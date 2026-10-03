/**
 * Walk ancestors of the Continue button and report pointer-events blockers.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;
const APP = "http://localhost:5173/lobby";

const profile = mkdtempSync(join(tmpdir(), "room5-pe-"));
const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--headless=new", "--no-first-run", "--disable-gpu", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* wait */ }
    await sleep(500);
  }
  throw new Error("no CDP target");
}

async function attach(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    return r.result.value;
  };
  return { send, evaluate, events };
}

const WALK = `(() => {
  const buttons = [...document.querySelectorAll('button')];
  const cont = buttons.find(b => (b.textContent || '').trim().toLowerCase().startsWith('continue'));
  if (!cont) return { error: 'no continue button', buttons: buttons.map(b => (b.textContent||'').trim()) };
  const chain = [];
  let el = cont;
  while (el && el !== document.documentElement.parentNode) {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    chain.push({
      tag: el.tagName,
      cls: String(el.getAttribute('class') || '').slice(0, 90),
      pointerEvents: cs.pointerEvents,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      position: cs.position,
      zIndex: cs.zIndex,
      overflow: cs.overflow,
      transform: cs.transform === 'none' ? 'none' : cs.transform.slice(0, 40),
      rect: Math.round(b.x) + ',' + Math.round(b.y) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height),
    });
    el = el.parentElement;
  }
  const r = cont.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  return {
    btnRect: Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height),
    center: Math.round(cx) + ',' + Math.round(cy),
    viewport: innerWidth + 'x' + innerHeight,
    willHit: document.elementFromPoint(cx, cy)?.tagName + '.' + String(document.elementFromPoint(cx, cy)?.className || '').slice(0, 40),
    chain,
  };
})()`;

(async () => {
  try {
    const cdp = await attach(await getTarget());
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: APP });
    await sleep(5000);

    const w = await cdp.evaluate(WALK);
    if (w.error) { console.log("ERROR:", w.error, "buttons:", w.buttons); return; }
    console.log(`viewport=${w.viewport}  button=${w.btnRect}  center=${w.center}`);
    console.log(`elementFromPoint(center) = ${w.willHit}\n`);
    console.log("ancestor chain (button -> html):");
    for (const a of w.chain) {
      const flag = a.pointerEvents !== "auto" ? "   <<<< BLOCKER (pointer-events)" : "";
      const flag2 = a.display === "none" || a.visibility === "hidden" ? "   <<<< HIDDEN" : "";
      console.log(`  ${a.tag.padEnd(6)} pe=${a.pointerEvents.padEnd(6)} pos=${a.position.padEnd(8)} z=${String(a.zIndex).padEnd(5)} op=${a.opacity.padEnd(4)} rect=${a.rect.padEnd(18)} [${a.cls}]${flag}${flag2}`);
    }

    // real click + see if POST fires
    const [cx, cy] = w.center.split(",").map(Number);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx, y: cy, button: "left", clickCount: 1 });
    await sleep(2500);
    const statuses = cdp.events
      .filter((e) => e.method === "Network.responseReceived" && e.params.response.url.includes("/api/guest"))
      .map((e) => String(e.params.response.status));
    console.log(`\nreal click -> /api/guest responses: [${statuses.join(", ") || "NONE"}]`);
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
})();

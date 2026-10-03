/**
 * Room5 layout/hit diagnostic: is the page shell a fixed, clipped,
 * viewport-sized overlay? Can Continue / the emoji picker be used?
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;
const APP = "http://localhost:5173/lobby";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch("http://127.0.0.1:" + PORT + "/json/list")).json();
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
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
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
  return { send, evaluate };
}

const TELEMETRY = `(() => {
  const root = document.getElementById('root');
  const shell = root && root.firstElementChild;
  const cs = shell ? getComputedStyle(shell) : null;
  const r = shell ? shell.getBoundingClientRect() : null;
  const cont = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim().toLowerCase().startsWith('continue'));
  const out = {
    innerH: window.innerHeight, scrollY: Math.round(window.scrollY),
    bodyScrollH: document.body.scrollHeight, htmlScrollH: document.documentElement.scrollHeight,
    shellCls: shell ? String(shell.className) : null,
    shellPosition: cs ? cs.position : null,
    shellOverflow: cs ? cs.overflow : null,
    shellPE: cs ? cs.pointerEvents : null,
    shellH: r ? Math.round(r.height) : null,
    hasContinue: !!cont,
  };
  if (cont) {
    const b = cont.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const els = document.elementsFromPoint(cx, cy);
    const stack = els.map((el) => el.tagName + (el.closest && el.closest('button') === cont ? '(BTN)' : ''));
    out.btn = Math.round(b.x) + ',' + Math.round(b.y) + ' ' + Math.round(b.width) + 'x' + Math.round(b.height);
    out.btnCenterOnScreen = cy >= 0 && cy <= window.innerHeight && cx >= 0 && cx <= window.innerWidth;
    out.stack5 = stack.slice(0, 5).join(' > ');
    out.btnReachable = stack.some((t) => t.includes("(BTN)"));
  }
  return out;
})()`;

const PICKER_BTN = `(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').toLowerCase().includes('emoji')
    || String(x.className || '').includes('aspect-square'));
  if (!b) return 'none';
  const r = b.getBoundingClientRect();
  return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) });
})()`;

const PICKER_STATE = `(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => (b.textContent || '').trim().length <= 3 && b.getBoundingClientRect().width > 10);
  const inView = btns.filter(b => { const r = b.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth; });
  const f = btns.find(b => b.getBoundingClientRect().width > 10);
  return { count: btns.length, fullyInView: inView.length,
    first: f ? (() => { const r = f.getBoundingClientRect(); return Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'px'; })() : null };
})()`;

async function scenario(width, height, label) {
  const profile = mkdtempSync(join(tmpdir(), "room5-diag-"));
  const edge = spawn(EDGE, [
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile,
    "--headless=new", "--no-first-run", "--disable-gpu",
    "--window-size=" + width + "," + height, "about:blank",
  ], { stdio: "ignore" });
  try {
    const cdp = await attach(await getTarget());
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: APP });
    await sleep(5000);

    console.log("\n########## " + label + " (" + width + "x" + height + ") ##########");
    console.log("layout :", JSON.stringify(await cdp.evaluate(TELEMETRY)));

    const at = await cdp.evaluate(PICKER_BTN);
    if (at && at.startsWith("{")) {
      const p = JSON.parse(at);
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
      await sleep(900);
      console.log("picker : clicked at " + p.x + "," + p.y + " ->", JSON.stringify(await cdp.evaluate(PICKER_STATE)));
    } else {
      console.log("picker : " + at);
    }
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

await scenario(1280, 900, "tall desktop");
await scenario(1366, 768, "typical laptop");
await scenario(756, 454, "short window");


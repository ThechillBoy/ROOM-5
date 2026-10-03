/**
 * Deep diagnostic: is the Continue button actually painted & hit-testable?
 * Prints ancestor chain (rects + clip/pointer-events/overflow) and saves a screenshot.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9337;
const profile = mkdtempSync(join(tmpdir(), "room5-deep-"));
const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--headless=new", "--no-first-run", "--disable-gpu", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
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

const DIAG = `(() => {
  const btn = [...document.querySelectorAll('button')]
    .find(b => (b.textContent || '').trim().toLowerCase().startsWith('continue'));
  if (!btn) return { error: 'Continue button not in DOM' };
  const r = btn.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const chain = [];
  for (let el = btn; el; el = el.parentElement) {
    const cs = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    chain.push({
      tag: el.tagName,
      cls: String(el.getAttribute('class') || '').slice(0, 55),
      rect: \`\${Math.round(b.x)},\${Math.round(b.y)} \${Math.round(b.width)}x\${Math.round(b.height)}\`,
      pos: cs.position, overflow: cs.overflow, pe: cs.pointerEvents,
      opacity: cs.opacity, transform: cs.transform === 'none' ? 'none' : 'yes',
      zIndex: cs.zIndex,
      coversPoint: b.left <= cx && b.right >= cx && b.top <= cy && b.bottom >= cy,
      elAtBtnCenter: (() => { const h = el.ownerDocument.elementFromPoint(cx, cy); return h === el ? 'SELF' : 'other'; })(),
    });
    if (el === document.documentElement) break;
  }
  return {
    viewport: \`\${window.innerWidth}x\${window.innerHeight}\`,
    scrollY: window.scrollY,
    docScrollHeight: document.documentElement.scrollHeight,
    rootCanScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    btnRect: \`\${Math.round(r.x)},\${Math.round(r.y)} \${Math.round(r.width)}x\${Math.round(r.height)}\`,
    btnCenter: \`\${Math.round(cx)},\${Math.round(cy)}\`,
    elementAtCenter: (() => { const h = document.elementFromPoint(cx, cy); return h ? h.tagName + '.' + String(h.getAttribute('class') || '').slice(0, 45) : 'NONE (nothing hit-testable here)'; })(),
    chain,
  };
})()`;

(async () => {
  try {
    const cdp = await attach(await getTarget());
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: "http://localhost:5173/lobby" });
    await sleep(5000);

    const d = await cdp.evaluate(DIAG);
    console.log("viewport:", d.viewport, "| scrollY:", d.scrollY,
      "| docScrollHeight:", d.docScrollHeight, "| root can scroll?", d.rootCanScroll);
    console.log("button rect:", d.btnRect, "center:", d.btnCenter);
    console.log("elementFromPoint(btn center):", d.elementAtCenter);
    console.log("\nancestor chain (button -> html):");
    for (const a of d.chain) {
      console.log(`  ${a.tag} [${a.cls}] rect=${a.rect} pos=${a.pos} overflow=${a.overflow} pe=${a.pe} op=${a.opacity} tf=${a.transform} z=${a.zIndex} coversCenter=${a.coversPoint}`);
    }

    const shot = await cdp.send("Page.captureScreenshot", { format: "png" });
    writeFileSync("E:\\room5\\diag-screenshot.png", Buffer.from(shot.data, "base64"));
    console.log("\nscreenshot -> E:\\room5\\diag-screenshot.png");
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
})();

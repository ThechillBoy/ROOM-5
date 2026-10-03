/**
 * Identify the exact element that intercepts clicks on the Continue button.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9334;
const APP = "http://localhost:5173/";

const profile = mkdtempSync(join(tmpdir(), "room5-hit-"));
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

async function connect(url) {
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
  const buttons = [...document.querySelectorAll('button')];
  const cont = buttons.find(b => (b.textContent || '').trim().toLowerCase().startsWith('continue'));
  if (!cont) return { error: 'no continue button' };
  const r = cont.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const stack = document.elementsFromPoint(cx, cy).map((el) => {
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      cls: String(el.getAttribute('class') || ''),
      inlineStyle: el.getAttribute('style') || '',
      position: cs.position,
      zIndex: cs.zIndex,
      pointerEvents: cs.pointerEvents,
      opacity: cs.opacity,
      rect: (() => { const b = el.getBoundingClientRect(); return \`\${Math.round(b.x)},\${Math.round(b.y)} \${Math.round(b.width)}x\${Math.round(b.height)}\`; })(),
      isButton: el === cont,
      isButtonChild: cont.contains(el),
    };
  });
  return {
    buttonRect: \`\${Math.round(r.x)},\${Math.round(r.y)} \${Math.round(r.width)}x\${Math.round(r.height)}\`,
    buttonCenter: \`\${Math.round(cx)},\${Math.round(cy)}\`,
    buttonZ: getComputedStyle(cont).zIndex,
    stack,
  };
})()`;

(async () => {
  try {
    const cdp = await connect(await getTarget());
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: APP });
    await sleep(4500);

    const diag = await cdp.evaluate(DIAG);
    console.log("button:", diag.buttonRect, "center:", diag.buttonCenter, "zIndex:", diag.buttonZ);
    console.log("\nstack at button center (topmost first):");
    for (const el of diag.stack) {
      const role = el.isButton ? "  <-- BUTTON" : el.isButtonChild ? "  <-- button child" : "";
      console.log(`  ${el.tag} [${el.cls.slice(0, 70)}] pos=${el.position} z=${el.zIndex} pe=${el.pointerEvents} op=${el.opacity} rect=${el.rect}${role}`);
      if (el.inlineStyle) console.log(`      style="${el.inlineStyle.slice(0, 120)}"`);
    }
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
})();

/**
 * Focused diagnosis: why does browser B not receive/send realtime messages?
 * Reads the live socket state out of the running app (Vite dev module import).
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9338;
const APP = "http://localhost:5173";

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

async function newPage(prefix) {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" });
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r2, rj) => { ws.onopen = r2; ws.onerror = rj; });
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
  const click = async (expr) => {
    const p = await evaluate(`(() => { const el = ${expr}; if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    if (!p) return false;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
    return true;
  };
  const type = async (expr, text) => {
    await evaluate(`(() => { const i = ${expr}; i.focus();
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input', { bubbles: true })); return i.value; })()`);
  };
  await send("Runtime.enable");
  await send("Page.enable");
  return { send, evaluate, click, type, close: () => ws.close(), name: prefix };
}

const BTN = (t) => `[...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().toLowerCase().startsWith(${JSON.stringify(t)}))`;
const NAME_INPUT = `[...document.querySelectorAll('input')].find(i => (i.placeholder||'').toLowerCase().includes('name'))`;

const SOCKET_STATE = `(async () => {
  const mod = await import('/src/services/socket.ts');
  const s = mod.getSocket();
  return {
    connected: s.connected, id: s.id || null, disconnected: s.disconnected,
    readyState: s.io ? s.io._readyState : 'n/a',
    transport: s.io && s.io.engine && s.io.engine.transport ? s.io.engine.transport.name : 'n/a',
  };
})()`;

const bodyText = (c) => c.evaluate("(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,150)");

(async () => {
  const edge = spawn(EDGE, [
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), "room5-b-"))}`,
    "--headless=new", "--no-first-run", "--disable-gpu", "--window-size=1280,900", "about:blank",
  ], { stdio: "ignore" });

  let A, B;
  try {
    await getTarget();
    A = await newPage("A");
    await A.send("Page.navigate", { url: `${APP}/lobby` });
    await sleep(4000);
    await A.type(NAME_INPUT, "Alpha");
    await A.click(BTN("continue"));
    await sleep(2500);
    await A.click(BTN("create room"));
    await sleep(3000);
    const code = await A.evaluate("window.location.pathname.split('/').pop()");
    console.log("room code:", code);
    console.log("A socket after room open:", JSON.stringify(await A.evaluate(SOCKET_STATE)));

    B = await newPage("B");
    await B.send("Page.navigate", { url: `${APP}/room/${code}` });
    await sleep(4000);
    console.log("B before join:", JSON.stringify(await bodyText(B)));
    await B.type(NAME_INPUT, "Beta");
    await B.click(BTN("join"));
    await sleep(3500);
    console.log("B after join :", JSON.stringify(await bodyText(B)));
    console.log("B socket after join:", JSON.stringify(await B.evaluate(SOCKET_STATE)));
    console.log("A socket now       :", JSON.stringify(await A.evaluate(SOCKET_STATE)));
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    if (A) A.close();
    if (B) B.close();
    edge.kill();
    await sleep(400);
  }
})();

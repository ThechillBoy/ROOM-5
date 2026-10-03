/** Step-verbose probe: guest -> create room -> send, measuring DOM bubbles
 *  immediately after optimistic add and after the server echo. */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9337;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "room5-dup2-"));
const edge = spawn(EDGE, [
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile,
  "--headless=new", "--no-first-run", "--disable-gpu", "--window-size=1280,900", "about:blank",
], { stdio: "ignore" });

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* wait */ }
    await sleep(500);
  }
  throw new Error("no target");
}

async function attach(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const events = [];
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
  const rect = (expr) => evaluate(
    `(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()`
  );
  const click = async (expr) => {
    const t = await rect(expr);
    if (!t) { console.log("  (click target not found: " + expr.slice(0, 60) + ")"); return false; }
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: t.x, y: t.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: t.x, y: t.y, button: "left", clickCount: 1 });
    return true;
  };
  const type = async (text) => {
    for (const ch of text) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
      await send("Input.dispatchKeyEvent", { type: "keyUp", text: ch });
      await sleep(35);
    }
  };
  const body = () => evaluate("(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,90)");
  return { send, evaluate, click, type, body, events };
}

const BUBBLES = (text) =>
  `(() => { const els = [...document.querySelectorAll('p,div,span')].filter(e => e.children.length === 0 && (e.textContent||'').trim() === ${JSON.stringify(text)}); return els.length; })()`;

const STORE = `(async () => {
  const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('roomStore'));
  if (!url) return { error: 'roomStore module not found in resource list' };
  const mod = await import(url);
  const s = mod.useRoomStore.getState();
  return {
    url: url.split('/').pop(),
    roomCode: s.room ? s.room.code : null,
    members: s.room ? s.room.members.length : null,
    count: s.messages.length,
    items: s.messages.map((x) => ({ id: String(x.id).slice(0, 10), tempId: x.tempId ?? null, text: x.content })),
  };
})()`;

try {
  const cdp = await attach(await target());
  await cdp.send("Runtime.enable");
  await cdp.send("Network.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url: "http://localhost:5173/lobby" });
  await sleep(4500);
  console.log("1) lobby:", JSON.stringify(await cdp.body()));

  await cdp.click("[...document.querySelectorAll('input')].find(i => (i.placeholder||'').toLowerCase().includes('name'))");
  await cdp.type("DupProbe");
  await cdp.click("[...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().startsWith('Continue'))");
  await sleep(3000);
  console.log("2) after continue:", JSON.stringify(await cdp.body()));

  await cdp.click("[...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().startsWith('Create Room'))");
  await sleep(3500);
  const dom = await cdp.evaluate("location.pathname");
  console.log("3) after create-room path:", dom, "| body:", JSON.stringify(await cdp.body()));
  console.log("   store:", JSON.stringify(await cdp.evaluate(STORE)));

  await cdp.click("document.querySelector('textarea')");
  await cdp.type("Probe message");
  await sleep(300);
  await cdp.click("[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Send message')");

  await sleep(150);
  console.log("\n4) t+150ms  bubbles=", await cdp.evaluate(BUBBLES("Probe message")), " store:", JSON.stringify(await cdp.evaluate(STORE)));
  await sleep(1800);
  console.log("5) t+1.95s bubbles=", await cdp.evaluate(BUBBLES("Probe message")), " store:", JSON.stringify(await cdp.evaluate(STORE)));
} catch (err) {
  console.error("ERR:", err.message);
} finally {
  edge.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}

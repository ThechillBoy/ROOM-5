/** Decisive probe: read the Zustand room store INSIDE the browser to see
 *  exactly what happens to the optimistic message when the server echo arrives. */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), "room5-dup-"));
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
  let id = 0; const pending = new Map();
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
    const t = await evaluate(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()`);
    if (!t) return false;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: t.x, y: t.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: t.x, y: t.y, button: "left", clickCount: 1 });
    return true;
  };
  const type = async (text) => {
    for (const ch of text) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
      await send("Input.dispatchKeyEvent", { type: "keyUp", text: ch });
      await sleep(30);
    }
  };
  return { send, evaluate, click, type };
}

const DUMP = `(async () => {
  const m = await import('/src/stores/roomStore.ts');
  const s = m.useRoomStore.getState();
  return {
    members: s.room ? s.room.members.map((x) => x.guest.name) : null,
    pending: [...s.pendingMessages.keys()],
    messages: s.messages.map((x) => ({ id: String(x.id).slice(0, 14), tempId: x.tempId ?? null, content: x.content, createdAt: String(x.createdAt) })),
  };
})()`;

try {
  const cdp = await attach(await target());
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Page.navigate", { url: "http://localhost:5173/lobby" });
  await sleep(4500);

  // guest
  await cdp.click("[...document.querySelectorAll('input')].find(i => (i.placeholder||'').toLowerCase().includes('name'))");
  await cdp.type("DupProbe");
  await cdp.click("[...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().startsWith('Continue'))");
  await sleep(3000);
  // room
  await cdp.click("[...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().startsWith('Create Room'))");
  await sleep(3500);
  console.log("joined:", JSON.stringify(await cdp.evaluate(`(async () => { const m = await import('/src/stores/roomStore.ts'); const s = m.useRoomStore.getState(); return { code: s.room?.code, members: s.room?.members.length }; })()`)));

  // send a message
  await cdp.click("document.querySelector('textarea')");
  await cdp.type("Probe message");
  await sleep(300);
  await cdp.click("[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Send message')");

  await sleep(120);
  console.log("\n--- t+120ms (optimistic added?) ---");
  console.log(JSON.stringify(await cdp.evaluate(DUMP), null, 1));
  await sleep(1600);
  console.log("\n--- t+1.7s (after server echo) ---");
  console.log(JSON.stringify(await cdp.evaluate(DUMP), null, 1));
} catch (err) {
  console.error("ERR:", err.message);
} finally {
  edge.kill();
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}

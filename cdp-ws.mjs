/**
 * Room5 WebSocket diagnostic — captures raw socket.io frames for the JOINING guest
 * to prove whether B's socket actually enters the room.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const APP = "http://localhost:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Page {
  constructor(name, port) { this.name = name; this.port = port; this.frames = []; }
  async start() {
    this.profile = mkdtempSync(join(tmpdir(), `room5-ws-${this.name}-`));
    this.proc = spawn(EDGE, [
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.profile}`,
      "--headless=new", "--no-first-run", "--disable-gpu", "about:blank",
    ], { stdio: "ignore" });
    const wsUrl = await this.#target();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method === "Network.webSocketFrameSent") {
        this.frames.push({ dir: ">>", data: msg.params.response.payloadData });
      } else if (msg.method === "Network.webSocketFrameReceived") {
        this.frames.push({ dir: "<<", data: msg.params.response.payloadData });
      } else if (msg.method === "Network.webSocketCreated") {
        this.frames.push({ dir: "--", data: `WS CREATED ${msg.params.url}` });
      } else if (msg.method === "Network.webSocketClosed") {
        this.frames.push({ dir: "--", data: "WS CLOSED" });
      }
    };
    await this.send("Runtime.enable");
    await this.send("Network.enable");
    await this.send("Page.enable");
  }
  async #target() {
    for (let i = 0; i < 40; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
        const page = list.find((t) => t.type === "page");
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      } catch { /* wait */ }
      await sleep(500);
    }
    throw new Error(`${this.name}: no CDP target`);
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      this.pending.set(++this.id, { resolve, reject });
      this.ws.send(JSON.stringify({ id: this.id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    return r.result.value;
  }
  async realClick(x, y) {
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
  stop() { try { this.proc.kill(); } catch { /* ignore */ } try { rmSync(this.profile, { recursive: true, force: true }); } catch { /* ignore */ } }
}

const findByText = (text) => `(() => {
  const el = [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().toLowerCase().startsWith('${text}'));
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { cx: r.left + r.width/2, cy: r.top + r.height/2, label: (el.textContent||'').trim(), disabled: el.disabled };
})()`;

const typeName = (name) => `(() => {
  const i = [...document.querySelectorAll('input')].find(x => (x.placeholder||'').toLowerCase().includes('name'));
  if (!i) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(i, '${name}');
  i.dispatchEvent(new Event('input', { bubbles: true }));
  return i.value;
})()`;


async function run() {
  const A = new Page("A", 9341);
  const B = new Page("B", 9342);
  try {
    await A.start();
    await A.send("Page.navigate", { url: APP });
    await sleep(4500);
    console.log("A name typed:", await A.evaluate(typeName("Alpha")));
    let btn = await A.evaluate(findByText("continue"));
    await A.realClick(btn.cx, btn.cy);
    await sleep(3000);

    btn = await A.evaluate(findByText("create room"));
    console.log("A create-room button:", JSON.stringify(btn));
    await A.realClick(btn.cx, btn.cy);
    await sleep(3500);
    const roomUrl = await A.evaluate("location.href");
    console.log("A room url:", roomUrl);

    await B.start();
    await B.send("Page.navigate", { url: roomUrl });
    await sleep(4500);
    console.log("B name typed:", await B.evaluate(typeName("Beta")));
    btn = await B.evaluate(findByText("join room"));
    console.log("B join button:", JSON.stringify(btn));
    const beforeJoin = B.frames.length;
    await B.realClick(btn.cx, btn.cy);
    await sleep(4000);
    console.log("B body after join:", (await B.evaluate("document.body.innerText")).replace(/\s+/g, " ").slice(0, 160));

    const sendBox = `(() => {
      const ta = document.querySelector('textarea') || [...document.querySelectorAll('input')].find(i => (i.placeholder||'').toLowerCase().includes('message'));
      if (!ta) return null;
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value').set;
      setter.call(ta, 'HELLO-FROM-B');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const r = ta.getBoundingClientRect();
      return { cx: r.left + r.width/2, cy: r.top + r.height/2 };
    })()`;
    const box = await B.evaluate(sendBox);
    console.log("B message box:", JSON.stringify(box));
    if (box) await B.realClick(box.cx, box.cy);
    await sleep(300);
    const sendBtn = await B.evaluate(`(() => {
      const el = [...document.querySelectorAll('button')].find(b => /send/i.test(b.textContent||''));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { cx: r.left + r.width/2, cy: r.top + r.height/2, label: (el.textContent||'').trim(), disabled: el.disabled };
    })()`);
    console.log("B send button:", JSON.stringify(sendBtn));
    if (sendBtn) await B.realClick(sendBtn.cx, sendBtn.cy);
    await sleep(3500);

    console.log("\n=== B WebSocket frames (from join click onwards) ===");
    for (const f of B.frames.slice(beforeJoin)) {
      console.log(`${f.dir} ${f.data.slice(0, 240)}`);
    }
    console.log("\nB final body:", (await B.evaluate("document.body.innerText")).replace(/\s+/g, " ").slice(0, 200));
    console.log("A final body:", (await A.evaluate("document.body.innerText")).replace(/\s+/g, " ").slice(0, 200));
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    A.stop();
    B.stop();
    await sleep(300);
  }
}

run();

/**
 * Room5 socket transport diagnostic — captures socket.io events over BOTH
 * polling (HTTP bodies) and WebSocket, for the joining guest (B).
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
    this.profile = mkdtempSync(join(tmpdir(), `room5-sock-${this.name}-`));
    this.proc = spawn(EDGE, [
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.profile}`,
      "--headless=new", "--no-first-run", "--disable-gpu", "about:blank",
    ], { stdio: "ignore" });
    const wsUrl = await this.#target();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        return;
      }
      const p = msg.params;
      if (msg.method === "Network.webSocketFrameSent") this.frames.push(`WS>> ${p.response.payloadData.slice(0, 200)}`);
      else if (msg.method === "Network.webSocketFrameReceived") this.frames.push(`WS<< ${p.response.payloadData.slice(0, 200)}`);
      else if (msg.method === "Network.requestWillBeSent" && String(p.request.url).includes("/socket.io/")) {
        const body = p.request.postData ? p.request.postData.slice(0, 200) : "(no body)";
        this.frames.push(`HTTP>> ${new URL(p.request.url).search} ${body}`);
      } else if (msg.method === "Network.responseReceived" && String(p.response.url).includes("/socket.io/")) {
        this.frames.push(`HTTP<< ${p.response.status} ${new URL(p.response.url).search}`);
      } else if (msg.method === "Network.loadingFinished" || msg.method === "Network.webSocketClosed") {
        this.frames.push(`-- ${msg.method.endsWith("Closed") ? "WS CLOSED" : "req finished"} ${p.requestId?.slice(0, 8) ?? ""}`);
      } else if (msg.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "warning")) {
        const text = (p.args || []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 220);
        this.frames.push(`CONSOLE[${p.type}] ${text}`);
      } else if (msg.method === "Network.loadingFailed" && p.type === "Fetch") {
        this.frames.push(`FAILED ${p.errorText}`);
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
  mark() { return this.frames.length; }
  stop() { try { this.proc.kill(); } catch {} try { rmSync(this.profile, { recursive: true, force: true }); } catch {} }
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
  const A = new Page("A", 9351);
  const B = new Page("B", 9352);
  try {
    await A.start();
    await A.send("Page.navigate", { url: APP });
    await sleep(4500);
    await A.evaluate(typeName("Alpha"));
    let btn = await A.evaluate(findByText("continue"));
    await A.realClick(btn.cx, btn.cy);
    await sleep(3000);
    btn = await A.evaluate(findByText("create room"));
    await A.realClick(btn.cx, btn.cy);
    await sleep(4000);
    const roomUrl = await A.evaluate("location.href");
    console.log("room:", roomUrl);

    await B.start();
    await B.send("Page.navigate", { url: roomUrl });
    await sleep(4500);
    await B.evaluate(typeName("Beta"));
    const bJoinMark = B.mark();
    btn = await B.evaluate(findByText("join room"));
    await B.realClick(btn.cx, btn.cy);
    await sleep(5000);
    console.log("B body:", (await B.evaluate("document.body.innerText")).replace(/\s+/g, " ").slice(0, 120));

    const aBox = await A.evaluate("(() => { const ta = document.querySelector('textarea'); if (!ta) return null; const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), 'value').set; setter.call(ta, 'PING-FROM-A'); ta.dispatchEvent(new Event('input', { bubbles: true })); const r = ta.getBoundingClientRect(); return { cx: r.left + r.width/2, cy: r.top + r.height/2 }; })()");
    if (aBox) { await A.realClick(aBox.cx, aBox.cy); await sleep(300); }
    const aSend = await A.evaluate("(() => { const el = [...document.querySelectorAll('button')].find(b => /send/i.test(b.textContent||'')); if (!el) return null; const r = el.getBoundingClientRect(); return { cx: r.left + r.width/2, cy: r.top + r.height/2, label: (el.textContent||'').trim(), disabled: el.disabled }; })()");
    console.log("A send button:", JSON.stringify(aSend));
    if (aSend) await A.realClick(aSend.cx, aSend.cy);
    await sleep(4000);

    const bText = await B.evaluate("document.body.innerText");
    console.log("B sees PING-FROM-A:", bText.includes("PING-FROM-A"));
    console.log("B body:", bText.replace(/\s+/g, " ").slice(0, 150));
    console.log("A body:", (await A.evaluate("document.body.innerText")).replace(/\s+/g, " ").slice(0, 160));

    console.log("\n=== B socket.io traffic (from join click onwards) ===");
    for (const f of B.frames.slice(bJoinMark)) console.log(f);
    console.log("\n=== A socket.io traffic (last 20) ===");
    for (const f of A.frames.slice(-20)) console.log(f);
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    A.stop(); B.stop();
    await sleep(300);
  }
}

run();


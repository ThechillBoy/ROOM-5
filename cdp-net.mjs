/**
 * Network-level truth for socket.io + real 2-browser realtime test.
 * Two separate Edge instances (separate profiles => separate guests/sessions).
 * Captures engine.io polling/WS traffic per page and verifies realtime delivery.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const APP = "http://localhost:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Page {
  constructor(ws, label) {
    this.ws = ws; this.label = label; this.id = 0; this.pending = new Map(); this.net = [];
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        this.net.push(msg);
      }
    };
  }
  static async attach(wsUrl, label) {
    const ws = new WebSocket(wsUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    const p = new Page(ws, label);
    await p.send("Runtime.enable");
    await p.send("Network.enable");
    await p.send("Page.enable");
    return p;
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
  async click(expr) {
    const p = await this.evaluate(`(() => { const el = ${expr}; if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    if (!p) throw new Error(`element not found: ${expr}`);
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
  }
  async type(expr, text) {
    await this.evaluate(`(() => { const i = ${expr}; if (!i) throw new Error('input not found');
      i.focus();
      const proto = i.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const s = Object.getOwnPropertyDescriptor(proto, 'value').set;
      s.call(i, ${JSON.stringify(text)}); i.dispatchEvent(new Event('input', { bubbles: true })); return i.value; })()`);
  }
  async enter(expr) {
    await this.evaluate(`(() => { const i = ${expr}; if (!i) throw new Error('input not found'); i.focus(); return true; })()`);
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  }
  body() { return this.evaluate("(document.body.innerText||'').replace(/\\s+/g,' ')"); }
  url() { return this.evaluate("window.location.pathname"); }
  socketioTraffic() {
    const out = [];
    for (const e of this.net) {
      const url = e.params?.request?.url || e.params?.response?.url || "";
      if (!url.includes("/socket.io/")) continue;
      if (e.method === "Network.requestWillBeSent") out.push(`REQ  ${e.params.request.method} ${url.slice(0, 60)}`);
      if (e.method === "Network.responseReceived") out.push(`RES  ${e.params.response.status} ${url.slice(0, 60)}`);
      if (e.method === "Network.loadingFailed") out.push(`FAIL ${e.params.errorText}`);
      if (e.method === "Network.webSocketCreated") out.push(`WS   ${url.slice(0, 60)}`);
      if (e.method === "Network.webSocketClosed") out.push(`WSCLOSE`);
      if (e.method === "Network.webSocketFrameReceived") out.push(`WS>  ${String(e.params.response.payloadData).slice(0, 80)}`);
      if (e.method === "Network.webSocketFrameError") out.push(`WSERR ${e.params.errorMessage}`);
    }
    return out;
  }
}


async function launchBrowser(port, prefix) {
  const profile = mkdtempSync(join(tmpdir(), prefix));
  const proc = spawn(EDGE, [
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    "--headless=new", "--no-first-run", "--disable-gpu", "--window-size=1280,900", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const p = list.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return { proc, profile, wsUrl: p.webSocketDebuggerUrl };
    } catch { /* wait */ }
    await sleep(500);
  }
  throw new Error("browser did not start on port " + port);
}

const BTN = (t) => `[...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().toLowerCase().startsWith(${JSON.stringify(t)}))`;
const NAME_INPUT = `[...document.querySelectorAll('input')].find(i => (i.placeholder||'').toLowerCase().includes('name'))`;
const MSG_INPUT = `[...document.querySelectorAll('textarea,input')].find(i => (i.placeholder||'').toLowerCase().includes('message'))`;

const results = [];
const check = (n, pass, detail = "") => {
  results.push({ n, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${n}${detail ? " — " + detail : ""}`);
};

(async () => {
  let bA, bB, A, B;
  try {
    bA = await launchBrowser(9401, "room5-A-");
    bB = await launchBrowser(9402, "room5-B-");
    A = await Page.attach(bA.wsUrl, "A");
    B = await Page.attach(bB.wsUrl, "B");

    console.log("=== A: create room ===");
    await A.send("Page.navigate", { url: `${APP}/lobby` });
    await sleep(4500);
    await A.type(NAME_INPUT, "Alpha");
    await A.click(BTN("continue"));
    await sleep(2500);
    check("A proceeds to lobby after Continue", /welcome back/i.test(await A.body()));
    await A.click(BTN("create room"));
    await sleep(4000);
    const code = await A.evaluate("window.location.pathname.split(\'/\').pop()");
    check("A create room -> room page", /^[A-Z0-9]{6}$/.test(code), `code=${code}`);

    console.log("\n=== B: open same link, join ===");
    await B.send("Page.navigate", { url: `${APP}/room/${code}` });
    await sleep(4500);
    const hasNameB = await B.evaluate(`!!(${NAME_INPUT})`);
    check("B sees join form", hasNameB);
    await B.type(NAME_INPUT, "Beta");
    await B.click(BTN("join"));
    await sleep(4000);
    check("B lands in the same room", (await B.body()).includes(code), `url=${await B.url()}`);

    console.log("\n=== realtime chat ===");
    await A.type(MSG_INPUT, "Hello-N");
    await A.enter(MSG_INPUT);
    await sleep(2500);
    check("A->B: B receives Hello-N without refresh", (await B.body()).includes("Hello-N"));
    await B.type(MSG_INPUT, "Hi-N");
    await B.enter(MSG_INPUT);
    await sleep(2500);
    check("B->A: A receives Hi-N without refresh", (await A.body()).includes("Hi-N"));

    const aBody = await A.body();
    const bBody = await B.body();
    check("exactly once (A)", (aBody.match(/Hello-N/g) || []).length === 1 && (aBody.match(/Hi-N/g) || []).length === 1,
      `A Hello=${(aBody.match(/Hello-N/g) || []).length} Hi=${(aBody.match(/Hi-N/g) || []).length}`);
    check("exactly once (B)", (bBody.match(/Hello-N/g) || []).length === 1 && (bBody.match(/Hi-N/g) || []).length === 1,
      `B Hello=${(bBody.match(/Hello-N/g) || []).length} Hi=${(bBody.match(/Hi-N/g) || []).length}`);

    console.log("\n=== refresh / history ===");
    await B.send("Page.reload", { ignoreCache: true });
    await sleep(4500);
    const bAfter = await B.body();
    check("B refresh: no username prompt", !(await B.evaluate(`!!(${NAME_INPUT})`)));
    check("B refresh: history intact", bAfter.includes("Hello-N") && bAfter.includes("Hi-N"));
    check("B refresh: no duplicates", (bAfter.match(/Hello-N/g) || []).length === 1 && (bAfter.match(/Hi-N/g) || []).length === 1);

    console.log("\n--- socket.io traffic A ---");
    for (const line of A.socketioTraffic().slice(0, 12)) console.log("  " + line);
    console.log("--- socket.io traffic B ---");
    for (const line of B.socketioTraffic().slice(0, 12)) console.log("  " + line);

    console.log(`\n===== ${results.filter((r) => r.pass).length}/${results.length} PASSED =====`);
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    for (const b of [bA, bB]) {
      if (b) { b.proc.kill(); try { rmSync(b.profile, { recursive: true, force: true }); } catch {} }
    }
    await sleep(400);
  }
})();

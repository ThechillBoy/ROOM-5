/** Focused presence + duplicate-message probe with a real desktop viewport. */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://localhost:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findTarget(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* wait */ }
    await sleep(500);
  }
  throw new Error("no CDP target on " + port);
}

class Page {
  constructor(port, tag, proc, profile) {
    this.port = port; this.tag = tag; this.proc = proc; this.profile = profile;
    this.id = 0; this.pending = new Map(); this.events = [];
  }
  static async launch(port, tag, w = 1400, h = 900) {
    const profile = mkdtempSync(join(tmpdir(), "room5-" + tag + "-"));
    const proc = spawn(EDGE, [
      "--remote-debugging-port=" + port, "--user-data-dir=" + profile,
      "--headless=new", "--no-first-run", "--disable-gpu",
      "--window-size=" + w + "," + h, "about:blank",
    ], { stdio: "ignore" });
    const page = new Page(port, tag, proc, profile);
    const ws = new WebSocket(await findTarget(port));
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    page.ws = ws;
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && page.pending.has(msg.id)) {
        const { resolve, reject } = page.pending.get(msg.id);
        page.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) page.events.push(msg);
    };
    await page.send("Runtime.enable");
    await page.send("Network.enable");
    await page.send("Page.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    return page;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    return r.result.value;
  }
  async goto(url) { await this.send("Page.navigate", { url }); await sleep(4200); }
  body() { return this.evaluate("(document.body.innerText||'').replace(/\\s+/g,' ') "); }
  async waitText(str, ms = 12000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if ((await this.body()).includes(str)) return true;
      await sleep(400);
    }
    return false;
  }
  async waitPath(re, ms = 12000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      const p = await this.evaluate("location.pathname");
      if (re.test(p)) return p;
      await sleep(300);
    }
    return await this.evaluate("location.pathname");
  }
  async type(selector, value) {
    await this.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (el) el.focus(); return true; })()`);
    for (const ch of value) {
      await this.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
      await this.send("Input.dispatchKeyEvent", { type: "keyUp", text: ch });
      await sleep(30);
    }
  }
  async clickText(label) {
    const info = await this.evaluate(`(() => {
      const cands = [...document.querySelectorAll('button,a,[role=button]')];
      const el = cands.find(b => (b.textContent || '').trim().toLowerCase().startsWith(${JSON.stringify(label.toLowerCase())}));
      if (!el) return { found: false };
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return { found: true, label: (el.textContent || '').trim(), cx, cy,
        blocked: !(top === el || el.contains(top)),
        topAt: top ? top.tagName + '.' + String(top.className || '').slice(0, 30) : 'none' };
    })()`);
    if (!info.found) return { found: false };
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x: info.cx, y: info.cy, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: info.cx, y: info.cy, button: "left", clickCount: 1 });
    return info;
  }
  cap() {
    return this.evaluate("(document.body.innerText.match(/\\d\\s*\\/\\s*5/) || ['none'])[0]");
  }
  names() {
    return this.evaluate(`(() => {
      const el = document.querySelector('[aria-label="Room members"]');
      return el ? (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 120) : 'sidebar-not-found';
    })()`);
  }
  count(str) {
    return this.evaluate(`(document.body.innerText.split(${JSON.stringify(str)}).length - 1)`);
  }
  html(selector) {
    return this.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.outerHTML.slice(0, 1200) : 'not-found'; })()`);
  }
  errors() {
    return this.events.filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error")
      .map((e) => (e.params.args || []).map((a) => a.value ?? a.description).join(" ").slice(0, 120));
  }
  close() { if (this.proc) this.proc.kill(); }
}

const NAME_INPUT = 'input[placeholder*="name" i]';
const TEXTAREA = "textarea";

let A, B;
try {
  console.log("--- A: fresh guest -> lobby -> create room ---");
  A = await Page.launch(9338, "PA");
  await A.goto(BASE + "/lobby");
  console.log("form visible:", await A.waitText("Display Name"));
  await A.type(NAME_INPUT, "Alpha");
  await A.clickText("continue");
  console.log("lobby reached:", await A.waitText("Create a private chat room"));
  const created = await A.clickText("create room");
  console.log("create click:", JSON.stringify(created));
  const path = await A.waitPath(/\/room\/[A-Z0-9]{6}/i);
  const code = (path.match(/\/room\/([A-Z0-9]{6})/i) || [])[1];
  console.log("room:", code, "| A cap:", await A.cap(), "| A names:", await A.names());

  console.log("\n--- B: opens shared link, joins ---");
  B = await Page.launch(9339, "PB");
  await B.goto(BASE + "/room/" + code);
  console.log("join form visible:", await B.waitText("Display Name"));
  await B.type(NAME_INPUT, "Beta");
  const joinClick = await B.clickText("join");
  console.log("join click:", JSON.stringify(joinClick));
  console.log("B has textarea:", await B.evaluate("!!document.querySelector('textarea')"));
  console.log("B nested guest form visible:", await B.waitText("Display Name", 3000));

  console.log("\n--- presence polling (1s x 8) ---");
  for (let i = 0; i < 8; i++) {
    await sleep(1000);
    console.log(
      `t+${i + 1}s  A cap=${await A.cap()}  A names="${await A.names()}"` +
      `  ||  B cap=${await B.cap()}  B names="${await B.names()}"`
    );
  }

  console.log("\n--- chat: A sends, duplicate check on A ---");
  const MSG = "PresenceProbe";
  await A.type(TEXTAREA, MSG);
  const send = await A.evaluate(`(() => {
    const el = document.querySelector('button[aria-label="Send message"]');
    if (!el) return { found: false };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return { found: true, cx, cy, blocked: !(top === el || el.contains(top)),
      topAt: top ? top.tagName + '.' + String(top.className || '').slice(0, 30) : 'none' };
  })()`);
  console.log("send hit-test:", JSON.stringify(send));
  if (send.found) {
    await A.send("Input.dispatchMouseEvent", { type: "mousePressed", x: send.cx, y: send.cy, button: "left", clickCount: 1 });
    await A.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: send.cx, y: send.cy, button: "left", clickCount: 1 });
  }
  await sleep(3000);
  console.log("A msg count:", await A.count(MSG), "| B msg count:", await B.count(MSG));
  const list = await A.evaluate(`(() => {
    const els = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent || '').trim() === ${JSON.stringify("PresenceProbe")});
    return els.map(e => { const b = e.closest('[class*="rounded"]'); return b ? String(b.className).slice(0, 70) : e.tagName; });
  })()`);
  console.log("A bubbles containing msg:", JSON.stringify(list));
  console.log("A console errors:", JSON.stringify((await A.errors()).slice(0, 2)));
  console.log("B console errors:", JSON.stringify((await B.errors()).slice(0, 2)));
} catch (err) {
  console.error("PROBE ERROR:", err.message);
} finally {
  if (A) A.close();
  if (B) B.close();
  await sleep(400);
  for (const p of [A, B]) if (p) { try { rmSync(p.profile, { recursive: true, force: true }); } catch { /* ignore */ } }
}


async function runFlow() {
  let A, B;
  try {
    console.log("=== BROWSER A (fresh) ===");
    A = await Page.launch(9336, "A");
    await A.goto(`${BASE}/lobby`);

    const formUp = await A.waitForText("Display Name");
    check("A1: onboarding form appears", formUp, `body="${(await A.body()).replace(/\s+/g, " ").slice(0, 90)}"`);
    await A.type(NAME_INPUT, "Alpha");

    const contLabel = await A.clickText("Continue");
    const inLobby = await A.waitForText("Create a private chat room");
    check("A2: Continue click -> lobby", inLobby,
      `clicked="${contLabel}" body="${(await A.body()).replace(/\s+/g, " ").slice(0, 90)}"`);

    const createLabel = await A.clickText("Create Room");
    const path = await A.waitForPath(/\/room\/[A-Z0-9]{6}/i);
    const code = (path.match(/\/room\/([A-Z0-9]{6})/i) || [])[1];
    check("A3: Create Room click -> room opens", !!code, `clicked="${createLabel}" path=${path}`);
    check("A4: capacity indicator present", (await A.count("/5")) > 0, `body has "/5"`);

    console.log("\n=== BROWSER B (opens the shared link) ===");
    B = await Page.launch(9337, "B");
    await B.goto(`${BASE}/room/${code}`);
    const bForm = await B.waitForText("Display Name");
    check("B1: join form appears for new guest", bForm);
    await B.type(NAME_INPUT, "Beta");
    await B.clickText("Join");
    const bInRoom = await B.waitForText("Type a message");
    check("B2: Join click -> same room opens", bInRoom,
      `body="${(await B.body()).replace(/\s+/g, " ").slice(0, 90)}"`);
    check("B3: A sees B join (2/5)", await A.waitForText("Beta", 8000));

    console.log("\n=== CHAT (A -> B) ===");
    const MSG_A = "Hello from Alpha";
    await A.type(TEXTAREA, MSG_A);
    await clickSelector(A, 'button[aria-label="Send message"]');
    check("C1: A send -> B receives instantly", await B.waitForText(MSG_A, 10000));
    check("C2: B sees it exactly once", (await B.count(MSG_A)) === 1, `count=${await B.count(MSG_A)}`);
    check("C3: A sees own message exactly once", (await A.count(MSG_A)) === 1, `count=${await A.count(MSG_A)}`);
console.log("   [debug] A bubbles:", JSON.stringify(await A.cdp.evaluate(
  "[...document.querySelectorAll('p.whitespace-pre-wrap')].map(e => e.textContent.slice(0,20))"
)));

    console.log("\n=== CHAT (B -> A, Enter key) ===");
    const MSG_B = "Hi from Beta";
    await B.type(TEXTAREA, MSG_B);
    await pressEnter(B);
    check("C4: B send (Enter) -> A receives instantly", await A.waitForText(MSG_B, 10000));
    check("C5: A sees it exactly once", (await A.count(MSG_B)) === 1, `count=${await A.count(MSG_B)}`);
    check("C6: B sees own message exactly once", (await B.count(MSG_B)) === 1, `count=${await B.count(MSG_B)}`);
console.log("   [debug] B bubbles:", JSON.stringify(await B.cdp.evaluate(
  "[...document.querySelectorAll('p.whitespace-pre-wrap')].map(e => e.textContent.slice(0,20))"
)));
console.log("   [debug] B body:", (await B.cdp.evaluate("document.body.innerText")).replace(/\s+/g, " ").slice(0, 260));

    console.log("\n=== REFRESH / HISTORY ===");
    await A.reload();
    check("D1: history survives refresh (A's message)", await A.waitForText(MSG_A, 15000));
    check("D2: history survives refresh (B's message)", await A.waitForText(MSG_B, 8000));
    check("D3: refresh does NOT ask for username again", !(await A.body()).includes("Display Name"));
    check("D4: no duplicate messages after refresh",
      (await A.count(MSG_A)) === 1 && (await A.count(MSG_B)) === 1,
      `A=${await A.count(MSG_A)} B=${await A.count(MSG_B)}`);

    console.log("\n=== CONSOLE ===");
    const errs = [...A.consoleErrors(), ...B.consoleErrors()];
    check("E1: no browser console errors", errs.length === 0, errs.slice(0, 3).join(" | ") || "none");
    console.log("[debug] A raw console:", JSON.stringify(A.rawConsole(), null, 1).slice(0, 2000));
    const wsNew = A.raw.events.filter((e) => e.method === "Network.webSocketFrameReceived" &&
      String(e.params?.response?.payloadData || "").includes("message:new"));
    const wsSent = A.raw.events.filter((e) => e.method === "Network.webSocketFrameSent" &&
      String(e.params?.response?.payloadData || "").includes("message:send"));
    console.log(`[debug] A WS frames: sent(message:send)=${wsSent.length} recv(message:new)=${wsNew.length}`);
    console.log("[debug] A recv payloads:", JSON.stringify(wsNew.map((f) => String(f.params.response.payloadData).slice(0, 150))));

    const passed = results.filter((r) => r.pass).length;
    console.log(`\n===== ${passed}/${results.length} PASSED =====`);
    console.log(`room code used: ${code}`);
    process.exitCode = passed === results.length ? 0 : 1;
  } catch (err) {
    console.error("\nFLOW ERROR:", err.message);
    process.exitCode = 1;
  } finally {
    if (A) A.close();
    if (B) B.close();
  }
}

/** Real click on a specific element found by CSS selector (hit-test verified). */
async function clickSelector(page, selector) {
  const found = await page.cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { found: false };
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      found: true, cx, cy,
      disabled: !!el.disabled,
      blocked: !(top === el || el.contains(top)),
      topAt: top ? top.tagName + '.' + String(top.className || '').slice(0, 40) : null,
    };
  })()`);
  if (!found.found) throw new Error(`selector not found: ${selector}`);
  if (found.disabled) throw new Error(`element is disabled: ${selector}`);
  if (found.blocked) throw new Error(`element covered by ${found.topAt}: ${selector}`);
  await page.cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: found.cx, y: found.cy, button: "left", clickCount: 1 });
  await page.cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: found.cx, y: found.cy, button: "left", clickCount: 1 });
}

/** Real Enter keypress in the message textarea. */
async function pressEnter(page) {
  const base = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  await page.cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...base, text: "\r" });
  await page.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
}


/**
 * Room5 E2E — real browser clicks/typing (no el.click() shortcuts).
 * Flow: A form -> Continue -> lobby -> Create Room -> room
 *       B room link -> Join Room -> same room
 *       A sends -> B sees once ; B sends -> A sees once
 *       A reload -> history kept, no username prompt
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = "http://localhost:5173";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};

class Page {
  constructor(cdp, label) { this.cdp = cdp; this.label = label; }

  static async launch(port, label) {
    const profile = mkdtempSync(join(tmpdir(), `room5-${label}-`));
    const proc = spawn(EDGE, [
      `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
      "--headless=new", "--no-first-run", "--disable-gpu", "--window-size=1280,900",
      "about:blank",
    ], { stdio: "ignore" });

    let wsUrl = null;
    for (let i = 0; i < 40 && !wsUrl; i++) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        wsUrl = list.find((t) => t.type === "page")?.webSocketDebuggerUrl ?? null;
      } catch { /* wait */ }
      if (!wsUrl) await sleep(500);
    }
    if (!wsUrl) throw new Error(`${label}: no CDP target`);

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    const raw = { events: [] };
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) raw.events.push(msg);
    };
    const cdp = {
      send: (method, params = {}) => new Promise((resolve, reject) => {
        pending.set(++id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      }),
    };
    cdp.evaluate = async (expression) => {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
      return r.result.value;
    };
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");

    const p = new Page(cdp, label);
    p.proc = proc;
    p.profile = profile;
    p.raw = raw;
    return p;
  }

  async goto(url) {
    this.raw.events.length = 0;
    await this.cdp.send("Page.navigate", { url });
  }

  async reload() { await this.cdp.send("Page.reload", { ignoreCache: false }); }

  body() { return this.cdp.evaluate("document.body.innerText || ''"); }

  async waitForText(needle, timeoutMs = 12000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if ((await this.body()).includes(needle)) return true;
      await sleep(400);
    }
    return false;
  }

  async waitForPath(re, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const p = await this.cdp.evaluate("location.pathname");
      if (re.test(p)) return p;
      await sleep(400);
    }
    return await this.cdp.evaluate("location.pathname");
  }

  count(text) {
    return this.cdp.evaluate(
      `(document.body.innerText || '').split(${JSON.stringify(text)}).length - 1`
    );
  }

  /** Real mouse click on the first visible element whose text matches. */
  async clickText(text) {
    const found = await this.cdp.evaluate(`(() => {
      const want = ${JSON.stringify(text.toLowerCase())};
      const els = [...document.querySelectorAll('button, a, [role=button]')];
      const el = els.find(e => {
        const t = (e.textContent || '').trim().toLowerCase();
        return t.includes(want) && getComputedStyle(e).pointerEvents !== 'none' && e.offsetParent !== null;
      });
      if (!el) return { found: false, buttons: els.map(e => (e.textContent||'').trim().slice(0,26)) };
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return {
        found: true, cx, cy,
        label: (el.textContent || '').trim().slice(0, 30),
        blocked: !(top === el || el.contains(top)),
        topAt: top ? top.tagName + '.' + String(top.className || '').slice(0, 40) : null,
      };
    })()`);
    if (!found.found) throw new Error(`"${text}" not found (visible: ${JSON.stringify(found.buttons)})`);
    if (found.blocked) throw new Error(`"${text}" is covered by ${found.topAt}`);
    await this.cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: found.cx, y: found.cy, button: "left", clickCount: 1 });
    await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: found.cx, y: found.cy, button: "left", clickCount: 1 });
    return found.label;
  }

  /** Real typing into a React-controlled input/textarea. */
  async type(selector, value) {
    const ok = await this.cdp.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.focus();
      const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return el.value === ${JSON.stringify(value)};
    })()`);
    if (!ok) throw new Error(`could not type into ${selector}`);
    await sleep(250);
  }

  consoleErrors() {
    return this.raw.events
      .filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error")
      .map((e) => (e.params.args || []).map((a) => a.value ?? a.description).join(" ").slice(0, 150));
  }

  rawConsole() {
    return this.raw.events
      .filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error")
      .map((e) => (e.params.args || []).map((a) => a.value ?? a.description).join(" "));
  }

  close() {
    try { this.proc.kill(); } catch { /* ignore */ }
    try { rmSync(this.profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

const NAME_INPUT = 'input[placeholder*="Display Name" i], input[placeholder*="name" i]';
const TEXTAREA = 'textarea[aria-label="Message input"]';

runFlow();


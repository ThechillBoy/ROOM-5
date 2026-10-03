/**
 * Room5 onboarding probe — real browser, real click.
 * Verifies: GuestForm visible -> type name -> REAL click on Continue ->
 * hit-testing (overlay detection) -> POST /api/guest -> lobby appears.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9333;
const APP = "http://localhost:5173/";

const profile = mkdtempSync(join(tmpdir(), "room5-onboard-"));
const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--headless=new",
  "--no-first-run",
  "--disable-gpu",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error("CDP target not found");
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.events = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const c = new CDP(ws);
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && c.pending.has(msg.id)) {
        const { resolve, reject } = c.pending.get(msg.id);
        c.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        c.events.push(msg);
      }
    };
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const r = await this.send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    return r.result.value;
  }
  async realClick(x, y) {
    await this.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await this.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  }
}

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
};


const PROBE = `(() => {
  const inputs = [...document.querySelectorAll('input')];
  const nameInput = inputs.find(i => (i.placeholder || '').toLowerCase().includes('name'));
  const buttons = [...document.querySelectorAll('button')];
  const cont = buttons.find(b => (b.textContent || '').trim().toLowerCase().startsWith('continue'));
  const info = {
    bodyText: (document.body.innerText || '').slice(0, 300),
    inputCount: inputs.length,
    hasNameInput: !!nameInput,
    hasContinue: !!cont,
    continueDisabled: cont ? cont.disabled : null,
    continueLabel: cont ? (cont.textContent || '').trim() : null,
  };
  if (cont) {
    const r = cont.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    info.btnCenter = { cx, cy };
    const top = document.elementFromPoint(cx, cy);
    info.topElAtCenter = top ? top.tagName + '.' + String(top.className || '').slice(0, 60) : null;
    info.clickBlocked = !(top === cont || cont.contains(top));
  }
  if (nameInput) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(nameInput, 'ProbeUser');
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    info.typed = nameInput.value;
    const av = inputs.find(i => (i.placeholder || '').toLowerCase().includes('emoji'));
    info.avatarValue = av ? av.value : null;
  }
  return info;
})()`;

(async () => {
  try {
    const wsUrl = await getTarget();
    const cdp = await CDP.connect(wsUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");

    console.log("=== FRESH BROWSER (no localStorage, no cookie) ===");
    await cdp.send("Page.navigate", { url: APP });
    await sleep(4000);

    const probe = await cdp.evaluate(PROBE);
    check("onboarding form visible (name input)", probe.hasNameInput, `inputs=${probe.inputCount}`);
    check("Continue button visible", probe.hasContinue, `label="${probe.continueLabel}"`);
    check("Continue NOT disabled", probe.continueDisabled === false, `disabled=${probe.continueDisabled}`);
    check("Continue not covered by overlay", probe.clickBlocked === false, `topAtCenter=${probe.topElAtCenter}`);
    check("name typed + avatar auto-filled", probe.typed === "ProbeUser" && !!probe.avatarValue,
      `name="${probe.typed}" avatar="${probe.avatarValue}"`);

    if (probe.btnCenter) {
      const { cx, cy } = probe.btnCenter;
      console.log(`\n=== REAL CLICK on Continue at (${Math.round(cx)}, ${Math.round(cy)}) ===`);
      await cdp.realClick(cx, cy);
      await sleep(3500);
    }

    const statuses = cdp.events
      .filter((x) => x.method === "Network.responseReceived" && x.params.response.url.includes("/api/guest"))
      .map((e) => String(e.params.response.status));
    const postSeen = cdp.events.some(
      (e) => e.method === "Network.requestWillBeSent" &&
             e.params.request.url.includes("/api/guest") && e.params.request.method === "POST"
    );
    check("POST /api/guest fired on click", postSeen, postSeen ? "POST seen" : "no POST seen");
    check("POST /api/guest succeeded (201)", statuses.some((s) => s.startsWith("201")),
      `guest responses: [${statuses.join(", ")}]`);

    const after = await cdp.evaluate(PROBE);
    const welcomed = /Welcome back/i.test(after.bodyText);
    check("proceeded past onboarding (lobby/guest view)", welcomed || !after.hasContinue,
      `body="${after.bodyText.replace(/\s+/g, " ").slice(0, 140)}"`);

    const consoleErrors = cdp.events
      .filter((e) => e.method === "Runtime.consoleAPICalled" && e.params.type === "error")
      .map((e) => (e.params.args || []).map((a) => a.value ?? a.description).join(" ").slice(0, 160));
    console.log(`\nconsole errors: ${consoleErrors.length ? JSON.stringify(consoleErrors) : "none"}`);

    console.log("\n=== CORRUPTED localStorage (phantom guest) ===");
    await cdp.evaluate(
      `localStorage.setItem('room5-guest', JSON.stringify({state:{guest:{name:'\\\\',avatar:'\\\\'}},version:0})); 'ok'`
    );
    await cdp.send("Page.reload", { ignoreCache: true });
    await sleep(4000);
    const rec = await cdp.evaluate(PROBE);
    const phantom = /Welcome back,\s*\\/.test(rec.bodyText);
    check("corrupted identity does not create phantom guest", !phantom,
      `body="${rec.bodyText.replace(/\s+/g, " ").slice(0, 120)}"`);
    check("form reachable after corrupted identity", rec.hasNameInput === true,
      `hasNameInput=${rec.hasNameInput} hasContinue=${rec.hasContinue}`);

    const total = results.filter((r) => r.pass).length;
    console.log(`\n===== ${total}/${results.length} PASSED =====`);
    process.exitCode = total === results.length ? 0 : 1;
  } catch (err) {
    console.error("PROBE ERROR:", err.message);
    process.exitCode = 1;
  } finally {
    edge.kill();
    await sleep(500);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
})();

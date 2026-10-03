/**
 * Root route ("/") click diagnosis: full hit stack + real click test.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9337;
const URL_TO_TEST = process.argv[2] || "/";

const profile = mkdtempSync(join(tmpdir(), "room5-root-"));
const edge = spawn(EDGE, [
  "--remote-debugging-port=" + PORT,
  "--user-data-dir=" + profile,
  "--headless=new", "--no-first-run", "--disable-gpu",
  "--window-size=1280,900",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch("http://127.0.0.1:" + PORT + "/json/list")).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* wait */ }
    await sleep(500);
  }
  throw new Error("no CDP target");
}

async function attach(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) { events.push(msg); }
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
  const click = async (x, y) => {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  };
  return { send, evaluate, click, events };
}

const FIND = "(() => [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().toLowerCase().startsWith('continue')) || null)()";

const NAME_POS = "(() => { const i = [...document.querySelectorAll('input')].find(x => (x.placeholder||'').toLowerCase().includes('name'));" +
  " if(!i) return null; i.focus(); const r=i.getBoundingClientRect();" +
  " return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)}; })()";

const BTN_POS = "(() => { const c = " + FIND + "; if(!c) return null; const r=c.getBoundingClientRect();" +
  " return {x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2)}; })()";

function chainExpr(x, y) {
  return "(() => { const els = document.elementsFromPoint(" + x + "," + y + ");" +
    " return els.slice(0, 8).map(el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect();" +
    " return el.tagName + ' [' + String(el.getAttribute('class')||'').slice(0,44) + '] pe=' + cs.pointerEvents +" +
    " ' pos=' + cs.position + ' z=' + cs.zIndex + ' op=' + cs.opacity +" +
    " ' rect=' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); }); })()";
}

const CHAIN_ANCESTORS = "(() => { const c = " + FIND + "; if(!c) return ['no button'];" +
  " const out = []; let el = c;" +
  " while (el && el !== document.documentElement) { const cs = getComputedStyle(el);" +
  " out.push(el.tagName + '#' + (el.id||'-') + ' [' + String(el.getAttribute('class')||'').slice(0,50) + '] pe=' + cs.pointerEvents + ' pos=' + cs.position + ' z=' + cs.zIndex);" +
  " el = el.parentElement; }" +
  " return out; })()";

(async () => {
  try {
    const cdp = await attach(await getTarget());
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: "http://localhost:5173" + URL_TO_TEST });
    await sleep(5000);

    console.log("route: " + URL_TO_TEST);
    console.log("body: " + await cdp.evaluate("(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,120)"));

    const ip = await cdp.evaluate(NAME_POS);
    if (ip) await cdp.click(ip.x, ip.y);
    for (const ch of "RealUser") {
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", text: ch });
      await sleep(40);
    }
    await sleep(600);
    console.log("inputs: " + await cdp.evaluate("[...document.querySelectorAll('input')].map(i=>i.value).join('|')"));

    const t = await cdp.evaluate(BTN_POS);
    if (!t) {
      console.log("no Continue button found");
    } else {
      const chain = await cdp.evaluate(chainExpr(t.x, t.y));
      console.log("\nhit chain at Continue centre (" + t.x + "," + t.y + "):");
      chain.forEach((el, i) => console.log("  " + i + ": " + el));
      const inside = await cdp.evaluate(
        HIT_INSIDE.replace("%X%", String(t.x)).replace("%Y%", String(t.y))
      );
      console.log("hit inside button: " + inside + "  scrollY=" + await cdp.evaluate("window.scrollY"));
      await cdp.click(t.x, t.y);
    }
    await sleep(3500);

    const posts = cdp.events.filter((e) => e.method === "Network.requestWillBeSent" &&
      e.params.request.url.includes("/api/guest") && e.params.request.method === "POST").length;
    const statuses = cdp.events.filter((e) => e.method === "Network.responseReceived" &&
      e.params.response.url.includes("/api/guest")).map((e) => String(e.params.response.status));
    console.log("\nPOSTs=" + posts + " guest=[ " + statuses.join(", ") + " ]");
    console.log("body after: " + await cdp.evaluate("(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,110)"));
    console.log("RESULT: " + (posts > 0 && statuses.some((s) => s.startsWith("201")) ? "CLICK WORKS" : "CLICK DEAD"));
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
})();


/**
 * Real-browser click test: is the Continue button actually clickable?
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9340;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch("http://127.0.0.1:" + PORT + "/json/list")).json();
      const page = list.find((t) => t.type === "page");
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
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
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    } else if (msg.method) events.push(msg);
  };
  const send = (method, params) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception && r.exceptionDetails.exception.description || "eval failed");
    return r.result.value;
  };
  return { send, evaluate, events };
}

const FIND_BTN = "[...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim().toLowerCase().startsWith('continue'))";

const STATE = "(() => {" +
  "const cont = " + FIND_BTN + ";" +
  "const rootDiv = document.querySelector('#root > div');" +
  "const st = {" +
  "  scrollY: Math.round(scrollY)," +
  "  docH: Math.round(document.documentElement.scrollHeight)," +
  "  viewport: innerHeight," +
  "  rootCls: rootDiv ? rootDiv.getAttribute('class') : null," +
  "  rootPE: rootDiv ? getComputedStyle(rootDiv).pointerEvents : null," +
  "};" +
  "if (cont) {" +
  "  const r = cont.getBoundingClientRect();" +
  "  st.btn = Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height);" +
  "  st.btnFullyVisible = r.top >= 0 && r.bottom <= innerHeight;" +
  "  st.btnPE = getComputedStyle(cont).pointerEvents;" +
  "  const hit = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);" +
  "  st.hitInsideButton = hit ? (hit === cont || cont.contains(hit)) : false;" +
  "  st.hitDesc = hit ? hit.tagName + (hit.className ? '.' + String(hit.className).slice(0,30) : '') : null;" +
  "} else { st.btn = null; }" +
  "return st; })()";

async function scenario(width, height) {
  const profile = mkdtempSync(join(tmpdir(), "room5-click-"));
  const edge = spawn(EDGE, [
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--headless=new", "--no-first-run", "--disable-gpu",
    "--window-size=" + width + "," + height,
    "about:blank",
  ], { stdio: "ignore" });

  try {
    const cdp = await attach(await getTarget());
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: width, height: height, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: "http://localhost:5173/lobby" });
    await sleep(5000);

    console.log("\n########## VIEWPORT " + width + "x" + height + " ##########");
    console.log("after mount :", JSON.stringify(await cdp.evaluate(STATE)));

    const ipExpr = "(() => { const i = [...document.querySelectorAll('input')].find(x => (x.placeholder||'').toLowerCase().includes('name'));" +
      " if (!i) return null; i.focus(); const r = i.getBoundingClientRect();" +
      " return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()";
    const ip = await cdp.evaluate(ipExpr);
    if (ip) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: ip.x, y: ip.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: ip.x, y: ip.y, button: "left", clickCount: 1 });
      for (const ch of "RealUser") {
        await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", text: ch });
        await sleep(40);
      }
    }
    await sleep(700);
    console.log("after typing:", JSON.stringify(await cdp.evaluate(STATE)));
    const val = await cdp.evaluate("[...document.querySelectorAll('input')].map(i=>i.value).join('|')");
    console.log("input values = " + JSON.stringify(val));

    const targetExpr = "(() => { const c = " + FIND_BTN + ";" +
      " if (!c) return null; const r = c.getBoundingClientRect();" +
      " return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()";
    const target = await cdp.evaluate(targetExpr);
    if (target) {
      const hit = await cdp.evaluate("(() => { const h = document.elementFromPoint(" + target.x + "," + target.y + ");" +
        " return h ? h.tagName + (h.className ? '.' + String(h.className).slice(0,30) : '') : 'none'; })()");
      console.log("clicking at (" + target.x + "," + target.y + "); elementFromPoint=" + hit);
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1 });
    }
    await sleep(3500);

    const statuses = cdp.events
      .filter((e) => e.method === "Network.responseReceived" && e.params.response.url.includes("/api/guest"))
      .map((e) => String(e.params.response.status));
    const posts = cdp.events.filter(
      (e) => e.method === "Network.requestWillBeSent" && e.params.request.url.includes("/api/guest") && e.params.request.method === "POST"
    ).length;
    const body = await cdp.evaluate("(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,110)");
    console.log("POSTs=" + posts + "  guest responses=[" + statuses.join(", ") + "]");
    console.log('body="' + body + '"');
    console.log("RESULT: " + (posts > 0 && statuses.some((s) => s.startsWith("201")) ? "CLICK WORKS" : "CLICK DEAD"));
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

await scenario(1280, 900);
await scenario(760, 460);


async function scenarioCorrupt() {
  const profile = mkdtempSync(join(tmpdir(), "room5-corrupt-"));
  const edge = spawn(EDGE, [
    "--remote-debugging-port=" + PORT,
    "--user-data-dir=" + profile,
    "--headless=new", "--no-first-run", "--disable-gpu",
    "--window-size=1280,900",
    "about:blank",
  ], { stdio: "ignore" });
  try {
    const cdp = await attach(await getTarget());
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: "http://localhost:5173/lobby" });
    await sleep(4500);

    // EXACT user state: persisted garbage guest ("Welcome back, \\")
    await cdp.evaluate("localStorage.setItem(\"room5-guest\", JSON.stringify({state:{guest:{name:\"\\\\\",avatar:\"\\\\\"}},version:0})); \"ok\"");
    await cdp.send("Page.reload", { ignoreCache: true });
    await sleep(5000);

    console.log("\n########## CORRUPTED localStorage STATE ##########");
    const s1 = await cdp.evaluate(STATE);
    console.log("after reload:", JSON.stringify(s1));
    console.log("body=\"" + (await cdp.evaluate("(document.body.innerText||\'\').replace(/\\s+/g, \' \').slice(0,120)")) + "\"");

    const ip = await cdp.evaluate("(() => { const i = [...document.querySelectorAll(\'input\')].find(x => (x.placeholder||\'\').toLowerCase().includes(\'name\'));" +
      " if (!i) return null; i.focus(); const r = i.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()");
    if (ip) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: ip.x, y: ip.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: ip.x, y: ip.y, button: "left", clickCount: 1 });
      for (const ch of "RealUser") {
        await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", text: ch });
        await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", text: ch });
        await sleep(40);
      }
      await sleep(600);
    }
    const target = await cdp.evaluate("(() => { const c = " + FIND_BTN + "; if (!c) return null; const r = c.getBoundingClientRect();" +
      " return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()");
    if (target) {
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: target.x, y: target.y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: target.x, y: target.y, button: "left", clickCount: 1 });
      console.log("real-clicked at (" + target.x + "," + target.y + ")");
    } else {
      console.log("NO continue button found");
    }
    await sleep(3500);

    const posts = cdp.events.filter((e) => e.method === "Network.requestWillBeSent" && e.params.request.url.includes("/api/guest") && e.params.request.method === "POST").length;
    const statuses = cdp.events.filter((e) => e.method === "Network.responseReceived" && e.params.response.url.includes("/api/guest")).map((e) => String(e.params.response.status));
    const body = await cdp.evaluate("(document.body.innerText||\'\').replace(/\\s+/g, \' \').slice(0,110)");
    console.log("POSTs=" + posts + "  guest responses=[" + statuses.join(", ") + "]");
    console.log("body=\"" + body + "\"");
    console.log("RESULT: " + (posts > 0 && statuses.some((s) => s.startsWith("201")) ? "RECOVERED + CLICK WORKS" : "STILL BROKEN"));
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

await scenarioCorrupt();

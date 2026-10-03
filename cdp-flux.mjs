/**
 * Measure whether the onboarding form is in a re-mount / re-animation loop.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9336;
const APP = "http://localhost:5173/lobby";

const profile = mkdtempSync(join(tmpdir(), "room5-flux-"));
const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--headless=new", "--no-first-run", "--disable-gpu", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
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
  return { send, evaluate };
}

// Samples the Continue button 12 times over ~3s inside the page.
const FLUX = `(async () => {
  const find = () => [...document.querySelectorAll('button')].find(b => (b.textContent||'').trim().toLowerCase().startsWith('continue'));
  let mutations = 0;
  const obs = new MutationObserver((list) => { mutations += list.length; });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true });
  const samples = [];
  const first = find();
  if (!first) return { error: 'no continue button yet' };
  first.dataset.probe = 'mark-' + Date.now();
  const markId = first.dataset.probe;
  for (let i = 0; i < 12; i++) {
    const btn = find();
    const sameTag = btn ? (btn.dataset.probe || 'none') : 'missing';
    const r = btn ? btn.getBoundingClientRect() : null;
    const hit = r ? document.elementFromPoint(r.left + r.width/2, r.top + r.height/2) : null;
    samples.push({
      t: i * 250,
      sameEl: sameTag === markId,
      y: r ? Math.round(r.y) : null,
      h: r ? Math.round(r.height) : null,
      scrollY: Math.round(window.scrollY),
      hitIsButton: hit ? (hit === btn || btn.contains(hit)) : false,
      hitTag: hit ? hit.tagName : null,
      mutations,
    });
    await new Promise(res => setTimeout(res, 250));
  }
  obs.disconnect();
  return { samples, totalMutations: mutations, docHeight: document.body.getBoundingClientRect().height, viewport: innerHeight };
})()`;

(async () => {
  try {
    const cdp = await attach(await getTarget());
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Page.navigate", { url: APP });
    await sleep(3000);

    const res = await cdp.evaluate(FLUX);
    if (res.error) { console.log("ERROR:", res.error); return; }
    console.log(`viewport=${res.viewport}  bodyHeight=${Math.round(res.docHeight)}  totalMutations=${res.totalMutations}`);
    console.log("\nt(ms)  sameElement  btnY  height  scrollY  hitIsButton  hitTag  mutations");
    for (const s of res.samples) {
      console.log(
        `${String(s.t).padStart(5)}  ${String(s.sameEl).padEnd(11)}  ${String(s.y).padStart(4)}  ${String(s.h).padStart(6)}  ${String(s.scrollY).padStart(7)}  ${String(s.hitIsButton).padEnd(11)}  ${String(s.hitTag).padEnd(6)}  ${s.mutations}`
      );
    }
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
})();

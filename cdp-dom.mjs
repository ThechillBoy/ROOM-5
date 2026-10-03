/**
 * Print the DOM ancestry of every .animated-bg element (root vs decorative child).
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;
const profile = mkdtempSync(join(tmpdir(), "room5-dom-"));
const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
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

(async () => {
  try {
    const ws = new WebSocket(await getTarget());
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

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Page.navigate", { url: "http://localhost:5173/" });
    await sleep(4500);

    const info = await evaluate(`(() => {
      const describe = (el) => {
        if (!el) return 'null';
        if (el.id === 'root') return '#root';
        return el.tagName + (el.className ? '.' + String(el.className).split(' ').join('.') : '');
      };
      return [...document.querySelectorAll('.animated-bg')].map((el) => ({
        path: describe(el.parentElement) + '  >  ' + describe(el),
        isDirectChildOfRoot: el.parentElement && el.parentElement.id === 'root',
        computed: (() => { const cs = getComputedStyle(el); return 'pos=' + cs.position + ' pe=' + cs.pointerEvents + ' z=' + cs.zIndex + ' ovf=' + cs.overflow; })(),
      }));
    })()`);

    console.log("=== .animated-bg elements in the live DOM ===");
    for (const row of info) {
      console.log(`${row.isDirectChildOfRoot ? "[ROOT ]" : "[layer]"} ${row.path}`);
      console.log(`         ${row.computed}`);
    }
  } catch (err) {
    console.error("ERR:", err.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
})();

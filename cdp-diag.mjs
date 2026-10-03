/**
 * Diagnose WHY the Continue button ignores real clicks.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9335;
const profile = mkdtempSync(join(tmpdir(), "room5-diag-"));
const edge = spawn(EDGE, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--headless=new", "--no-first-run", "--disable-gpu", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* wait */ }
    await sleep(500);
  }
  throw new Error("no target");
}

const DIAG = `(() => {
  const inputs = [...document.querySelectorAll('input')];
  const nameInput = inputs.find(i => (i.placeholder || '').toLowerCase().includes('name'));
  const cont = [...document.querySelectorAll('button')]
    .find(b => (b.textContent || '').trim().toLowerCase().startsWith('continue'));
  const chain = (el) => {
    const out = [];
    let n = el;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      out.push(\`\${n.tagName.toLowerCase()}.\${String(n.getAttribute('class')||'').slice(0,44)}[pe=\${cs.pointerEvents},pos=\${cs.position},ovf=\${cs.overflow}]\`);
      n = n.parentElement;
    }
    return out;
  };
  const r = cont.getBoundingClientRect();
  return {
    inputPointerEvents: nameInput ? getComputedStyle(nameInput).pointerEvents : null,
    buttonPointerEvents: getComputedStyle(cont).pointerEvents,
    topAtInput: document.elementFromPoint(r.left + 40, r.top - 60)?.tagName ?? null,
    topAtButton: document.elementFromPoint(r.left + r.width/2, r.top + r.height/2)?.tagName ?? null,
    htmlPointerEvents: getComputedStyle(document.documentElement).pointerEvents,
    bodyChain: chain(cont),
    shellChain: chain(document.body.firstElementChild),
  };
})()`;

(async () => {
  try {
    const ws = new WebSocket(await target());
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
    };
    const send = (method, params = {}) => new Promise((resolve) => {
      pending.set(++id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true })).result.value;

    await send("Runtime.enable");
    await send("Page.enable");
    await send("Page.navigate", { url: "http://localhost:5173/" });
    await sleep(4500);

    const d = await evaluate(DIAG);
    console.log("input pointer-events :", d.inputPointerEvents);
    console.log("button pointer-events:", d.buttonPointerEvents);
    console.log("html pointer-events  :", d.htmlPointerEvents);
    console.log("elementFromPoint over input :", d.topAtInput);
    console.log("elementFromPoint over button:", d.topAtButton);
    console.log("\nancestor chain of Continue button:");
    for (const c of d.bodyChain) console.log("  " + c);
    console.log("\nanchor chain of <body> first child (page shell):");
    for (const c of d.shellChain) console.log("  " + c);
  } catch (e) {
    console.error("ERR:", e.message);
  } finally {
    edge.kill();
    await sleep(400);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
})();

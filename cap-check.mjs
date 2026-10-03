/**
 * Capacity + authorization regression check (protocol level, real HTTP + socket).
 * 1-5 members ok, 6th rejected; non-member cannot read messages.
 */
import { io } from "socket.io-client";

const BASE = "http://localhost:3000";
const API = BASE + "/api";

function newJar() { return { cookies: {} }; }

function cookieHeader(jar) {
  return Object.entries(jar.cookies).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(jar, path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const c = cookieHeader(jar);
  if (c) headers.Cookie = c;
  const res = await fetch(API + path, { ...options, headers });
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const idx = pair.indexOf("=");
    jar.cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  let body = null;
  try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body };
}

async function createGuest(jar, name) {
  await req(jar, "/guest");                       // obtains session cookie (401 expected)
  const res = await req(jar, "/guest", { method: "POST", body: JSON.stringify({ name, avatar: name[0] }) });
  return res;
}

const results = [];
const check = (n, pass, detail = "") => {
  results.push({ n, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${n}${detail ? " — " + detail : ""}`);
};

(async () => {
  let code = null;
  try {
    const jars = [];
    for (let i = 1; i <= 6; i++) {
      const jar = newJar();
      const res = await createGuest(jar, `Cap${i}`);
      check(`guest Cap${i} created`, res.status === 201, `status=${res.status}`);
      jars.push(jar);
    }

    const created = await req(jars[0], "/rooms", { method: "POST", body: JSON.stringify({}) });
    code = created.body?.code;
    check("room created with 6-char code", created.status === 201 && /^[A-Z0-9]{6}$/.test(code || ""), `code=${code}`);

    const joinStatuses = [];
    for (let i = 1; i < 6; i++) {
      const res = await req(jars[i], `/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ code }) });
      joinStatuses.push(res.status);
    }
    check("members 2-5 join successfully", joinStatuses.slice(0, 4).every((s) => s === 200), `statuses=[${joinStatuses.join(", ")}]`);
    check("6th member rejected (room full)", joinStatuses[4] !== 200, `6th status=${joinStatuses[4]} body=${JSON.stringify(joinStatuses[4] && (await req(jars[5], `/rooms/${code}`)).body?.error || "")}`);

    const outsider = await req(jars[5], `/rooms/${code}/messages`);
    check("non-member cannot read messages", outsider.status === 403 || outsider.status === 401, `status=${outsider.status}`);

    const insider = await req(jars[1], `/rooms/${code}/messages`);
    check("member CAN read messages", insider.status === 200, `status=${insider.status}`);

    // Socket path: 6th guest must be refused by the socket handler too
    await new Promise((resolve) => {
      const sock = io(BASE, { withCredentials: true, extraHeaders: { Cookie: cookieHeader(jars[5]) }, transports: ["polling"] });
      const timer = setTimeout(() => { sock.close(); check("socket room:join for 6th rejected", false, "timeout"); resolve(); }, 6000);
      sock.on("connect", () => sock.emit("room:join", { code }));
      sock.on("room:error", (e) => { clearTimeout(timer); check("socket room:join for 6th rejected", /full/i.test(e.message), `message="${e.message}"`); sock.close(); resolve(); });
      sock.on("connect_error", (e) => { clearTimeout(timer); check("socket room:join for 6th rejected", false, `connect_error=${e.message}`); sock.close(); resolve(); });
    });

    const pass = results.filter((r) => r.pass).length;
    console.log(`\n===== ${pass}/${results.length} PASSED =====`);
    console.log("ROOM_CODE=" + code);
  } catch (err) {
    console.error("ERR:", err.message);
  }
})();

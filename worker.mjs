export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const isBackendRequest = url.pathname === "/health"
      || url.pathname === "/api" || url.pathname.startsWith("/api/")
      || url.pathname === "/socket.io" || url.pathname.startsWith("/socket.io/");

    if (!isBackendRequest) return env.ASSETS.fetch(request);

    const upstream = new URL(env.BACKEND_ORIGIN);
    upstream.pathname = url.pathname;
    upstream.search = url.search;

    // Keep the method, body, cookies, Origin, and WebSocket upgrade headers.
    const proxyRequest = new Request(upstream, request);
    proxyRequest.headers.set("Host", upstream.host);
    proxyRequest.headers.set("X-Forwarded-Proto", upstream.protocol.slice(0, -1));

    // Return the original response so every Set-Cookie header and any 101
    // WebSocket upgrade survive. The backend cookie has no Domain attribute,
    // so browsers store it on the frontend host that served this response.
    return fetch(proxyRequest, { redirect: "manual" });
  },
};

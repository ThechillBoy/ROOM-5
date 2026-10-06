# Room5 backend hosting preparation

This guide prepares the existing Express + Socket.io server for a Node web
service. It does not provision infrastructure, apply migrations, or deploy it.

## Service requirements

- A persistent Node process with HTTPS termination, HTTP long-polling, and
  WebSocket upgrades. A static host alone cannot run this server.
- Use Node 24.19.0 to match the verified local runtime. The project declares
  npm 10.8.2; retain the committed package-lock.json and existing dependency versions.
- Start with one Node process and one service replica. Redis here stores sessions;
  the current Socket.io broadcasts and room state use the default in-process
  adapter. Redis sessions alone do not enable multiple chat-server replicas.
- PostgreSQL reachable from the service, with the committed Prisma migrations
  applied and the provider's required TLS configuration.
- Redis reachable from the service. Enable appropriate persistence and backups
  if sessions must survive Redis restarts.
- A stable session secret and the exact public website origin configured through
  the host's environment/secret settings.

## Environment variables

The server reads exactly these six application settings:

| Variable | Production requirement | Visibility |
| --- | --- | --- |
| NODE_ENV | Set to production. This requires Redis and enables secure cookies. | Public configuration |
| PORT | Use the platform-assigned positive integer port; the application defaults to 3000. | Public configuration |
| DATABASE_URL | Provider-supplied PostgreSQL connection string with any required TLS parameters. | Secret |
| REDIS_URL | Provider-supplied redis:// or rediss:// connection string; required in production. | Secret |
| SESSION_SECRET | Stable secret generated with at least 32 random bytes; validation requires at least 32 characters. | Secret |
| CLIENT_URL | Exact HTTPS website origin, without credentials, path, query, fragment, or trailing slash. Both REST and Socket.io use it for credentialed CORS. | Public configuration |

The blank .env.production.example is documentation, not an automatically loaded
production file. Inject real values using the hosting platform. Do not commit
real .env files, connection strings, session/API secrets, or signing credentials.
No Android credentials or frontend VITE_* variables are needed by this server.

## Hosting settings

Connect the existing GitHub repository and select branch main when deployment
is authorized. Use the repository root as the service working/build directory
because the lockfile and shared workspace live there.

Install with the project's declared npm version:

```sh
npx --yes npm@10.8.2 ci --workspace=@room5/shared --workspace=@room5/server --include-workspace-root --include=dev
```

Build the generated Prisma client, shared package, and server:

```sh
npm run prisma:generate --workspace=@room5/server && npm run build --workspace=@room5/shared && npm run build --workspace=@room5/server
```

The output directories are packages/shared/dist and apps/server/dist. Keep both
in the runtime filesystem along with the installed dependencies and generated
Prisma client. Do not use the root all-workspaces build for this service; it also
invokes the mobile build and its native prebuild lifecycle.

When actual deployment is authorized, run the following once in the platform's
release/pre-deploy step against the intended production database:

```sh
npm run prisma:deploy --workspace=@room5/server
```

The Prisma CLI is a development dependency. Keep it installed until the release
step completes. Use migrate deploy for committed migrations, not migrate dev or
db push. This preparation does not execute migrations against any database.

Start the server from the repository root:

```sh
npm run start --workspace=@room5/server
```

This invokes node dist/server.js inside apps/server. The server explicitly binds
to 0.0.0.0 and reads PORT from the validated process environment (default 3000).
It accepts IPv4 connections on all interfaces; local development continues to
use the same port. The bind address does not configure the public origin.

## HTTPS, proxy, and sessions

Forward /health, /api/*, and /socket.io/* without changing their paths. Preserve
cookies and WebSocket Upgrade headers. Set the proxy idle timeout above the
Socket.io heartbeat window; at least 60 seconds is appropriate for the current
defaults.

The Express app currently trusts one proxy hop. Use a host whose TLS proxy sets
and sanitizes X-Forwarded-Proto and whose forwarding path matches that setting.
Confirm the actual proxy topology before deployment; do not change trust proxy
speculatively.

Production cookies are HttpOnly, Secure, SameSite=None, scoped to the backend
host, and use the existing session TTL. REST requests and Socket.io must carry
the same session cookie. Set CLIENT_URL to the website origin, not the backend
origin. The current setting supports one website origin; preview domains are
not automatically allowed.

Prefer website and API hostnames under the same registrable domain when possible.
For different sites, verify cookie acceptance in target browsers; SameSite=None
does not override browser blocking of third-party cookies.

## Health and verification

Configure the platform health check as GET /health. Allow at least 30 seconds
for startup: production attempts to connect to Redis before opening the HTTP
listener, with a 15-second startup timeout.

The existing health endpoint is a liveness response. Its HTTP 200 does not prove
PostgreSQL connectivity or continuing Redis availability. After deployment is
authorized, verify separately:

- Committed migrations have applied and PostgreSQL queries succeed.
- Guest creation/restoration, room creation/joining/history, and member updates
  work through the public API.
- REST and Socket.io authenticate as the same guest, and a real WebSocket
  connection works through the host's proxy.
- Sessions survive a backend restart with the same secret and Redis store;
  session survival across Redis restarts depends on Redis persistence.

The current frontend still uses /api through its development proxy. Public
frontend routing and VITE_SOCKET_URL must be configured in a later phase; this
backend preparation does not edit the website or Android app.

Local verification on 2026-10-06 passed Prisma generation, shared/server builds,
and 19 checks covering development and production startup, explicit 0.0.0.0/PORT
binding, CORS, cookie flags, Redis sessions, authenticated REST and Socket.io,
polling-to-WebSocket upgrades, and session restoration after a backend restart.
The checks used the existing local database without writes and a temporary local
Redis container that was removed afterward. No production credentials or public
URLs were invented; cloud HTTPS/proxy verification and production migrations
remain pending.

## Local development

Keep the existing private apps/server/.env and root docker-compose.yml unchanged.
The existing npm run dev command and npm run dev:server command remain the same.
Development without REDIS_URL retains the existing in-memory session store.

## References

- [Prisma production migrations](https://www.prisma.io/docs/orm/prisma-client/deployment/deploy-database-changes-with-prisma-migrate)
- [Socket.io reverse proxy requirements](https://socket.io/docs/v4/reverse-proxy/)
- [Socket.io multiple server requirements](https://socket.io/docs/v4/using-multiple-nodes/)
- [Express session cookies and proxy settings](https://expressjs.com/en/resources/middleware/session/)

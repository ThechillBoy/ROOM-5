# Room5 Android production release

Current status: release preparation is implemented; production infrastructure and a
working public API URL are not provisioned. No production AAB is available yet.

## Separate development and production

Development stays on `npx expo start` / the existing debug APK, with
`http://10.0.2.2:3000` as the Android development fallback. The debug manifest
continues to allow local HTTP. Release network policy requires HTTPS.

Production REST and Socket.io use one public HTTPS origin. The existing
`io(API_ORIGIN)` connection uses secure polling and upgrades to WSS on
`/socket.io/`; no chat events or authentication contract change.

Copy `.env.production.example` to `.env.production.local` and enter the actual
public backend origin after deploying it. The file deliberately starts with an
empty API URL. Optional `EXPO_PUBLIC_WEB_URL` is the real web origin for shared
invite fallback. Increase `ROOM5_ANDROID_VERSION_CODE` for each subsequent upload.

The release command reads only this production file and explicitly supplied
environment variables (explicit shell/CI values take precedence). It disables Expo dotenv loading so development `.env`
files cannot leak into the release. Public variables are compiled into the app;
never put database, Redis, session, or signing secrets in `EXPO_PUBLIC_*` values.

## Provision the existing backend

The hosting account/provider and domain are not selected yet. Required services:

1. One persistent Node backend instance initially, built from the existing server.
2. Public HTTPS hostname with a valid certificate and WebSocket support.
3. Production PostgreSQL, using the existing migrations and a durable volume or
   managed backups. Do not run development migrations against production.
4. Redis with persistence enabled and backups. A volatile cache does not provide
   durable sessions across a Redis restart.

Set the server's separate production secrets/settings from
`apps/server/.env.production.example`: `NODE_ENV=production`, `DATABASE_URL`,
`REDIS_URL`, stable random `SESSION_SECRET`, `CLIENT_URL` (real HTTPS web origin),
and provider `PORT`. Retain the same session secret across deploys; changing it
invalidates existing signed cookies. The cookie/session TTL remains 24 hours.

Build from the repository root, then start from the server directory with the
provider's production environment injected:

```powershell
npm run build --workspace=@room5/shared
npm run build --workspace=@room5/server
npx prisma migrate deploy --schema apps/server/prisma/schema.prisma
npm run start --workspace=@room5/server
```

The Prisma command must run with the intended production `DATABASE_URL`. This
preparation has not run migrations or provisioned any production service.

A trusted TLS proxy forwards `/health`, `/api/*`, and `/socket.io/*` unchanged to
the existing HTTP Node server. Preserve cookies, HTTP/1.1, WebSocket
`Upgrade`/`Connection` headers, and trustworthy `X-Forwarded-Proto=https`; idle
timeouts must exceed Socket.io's heartbeat window (45 seconds by default).
Existing `trust proxy=1` assumes exactly one trusted proxy hop; align the hosting
topology with this setting and prevent direct public access to the internal Node
port. Existing CORS stays restricted to `CLIENT_URL`. Android needs no CORS bypass.

Production requires Redis and connects before accepting requests, with no
MemoryStore fallback. Development without `REDIS_URL` uses the existing in-memory
store. No multi-instance Socket.io deployment is introduced by session Redis.

## Upload signing

The Windows upload-key command creates an RSA upload key and a signing file under
`apps/mobile/.credentials/`, restricted to the current Windows account and SYSTEM:

```powershell
npm run android:upload-key --workspace=@room5/mobile
```

It never replaces an existing key. Alias: `room5-upload`. Passwords are generated
randomly, saved in `android-signing.properties`, and never printed. This directory
is ignored by source control. **Securely back up both the keystore and the signing
properties file** outside the project before publishing. The properties file
contains passwords and must remain private.

For CI or a different machine, inject these private variables instead:

- `ROOM5_UPLOAD_STORE_FILE` (absolute keystore path)
- `ROOM5_UPLOAD_STORE_PASSWORD`
- `ROOM5_UPLOAD_KEY_ALIAS`
- `ROOM5_UPLOAD_KEY_PASSWORD`

Release signing never falls back to the debug key. Existing emulator debug
signing remains independent. A release APK signed with the new upload key cannot
replace an installed debug APK directly; use a separate test device/profile or
explicitly uninstall the debug package only after preserving its data.

Create the Play Console app for `com.room5.app` and enroll in Play App Signing.
The local key is the upload key; Play manages the app signing key. No Play Console
app or enrollment has been created in this task.

## Generate and verify the AAB

From `E:\room5`:

```powershell
npm run android:release:check --workspace=@room5/mobile
npm run android:release --workspace=@room5/mobile
```

The first command validates explicit public HTTPS settings and upload signing
without compiling. The second also checks public `/health` and the Socket.io
polling handshake, invokes the existing `:app:bundleRelease`, verifies the AAB
signature, and checks that its signer matches the upload key. Gradle tracks the
endpoint as a bundle input so switching URLs cannot reuse the emulator bundle.

Expected output:
`E:\room5\apps\mobile\android\app\build\outputs\bundle\release\app-release.aab`.

Use this local Gradle path for the preserved native project. The existing EAS
configuration is generic and unverified; `/android/` is ignored by Git. A cloud
build needs explicit native-file upload rules, production EAS variables, an Expo
project, and the same upload key configured with EAS. Do not treat the existing
`eas.json` as a configured production release.

Do not run `npm run build --workspace=@room5/mobile`: npm would also invoke the
existing `prebuild` lifecycle (`expo prebuild --clean`) and regenerate native
files. The new release command never runs prebuild.

## Required production runtime checks before publishing

- Android creates a guest through HTTPS and restores the same guest after app
  restart and backend restart while the session is valid.
- The session also survives a Redis restart when its persistence is configured.
- Socket.io authenticates using the same session and completes a real WSS
  connection; polling handshake alone does not verify the WebSocket proxy.
- Existing web guest/session/chat behavior still works against the deployment.
- The AAB is signed by the upload key, accepted by Play Console internal testing,
  and tested on a real Android device.

A signed AAB is a build artifact; production connectivity, session persistence,
and Play Console enrollment must all be verified before claiming readiness.

## Files changed in this preparation

Mobile files changed:

- `apps/mobile/src/config.ts`
- `apps/mobile/app.config.ts`
- `apps/mobile/android/app/build.gradle`
- `apps/mobile/package.json`
- `apps/mobile/.env.example`
- `apps/mobile/.gitignore`

Mobile files created:

- `apps/mobile/.env.production.example`
- `apps/mobile/scripts/release-config.cjs`
- `apps/mobile/scripts/android-release.cjs`
- `apps/mobile/scripts/create-upload-key.ps1`
- `apps/mobile/RELEASE.md`
- `apps/mobile/.credentials/android-upload.keystore` (private)
- `apps/mobile/.credentials/android-signing.properties` (private passwords)

Server files changed:

- `apps/server/src/config/env.ts`
- `apps/server/src/config/session.ts`
- `apps/server/src/server.ts` (session-store startup/shutdown only)
- `apps/server/package.json`
- `package-lock.json`

Server file created: `apps/server/.env.production.example`.

Dependencies added: `connect-redis@9.0.0` and `redis@5.12.1`, server only.
No existing dependency versions were upgraded or removed.

## Verification on 3 October 2026

- Mobile and server TypeScript: passed.
- Production URL/profile/version rejection checks: passed using synthetic
  fixtures without network calls or builds.
- Actual upload key/password verification: passed; no secrets displayed.
- Gradle signing report: release uses `room5-upload`; debug uses `androiddebugkey`.
- Android debug task graph: passed (`assembleDebug --dry-run`), no APK rebuild.
- Development backend `/health`: HTTP 200 after the configuration changes.
- Isolated server configuration: production rejects absent Redis; development
  initializes without Redis.
- Release command: correctly blocked by absent `EXPO_PUBLIC_API_URL`.
- Direct `bundleRelease --dry-run`: correctly blocked by absent production profile.
- Production AAB generation and live HTTPS/WSS/durable Redis sessions: blocked
  or unverified because production infrastructure is not provisioned.

The existing APKs are development artifacts and were not replaced by a
production build. Mobile screens, web client, database schema, chat events,
and Android cleartext policy were not edited by this preparation.

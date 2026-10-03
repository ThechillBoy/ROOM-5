const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const { spawnSync } = require("node:child_process");
const { validateProductionEnvironment } = require("./release-config.cjs");

const mobileRoot = path.resolve(__dirname, "..");
const androidRoot = path.join(mobileRoot, "android");
const credentialFile = path.join(mobileRoot, ".credentials", "android-signing.properties");

function readSettings(file) {
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, "utf8")) : {};
}

function releaseEnvironment(fromGradle) {
  const environment = { ...process.env };
  if (!fromGradle) {
    const local = readSettings(path.join(mobileRoot, ".env.production.local"));
    for (const name of ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_WEB_URL", "ROOM5_ANDROID_VERSION_CODE"]) {
      if (!Object.hasOwn(environment, name) && Object.hasOwn(local, name)) environment[name] = local[name];
    }
    // This command chooses production explicitly; development dotenv is never loaded.
    environment.EXPO_PUBLIC_APP_ENV = "production";
    environment.EXPO_NO_DOTENV = "1";
    environment.NODE_ENV = "production";
    environment.BABEL_ENV = "production";
  }
  return environment;
}

function javaTool(name, environment) {
  return environment.JAVA_HOME
    ? path.join(environment.JAVA_HOME, "bin", name + (process.platform === "win32" ? ".exe" : ""))
    : name;
}

function signingSettings(environment) {
  const local = readSettings(credentialFile);
  const storeFile = environment.ROOM5_UPLOAD_STORE_FILE || local.storeFile;
  const storePassword = environment.ROOM5_UPLOAD_STORE_PASSWORD || local.storePassword;
  const keyAlias = environment.ROOM5_UPLOAD_KEY_ALIAS || local.keyAlias;
  const keyPassword = environment.ROOM5_UPLOAD_KEY_PASSWORD || local.keyPassword;
  if (!storeFile || !storePassword || !keyAlias || !keyPassword) {
    throw new Error("Upload signing is missing. Create the private upload key or supply ROOM5_UPLOAD_* signing variables.");
  }
  const resolvedFile = path.resolve(environment.ROOM5_UPLOAD_STORE_FILE ? mobileRoot : path.dirname(credentialFile), storeFile);
  if (!fs.existsSync(resolvedFile)) throw new Error("Configured upload keystore does not exist.");
  if (keyAlias.toLowerCase() === "androiddebugkey" || path.basename(resolvedFile).toLowerCase() === "debug.keystore") {
    throw new Error("A production release cannot use the Android debug key.");
  }
  const checked = spawnSync(javaTool("keytool", environment), [
    "-J-Duser.language=en", "-list", "-v", "-keystore", resolvedFile,
    "-alias", keyAlias, "-storepass:env", "ROOM5_KEY_CHECK_PASSWORD",
  ], { encoding: "utf8", env: { ...environment, ROOM5_KEY_CHECK_PASSWORD: storePassword }, timeout: 15000 });
  if (checked.error || checked.status !== 0) throw new Error("Upload keystore/alias/password validation failed; signing values were not printed.");
  if (/CN=Android Debug/i.test(checked.stdout)) throw new Error("The configured certificate is the Android debug certificate.");
  if (!checked.stdout.includes("PrivateKeyEntry")) throw new Error("The upload alias does not contain a private signing key.");
  return { resolvedFile, storePassword, keyAlias, keyPassword };
}

async function verifyBackend(apiOrigin) {
  const health = await fetch(`${apiOrigin}/health`, { redirect: "error", signal: AbortSignal.timeout(10000) });
  if (!health.ok) throw new Error(`Production /health returned HTTP ${health.status}.`);
  const response = await fetch(`${apiOrigin}/socket.io/?EIO=4&transport=polling`, {
    redirect: "error", signal: AbortSignal.timeout(10000),
  });
  const body = await response.text();
  if (!response.ok || !body.startsWith("0")) throw new Error("Production Socket.io handshake did not reach the existing backend.");
  const handshake = JSON.parse(body.slice(1));
  if (!handshake.upgrades?.includes("websocket")) throw new Error("Production Socket.io does not advertise WebSocket upgrade support.");
  console.log("Production health and Socket.io polling handshake passed. Device WSS/session verification remains required.");
}

async function main() {
  const fromGradle = process.argv.includes("--check-env");
  const environment = releaseEnvironment(fromGradle);
  const config = validateProductionEnvironment(environment);
  environment.EXPO_PUBLIC_API_URL = config.apiOrigin;
  if (config.webOrigin) environment.EXPO_PUBLIC_WEB_URL = config.webOrigin;
  if (environment.EXPO_NO_DOTENV !== "1" || environment.NODE_ENV !== "production" || environment.BABEL_ENV !== "production") {
    throw new Error("Use android:release so production bundling cannot inherit development dotenv or Babel settings.");
  }
  const signing = signingSettings(environment);
  console.log(`Production REST/Socket.io origin: ${config.apiOrigin}`);
  console.log(`Upload signing validated; Android versionCode=${config.versionCode}.`);
  if (process.argv.includes("--check") || fromGradle) return;

  // Pass the exact validated credentials to Gradle rather than parsing them again.
  environment.ROOM5_UPLOAD_STORE_FILE = signing.resolvedFile;
  environment.ROOM5_UPLOAD_STORE_PASSWORD = signing.storePassword;
  environment.ROOM5_UPLOAD_KEY_ALIAS = signing.keyAlias;
  environment.ROOM5_UPLOAD_KEY_PASSWORD = signing.keyPassword;
  await verifyBackend(config.apiOrigin);
  const result = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", "gradlew.bat :app:bundleRelease --console=plain"], { cwd: androidRoot, env: environment, stdio: "inherit" })
    : spawnSync(path.join(androidRoot, "gradlew"), [":app:bundleRelease", "--console=plain"], { cwd: androidRoot, env: environment, stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error("Production Gradle AAB build failed.");
  const artifact = path.join(androidRoot, "app/build/outputs/bundle/release/app-release.aab");
  if (!fs.existsSync(artifact)) throw new Error("Gradle succeeded without producing the expected AAB.");
  const verified = spawnSync(javaTool("jarsigner", environment), ["-J-Duser.language=en", "-verify", artifact], { encoding: "utf8", env: environment });
  if (verified.error || verified.status !== 0 || !verified.stdout.includes("jar verified.")) {
    throw new Error("Generated AAB signature verification failed.");
  }
  const expectedCertificate = spawnSync(javaTool("keytool", environment), [
    "-J-Duser.language=en", "-list", "-v", "-keystore", signing.resolvedFile,
    "-alias", signing.keyAlias, "-storepass:env", "ROOM5_KEY_CHECK_PASSWORD",
  ], { encoding: "utf8", env: { ...environment, ROOM5_KEY_CHECK_PASSWORD: signing.storePassword } });
  const actualCertificate = spawnSync(javaTool("keytool", environment), [
    "-J-Duser.language=en", "-printcert", "-jarfile", artifact,
  ], { encoding: "utf8", env: environment });
  const fingerprint = (result) => result.stdout?.match(/SHA256:\s*([A-F0-9:]+)/)?.[1];
  if (expectedCertificate.status !== 0 || actualCertificate.status !== 0 ||
      !fingerprint(expectedCertificate) || fingerprint(expectedCertificate) !== fingerprint(actualCertificate)) {
    throw new Error("The generated AAB signer does not match the configured upload key.");
  }
  console.log(`Signed AAB generated and signature verified: ${artifact}`);
  console.log(`Upload alias: ${signing.keyAlias}. Validate production guest/session and WSS behavior on a device before publishing.`);
}

module.exports = { releaseEnvironment, signingSettings };

if (require.main === module) {
  main().catch((error) => {
    console.error(`Room5 release blocked: ${error.message}`);
    process.exitCode = 1;
  });
}

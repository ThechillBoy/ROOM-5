const { isIP } = require("node:net");

function publicHttpsOrigin(value, name) {
  if (!value?.trim()) throw new Error(`${name} is required for a production release.`);
  let url;
  try { url = new URL(value.trim()); }
  catch { throw new Error(`${name} must be a public HTTPS origin.`); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error(`${name} must be an HTTPS origin without credentials, path, query, or fragment.`);
  }
  if (isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".") ||
      /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host) ||
      /(^|\.)example\.(com|net|org)$/.test(host)) {
    throw new Error(`${name} must use a real public hostname, not a local IP or placeholder.`);
  }
  url.hostname = host;
  return url.origin;
}

function validateProductionEnvironment(environment) {
  if (environment.EXPO_PUBLIC_APP_ENV !== "production") {
    throw new Error("EXPO_PUBLIC_APP_ENV must be production for a release build.");
  }
  const apiOrigin = publicHttpsOrigin(environment.EXPO_PUBLIC_API_URL, "EXPO_PUBLIC_API_URL");
  const webOrigin = environment.EXPO_PUBLIC_WEB_URL?.trim()
    ? publicHttpsOrigin(environment.EXPO_PUBLIC_WEB_URL, "EXPO_PUBLIC_WEB_URL")
    : undefined;
  const versionCode = environment.ROOM5_ANDROID_VERSION_CODE || "1";
  if (!/^[1-9]\d*$/.test(versionCode) || Number(versionCode) > 2100000000) {
    throw new Error("ROOM5_ANDROID_VERSION_CODE must be an integer from 1 to 2100000000.");
  }
  return { apiOrigin, webOrigin, versionCode: Number(versionCode) };
}

module.exports = { publicHttpsOrigin, validateProductionEnvironment };

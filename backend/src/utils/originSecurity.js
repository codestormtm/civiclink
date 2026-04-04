const env = require("../config/env");

const explicitOrigins = new Set();
const allowedDevPorts = new Set(env.network.devFrontendPorts.map(String));

[
  env.clientUrl,
  env.monitoring.adminPortalUrl,
  env.monitoring.workerPortalUrl,
  env.monitoring.citizenPortalUrl,
  env.monitoring.transparencyPortalUrl,
].filter(Boolean).forEach((value) => {
  try {
    explicitOrigins.add(new URL(value).origin);
  } catch {
    // Ignore malformed optional URLs to avoid blocking startup.
  }
});

function isPrivateIpv4Host(hostname) {
  const parts = String(hostname || "").split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function isAllowedDevOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const normalizedHostname = parsed.hostname.toLowerCase();
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");

    const isKnownTrustedHost = env.network.trustedOriginHosts.includes(normalizedHostname);
    const isPrivateLanHost = env.nodeEnv !== "production" && isPrivateIpv4Host(normalizedHostname);

    return allowedDevPorts.has(port)
      && (isKnownTrustedHost || isPrivateLanHost);
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  return explicitOrigins.has(origin) || isAllowedDevOrigin(origin);
}

function resolveCorsOrigin(origin, callback) {
  if (isAllowedOrigin(origin)) {
    callback(null, origin || true);
    return;
  }

  const error = new Error(`CORS blocked for origin: ${origin}`);
  error.statusCode = 403;
  callback(error);
}

module.exports = {
  explicitOrigins,
  isAllowedOrigin,
  resolveCorsOrigin,
};

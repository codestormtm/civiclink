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

function isAllowedDevOrigin(origin) {
  try {
    const parsed = new URL(origin);
    const normalizedHostname = parsed.hostname.toLowerCase();
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");

    return env.network.trustedOriginHosts.includes(normalizedHostname)
      && allowedDevPorts.has(port);
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

  callback(new Error(`CORS blocked for origin: ${origin}`));
}

module.exports = {
  explicitOrigins,
  isAllowedOrigin,
  resolveCorsOrigin,
};

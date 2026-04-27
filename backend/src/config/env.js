const { existsSync, readFileSync } = require("fs");
const os = require("os");

require("dotenv").config();

const runningInDocker = existsSync("/.dockerenv");
const runningInWsl = Boolean(process.env.WSL_DISTRO_NAME) || os.release().toLowerCase().includes("microsoft");
const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const DEV_FRONTEND_PORTS = [5173, 5174, 5175];
const VIRTUAL_INTERFACE_PATTERNS = [
  /virtual/i,
  /vbox/i,
  /vmware/i,
  /hyper-v/i,
  /vethernet/i,
  /\bwsl\b/i,
  /docker/i,
  /loopback/i,
  /pseudo/i,
  /\btap\b/i,
  /\btun\b/i,
  /tailscale/i,
  /zerotier/i,
  /hamachi/i,
];
const WIFI_INTERFACE_PATTERNS = [/\bwi-?fi\b/i, /\bwlan\b/i, /\bwireless\b/i];
const ETHERNET_INTERFACE_PATTERNS = [/\bethernet\b/i, /\blan\b/i];

function detectWslHostIp() {
  try {
    const resolvConf = readFileSync("/etc/resolv.conf", "utf8");
    const match = resolvConf.match(/^\s*nameserver\s+([0-9.]+)\s*$/m);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function isPrivateIpv4(address) {
  if (!address) {
    return false;
  }

  const parts = String(address).split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function getLanIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  Object.entries(interfaces).forEach(([interfaceName, entries]) => {
    (entries || []).forEach((entry) => {
      const family = typeof entry.family === "string"
        ? entry.family
        : (entry.family === 4 ? "IPv4" : String(entry.family));

      if (family !== "IPv4" || entry.internal || !isPrivateIpv4(entry.address)) {
        return;
      }

      const normalizedInterfaceName = String(interfaceName || "").trim();
      let score = 0;

      if (WIFI_INTERFACE_PATTERNS.some((pattern) => pattern.test(normalizedInterfaceName))) {
        score += 300;
      }

      if (ETHERNET_INTERFACE_PATTERNS.some((pattern) => pattern.test(normalizedInterfaceName))) {
        score += 150;
      }

      if (VIRTUAL_INTERFACE_PATTERNS.some((pattern) => pattern.test(normalizedInterfaceName))) {
        score -= 500;
      }

      if (entry.address.startsWith("192.168.")) {
        score += 25;
      }

      candidates.push({
        address: entry.address,
        score,
      });
    });
  });

  candidates.sort((left, right) => right.score - left.score);
  return Array.from(new Set(candidates.map((candidate) => candidate.address)));
}

function parseUrl(value) {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
}

function extractHostname(value) {
  return parseUrl(value)?.hostname?.toLowerCase() || null;
}

function replaceLoopbackHostname(urlValue, nextHostname) {
  const parsed = parseUrl(urlValue);

  if (!parsed || !nextHostname || !LOCALHOST_HOSTS.has(parsed.hostname.toLowerCase())) {
    return urlValue;
  }

  parsed.hostname = nextHostname;
  return parsed.toString().replace(/\/$/, "");
}

function resolveBackendApiUrl(urlValue, internalPort, monitoringHost) {
  const parsed = parseUrl(urlValue);

  if (!parsed) {
    return urlValue;
  }

  if (runningInDocker) {
    const hostname = parsed.hostname.toLowerCase();

    if (LOCALHOST_HOSTS.has(hostname)) {
      parsed.hostname = "127.0.0.1";
      parsed.port = String(internalPort);
      return parsed.toString().replace(/\/$/, "");
    }

    return parsed.toString().replace(/\/$/, "");
  }

  return replaceLoopbackHostname(urlValue, monitoringHost);
}

const detectedWslHostIp = runningInWsl ? detectWslHostIp() : null;
const lanIpv4Addresses = getLanIpv4Addresses();
const preferredLanHost = runningInWsl
  ? (detectedWslHostIp || lanIpv4Addresses[0] || null)
  : (lanIpv4Addresses[0] || null);
const defaultMonitoringHost = process.env.MONITORING_HOST
  || (runningInDocker ? "host.docker.internal" : (preferredLanHost || detectedWslHostIp || "localhost"));
const defaultCitizenPortalUrl = `http://${defaultMonitoringHost}:5173`;
const defaultAdminPortalUrl = `http://${defaultMonitoringHost}:5174`;
const defaultWorkerPortalUrl = `http://${defaultMonitoringHost}:5175`;
const defaultBackendApiUrl = `http://${runningInDocker ? "127.0.0.1" : defaultMonitoringHost}:${process.env.PORT || 5001}/api/health/app`;
const resolvedBackendApiUrl = resolveBackendApiUrl(
  process.env.BACKEND_API_URL || defaultBackendApiUrl,
  Number(process.env.PORT || 5001),
  defaultMonitoringHost
);
const rawCitizenPortalUrl = process.env.CITIZEN_PORTAL_URL
  || (runningInDocker ? defaultCitizenPortalUrl : (process.env.CLIENT_URL || defaultCitizenPortalUrl));
const resolvedAdminPortalUrl = replaceLoopbackHostname(process.env.ADMIN_PORTAL_URL || defaultAdminPortalUrl, defaultMonitoringHost);
const resolvedWorkerPortalUrl = replaceLoopbackHostname(process.env.WORKER_PORTAL_URL || defaultWorkerPortalUrl, defaultMonitoringHost);
const resolvedCitizenPortalUrl = replaceLoopbackHostname(rawCitizenPortalUrl, defaultMonitoringHost);
const resolvedTransparencyPortalUrl = replaceLoopbackHostname(
  process.env.TRANSPARENCY_PORTAL_URL || `${resolvedCitizenPortalUrl.replace(/\/$/, "")}/public`,
  defaultMonitoringHost
);

const required = [
  "PORT",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
  "JWT_EXPIRES_IN",
  "CLIENT_URL",
  "MINIO_ENDPOINT",
  "MINIO_PORT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
];

const missing = required.filter((key) => !process.env[key]);

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") {
    return fallback;
  }

  return String(value).trim().toLowerCase() === "true";
}

function normalizeMultilineSecret(value) {
  return String(value || "").replace(/\\n/g, "\n");
}

function buildFirebaseServiceAccount() {
  const jsonValue = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (jsonValue && jsonValue.trim()) {
    let parsed;

    try {
      parsed = JSON.parse(jsonValue);
    } catch {
      console.error("App startup failed: FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
      process.exit(1);
    }

    const projectId = parsed.project_id || parsed.projectId;
    const clientEmail = parsed.client_email || parsed.clientEmail;
    const privateKey = normalizeMultilineSecret(parsed.private_key || parsed.privateKey);

    if (!projectId || !clientEmail || !privateKey) {
      console.error("App startup failed: Firebase service account JSON is missing required fields");
      process.exit(1);
    }

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  const hasServiceAccountFields = [
    process.env.FIREBASE_CLIENT_EMAIL,
    process.env.FIREBASE_PRIVATE_KEY,
  ].some((value) => value && String(value).trim());

  if (!hasServiceAccountFields) {
    return null;
  }

  if (
    !process.env.FIREBASE_PROJECT_ID
    || !process.env.FIREBASE_CLIENT_EMAIL
    || !process.env.FIREBASE_PRIVATE_KEY
  ) {
    console.error(
      "App startup failed: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are all required when Firebase auth is enabled"
    );
    process.exit(1);
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizeMultilineSecret(process.env.FIREBASE_PRIVATE_KEY),
  };
}

if (missing.length > 0) {
  console.error(`App startup failed: missing required env variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === "") {
  console.error("App startup failed: JWT_SECRET must not be empty");
  process.exit(1);
}

const firebaseServiceAccount = buildFirebaseServiceAccount();
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID
  || firebaseServiceAccount?.projectId
  || "";
const defaultMinioPublicUrl = `http://localhost:${process.env.MINIO_PORT || 9000}`;
const resolvedMinioPublicUrl = replaceLoopbackHostname(
  process.env.MINIO_PUBLIC_URL || defaultMinioPublicUrl,
  defaultMonitoringHost
);
const parsedMinioPublicUrl = parseUrl(resolvedMinioPublicUrl);
const trustedOriginHosts = Array.from(
  new Set(
    [
      ...LOCALHOST_HOSTS,
      ...(runningInDocker ? ["host.docker.internal"] : []),
      ...(detectedWslHostIp ? [detectedWslHostIp] : []),
      ...lanIpv4Addresses,
      extractHostname(process.env.CLIENT_URL),
      extractHostname(resolvedAdminPortalUrl),
      extractHostname(resolvedWorkerPortalUrl),
      extractHostname(resolvedCitizenPortalUrl),
      extractHostname(resolvedTransparencyPortalUrl),
      extractHostname(resolvedBackendApiUrl),
    ].filter(Boolean)
  )
);

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT),

  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    name: process.env.DB_NAME,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
  },

  clientUrl: process.env.CLIENT_URL,

  monitoring: {
    enabled: parseBoolean(process.env.MONITORING_ENABLED, false),
    adminPortalUrl: resolvedAdminPortalUrl,
    workerPortalUrl: resolvedWorkerPortalUrl,
    citizenPortalUrl: resolvedCitizenPortalUrl,
    transparencyPortalUrl: resolvedTransparencyPortalUrl,
    backendApiUrl: resolvedBackendApiUrl,
  },

  network: {
    monitoringHost: defaultMonitoringHost,
    lanIpv4Addresses,
    trustedOriginHosts,
    devFrontendPorts: DEV_FRONTEND_PORTS,
  },

  minio: {
    endPoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    bucket: process.env.MINIO_BUCKET,
    publicUrl: resolvedMinioPublicUrl,
    publicEndPoint: parsedMinioPublicUrl?.hostname || process.env.MINIO_ENDPOINT,
    publicPort: parsedMinioPublicUrl?.port
      ? Number(parsedMinioPublicUrl.port)
      : (parsedMinioPublicUrl?.protocol === "https:" ? 443 : 80),
    publicUseSSL: parsedMinioPublicUrl?.protocol === "https:",
  },

  firebase: {
    enabled: Boolean(firebaseProjectId),
    projectId: firebaseProjectId,
    serviceAccount: firebaseServiceAccount,
  },
};

if (isNaN(env.port)) {
  console.error("App startup failed: PORT must be a number");
  process.exit(1);
}

if (isNaN(env.db.port)) {
  console.error("App startup failed: DB_PORT must be a number");
  process.exit(1);
}

if (isNaN(env.minio.port)) {
  console.error("App startup failed: MINIO_PORT must be a number");
  process.exit(1);
}

module.exports = env;

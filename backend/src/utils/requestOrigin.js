function readForwardedHeader(req, headerName) {
  const value = req.get(headerName);

  if (!value) {
    return "";
  }

  return String(value)
    .split(",")[0]
    .trim();
}

function getRequestOrigin(req) {
  const forwardedProtocol = readForwardedHeader(req, "x-forwarded-proto");
  const forwardedHost = readForwardedHeader(req, "x-forwarded-host");
  const protocol = forwardedProtocol || req.protocol || "http";
  const host = forwardedHost || req.get("host") || "";

  return host ? `${protocol}://${host}` : "";
}

module.exports = {
  getRequestOrigin,
};

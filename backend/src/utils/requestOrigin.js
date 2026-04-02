function getRequestOrigin(req) {
  const protocol = req.protocol || "http";
  const host = req.get("host");
  return `${protocol}://${host}`;
}

module.exports = {
  getRequestOrigin,
};

exports.success = (res, data, statusCode = 200, message = "Success") => {
  return res.status(statusCode).json({ success: true, message, data });
};

exports.failure = (res, message, statusCode = 500, errors = null) => {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

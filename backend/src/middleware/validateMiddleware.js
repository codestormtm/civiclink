const validate = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      return res.status(400).json({ success: false, error: err.issues });
    }
  };
};

module.exports = validate;

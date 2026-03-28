const { z } = require("zod");

const nullableTextField = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}, z.string().nullable());

const nullableCoordinate = (label, min, max) =>
  z.any().transform((value, ctx) => {
    if (value === undefined || value === null) {
      return null;
    }

    if (typeof value === "string" && value.trim() === "") {
      return null;
    }

    if (typeof value !== "string" && typeof value !== "number") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid ${label}`,
      });
      return z.NEVER;
    }

    const numericValue = Number(value);

    if (Number.isNaN(numericValue) || numericValue < min || numericValue > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid ${label}`,
      });
      return z.NEVER;
    }

    return numericValue;
  });

const complaintLocationFields = {
  latitude: nullableCoordinate("latitude", -90, 90),
  longitude: nullableCoordinate("longitude", -180, 180),
  address_text: nullableTextField,
  location_source: nullableTextField,
};

module.exports = {
  complaintLocationFields,
};

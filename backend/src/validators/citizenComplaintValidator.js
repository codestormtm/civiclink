const { z } = require("zod");
const { complaintLocationFields } = require("./locationFields");

exports.createComplaintSchema = z.object({
  department_id: z.string().uuid(),
  issue_type_id: z.string().uuid(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  ...complaintLocationFields,
});

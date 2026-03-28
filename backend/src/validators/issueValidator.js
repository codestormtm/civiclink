const { z } = require("zod");
const { complaintLocationFields } = require("./locationFields");

exports.createIssueSchema = z.object({
  department_id: z.string().uuid(),
  issue_type_id: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().min(5),
  priority_level: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  ...complaintLocationFields,
});

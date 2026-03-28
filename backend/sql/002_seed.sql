INSERT INTO departments (name, code, contact_email)
VALUES
  ('Municipal', 'MUNICIPAL', 'municipal@civiclink.local'),
  ('EB', 'EB', 'eb@civiclink.local'),
  ('Transport', 'TRANSPORT', 'transport@civiclink.local');

INSERT INTO department_issue_types (department_id, name, description)
SELECT d.id, t.name, t.description
FROM departments d
JOIN (
  VALUES
    ('MUNICIPAL', 'Garbage Collection', 'Missed garbage pickup or overflowing bins'),
    ('MUNICIPAL', 'Drainage', 'Blocked drains and water stagnation'),
    ('EB', 'Electricity Outage', 'Power cuts, line damage, or street light failures'),
    ('EB', 'Meter Issue', 'Meter faults and billing-related meter problems'),
    ('TRANSPORT', 'Road Damage', 'Road defects, potholes, or unsafe surfaces'),
    ('TRANSPORT', 'Traffic Signal Fault', 'Broken or unsafe traffic light systems')
) AS t(department_code, name, description)
  ON d.code = t.department_code;

-- Create one system admin manually after loading this seed:
-- Email: sysadmin@civiclink.local
-- Role: SYSTEM_ADMIN
-- Department: null
--
-- Password hashes are environment-specific, so admin and worker user rows
-- should be created from the application or inserted manually in pgAdmin.

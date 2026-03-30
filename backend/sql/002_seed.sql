INSERT INTO departments (name, code, contact_email, contact_phone)
VALUES
  ('Municipal', 'MUNICIPAL', 'municipal@civiclink.local', '+94 11 123 4567'),
  ('EB', 'EB', 'eb@civiclink.local', '+94 11 234 5678'),
  ('Transport', 'TRANSPORT', 'transport@civiclink.local', '+94 11 345 6789');

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

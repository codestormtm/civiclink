CREATE OR REPLACE FUNCTION ensure_default_department_issue_type()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO department_issue_types (department_id, name, description)
  SELECT
    NEW.id,
    'General Complaint',
    'Fallback complaint type created automatically so new departments are available in citizen intake immediately.'
  WHERE NOT EXISTS (
    SELECT 1
    FROM department_issue_types
    WHERE department_id = NEW.id
      AND is_active = TRUE
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS departments_default_issue_type ON departments;

CREATE TRIGGER departments_default_issue_type
AFTER INSERT ON departments
FOR EACH ROW
EXECUTE FUNCTION ensure_default_department_issue_type();

INSERT INTO department_issue_types (department_id, name, description)
SELECT
  d.id,
  'General Complaint',
  'Fallback complaint type created automatically so new departments are available in citizen intake immediately.'
FROM departments d
WHERE d.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM department_issue_types dit
    WHERE dit.department_id = d.id
      AND dit.is_active = TRUE
  );

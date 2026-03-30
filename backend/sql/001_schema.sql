CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE department_issue_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (department_id, name)
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_role_check CHECK (
    role IN ('SYSTEM_ADMIN', 'DEPT_ADMIN', 'WORKER', 'CITIZEN')
  ),
  CONSTRAINT users_department_scope_check CHECK (
    (role IN ('DEPT_ADMIN', 'WORKER') AND department_id IS NOT NULL)
    OR
    (role IN ('SYSTEM_ADMIN', 'CITIZEN') AND department_id IS NULL)
  )
);

CREATE TABLE worker_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  full_name VARCHAR(150) NOT NULL,
  name_initials VARCHAR(150),
  nic_number VARCHAR(50) NOT NULL UNIQUE,
  address TEXT,
  designation VARCHAR(150),
  employment_type VARCHAR(50),
  salary NUMERIC(12, 2),
  date_of_appointment DATE,
  previous_employer VARCHAR(150),
  bank_name VARCHAR(150),
  account_number VARCHAR(100),
  iban VARCHAR(100),
  profile_picture_url TEXT,
  nic_copy_url TEXT,
  employment_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, department_id),
  CONSTRAINT worker_profiles_employment_status_check CHECK (
    employment_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')
  )
);

CREATE TABLE complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  issue_type_id UUID NOT NULL REFERENCES department_issue_types(id) ON DELETE RESTRICT,
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  address_text TEXT,
  location_source VARCHAR(50),
  status VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT complaints_latitude_check CHECK (
    latitude IS NULL OR (latitude >= -90 AND latitude <= 90)
  ),
  CONSTRAINT complaints_longitude_check CHECK (
    longitude IS NULL OR (longitude >= -180 AND longitude <= 180)
  ),
  CONSTRAINT complaints_status_check CHECK (
    status IN (
      'SUBMITTED',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
      'REJECTED_WRONG_DEPARTMENT',
      'CLOSED'
    )
  ),
  UNIQUE (id, department_id)
);

CREATE TABLE complaint_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type VARCHAR(255) NOT NULL,
  uploaded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE complaint_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL,
  worker_user_id UUID NOT NULL,
  department_id UUID NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',
  field_notes TEXT,
  assigned_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT complaint_assignments_status_check CHECK (
    status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')
  ),
  CONSTRAINT complaint_assignments_complaint_fk
    FOREIGN KEY (complaint_id, department_id)
    REFERENCES complaints(id, department_id)
    ON DELETE CASCADE,
  CONSTRAINT complaint_assignments_worker_fk
    FOREIGN KEY (worker_user_id, department_id)
    REFERENCES worker_profiles(user_id, department_id)
    ON DELETE RESTRICT
);

CREATE TABLE password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_email VARCHAR(255) NOT NULL,
  target_name VARCHAR(150) NOT NULL,
  target_role VARCHAR(20) NOT NULL,
  nic_number VARCHAR(50) NOT NULL,
  mobile_number VARCHAR(50) NOT NULL,
  request_letter_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  viewed_at TIMESTAMPTZ,
  viewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT password_reset_requests_target_role_check CHECK (
    target_role = 'DEPT_ADMIN'
  ),
  CONSTRAINT password_reset_requests_status_check CHECK (
    status IN ('PENDING', 'COMPLETED')
  )
);

CREATE INDEX idx_department_issue_types_department_id
  ON department_issue_types(department_id);

CREATE INDEX idx_users_department_id
  ON users(department_id);

CREATE INDEX idx_users_role
  ON users(role);

CREATE INDEX idx_worker_profiles_department_id
  ON worker_profiles(department_id);

CREATE INDEX idx_complaints_department_id
  ON complaints(department_id);

CREATE INDEX idx_complaints_reporter_user_id
  ON complaints(reporter_user_id);

CREATE INDEX idx_complaints_issue_type_id
  ON complaints(issue_type_id);

CREATE INDEX idx_complaint_assignments_worker_user_id
  ON complaint_assignments(worker_user_id);

CREATE INDEX idx_password_reset_requests_created_at
  ON password_reset_requests(created_at DESC);

CREATE INDEX idx_password_reset_requests_department_id
  ON password_reset_requests(department_id);

CREATE INDEX idx_password_reset_requests_target_user_id
  ON password_reset_requests(target_user_id);

CREATE INDEX idx_password_reset_requests_unread
  ON password_reset_requests(viewed_at)
  WHERE viewed_at IS NULL;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_issue_type_department_match()
RETURNS TRIGGER AS $$
DECLARE
  issue_type_department UUID;
BEGIN
  SELECT department_id
  INTO issue_type_department
  FROM department_issue_types
  WHERE id = NEW.issue_type_id;

  IF issue_type_department IS NULL THEN
    RAISE EXCEPTION 'Complaint issue type does not exist';
  END IF;

  IF issue_type_department <> NEW.department_id THEN
    RAISE EXCEPTION 'Complaint issue type must belong to the same department';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_worker_department_match()
RETURNS TRIGGER AS $$
DECLARE
  user_department UUID;
  user_role VARCHAR(20);
BEGIN
  SELECT department_id, role
  INTO user_department, user_role
  FROM users
  WHERE id = NEW.user_id;

  IF user_role <> 'WORKER' THEN
    RAISE EXCEPTION 'Worker profile can only be created for WORKER users';
  END IF;

  IF user_department <> NEW.department_id THEN
    RAISE EXCEPTION 'Worker profile department must match user department';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_complaint_department_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.department_id <> NEW.department_id THEN
    RAISE EXCEPTION 'Complaint department cannot be changed after creation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER departments_set_updated_at
BEFORE UPDATE ON departments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER department_issue_types_set_updated_at
BEFORE UPDATE ON department_issue_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER worker_profiles_set_updated_at
BEFORE UPDATE ON worker_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER complaints_set_updated_at
BEFORE UPDATE ON complaints
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER complaint_assignments_set_updated_at
BEFORE UPDATE ON complaint_assignments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER password_reset_requests_set_updated_at
BEFORE UPDATE ON password_reset_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER complaints_issue_type_department_match
BEFORE INSERT OR UPDATE ON complaints
FOR EACH ROW
EXECUTE FUNCTION enforce_issue_type_department_match();

CREATE TRIGGER worker_profiles_department_match
BEFORE INSERT OR UPDATE ON worker_profiles
FOR EACH ROW
EXECUTE FUNCTION enforce_worker_department_match();

CREATE TRIGGER complaints_department_immutable
BEFORE UPDATE ON complaints
FOR EACH ROW
EXECUTE FUNCTION prevent_complaint_department_change();

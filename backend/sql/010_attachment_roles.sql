ALTER TABLE complaint_attachments
  ADD COLUMN IF NOT EXISTS attachment_role VARCHAR(20);

UPDATE complaint_attachments
SET attachment_role = 'GENERAL'
WHERE attachment_role IS NULL;

ALTER TABLE complaint_attachments
  ALTER COLUMN attachment_role SET DEFAULT 'GENERAL';

ALTER TABLE complaint_attachments
  ALTER COLUMN attachment_role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'complaint_attachments_attachment_role_check'
  ) THEN
    ALTER TABLE complaint_attachments
      ADD CONSTRAINT complaint_attachments_attachment_role_check
      CHECK (attachment_role IN ('BEFORE', 'AFTER', 'GENERAL'));
  END IF;
END $$;

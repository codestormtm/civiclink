# CivicLink pgAdmin Setup

Use this when creating the new database from scratch in pgAdmin.

## 1. Create the Database
- In pgAdmin, right-click `Databases`
- Choose `Create` -> `Database`
- Name it something like `civiclink_v2`
- Save

## 2. Open the Query Tool
- Select the new database
- Open `Tools` -> `Query Tool`

## 3. Run the Schema
- Open [001_schema.sql](/c:/Users/Startklar/Desktop/ATI-Individual-Project/civiclink/backend/sql/001_schema.sql)
- Execute the full file

## 4. Run the Seed Data
- Open [002_seed.sql](/c:/Users/Startklar/Desktop/ATI-Individual-Project/civiclink/backend/sql/002_seed.sql)
- Execute the full file

## 5. Create the First Users
- Create one `SYSTEM_ADMIN` user first
- Use the admin UI or direct inserts to create department admins and workers after the backend is pointed at the new database

## Notes
- This schema replaces the old `issues`, `workers`, `media`, and `task_assignments` table model
- `complaints.department_id` is immutable after insert
- `department_issue_types` are department-specific, so EB complaint types cannot be attached to Municipal complaints
- `complaint_assignments` uses composite foreign keys to prevent cross-department worker assignment

# Supabase setup for Bencia Control

This folder contains an initial database schema draft. It has not been applied to a Supabase project.

## Required project

Use a dedicated Bencia Control Supabase project. Do not reuse another product's project.

## Configure the frontend

1. Create a dedicated project in the Mumbai (ap-south-1) region if available and appropriate.
2. Copy .env.example to .env.local.
3. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from that project.
4. Never place a service-role or secret key in a VITE_ variable or browser code.
5. Configure Auth email confirmation and password policy in the Supabase dashboard.

## Database

Review schema.sql with a qualified engineer before applying it to a dedicated project. It is a bootstrap SQL draft, not yet a versioned CLI migration and has not been tested against a live Bencia database.

Before production use:
- Run the schema against a disposable test project first.
- Test two separate users in two organizations for cross-tenant reads and writes.
- Test every role, including denied actions.
- Run Supabase security and performance advisors.
- Add automated policy tests and migration history.
- Review membership invitation and ownership-transfer flows.

## Current app behavior

If environment variables are absent, the frontend remains in preview mode and displays fictional local data. Once both variables are configured, the app requires Supabase Auth sign-in. Agent records are not yet persisted to PostgreSQL.

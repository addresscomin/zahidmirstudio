# Bencia Control

AI agent inventory and permission-governance workspace.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase environment values, the app opens in clearly labelled preview mode with fictional in-memory data. When both Supabase values are configured, the app requires email/password authentication.

## Current milestone (0.1.1)

- Responsive dashboard and agent registry preview
- Agent registration form (local preview only)
- Supabase client configuration using a publishable key
- Email/password sign-in and sign-up gate when configured
- Initial organization-scoped PostgreSQL schema and RLS policy draft in supabase/schema.sql
- Example environment file with blank values

## Not yet implemented or verified

- Agent CRUD persistence against PostgreSQL
- Organization creation and workspace selection UI
- Member invitation and role management
- Automated RLS integration tests
- Approval decision workflow
- Tamper-evident audit storage
- Real emergency shutdown or agent blocking
- Monthly report generation

## Security notes

- Never put a Supabase service-role or secret key in frontend code or a VITE_ variable.
- Do not enter customer data, production prompts, API keys or credentials in preview mode.
- The SQL file is a draft and has not been applied to a live Bencia database.
- Use a dedicated Bencia Supabase project. Do not reuse another product's database.
- Review and test the SQL against an isolated project before production use.

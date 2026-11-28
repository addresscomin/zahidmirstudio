# Bencia Control

AI agent inventory and permission-governance workspace.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase environment values, the app opens in clearly labelled preview mode with fictional in-memory data. When both Supabase values are configured, the app requires email/password authentication.

## Current milestone (0.2.0)

- Responsive preview dashboard and registry
- Supabase email/password authentication gate
- Create an organization; creator is assigned the first owner role by database trigger
- Load organization memberships and switch between available workspaces
- Register agents in PostgreSQL with environment/framework metadata
- Record declared tools/APIs as permission metadata
- Append a registration activity event
- Organization-scoped RLS policy draft
- GitHub Actions build workflow scoped to the Bencia Control folder

## Not yet implemented or verified

- Build workflow result has not yet been inspected
- Automated cross-organization RLS integration tests
- Member invitations and role administration UI
- Approval decision workflow
- Stronger server-side audit event validation and tamper evidence
- Real emergency shutdown or agent blocking
- Monthly report generation

## Security notes

- Never put a Supabase service-role or secret key in frontend code or a VITE_ variable.
- Do not enter customer data, production prompts, API keys or credentials in preview mode.
- The SQL file is a draft and has not been applied to a live Bencia database.
- Use a dedicated Bencia Supabase project. Do not reuse another product's database.
- Review and test the SQL against an isolated project before production use.
- This app is an early prototype, not a security product ready for production deployment.

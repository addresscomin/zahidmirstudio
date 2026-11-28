# Bencia Control

AI agent inventory and permission-governance workspace.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Without Supabase environment values, the app opens in clearly labelled preview mode with fictional in-memory data. When both Supabase values are configured, the app requires email/password authentication.

## Current milestone (0.3.0)

- Responsive preview dashboard and agent registry
- Supabase email/password authentication gate
- Create an organization; creator is assigned the first owner role by database trigger
- Load organization memberships and switch between available workspaces
- Register agents in PostgreSQL with environment/framework metadata
- Record declared tools/APIs as permission metadata
- Append a registration activity event
- Approval request UI: submit, list, approve, reject, or request changes
- Approval decisions call a narrowly-scoped SECURITY INVOKER database function
- Approval SQL migration constrains request creation, blocks self-approval, validates decision fields, and writes decision activity events
- GitHub Actions build workflow scoped to the Bencia Control folder

## Apply the approval workflow migration

After creating a dedicated test Supabase project and applying `supabase/schema.sql`, review and apply `supabase/approval_workflow.sql` in the Supabase SQL editor. Do not apply it to a production database without a separate review and test. New tables may require explicit Data API exposure and grants depending on project settings.

## Not yet implemented or verified

- Latest GitHub Actions build result has not yet been inspected
- SQL migration has not been applied to a live database or integration-tested
- Automated cross-organization RLS integration tests
- Member invitations and role administration UI
- Stronger server-side audit event validation and tamper evidence
- Real emergency shutdown or agent blocking
- Monthly report generation

## Security notes

- Never put a Supabase service-role or secret key in frontend code or a VITE_ variable.
- Do not enter customer data, production prompts, API keys or credentials in preview mode.
- Both SQL files are drafts and have not been applied to a live Bencia database.
- Use a dedicated Bencia Supabase project. Do not reuse another product's database.
- Review and test the SQL against an isolated project before production use.
- This app is an early prototype, not a security product ready for production deployment.
- The source repository is currently public. Do not commit secrets or real customer data; move the project to a private repository before adding sensitive project material.

# Bencia Control

AI agent inventory and permission-governance workspace.

## Run locally
```bash
cd bencia-control
npm install
npm run dev
```

## Current milestone
- Responsive dashboard shell
- Agent registry and search
- Register-agent form
- Agent details and declared permission metadata
- Preview-only sample records

## Safety and limitations
This is a frontend prototype. It does not yet provide authentication, organization isolation, persistent storage, approval enforcement, immutable audit storage, live integrations, or real emergency shutdown. All sample data is fictional. Do not enter real customer data, credentials, or secrets.

Next: Supabase Auth, PostgreSQL, organization-scoped RLS, then tested approval and audit workflows.

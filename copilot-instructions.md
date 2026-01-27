# EquityCloud Platform Copilot Instructions

You are helping build a showcase project for a Microsoft Cloud Solution Engineer path.

## Target Specialization
- Focus on **AI Apps & Agents / App Innovation** (code-first): APIs, serverless, infra, data access, observability, security.
- De-emphasize **BizApps / low-code / CRM workflows** unless explicitly requested.

## Architecture Preferences
- Prefer Azure-native patterns (Bicep IaC, GitHub Actions CI/CD).
- Prefer secure-by-default designs: Managed Identity, Key Vault, no secrets in code or outputs.
- Prefer production-grade engineering: validation, retries/backoff where appropriate, telemetry, clear error boundaries.

## Frontend Direction (near-term)
- Current frontend is vanilla JS. Suggest improvements that keep secrets off the client.
- If/when migrating: use Next.js App Router + TypeScript + Tailwind.

## Backend Direction
- Use Azure Functions (Python v2 programming model) with type hints and Pydantic models.
- Don’t return raw exception details to clients; log internally.

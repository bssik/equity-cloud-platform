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

## 🤝 Interaction Style
- **Talk First:** Stop and explain the plan. Ask for confirmation before editing code or running commands, especially for infrastructure or architectural pivots.
- **Narrative Commits:** Use human, conversational commit messages. No bot-speak (e.g., "fix(infra): update bicep").
- **Incremental:** Commit and test one small change at a time.
- **Context Aware:** Before assuming a fix, verify if the needed output/variable actually exists in the codebase.
- **Explain "Why":** Relate changes to ETL/Data Engineering concepts or Enterprise best practices.
- **NO Commits of Instructions:** Never commit changes to `copilot-instructions.md` or any instruction files. If you edit them, keep them local-only or reverting them immediately if accidentally staged.

## 🏗️ Execution Rules
- **No Parallel Execution:** Don't chain git commands or multiple edits without user checkpoints.
- **Infrastructure Check:** Always verify module outputs before referencing them in parent templates.

# Safe Spend

Safe Spend is the working repository for `써도돼`, an Apps in Toss miniapp that answers one practical question: how much of the money on hand is actually safe to spend before the next regular income arrives?

The product is intentionally smaller than a household ledger.
It does not attempt to aggregate every account, import card history, or classify every purchase.
Instead, the user enters one available balance, the next income date, a safety reserve, and upcoming recurring expenses.

## Core Calculation

The MVP uses a single combined spending pool.
All monetary values are stored as integer Korean won amounts.

```plaintext
reserved amount = pending recurring expenses due before the next income
safe to spend = max(current balance - reserved amount - safety reserve, 0)
daily allowance = safe to spend / remaining days
```

Before making a purchase, the user can enter its amount to see:

- Its percentage of the current safe-to-spend amount.
- The safe-to-spend amount after the purchase.
- The daily allowance before and after the purchase.
- A clear warning when the purchase exceeds the available safe amount.

The preview does not change stored data unless the user explicitly records the purchase.

## MVP Scope

- Guided setup for balance, income date, safety reserve, and recurring expenses.
- A home screen centered on the current safe-to-spend amount.
- Purchase-impact previews and optional spending records.
- Pending, paid, and skipped states for scheduled expenses.
- Local persistence through Apps in Toss Storage.
- One unobtrusive banner advertisement after the primary value is shown.

Account linking, MyData, SMS parsing, server synchronization, notifications, category budgets, and financial reports are outside the MVP.

## Planned Architecture

The miniapp will use React, strict TypeScript, `@apps-in-toss/web-framework`, and TDS Mobile in an Apps in Toss WebView.
Financial calculations will remain in framework-independent domain functions, while platform storage and advertising APIs will be isolated behind small adapters.

The repository is currently in the design stage and does not contain a runnable application scaffold yet.
Development, test, and build commands will be documented here after `package.json` is generated and verified.

## Repository Layout

```plaintext
src/             Application code after scaffolding
tests/           Cross-feature and integration tests
public/          Static assets
docs/specs/      Approved product and technical specifications
docs/plans/      Executable implementation plans
AGENTS.md        Contributor and agent guidelines
granite.config.ts  Apps in Toss metadata after scaffolding
```

## Privacy

The MVP is local-first and requires no login or server-side financial data storage.
Analytics events must never contain balances, purchase amounts, expense names, or exact financial dates.
Do not commit credentials, account information, or real financial records.

## Contributing

Read [AGENTS.md](./AGENTS.md) before making changes.
Keep changes small, add tests for financial and date rules, and use Conventional Commits such as `feat: add spending impact preview`.

## References

- [Apps in Toss Developer Center](https://developers-apps-in-toss.toss.im/)
- [Apps in Toss Developer Documentation MCP](https://developers-apps-in-toss.toss.im/~gitbook/mcp)

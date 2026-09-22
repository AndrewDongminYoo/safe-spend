# Repository Guidelines

## Project Structure & Module Organization

This repository contains an Apps in Toss WebView miniapp built with React and TypeScript.
Keep application code in `src/`, colocate small component tests with their modules, and place broader tests in `tests/`.
Use `src/components/` for reusable UI, `src/features/` for product flows, `src/domain/` for financial calculations, and `src/storage/` for Apps in Toss Storage adapters.
Store static images in `public/` and durable decisions in `docs/specs/` or `docs/plans/`.
Treat `apps-in-toss.config.ts` as the source of truth for bundle metadata.

## Build, Test, and Development Commands

Use the checked-in npm scripts:

```sh
npm install
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
```

`npm run dev` starts the local Vite server with Apps in Toss developer tools.
`npm test` runs Vitest once, while `npm run test:watch` supports local iteration.
`npm run lint` and `npm run typecheck` validate source quality.
`npm run build` creates both the web bundle and the `.ait` package and must pass before a pull request is ready.

## Coding Style & Naming Conventions

Use strict TypeScript, React functional components, and hooks.
Follow the formatter and linter configured in `package.json`; do not introduce another tool without a concrete need.
Use two-space indentation, `PascalCase` for components and types, `camelCase` for functions and variables, and `kebab-case` for non-component file names.
Keep monetary values as integer won amounts and isolate date rules in domain functions.
Prefer TDS Mobile components over custom UI primitives.

## Testing Guidelines

Add tests for every change to safe-to-spend calculations, recurrence rules, or persisted-data migrations.
Name tests `*.test.ts` or `*.test.tsx` and describe behavior rather than implementation details.
Cover boundary dates, month-end recurrence, zero balances, and overspending.
For UI changes, include a manual Apps in Toss sandbox check and attach screenshots when appearance changes.

## Commit & Pull Request Guidelines

Use Conventional Commits such as `feat: add spending impact preview` and keep each commit focused on one concern.
Pull requests should explain the user-visible outcome, list verification commands, link the relevant issue or spec, and include screenshots for UI changes.
Never commit credentials, account data, or real financial records.

## Architecture & Privacy

Keep the MVP local-first: no account linking, MyData integration, or server-side financial storage.
Access platform capabilities through small adapters so domain calculations remain deterministic and testable.

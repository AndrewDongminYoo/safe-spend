# Ledger Consistency Correction

## Status

- Status: Approved for implementation
- Date: 2026-09-23
- Scope: Review findings 1–5 against HEAD `a41e249`
- Parent spec: `docs/specs/2026-09-22-safe-spend-design.md`

## Goal

Keep the headline safe-to-spend amount correct when storage is unavailable, cycle dates change, income arrives late, recurring expenses are edited, and historical deductions are removed or reverted.

This correction overrides only the conflicting transition and persistence rules in the parent spec.

## Persistence Mode

The application store has an explicit `storage | session` persistence mode.

Choosing `저장 없이 시작하기` switches to `session` before onboarding begins.

In session mode, initialization, mutations, retries, and reset operations update memory without calling `StateRepository.save` or `StateRepository.clear`.

The application shell displays `저장 없이 사용 중이에요. 앱을 닫으면 변경사항이 사라져요.` and does not offer a misleading save retry action.

A transiently recovered Storage bridge must not receive session data unless the user explicitly reloads into storage mode in a future feature.

## Snapshot Version 2

The persisted snapshot version increases to `2` and adds a non-negative integer `balanceRevision`.

Every spending record and paid occurrence stores the balance revision in which its deduction happened.

Creating the initial state starts at revision `0`.

Renewing a cycle always increments the revision because it replaces the balance with an independently observed absolute value.

Editing settings increments the revision only when `currentBalance` changes.

Deleting a spending record or reverting a paid occurrence restores money only when its stored revision equals the current state revision.

The record or completed status is still removed or reverted when revisions differ, but no money is added to the current balance.

Version 1 snapshots migrate in memory to version 2.

Migrated state uses revision `1`, while legacy spending records and paid occurrences use revision `0` because the old schema cannot prove whether a later absolute balance reset already absorbed those deductions.

This conservative migration prevents an unverifiable historical refund from inflating safe-to-spend money.

## Occurrence Generation

Occurrence identity is deduplicated by `(recurringExpenseId, dueDate)` across existing and newly generated entries.

Extending `nextIncomeDate` generates active recurring occurrences in `(oldNextIncomeDate, newNextIncomeDate]`.

Shortening the date does not delete occurrence history; the budget calculation already excludes entries beyond the new horizon.

Renewal generates active recurring occurrences in `(min(oldNextIncomeDate, receivedOn), nextIncomeDate]`.

This includes unpaid bills in a late-income gap and bills due on the day income is eventually confirmed.

Existing paid, skipped, or pending entries with the same identity prevent duplicate generation.

## Recurring Definition Reconciliation

Editing a recurring definition preserves all paid and skipped occurrences as historical facts.

Pending occurrences for that definition on or before the current `nextIncomeDate`, including overdue entries, are reconciled to the new name, amount, and monthly due day.

Each existing pending occurrence keeps its identifier and moves to the resolved due date in the same calendar month.

Duplicate reconciled identities collapse to one pending occurrence.

When no protected pending occurrence exists, the transition generates due dates from today through the current income date.

An existing completed occurrence at a generated identity suppresses a new pending duplicate.

## Compatibility and Non-Goals

- Do not change safe-to-spend arithmetic or the rule that bills due on payday remain reserved.
- Do not prune occurrence or spending history in this correction.
- Do not add backend storage, synchronization, analytics, or dependencies.
- Do not change recurring-expense deactivation semantics.
- Do not implement the separate Home renewal CTA or analytics suggestions from the review.

## Acceptance Criteria

1. Session-only onboarding and later mutations never invoke repository persistence and visibly disclose that changes will disappear.
2. Extending an income date from September 25 to October 10 creates and reserves an October 5 recurring bill exactly once.
3. Renewing late on October 5 after a September 25 income date creates and reserves an October 5 recurring bill exactly once.
4. Editing an overdue September 20 pending bill to day 24 on September 23 replaces it with one September 24 pending bill using the new name and amount.
5. Deleting or reverting a deduction from an older balance revision never increases the current balance.
6. Deleting or reverting a deduction from the current balance revision restores the deducted amount exactly once.
7. A valid version 1 snapshot loads as version 2 without becoming corrupt, while malformed and future-version snapshots remain recoverable corrupt data.

## Verification

```bash
npm test -- src/app/app-store.test.tsx src/app/router.test.tsx
npm test -- src/storage/schema.test.ts src/domain/transitions.test.ts
npm test
npm run typecheck
npm run lint
npm run format:check
```

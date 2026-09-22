# Safe Spend MVP Design

## Document Status

- Status: Proposed for implementation approval
- Date: 2026-09-22
- Product name: `써도돼`
- Repository and app identifier: `safe-spend`
- Platform: Apps in Toss WebView miniapp

## Product Thesis

Safe Spend answers one question before the next regular income arrives: “How much of the money I can see is actually safe to spend?”

The product is a spending pacemaker, not a household ledger.
It protects money already committed to recurring expenses and a user-defined safety reserve, then shows the effect of a proposed purchase against the remainder.
It avoids the setup burden and privacy concerns of account aggregation, MyData, SMS parsing, and transaction categorization.

## Goals

- Show one trustworthy safe-to-spend amount for the current income cycle.
- Make upcoming recurring expenses visible before they are withdrawn.
- Show the percentage and daily-budget impact of a proposed purchase before or after it happens.
- Keep financial data on the device without login or a backend.
- Reach a shippable monetized baseline with one non-disruptive banner advertisement.

## Non-Goals

- Bank, card, or MyData connections.
- SMS or push-notification parsing.
- Full transaction history import, category budgets, charts, or accounting reports.
- Multiple accounts, household members, currencies, or income streams.
- Cloud synchronization, export, or cross-device recovery.
- Notifications in the first release.
- Interstitial, rewarded, or paywall monetization.

## Target User and Primary Job

The initial user receives regular income, has several predictable monthly withdrawals, and wants a lightweight answer without exposing every account.
The primary job is: “Before I spend this amount, tell me how much of my genuinely available money it consumes and what remains per day.”

## Product Identity

The user-facing Korean name is `써도돼`, and the English name is `Safe Spend`.
The intended immutable Apps in Toss `appName` is `safe-spend`.
Availability must be checked before console registration because `appName` cannot be changed after registration.
If `safe-spend` is unavailable, use the deterministic fallback `safe-spend-app` before the first registration and replace the identifier consistently in the console, `apps-in-toss.config.ts`, deep links, and documentation.

## Core Model

The MVP uses one combined spending pool rather than modeling separate accounts.
Money is stored as non-negative integer Korean won amounts.

```plaintext
reservedAmount = sum(estimatedAmount for pending occurrences due on or before nextIncomeDate)
rawSafeToSpend = currentBalance - reservedAmount - safetyReserve
safeToSpend = max(rawSafeToSpend, 0)
shortfall = max(-rawSafeToSpend, 0)
remainingDays = max(calendarDaysBetween(today, nextIncomeDate), 1)
dailyAllowance = floor(safeToSpend / remainingDays)
purchaseImpactPercent = purchaseAmount / safeToSpend × 100
```

`purchaseImpactPercent` is unavailable when `safeToSpend` is zero.
Any positive purchase in that state is presented as exceeding the safe amount rather than as an infinite percentage.
Display an available percentage to one decimal place while retaining the unrounded value for comparisons.
Money calculations must not use floating-point values except for display-only percentage calculation.

## Calendar and Cycle Rules

- Store dates as date-only `YYYY-MM-DD` strings and calculate by local calendar dates, not elapsed milliseconds.
- The spending horizon starts today and ends immediately before the next income date.
- Use at least one remaining day when the next income date is today or already passed.
- Conservatively reserve an expense due on the next income date until the user confirms that the new income arrived.
- Do not advance a cycle automatically when a date passes.
- When income arrives, prompt the user to confirm the current balance and choose the following income date.
- Generate one occurrence per recurring expense for each cycle.
- A monthly due day from 29 through 31 clamps to the last valid day of shorter months.

## Expense State Rules

Each scheduled occurrence is `pending`, `paid`, or `skipped`.
Only pending occurrences contribute to `reservedAmount`.

Marking an expense paid requires its actual amount, defaulted to the estimate.
The mutation subtracts the actual amount from `currentBalance`, records the actual amount, and removes the estimated amount from the reserved total.
When actual and estimated amounts match, `safeToSpend` remains unchanged.
When they differ, the result changes by the estimate-minus-actual difference.

Skipping an expense removes its estimate from the reserved total without changing the current balance.
Reverting paid or skipped status restores the preceding balance and reservation state.
Editing a recurring definition affects future cycles only.
The current pending occurrence can be edited separately, while removing a recurring definition marks it inactive so completed occurrences remain readable.

## Purchase Preview and Recording

The purchase-impact screen accepts a positive integer amount and an optional memo.
Before confirmation it shows the current safe amount, impact percentage, safe amount after purchase, and daily allowance after purchase.
The UI uses factual language and does not label ordinary purchases as morally good or bad.
A purchase above the safe amount receives an explicit exceed warning.

`계산만 하기` returns without changing data.
`지출로 기록하기` subtracts the amount from `currentBalance` and creates a spending record.
Deleting that record restores the same amount to the balance.

## User Experience

### Onboarding

Use a short guided sequence with one decision per screen:

1. Explain that the app calculates spendable money without connecting financial accounts.
2. Enter the current combined balance.
3. Choose the next income date.
4. Enter an optional safety reserve, defaulting to zero.
5. Add recurring expense name, estimated amount, and monthly due day.
6. Review the calculation and enter the home screen.

Users may skip recurring-expense creation and add entries later.
All amount fields use a numeric keyboard, won formatting, clear validation, and a visible unformatted value for assistive technology.

### Home

The information hierarchy is:

1. `다음 수입일까지 써도 되는 돈` and the safe-to-spend amount.
2. Remaining days and daily allowance.
3. A breakdown of current balance, pending expenses, and safety reserve.
4. The next pending expenses in due-date order.
5. Primary action: `지출 영향 확인하기`.
6. Secondary actions for scheduled expenses and settings.
7. One banner advertisement after the core value and actions.

When `shortfall` is positive, replace the normal hero state with the shortfall amount and explain which protected amounts exceed the current balance.
Do not rely on color alone to communicate this state.

### Scheduled Expenses

Show pending entries first, then paid and skipped entries.
Each row exposes the name, due date, estimate, status, and actions appropriate to its status.
Users can add, edit, delete, pay, skip, or revert an occurrence.
Deleting a recurring definition does not rewrite completed spending records.

### Settings

Allow editing the current balance, next income date, safety reserve, and recurring expense definitions.
Show a persistent disclosure that uninstalling Toss removes locally stored data.
Provide an explicit local-data reset action with a confirmation step.

## TDS Usage

Use TDS Mobile components for navigation, typography, amount inputs, buttons, list rows, bottom sheets, dialogs, badges, and empty states.
Custom components are limited to product-specific number summaries and calculation breakdowns.
Spacing, type scale, touch targets, pressed states, and disabled states follow TDS defaults unless the documented product hierarchy requires a small composition layer.

The primary action remains visible without competing with the banner.
Advertising must never resemble a calculation result or action button.

## Routes

```plaintext
/                 Home or onboarding redirect
/onboarding       Initial setup flow
/spend            Purchase-impact preview
/expenses         Scheduled expenses
/settings         Balance, cycle, privacy, and reset controls
```

Routes support browser history and Apps in Toss deep linking.
The home route decides whether to redirect to onboarding after loading persisted state.

## Architecture

Use a React 18 and strict TypeScript WebView project aligned with the current `create-ait-app` TDS template, with `@apps-in-toss/web-framework`, `@toss/tds-mobile`, `@toss/tds-mobile-ait`, and `@emotion/react`.
Because this repository already contains documentation and MCP configuration, create the equivalent root scaffold in place and run `ait init` instead of asking `create-ait-app` to overwrite a non-empty directory.
Use npm and commit `package-lock.json` with dependency changes.

```plaintext
src/
  app/          Routing, providers, and app startup
  components/   Reusable product compositions built from TDS
  domain/       Pure money, calendar, recurrence, and transition logic
  features/     Onboarding, home, spend, expenses, and settings
  storage/      Versioned persistence schema and Apps in Toss adapter
  ads/          Banner initialization and lifecycle adapter
tests/          Cross-feature and persistence tests
```

Domain modules must not import React, TDS, Storage, or advertising APIs.
Feature code calls explicit domain transitions and persists the returned snapshot.
One application state provider is sufficient for the MVP; adding a third-party state-management dependency is unnecessary.

## Persisted Data

Store one versioned JSON snapshot under the key `safe-spend:state` through the Apps in Toss `Storage` API.
Do not use `AsyncStorage` or web storage for financial records.

```typescript
type LocalDate = string;
type Won = number;

interface SafeSpendStateV1 {
  version: 1;
  currentBalance: Won;
  safetyReserve: Won;
  nextIncomeDate: LocalDate;
  recurringExpenses: RecurringExpense[];
  occurrences: ExpenseOccurrence[];
  spendingRecords: SpendingRecord[];
  updatedAt: string;
}

interface RecurringExpense {
  id: string;
  name: string;
  estimatedAmount: Won;
  dueDay: number;
  isActive: boolean;
}

interface ExpenseOccurrence {
  id: string;
  recurringExpenseId: string;
  name: string;
  dueDate: LocalDate;
  estimatedAmount: Won;
  status: "pending" | "paid" | "skipped";
  actualAmount?: Won;
}

interface SpendingRecord {
  id: string;
  amount: Won;
  memo?: string;
  spentAt: string;
}
```

Persist each user mutation as one complete snapshot.
Validate version, required fields, integer money values, due-day range, and date formats when loading.
If parsing or validation fails, retain the unreadable raw value, show a recovery screen, and require confirmation before resetting it.
Future schema changes must add a migration test before increasing the version.

## Privacy and Analytics

The MVP has no authentication, backend, account connection, or remote financial-data storage.
Analytics are limited to product-flow events and boolean outcomes.
Never include amounts, balances, expense names, memos, exact dates, or serialized state in analytics or error reports.

Allowed event examples are `onboarding_completed`, `purchase_previewed`, `purchase_recorded`, `expense_marked_paid`, and `cycle_renewed`.
Allowed properties are coarse non-financial values such as `has_recurring_expense` or `result: within_safe_amount | exceeds_safe_amount`.

## Monetization

Use one WebView banner on the home screen after the calculation and primary actions.
Initialize `TossAds` once at application startup after checking `isSupported()`.
Attach the banner only after initialization, use a `100%`-width empty container, and use the documented `96px` height for the fixed layout.
Destroy the attached banner on unmount.
Hide the container after `onNoFill` or render failure so it leaves no blank space.
Use test ad identifiers during development and require the supported Toss app version before enabling production ads.

## Error and Empty States

- Storage unavailable: keep the current session usable, show that changes could not be saved, and offer retry.
- Corrupt snapshot: show recovery without silently deleting data.
- No recurring expenses: calculate from balance and safety reserve and offer `고정지출 추가하기`.
- Income date passed: keep the last snapshot and prompt `수입이 들어왔어요` instead of guessing.
- Invalid or zero purchase: disable preview and recording actions with inline guidance.
- Unsupported advertising or no fill: remove the banner area without blocking the product.

## Accessibility

- Use semantic headings and labels exposed by TDS components.
- Announce calculated result changes through an appropriate live region without repeating every keystroke.
- Provide text and icons in addition to color for warnings and statuses.
- Preserve dynamic text sizing and avoid clipping formatted won amounts.
- Keep all interactive controls keyboard accessible in browser development and screen-reader accessible in the Toss WebView.

## Testing Strategy

Unit tests cover pure domain behavior:

- Safe amount, shortfall, daily allowance, and zero-safe purchase impact.
- Paid, skipped, reverted, recorded, and deleted transitions.
- Actual expense amounts above and below estimates.
- Same-day, past, and future income dates.
- Leap years and month-end clamping for days 29 through 31.
- Expenses due on the next income date.
- Snapshot validation and future migration fixtures.

Component tests cover onboarding validation, home-state variants, purchase preview behavior, and destructive-action confirmations.
A final device pass in the Apps in Toss sandbox covers navigation, persistence across relaunch, numeric keyboard behavior, safe areas, banner fallback, and large text.

## Acceptance Criteria

1. A first-time user can reach a calculated safe amount after entering balance and next income date without creating an account.
2. Pending expenses through the income date and the safety reserve reduce the displayed safe amount exactly once.
3. A purchase preview shows percentage, remaining safe amount, and revised daily allowance without mutating stored state.
4. Recording or deleting a purchase updates the balance and persists across relaunch.
5. Paying, skipping, or reverting an expense produces the defined balance and reservation changes.
6. Passing the income date never silently resets financial data.
7. Unsupported, failed, or unfilled ads leave the primary product fully usable and without blank layout space.
8. No analytics or error payload contains financial values or user-entered financial text.

## Release Preconditions

- Confirm `appName` availability before the irreversible console registration.
- Keep `apps-in-toss.config.ts` `appName` identical to the console `appName`; manage display names and the icon in the console.
- Prepare a square 600 × 600 PNG logo with an opaque background and square corners.
- Validate the current Apps in Toss supported-user and review policies immediately before submission.
- Complete sandbox testing and a Toss-app test bundle before requesting review.

## Official References

- [Apps in Toss Developer Center](https://developers-apps-in-toss.toss.im/)
- [WebView SDK and TDS setup](https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview)
- [Apps in Toss Storage](https://developers-apps-in-toss.toss.im/documentation/common/file-storage/storage)
- [WebView banner advertising](https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/web-banner)
- [Miniapp registration](https://developers-apps-in-toss.toss.im/guide/operation/console-workspace)
- [Toss Design System](https://developers-apps-in-toss.toss.im/design/components)

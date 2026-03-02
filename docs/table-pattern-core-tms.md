# Core TMS Table Pattern (Phase 1)

Core TMS list pages (`Projects`, `Test Plans`, `Test Suites`, `Test Cases`, `Test Runs`) use a unified pattern:
- `DataWorkspace` as the page container.
- `TableShell` for loading/empty/table/card rendering.
- `RowActionButton` for icon-only row actions with consistent size, shape, and tone.

When adding or updating a core table, reuse these components before introducing custom table structure or action buttons.

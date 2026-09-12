## 2024-05-18 - Accessibility on Comment Inputs
**Learning:** The comment inputs in this application lacked ARIA labels making it hard for screen readers to understand the purpose of the input. In `ClassCommentsThread.tsx`, the `<input>` didn't have a label.
**Action:** When adding inputs, ensure they always have a label using `sr-only` if it doesn't need to be visible.

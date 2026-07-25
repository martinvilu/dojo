## 2026-07-24 - Accessibility for Close Buttons
**Learning:** Found multiple icon-only "close" (✕) buttons in modals (QrScannerModal, CalendarPanel) and toasts (ToastNotification) that lacked screen reader support.
**Action:** Always add descriptive `aria-label`s (in Spanish, matching the app's language, e.g., "Cerrar modal") and explicitly set `type="button"` on icon-only interactive elements to prevent implicit form submissions and improve a11y.

## 2026-07-25 - Form Accessibility (Label Associations)
**Learning:** Found that multiple form inputs across the application (e.g., in the login page and user profile panel) lacked explicit associations with their labels via `htmlFor` and `id`. This negatively impacts screen readers and reduces the click area for users.
**Action:** Always associate `<label>` elements with their respective `<input>` elements using the `htmlFor` and `id` attributes to improve accessibility and user experience.

## 2026-07-25 - Accessibility for Close Buttons (Moodle, Email)
**Learning:** Found multiple icon-only "close" (✕) buttons in modals in EmailManagementPanel and MoodleIntegrationPanel that lacked screen reader support.
**Action:** Always add descriptive `aria-label`s (in Spanish, matching the app's language, e.g., "Cerrar modal") and explicitly set `type="button"` on icon-only interactive elements to prevent implicit form submissions and improve a11y.

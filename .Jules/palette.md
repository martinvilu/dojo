## 2026-07-24 - Accessibility for Close Buttons
**Learning:** Found multiple icon-only "close" (✕) buttons in modals (QrScannerModal, CalendarPanel) and toasts (ToastNotification) that lacked screen reader support.
**Action:** Always add descriptive `aria-label`s (in Spanish, matching the app's language, e.g., "Cerrar modal") and explicitly set `type="button"` on icon-only interactive elements to prevent implicit form submissions and improve a11y.

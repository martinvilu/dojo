## 2026-07-24 - Accessibility for Close Buttons
**Learning:** Found multiple icon-only "close" (✕) buttons in modals (QrScannerModal, CalendarPanel) and toasts (ToastNotification) that lacked screen reader support.
**Action:** Always add descriptive `aria-label`s (in Spanish, matching the app's language, e.g., "Cerrar modal") and explicitly set `type="button"` on icon-only interactive elements to prevent implicit form submissions and improve a11y.

## 2026-07-25 - Form Accessibility (Label Associations)
**Learning:** Found that multiple form inputs across the application (e.g., in the login page and user profile panel) lacked explicit associations with their labels via `htmlFor` and `id`. This negatively impacts screen readers and reduces the click area for users.
**Action:** Always associate `<label>` elements with their respective `<input>` elements using the `htmlFor` and `id` attributes to improve accessibility and user experience.

## 2026-07-25 - Accessibility for Close Buttons (Moodle, Email)
**Learning:** Found multiple icon-only "close" (✕) buttons in modals in EmailManagementPanel and MoodleIntegrationPanel that lacked screen reader support.
**Action:** Always add descriptive `aria-label`s (in Spanish, matching the app's language, e.g., "Cerrar modal") and explicitly set `type="button"` on icon-only interactive elements to prevent implicit form submissions and improve a11y.
## 2025-02-15 - Missing Form Label Associations in Modals
**Learning:** Reusable modal forms like DirectEmailModal lacked explicit htmlFor/id associations, reducing screen reader accessibility and preventing click-to-focus on labels.
**Action:** Always verify that input/textarea components are explicitly linked to their descriptive labels using id and htmlFor attributes, especially in dynamic modals.

## 2026-08-03 - Password Visibility Toggle UX
**Learning:** The login page lacked a way to verify the entered password, leading to potential frustration and typos, especially on mobile devices or when pasting.
**Action:** Adding a simple, accessible show/hide password toggle button within the password input field significantly improves the login experience without requiring large design changes. Ensure the button has proper `aria-label` for screen readers and `focus-visible` styles for keyboard navigation.

## 2026-08-01 - Form Accessibility (Label Associations)
**Learning:** Found that multiple form inputs across the application (e.g., in the login page and user profile panel) lacked explicit associations with their labels via `htmlFor` and `id`. This negatively impacts screen readers and reduces the click area for users.
**Action:** Always associate `<label>` elements with their respective `<input>` elements using the `htmlFor` and `id` attributes to improve accessibility and user experience.

## 2026-08-25 - Accessibilidad en Formularios Dinámicos
**Learning:** En Next.js, los mensajes de error de autenticación que aparecen dinámicamente deben llevar `role="alert"` y `aria-live="assertive"` para que los lectores de pantalla los anuncien inmediatamente sin requerir recargar la página o mover el foco. Adicionalmente, todos los botones interactivos, incluidos los secundarios (como OAuth) y los enlaces que actúan como toggles (e.g., ¿No tenés cuenta? Registrate) requieren estilos explícitos de foco (como `focus-visible:ring-2` en Tailwind) para ser navegables vía teclado.
**Action:** Aplicar sistemáticamente `role="alert"` a todos los contenedores de errores que renderizan condicionalmente, y verificar siempre la navegación por tabulación asegurando que cada elemento "clickeable" tenga un estado `focus-visible` definido.

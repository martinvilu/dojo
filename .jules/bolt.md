## 2025-02-18 - Repeated Date instantiations in functional components
**Learning:** Large functional components (like `src/app/dashboard/page.tsx` with >6000 lines) often perform repeated unmemoized operations inside loops during renders. Specifically, instantiating `new Date()` within nested `filter`, `some`, and `map` iterations causes an $O(N \times M)$ overhead for simple comparisons (e.g. checking if assignments are past due).
**Action:** Always extract and memoize date instantiations or complex data processing that relies on invariant state during a single render cycle, using `useMemo` and Set lookups for $O(1)$ performance in inner loops.

## 2026-07-25 - O(N) array filtering within calendar grid render
**Learning:** In a calendar view that renders ~35-42 days, calling `getEventsForDate(dateStr)` which iterates over all events ((N)$) for every single day results in (N 	imes D)$ operations on every render. This was discovered in `src/components/dashboard/calendar/CalendarPanel.tsx`.
**Action:** Pre-compute an `eventsByDate` hash map using `useMemo` ((N)$) so that event lookups per day become (1)$, reducing overall complexity to (N + D)$.

## 2025-02-18 - Object key type coercion causing strict equality map lookup failures
**Learning:** When using `Object.entries()` to iterate over object keys (like `c.records`), JavaScript coerces keys to strings. If these keys are used to perform `.get()` lookups on a `Map` where the expected keys are numbers (e.g. `student.id`), the strict equality check of the `Map` will silently fail.
**Action:** When building and querying Maps from object keys, enforce explicit and consistent type coercion (e.g. `String(student.id)`) on both Map insertion and retrieval.

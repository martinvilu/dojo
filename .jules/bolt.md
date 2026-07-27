## 2025-02-18 - Repeated Date instantiations in functional components
**Learning:** Large functional components (like `src/app/dashboard/page.tsx` with >6000 lines) often perform repeated unmemoized operations inside loops during renders. Specifically, instantiating `new Date()` within nested `filter`, `some`, and `map` iterations causes an $O(N \times M)$ overhead for simple comparisons (e.g. checking if assignments are past due).
**Action:** Always extract and memoize date instantiations or complex data processing that relies on invariant state during a single render cycle, using `useMemo` and Set lookups for $O(1)$ performance in inner loops.

## 2026-07-25 - O(N) array filtering within calendar grid render
**Learning:** In a calendar view that renders ~35-42 days, calling `getEventsForDate(dateStr)` which iterates over all events ((N)$) for every single day results in (N 	imes D)$ operations on every render. This was discovered in `src/components/dashboard/calendar/CalendarPanel.tsx`.
**Action:** Pre-compute an `eventsByDate` hash map using `useMemo` ((N)$) so that event lookups per day become (1)$, reducing overall complexity to (N + D)$.

## 2026-07-26 - O(N^2) array filtering and Date instantiations within Dashboard chronogram rendering
**Learning:** In a large functional component (`src/app/dashboard/page.tsx`), rendering the chronogram list executes an O(N) `courseAttendance.find()` on every iteration of the loop, along with calling `new Date()` repeatedly. This causes O(N^2) scaling when iterating through the grouped weekly classes.
**Action:** Use `useMemo` to build an `attendanceByClassNumber` Map. Iterate the source array backwards (so the first matching item wins, mirroring `.find()`) to provide O(1) lookups. Hoist Date calculations that evaluate current day/time outside of loops to eliminate repeated object allocations.

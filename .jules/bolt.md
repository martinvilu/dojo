## 2025-02-18 - Repeated Date instantiations in functional components
**Learning:** Large functional components (like `src/app/dashboard/page.tsx` with >6000 lines) often perform repeated unmemoized operations inside loops during renders. Specifically, instantiating `new Date()` within nested `filter`, `some`, and `map` iterations causes an $O(N \times M)$ overhead for simple comparisons (e.g. checking if assignments are past due).
**Action:** Always extract and memoize date instantiations or complex data processing that relies on invariant state during a single render cycle, using `useMemo` and Set lookups for $O(1)$ performance in inner loops.

## 2026-07-25 - O(N) array filtering within calendar grid render
**Learning:** In a calendar view that renders ~35-42 days, calling `getEventsForDate(dateStr)` which iterates over all events ((N)$) for every single day results in (N 	imes D)$ operations on every render. This was discovered in `src/components/dashboard/calendar/CalendarPanel.tsx`.
**Action:** Pre-compute an `eventsByDate` hash map using `useMemo` ((N)$) so that event lookups per day become (1)$, reducing overall complexity to (N + D)$.

## 2023-10-27 - O(N) array filtering within map/reduce calls across large datasets
**Learning:** In components rendering long lists of entities like `CourseStudentsPanel`, nested iterations using `.filter()` and `.find()` over relationships (like `courseAttendance` or `courseSubmissions`) within standard `.map()` render loops or `.reduce()` aggregation functions result in severe O(N*M) or O(N^2) complexity. This causes massive slowdowns on re-renders or when exporting large CSV/PDF files.
**Action:** Always pre-compute relationships into O(1) lookups using Hash Maps (like `Map<StudentId, Map<AssignmentId, Submission>>`) encapsulated in a `useMemo` block. This reduces rendering and aggregation from O(N^2) to O(N).

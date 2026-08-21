## 2025-02-18 - Repeated Date instantiations in functional components
**Learning:** Large functional components (like `src/app/dashboard/page.tsx` with >6000 lines) often perform repeated unmemoized operations inside loops during renders. Specifically, instantiating `new Date()` within nested `filter`, `some`, and `map` iterations causes an $O(N \times M)$ overhead for simple comparisons (e.g. checking if assignments are past due).
**Action:** Always extract and memoize date instantiations or complex data processing that relies on invariant state during a single render cycle, using `useMemo` and Set lookups for $O(1)$ performance in inner loops.

## 2026-07-25 - O(N) array filtering within calendar grid render
**Learning:** In a calendar view that renders ~35-42 days, calling `getEventsForDate(dateStr)` which iterates over all events ((N)$) for every single day results in (N 	imes D)$ operations on every render. This was discovered in `src/components/dashboard/calendar/CalendarPanel.tsx`.
**Action:** Pre-compute an `eventsByDate` hash map using `useMemo` ((N)$) so that event lookups per day become (1)$, reducing overall complexity to (N + D)$.
## 2026-10-09 - Redundant array filtering inside component render cycle
**Learning:** Component `CourseOverviewPanel.tsx` recalculated student risk status 4 times per render within different visual sections (e.g. summary cards and tables). These inline `filter` and `some` operations caused extreme performance bottlenecks with an overall runtime of $O(4 \times R \times (A+S))$ operations.
**Action:** Extract deeply nested, repeated array filter/map logic over large arrays like `roster` out of JSX inline blocks, and replace them with a precomputed $O(1)$ Hash Map populated via `useMemo`.

## 2025-02-18 - Repeated Date instantiations in functional components
**Learning:** Instantiating `new Date()` within nested `map` iterations causes an $O(N \times M)$ overhead for simple comparisons (e.g. checking if assignments are past due or classes passed) and can cause memory leaks / performance degradation in large lists.
**Action:** Always extract and memoize date instantiations or complex data processing that relies on invariant state during a single render cycle, using `useMemo` and Set/Map lookups for $O(1)$ performance in inner loops.

## 2023-10-25 - O(N*M) filtering inside render loops
**Learning:** Found an $O(N \times M)$ anti-pattern in `src/modules/course/components/CourseSchedulesPanel.tsx` where an array of comments ($M$) was being `.filter()`'d inside a `.map()` that rendered a list of classes ($N$) to find comment counts per class. This caused significant performance degradation on every render when both lists are large.
**Action:** Replace nested loops by pre-computing counts with a `useMemo` block into a `Map` ($O(N + M)$), and then use `O(1)` map lookups inside the render cycle.

## 2023-10-27 - O(N) array filtering within map/reduce calls across large datasets
**Learning:** In components rendering long lists of entities like `CourseStudentsPanel`, nested iterations using `.filter()` and `.find()` over relationships (like `courseAttendance` or `courseSubmissions`) within standard `.map()` render loops or `.reduce()` aggregation functions result in severe O(N*M) or O(N^2) complexity. This causes massive slowdowns on re-renders or when exporting large CSV/PDF files.
**Action:** Always pre-compute relationships into O(1) lookups using Hash Maps (like `Map<StudentId, Map<AssignmentId, Submission>>`) encapsulated in a `useMemo` block. This reduces rendering and aggregation from O(N^2) to O(N).
## 2024-11-20 - Memoizing Date formatting vs inline strings
**Learning:** Instantiating `Intl.DateTimeFormat` dynamically within render loops using `.toLocaleDateString()` and `.toLocaleTimeString()` scales horribly and introduces rendering jank due to high computation costs. This was seen heavily in components like `CourseSchedulesPanel.tsx`. Also attempted string comparison for sorting ISO string arrays but had to revert because localized format comparisons break order, requiring specific structural verification.
**Action:** Always pre-initialize `Intl.DateTimeFormat` configurations outside the React component (at module level) and inject the static instances into render `.map` loops for `format()` calls.

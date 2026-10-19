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
## 2023-10-27 - O(N) Array Scans in Re-rendered Memo Hooks
**Learning:** In heavily used components like CommandPalette (which manages global search), `Array.find()` operations inside heavily triggered `useMemo` blocks can compound to O(N * M) performance drops if called iteratively (e.g. searching a list of thousands of assignments against an array of courses). A seemingly innocuous lookup becomes a noticeable bottleneck during rapid typing.
**Action:** When filtering or mapping large arrays inside `useMemo`, immediately look for nested `Array.find()` calls. Precompute a single `Map` of the target data structure at the start of the hook and swap the logic to O(1) `.get()` lookups. Also, double-check that scratchpad scripts and lockfiles are removed before submitting.

## 2024-05-18 - Replacing nested `.filter()` inside `forEach` with Hash Maps
**Learning:** O(N) array filtering inside loops (e.g. `roster.forEach`) across large dataset combinations (`courseAttendance` and `courseSubmissions`) creates hidden O(N²) scaling bottlenecks. In this project, iterating object entries across arrays to build stats adds significant CPU overhead during renders.
**Action:** Always pre-compute relationships into Hash Maps or Sets outside iterations for O(1) lookups instead of using `.some` and `.filter` to reduce complexity from `O(R * (A + S))` to `O(A + S + R * M)`.
## 2023-10-27 - O(N*M) Array Scans in Render Loops
**Learning:** Found an $O(N \times M)$ anti-pattern in `src/app/dashboard/hooks/useTabDataLoader.ts` where `Array.prototype.find()` was being used inside a `.map()` block across hundreds of courses and assignments. Multiple iterations compounded to cause significant overhead.
**Action:** Replace nested `find()` calls inside `map` operations by pre-computing a single $O(N)$ `Map` of the target data structure (like `courseNameMap = new Map()`) before the loop, and use $O(1)$ `.get()` lookups inside the loop.
## 2023-10-28 - O(N) Array filtering during Kanban render
**Learning:** Found multiple instances where arrays of React components were rendered using `.map().filter()` iteratively over four kanban columns inside `CourseSchedulesPanel.tsx`, calculating the same `O(N)` loop on every re-render. Similarly, `CourseStudentsPanel.tsx` recalculated its filtered roster inline inside the render `{roster.filter().map()}`.
**Action:** When working on Kanban-style UI or filtered lists, use `useMemo` to pre-compute and categorize items into O(1) properties (e.g. `kanbanColumns.teoricas`) to eliminate redundant mapping during the component render cycle.
## 2025-02-28 - O(N) filtering inside map loops is a silent killer
**Learning:** In React functional components handling lists (like `AssignmentsPanel.tsx`), repeatedly calling `.filter()` on an array inside another `.map()` or rendering conditional block (e.g., checking if the filtered length is 0) causes severe O(N^2) or O(N*M) performance bottlenecks because a new array is constructed on *every render* for *every item*.
**Action:** Always precompute these expensive filtered operations into a stable dictionary mapping (using `useMemo` that returns a `Record<string, any[]>`) *before* iterating over the main collection in JSX. This changes the O(N*M) continuous rendering cost into an O(1) dictionary lookup that only recalculates when dependency variables genuinely change.

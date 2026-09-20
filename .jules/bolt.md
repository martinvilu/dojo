## 2025-02-18 - Pre-computing O(1) Maps in React useMemo Hooks
**Learning:** In deeply nested loops calculating stats for large datasets (like student rosters, assignments, and attendance records), applying `.filter()` inside the loop for every student produces O(N * M) performance bottlenecks.
**Action:** Always pre-compute array lookups into Map or Set data structures before the inner loop when doing calculations inside `useMemo`, specifically ensuring original truthiness logic is preserved during the Map generation.

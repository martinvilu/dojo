## 2025-02-25 - UseMemo Array Optimization
**Learning:** Multiple array filter methods mapped to the same inputs inside a functional component can be optimized into a single pass loop using useMemo to reduce layout trashing on rendering.
**Action:** Always wrap derived states in useMemo and condense duplicated iterations (like filters/maps/forEach on the same object) to O(N) operations when a component frequently re-renders.

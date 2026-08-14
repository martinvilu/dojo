## 2024-05-18 - Pre-instantiating Intl.DateTimeFormat
**Learning:** Instantiating new `Intl.DateTimeFormat` instances inside a loop or render function is a significant performance bottleneck.
**Action:** Extract invariant instantiations (like `new Intl.DateTimeFormat()`) completely outside the component (at the module level) or memoize them to prevent expensive re-evaluations on every render.

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
    },
  },
  {
    // Avatars, QR codes and other dynamic external assets rendered inside the
    // auth-gated dashboard; next/image would require remotePatterns entries
    // and fixed dimensions without measurable LCP benefit here.
    files: [
      "src/app/dashboard/page.tsx",
      "src/modules/attendance/components/AttendanceManager.tsx",
      "src/modules/github/components/CommitVisualizer.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tests/**",
    "scripts/**",
    "functions/**",
    "public/**",
  ]),
]);

export default eslintConfig;

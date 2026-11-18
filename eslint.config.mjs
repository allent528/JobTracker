import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/types/database.types.ts",
    "test-results/**",
    "playwright-report/**",
    "blob-report/**",
    "playwright/.cache/**",
    // Vendored Claude skills (third-party scripts), not app code.
    ".claude/skills/**",
  ]),
]);

export default eslintConfig;

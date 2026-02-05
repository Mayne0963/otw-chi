import eslintConfigPrettier from "eslint-config-prettier";
import nextConfig from "eslint-config-next";

const config = [
  // Base Next.js rules (includes TypeScript support and Next.js plugin)
  ...nextConfig,
  {
    name: "custom:ignores",
    ignores: ["node_modules/**", "dist/**", "lib/generated/**", "scripts/**", "prisma/seed.js", ".vercel/**", ".next/**"]
  },
  {
    name: "custom:base-rules",
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  },
  {
    name: "custom:typescript-rules",
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    name: "custom:prettier",
    ...eslintConfigPrettier
  }
];

export default config;

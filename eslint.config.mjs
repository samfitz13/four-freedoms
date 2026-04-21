import nextConfig from "eslint-config-next";
import prettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [
  ...nextConfig,
  prettier,
  {
    ignores: [".next/**", "node_modules/**", "drizzle/**"],
  },
];

export default eslintConfig;

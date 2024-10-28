/**
 * @type {import("@types/eslint").Linter.BaseConfig}
 */
module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:hydrogen/recommended",
    "plugin:hydrogen/typescript",
  ],
  rules: {
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/naming-convention": "off",
    "hydrogen/prefer-image-component": "off",
    "no-useless-escape": "off",
    "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
    "no-case-declarations": "off",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prettier/prettier": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
        args: "none", // Ignore all args in type definitions
      },
    ],
    "jest/no-deprecated-functions": "off",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};

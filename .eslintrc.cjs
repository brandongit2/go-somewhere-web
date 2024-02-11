module.exports = {
	root: true,
	extends: [
		`eslint:recommended`,
		`plugin:import/recommended`,
		`next/core-web-vitals`,
		`next`,
		`plugin:@tanstack/eslint-plugin-query/recommended`,
	],
	rules: {
		"import/no-duplicates": `error`,
		"import/order": [
			`warn`,
			{
				groups: [
					[`builtin`, `external`],
					[`object`, `unknown`, `type`],
					[`internal`, `parent`, `index`, `sibling`],
				],
				pathGroups: [{pattern: `@/**`, group: `parent`}],
				pathGroupsExcludedImportTypes: [`type`],
				"newlines-between": `always`,
				alphabetize: {order: `asc`, caseInsensitive: true},
				warnOnUnassignedImports: true,
			},
		],
		"@next/next/no-assign-module-variable": `off`,
		"no-console": [`warn`, {allow: [`info`, `warn`, `error`]}],
		"no-constant-condition": [`error`, {checkLoops: false}],
		"no-debugger": `warn`,
		"no-empty": [`warn`, {allowEmptyCatch: true}],
		"no-mixed-spaces-and-tabs": [`warn`, `smart-tabs`],
		"no-unused-vars": [`warn`, {ignoreRestSiblings: true}],
		quotes: [`warn`, `backtick`],
	},
	overrides: [
		{
			files: [`**/*.ts`, `**/*.tsx`],
			plugins: [`@typescript-eslint`],
			parserOptions: {
				project: true,
				tsconfigRootDir: __dirname,
			},
			extends: [
				`plugin:@typescript-eslint/recommended-type-checked`,
				`plugin:@typescript-eslint/stylistic-type-checked`,
			],
			rules: {
				"@typescript-eslint/consistent-type-definitions": [`warn`, `type`],
				"@typescript-eslint/consistent-type-imports": `warn`,
				"@typescript-eslint/no-unnecessary-condition": `warn`,
				"@typescript-eslint/no-unused-vars": [`warn`, {ignoreRestSiblings: true}],
				"@typescript-eslint/quotes": [`warn`, `backtick`],
				"prefer-const": `off`,
				quotes: `off`,
			},
		},
		{
			files: [`**/*.jsx`, `**/*.tsx`],
			extends: [`plugin:react/jsx-runtime`],
			rules: {
				"react/button-has-type": `warn`,
				"react/display-name": `warn`,
				"react/jsx-boolean-value": `warn`,
				"react/jsx-curly-brace-presence": `warn`,
				"react/jsx-no-useless-fragment": [`warn`, {allowExpressions: true}],
				"react/no-unescaped-entities": `warn`,
				"react/no-unused-prop-types": `warn`,
			},
		},
	],
}

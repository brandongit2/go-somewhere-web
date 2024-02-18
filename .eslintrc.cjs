module.exports = {
	root: true,
	extends: [`eslint:recommended`, `plugin:import/recommended`],
	env: {
		browser: true,
		node: true,
	},
	plugins: [`import`],
	settings: {
		"import/parsers": {
			[require.resolve(`@typescript-eslint/parser`)]: [`.ts`, `.mts`, `.cts`, `.d.ts`],
		},
		"import/resolver": {
			[require.resolve(`eslint-import-resolver-node`)]: {
				extensions: [`.js`, `.ts`],
			},
			[require.resolve(`eslint-import-resolver-typescript`)]: {
				alwaysTryTypes: true,
			},
		},
	},
	rules: {
		"import/extensions": [`warn`, `always`],
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
			parser: `@typescript-eslint/parser`,
			parserOptions: {
				project: true,
				tsconfigRootDir: __dirname,
			},
			extends: [
				`plugin:@typescript-eslint/recommended-type-checked`,
				`plugin:@typescript-eslint/stylistic-type-checked`,
			],
			rules: {
				"@typescript-eslint/array-type": [`warn`, {default: `array-simple`}],
				"@typescript-eslint/consistent-type-definitions": [`warn`, `type`],
				"@typescript-eslint/consistent-type-imports": `warn`,
				"@typescript-eslint/no-unnecessary-condition": `warn`,
				"@typescript-eslint/no-unused-vars": [`warn`, {ignoreRestSiblings: true}],
				"@typescript-eslint/quotes": [`warn`, `backtick`],
				"prefer-const": `off`,
				quotes: `off`,
			},
		},
	],
}

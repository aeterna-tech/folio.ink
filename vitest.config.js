import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		// Синтез-движок и фильтры — чистые функции над обычными JS-объектами,
		// DOM им не нужен, поэтому 'node' быстрее, чем 'jsdom'.
		environment: 'node',
		include: ['src/**/*.{test,spec}.{js,jsx}'],
		reporters: 'default',
		// npm run test должен падать с ненулевым кодом при провале — это
		// поведение `vitest run` по умолчанию (в отличие от `vitest` без
		// run, который остаётся в watch-режиме), см. package.json.
	},
})

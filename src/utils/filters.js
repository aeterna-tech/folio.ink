/**
 * Фильтрация записей (Entry, в форме, которую отдаёт getEntries() из
 * api/client.js: { id, projectId, date: 'YYYY-MM-DD', durationMinutes,
 * text, tags: string[] }) по диапазону дат и по тегам.
 *
 * Чистые функции без побочных эффектов — не знают ни про React, ни про
 * API, ни про DOM. Используются artifacts.js (синтез-движок) и могут
 * применяться отдельно где угодно ещё, где на входе список entries.
 */

/**
 * Разбирает 'YYYY-MM-DD' в Date в локальном времени (полночь).
 * Namespace-строки вроде entry.date всегда в этом формате (см.
 * toLocalISODate() в App.jsx) — важно не использовать `new Date(str)`
 * напрямую, так как для голых 'YYYY-MM-DD' она парсит как UTC-полночь,
 * что на часовых поясах западнее UTC сдвигает день на минус один.
 *
 * @param {string|Date|null} value
 * @returns {Date|null}
 * @throws {Error} если строка не парсится как дата
 */
export function parseISODate(value) {
	if (value == null) return null
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) {
			throw new Error('Некорректная дата')
		}
		return value
	}

	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (!match) {
		throw new Error(
			`Некорректный формат даты: ${JSON.stringify(value)} (ожидается YYYY-MM-DD)`,
		)
	}

	const [, year, month, day] = match
	const date = new Date(Number(year), Number(month) - 1, Number(day))
	// new Date(2026, 1, 30) "перекатывает" несуществующий день (30 февраля)
	// в март вместо того, чтобы бросить ошибку — проверяем вручную.
	if (
		date.getFullYear() !== Number(year) ||
		date.getMonth() !== Number(month) - 1 ||
		date.getDate() !== Number(day)
	) {
		throw new Error(`Несуществующая дата: ${value}`)
	}

	return date
}

/**
 * Возвращает записи, чья `.date` попадает в диапазон [start, end]
 * ВКЛЮЧИТЕЛЬНО с обеих сторон.
 *
 * - `start`/`end` — `null`/`undefined` (граница не задана — диапазон
 *   открыт с этой стороны), либо строка 'YYYY-MM-DD'.
 * - Пустой список на входе — пустой список на выходе.
 * - `start > end` — бросает Error (бессмысленный диапазон лучше явно
 *   провалить, чем молча вернуть пустой список).
 *
 * @param {Array<{date: string}>} entries
 * @param {string|null} [start]
 * @param {string|null} [end]
 * @returns {Array}
 */
export function filterByDateRange(entries, start = null, end = null) {
	const startDate = parseISODate(start)
	const endDate = parseISODate(end)

	if (startDate && endDate && startDate > endDate) {
		throw new Error('Начальная дата не может быть позже конечной')
	}

	return entries.filter(entry => {
		const entryDate = parseISODate(entry.date)
		if (startDate && entryDate < startDate) return false
		if (endDate && entryDate > endDate) return false
		return true
	})
}

/**
 * Фильтрует записи по названиям тегов (без учёта регистра).
 *
 * - `tags` — `null`/`undefined`/пустой массив -> фильтрация не
 *   применяется, возвращаются все записи как есть.
 * - `match='any'` (по умолчанию) — запись проходит, если у неё есть
 *   хотя бы один из запрошенных тегов.
 * - `match='all'` — запись должна содержать ВСЕ запрошенные теги.
 * - Записи без тегов (`tags` пуст или отсутствует) никогда не проходят
 *   непустой фильтр.
 * - Теги, которых ни у одной записи нет (опечатка, несуществующий тег),
 *   просто не дают совпадений — это не ошибка, а пустой результат.
 *
 * @param {Array<{tags?: string[]}>} entries
 * @param {string[]|null} [tags]
 * @param {'any'|'all'} [match]
 * @returns {Array}
 */
export function filterByTags(entries, tags = null, match = 'any') {
	const wanted = (tags || [])
		.map(tag => (tag || '').trim().toLowerCase())
		.filter(Boolean)

	if (wanted.length === 0) return [...entries]

	if (match !== 'any' && match !== 'all') {
		throw new Error(
			`Некорректный режим match: ${JSON.stringify(match)} (ожидается 'any' или 'all')`,
		)
	}

	return entries.filter(entry => {
		const entryTags = new Set((entry.tags || []).map(t => t.toLowerCase()))
		if (match === 'any') return wanted.some(tag => entryTags.has(tag))
		return wanted.every(tag => entryTags.has(tag))
	})
}

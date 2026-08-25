// Утилиты фильтрации записей и синтеза markdown-текста для трёх
// пресетов: "Стендап" (вчера/сегодня), "Отчёт" (произвольный диапазон
// дат) и "Brag doc" (всё время, со сводной статистикой).
//
// Специально вынесено из компонентов в чистые функции без React и без
// побочных эффектов — именно они и покрыты тестами в digest.test.js.

/**
 * Фильтрует записи по диапазону дат (включительно с обеих сторон).
 * entry.date и start/end — строки 'YYYY-MM-DD'; сравнение лексикографическое,
 * что корректно работает для ISO-дат без парсинга в Date.
 * Отсутствующий start/end трактуется как "без ограничения с этой стороны".
 */
export function filterEntriesByDateRange(entries, { start, end } = {}) {
	return entries.filter(entry => {
		if (start && entry.date < start) return false
		if (end && entry.date > end) return false
		return true
	})
}

/**
 * Фильтрует записи по тегам.
 * matchMode: 'any' (по умолчанию) — запись проходит, если содержит хотя бы
 * один из tags; 'all' — только если содержит все.
 * Пустой/отсутствующий tags — фильтр не применяется, проходят все записи
 * (в том числе без единого тега).
 */
export function filterEntriesByTags(entries, tags = [], matchMode = 'any') {
	if (!tags || tags.length === 0) return entries
	const wanted = tags.map(t => t.toLowerCase())
	return entries.filter(entry => {
		const entryTags = (entry.tags || []).map(t => t.toLowerCase())
		return matchMode === 'all'
			? wanted.every(t => entryTags.includes(t))
			: wanted.some(t => entryTags.includes(t))
	})
}

// Форматирует дату в YYYY-MM-DD по ЛОКАЛЬНОМУ времени (не UTC) — та же
// логика, что уже используется в App.jsx/LogEditor.jsx, продублирована
// здесь намеренно, чтобы digest.js не тянул зависимость на компоненты.
function toLocalISODate(date) {
	const d = new Date(date)
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

/**
 * Готовые диапазоны дат для пресетов, которые не требуют ручного выбора:
 *   'standup' — вчера + сегодня
 *   'brag'    — без ограничений (всё время)
 * Диапазон для 'report' пользователь всегда задаёт сам через UI, поэтому
 * здесь для него (и для любого неизвестного пресета) возвращается
 * "без ограничений" — вызывающий код обязан подставить свои start/end.
 */
export function getPresetDateRange(preset, referenceDate = new Date()) {
	if (preset === 'standup') {
		const yesterday = new Date(referenceDate)
		yesterday.setDate(yesterday.getDate() - 1)
		return {
			start: toLocalISODate(yesterday),
			end: toLocalISODate(referenceDate),
		}
	}
	return { start: undefined, end: undefined }
}

function formatDuration(minutes) {
	const h = Math.floor(minutes / 60)
	const m = minutes % 60
	if (h === 0) return `${m}m`
	if (m === 0) return `${h}h`
	return `${h}h ${m}m`
}

function groupByDate(entries) {
	const map = new Map()
	for (const entry of entries) {
		if (!map.has(entry.date)) map.set(entry.date, [])
		map.get(entry.date).push(entry)
	}
	// Свежие даты сверху.
	return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

function formatDateHeading(dateStr, locale) {
	const d = new Date(`${dateStr}T00:00:00`)
	return d.toLocaleDateString(locale, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
	})
}

const PRESET_TITLES = {
	standup: 'Standup',
	report: 'Report',
	brag: 'Brag Doc',
}

/**
 * Синтезирует markdown-текст артефакта из УЖЕ отфильтрованных записей
 * (см. filterEntriesByDateRange/filterEntriesByTags выше — вызывающий
 * код сначала фильтрует, потом передаёт результат сюда).
 *
 * preset влияет только на заголовок и наличие сводной статистики —
 * сама структура (группировка по дате, буллеты по записям) общая для
 * всех трёх пресетов, так что это один механизм с разными "шапками",
 * а не три отдельных генератора.
 */
export function buildDigestText({
	project,
	entries,
	preset,
	dateLocale = 'en-US',
}) {
	const groups = groupByDate(entries)
	const totalMinutes = entries.reduce(
		(sum, e) => sum + (e.durationMinutes || 0),
		0,
	)

	const title = PRESET_TITLES[preset] || 'Digest'
	const lines = [`# ${title} — ${project?.name ?? ''}`, '']

	if (preset === 'brag') {
		const tagCounts = {}
		entries.forEach(e => {
			;(e.tags || []).forEach(tag => {
				tagCounts[tag] = (tagCounts[tag] || 0) + 1
			})
		})
		const topTags = Object.entries(tagCounts)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([tag]) => `#${tag}`)

		lines.push(
			`**${entries.length}** entries · **${formatDuration(totalMinutes)}** total`,
		)
		if (topTags.length) lines.push(`Top tags: ${topTags.join(', ')}`)
		lines.push('')
	} else if (entries.length > 0) {
		lines.push(
			`_${formatDuration(totalMinutes)} total across ${entries.length} ${
				entries.length === 1 ? 'entry' : 'entries'
			}_`,
		)
		lines.push('')
	}

	if (groups.length === 0) {
		lines.push('_No entries in this range._')
	}

	for (const [date, dateEntries] of groups) {
		lines.push(`## ${formatDateHeading(date, dateLocale)}`)
		for (const entry of dateEntries) {
			const tagsSuffix = entry.tags?.length
				? ` (${entry.tags.map(t => `#${t}`).join(' ')})`
				: ''
			const text = (entry.text || '').trim() || '_no notes_'
			lines.push(
				`- **${formatDuration(entry.durationMinutes)}** — ${text}${tagsSuffix}`,
			)
		}
		lines.push('')
	}

	return lines.join('\n').trimEnd() + '\n'
}

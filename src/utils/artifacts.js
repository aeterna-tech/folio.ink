/**
 * Artifact Synthesis Engine — превращает записи проекта (entries из
 * getEntries()) в готовый Markdown-документ по одному из пресетов:
 * standup / sprint_report / brag_doc.
 *
 * Работает целиком на фронтенде, на данных, уже загруженных через
 * getEntries() — бэкенд ничего не знает про пресеты (см.
 * backend/app/routes/projects.py: export_project теперь отдаёт только
 * сырые entries).
 *
 * Архитектура: один универсальный driver — generateArtifact() — который
 * фильтрует (filters.js) и делегирует форматирование конкретному
 * пресету. Добавить новый пресет — значит добавить запись в PRESETS,
 * а не копировать пайплайн фильтрации.
 */
import { filterByDateRange, filterByTags, parseISODate } from './filters'

const DEFAULT_HIGHLIGHT_TAGS = [
	'milestone',
	'shipped',
	'launch',
	'achievement',
	'win',
]

// --- Общие хелперы форматирования --------------------------------------

function groupBy(items, keyFn) {
	const groups = new Map()
	for (const item of items) {
		const key = keyFn(item)
		if (!groups.has(key)) groups.set(key, [])
		groups.get(key).push(item)
	}
	return groups
}

function formatHours(minutes) {
	return (minutes / 60).toFixed(1)
}

/**
 * Одна запись -> одна строка Markdown-списка, например:
 *   - **1.5h** Fixed the login redirect bug  #bugfix #auth
 * Берём только первую строку контента — заметки могут быть многостроч-
 * ными Markdown-блоками, полный текст в компактном отчёте не нужен.
 */
function formatEntryLine(entry, { withDate = false, marker = '-' } = {}) {
	const firstLine = (entry.text || '').trim().split('\n')[0] || ''
	const tagsSuffix = (entry.tags || []).length
		? '  ' + entry.tags.map(tag => `#${tag}`).join(' ')
		: ''

	let line = `${marker} `
	if (withDate) line += `${entry.date} — `
	line += `**${formatHours(entry.durationMinutes)}h**`
	if (firstLine) line += ` ${firstLine}`
	return line + tagsSuffix
}

/** ISO-8601 неделя ('2026-W03'), считается в UTC чтобы не зависеть от TZ окружения. */
function isoWeekKey(date) {
	const d = new Date(
		Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
	)
	const dayNum = d.getUTCDay() || 7 // Вс(0) -> 7, чтобы неделя начиналась с Пн
	d.setUTCDate(d.getUTCDate() + 4 - dayNum)
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
	const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
	return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function joinLines(lines) {
	// Схлопываем случайные тройные+ переносы (например, пустая группа)
	// в один пустой абзац и убираем висящие переносы в конце файла.
	return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

function countTags(entries) {
	const counts = new Map()
	for (const entry of entries) {
		for (const tag of entry.tags || []) {
			const key = tag.toLowerCase()
			counts.set(key, (counts.get(key) || 0) + 1)
		}
	}
	return counts
}

// --- Пресеты -------------------------------------------------------------

/**
 * Standup: последние N дней активности (по умолчанию 2 — "вчера/сегодня"),
 * сгруппированные по дню, без итогов — стендап про "что делал", а не про
 * общую статистику.
 */
function generateStandup(entries, options = {}) {
	const { days = 2 } = options
	const title = '# Daily Standup'

	if (entries.length === 0) {
		return joinLines([title, '', '_No activity in the selected range._'])
	}

	const distinctDates = [...new Set(entries.map(e => e.date))].sort(
		(a, b) => (a < b ? 1 : -1),
	)
	const recentDates = new Set(distinctDates.slice(0, days))
	const relevant = entries.filter(e => recentDates.has(e.date))

	const lines = [title, '']
	const byDate = groupBy(relevant, e => e.date)
	const sortedDates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1))

	for (const date of sortedDates) {
		lines.push(`## ${date}`)
		for (const entry of byDate.get(date)) {
			lines.push(formatEntryLine(entry))
		}
		lines.push('')
	}

	return joinLines(lines)
}

/**
 * Sprint Report: все отфильтрованные записи, сгруппированные по ISO-неделе,
 * с итогом по неделе и по всему периоду, плюс сводка по тегам.
 */
function generateSprintReport(entries) {
	const title = '# Sprint Report'

	if (entries.length === 0) {
		return joinLines([title, '', '_No entries in this sprint._'])
	}

	const lines = [title, '']
	const byWeek = groupBy(entries, e => isoWeekKey(parseISODate(e.date)))
	const sortedWeeks = [...byWeek.keys()].sort()

	for (const week of sortedWeeks) {
		const weekEntries = byWeek.get(week)
		const weekMinutes = weekEntries.reduce(
			(sum, e) => sum + (e.durationMinutes || 0),
			0,
		)
		lines.push(`## ${week} — ${formatHours(weekMinutes)}h`)
		for (const entry of weekEntries) {
			lines.push(formatEntryLine(entry, { withDate: true }))
		}
		lines.push('')
	}

	const totalMinutes = entries.reduce(
		(sum, e) => sum + (e.durationMinutes || 0),
		0,
	)
	const entryWord = entries.length === 1 ? 'entry' : 'entries'
	lines.push(
		`**Total: ${formatHours(totalMinutes)}h across ${entries.length} ${entryWord}**`,
	)

	const tagCounts = [...countTags(entries).entries()].sort(
		(a, b) => b[1] - a[1],
	)
	if (tagCounts.length > 0) {
		lines.push('')
		lines.push('## Tags summary')
		for (const [tag, count] of tagCounts) {
			lines.push(`- #${tag} × ${count}`)
		}
	}

	return joinLines(lines)
}

/**
 * Brag Doc: выделяет только "заметные" записи — либо достаточно долгие
 * (>= minMinutes), либо помеченные одним из highlightTags — и группирует
 * их по месяцу. Обычная рутинная работа сознательно не попадает внутрь:
 * это документ для перечисления достижений, а не полный лог.
 */
function generateBragDoc(entries, options = {}) {
	const { minMinutes = 60, highlightTags = DEFAULT_HIGHLIGHT_TAGS } = options
	const title = '# Brag Doc'
	const wanted = new Set(highlightTags.map(t => t.toLowerCase()))

	const highlights = entries.filter(entry => {
		const isLongEnough = (entry.durationMinutes || 0) >= minMinutes
		const entryTags = new Set((entry.tags || []).map(t => t.toLowerCase()))
		const isTaggedHighlight = [...wanted].some(tag => entryTags.has(tag))
		return isLongEnough || isTaggedHighlight
	})

	if (highlights.length === 0) {
		return joinLines([
			title,
			'',
			'_Nothing logged yet — go build something brag-worthy._',
		])
	}

	const lines = [title, '']
	const byMonth = groupBy(highlights, e => e.date.slice(0, 7)) // 'YYYY-MM'
	const sortedMonths = [...byMonth.keys()].sort()

	for (const month of sortedMonths) {
		lines.push(`## ${month}`)
		for (const entry of byMonth.get(month)) {
			lines.push(formatEntryLine(entry, { withDate: true, marker: '- ⭐' }))
		}
		lines.push('')
	}

	lines.push('_Generated by folio.ink_')

	return joinLines(lines)
}

export const PRESETS = {
	standup: { key: 'standup', label: 'Daily Standup', generate: generateStandup },
	sprint_report: {
		key: 'sprint_report',
		label: 'Sprint Report',
		generate: generateSprintReport,
	},
	brag_doc: { key: 'brag_doc', label: 'Brag Doc', generate: generateBragDoc },
}

/**
 * Главный driver: фильтрует entries (дата/теги) и делегирует форматирование
 * выбранному пресету.
 *
 * @param {Array} entries — записи из getEntries()
 * @param {'standup'|'sprint_report'|'brag_doc'} presetKey
 * @param {object} [options]
 * @param {string} [options.start] — 'YYYY-MM-DD', включительно
 * @param {string} [options.end] — 'YYYY-MM-DD', включительно
 * @param {string[]} [options.tags] — фильтр по тегам
 * @param {'any'|'all'} [options.tagMatch] — режим сочетания тегов (default 'any')
 * @param {...*} [options.presetOptions] — остальные ключи прокидываются в сам пресет
 *        (например `days` для standup, `minMinutes`/`highlightTags` для brag_doc)
 * @returns {string} готовый Markdown-документ
 */
export function generateArtifact(entries, presetKey, options = {}) {
	const preset = PRESETS[presetKey]
	if (!preset) {
		throw new Error(
			`Неизвестный пресет: ${JSON.stringify(presetKey)}. Доступные: ${Object.keys(PRESETS).join(', ')}`,
		)
	}

	const { start, end, tags, tagMatch = 'any', ...presetOptions } = options

	let filtered = filterByDateRange(entries, start ?? null, end ?? null)
	filtered = filterByTags(filtered, tags ?? null, tagMatch)

	return preset.generate(filtered, presetOptions)
}

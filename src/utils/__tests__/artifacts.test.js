import { describe, it, expect } from 'vitest'
import { generateArtifact, PRESETS } from '../artifacts'

function makeEntry({ date, tags = [], durationMinutes = 30, text = '' }) {
	return { id: `${date}-${text}-${Math.random()}`, date, tags, durationMinutes, text }
}

describe('generateArtifact — driver', () => {
	it('throws for an unknown preset key', () => {
		expect(() => generateArtifact([], 'nonexistent')).toThrow()
	})

	it('exposes exactly the three required presets', () => {
		expect(Object.keys(PRESETS).sort()).toEqual([
			'brag_doc',
			'sprint_report',
			'standup',
		])
	})

	it('applies date-range filtering before handing off to the preset', () => {
		const inRange = makeEntry({ date: '2026-01-10', text: 'In range' })
		const outOfRange = makeEntry({ date: '2026-02-01', text: 'Out of range' })

		const markdown = generateArtifact(
			[inRange, outOfRange],
			'sprint_report',
			{ start: '2026-01-01', end: '2026-01-31' },
		)

		expect(markdown).toContain('In range')
		expect(markdown).not.toContain('Out of range')
	})

	it('includes entries exactly on the date-range boundaries (overlapping boundaries)', () => {
		const onStart = makeEntry({ date: '2026-01-01', text: 'On start boundary' })
		const onEnd = makeEntry({ date: '2026-01-31', text: 'On end boundary' })

		const markdown = generateArtifact(
			[onStart, onEnd],
			'sprint_report',
			{ start: '2026-01-01', end: '2026-01-31' },
		)

		expect(markdown).toContain('On start boundary')
		expect(markdown).toContain('On end boundary')
	})

	it('applies tag filtering before handing off to the preset', () => {
		const tagged = makeEntry({ date: '2026-01-10', tags: ['bugfix'], text: 'Fixed bug' })
		const untagged = makeEntry({ date: '2026-01-11', text: 'Random note' })

		const markdown = generateArtifact([tagged, untagged], 'sprint_report', {
			tags: ['bugfix'],
		})

		expect(markdown).toContain('Fixed bug')
		expect(markdown).not.toContain('Random note')
	})

	it('propagates an invalid date range as an error instead of silently returning empty', () => {
		expect(() =>
			generateArtifact([], 'sprint_report', { start: '2026-02-01', end: '2026-01-01' }),
		).toThrow()
	})
})

describe('standup preset', () => {
	it('shows the empty-range message for an empty entries list', () => {
		const markdown = generateArtifact([], 'standup')
		expect(markdown).toContain('# Daily Standup')
		expect(markdown).toContain('No activity in the selected range')
	})

	it('only includes the most recent N distinct days (default 2)', () => {
		const today = makeEntry({ date: '2026-01-15', text: 'Today work' })
		const yesterday = makeEntry({ date: '2026-01-14', text: 'Yesterday work' })
		const older = makeEntry({ date: '2026-01-10', text: 'Old work' })

		const markdown = generateArtifact([today, yesterday, older], 'standup')

		expect(markdown).toContain('Today work')
		expect(markdown).toContain('Yesterday work')
		expect(markdown).not.toContain('Old work')
	})

	it('respects a custom `days` option', () => {
		const day1 = makeEntry({ date: '2026-01-15', text: 'Day 1' })
		const day2 = makeEntry({ date: '2026-01-14', text: 'Day 2' })
		const day3 = makeEntry({ date: '2026-01-13', text: 'Day 3' })

		const markdown = generateArtifact([day1, day2, day3], 'standup', { days: 3 })

		expect(markdown).toContain('Day 1')
		expect(markdown).toContain('Day 2')
		expect(markdown).toContain('Day 3')
	})

	it('renders one heading per included day', () => {
		const markdown = generateArtifact(
			[makeEntry({ date: '2026-01-15' }), makeEntry({ date: '2026-01-14' })],
			'standup',
		)

		expect(markdown).toContain('## 2026-01-15')
		expect(markdown).toContain('## 2026-01-14')
	})

	it('does not include a totals line (standup is not a summary)', () => {
		const markdown = generateArtifact([makeEntry({ date: '2026-01-15' })], 'standup')
		expect(markdown).not.toContain('Total:')
	})

	it('formats entries without tags without a trailing tag suffix', () => {
		const markdown = generateArtifact(
			[makeEntry({ date: '2026-01-15', text: 'No tags here', tags: [] })],
			'standup',
		)
		const line = markdown.split('\n').find(l => l.includes('No tags here'))
		expect(line).not.toContain('#')
	})
})

describe('sprint_report preset', () => {
	it('shows the empty message for an empty entries list', () => {
		const markdown = generateArtifact([], 'sprint_report')
		expect(markdown).toContain('# Sprint Report')
		expect(markdown).toContain('No entries in this sprint')
	})

	it('groups entries by ISO week', () => {
		// Известные из независимого расчёта: 2026-01-05/06 -> W02, 2026-01-12/13 -> W03
		const entries = [
			makeEntry({ date: '2026-01-05', durationMinutes: 60, text: 'Week 2 A' }),
			makeEntry({ date: '2026-01-06', durationMinutes: 30, text: 'Week 2 B' }),
			makeEntry({ date: '2026-01-12', durationMinutes: 90, text: 'Week 3 A' }),
		]

		const markdown = generateArtifact(entries, 'sprint_report')

		expect(markdown).toContain('## 2026-W02')
		expect(markdown).toContain('## 2026-W03')
		expect(markdown).toContain('Week 2 A')
		expect(markdown).toContain('Week 3 A')
	})

	it('calculates per-week and overall totals correctly', () => {
		const entries = [
			makeEntry({ date: '2026-01-05', durationMinutes: 60 }),
			makeEntry({ date: '2026-01-06', durationMinutes: 30 }),
		]

		const markdown = generateArtifact(entries, 'sprint_report')

		// Неделя: (60+30)/60 = 1.5ч
		expect(markdown).toContain('## 2026-W02 — 1.5h')
		// Итог по всему периоду: те же 1.5ч, 2 записи
		expect(markdown).toContain('**Total: 1.5h across 2 entries**')
	})

	it('uses singular "entry" wording for a single-entry total', () => {
		const markdown = generateArtifact(
			[makeEntry({ date: '2026-01-05', durationMinutes: 60 })],
			'sprint_report',
		)
		expect(markdown).toContain('**Total: 1.0h across 1 entry**')
	})

	it('includes a tag summary sorted by frequency', () => {
		const entries = [
			makeEntry({ date: '2026-01-05', tags: ['bugfix'] }),
			makeEntry({ date: '2026-01-06', tags: ['bugfix'] }),
			makeEntry({ date: '2026-01-07', tags: ['feature'] }),
		]

		const markdown = generateArtifact(entries, 'sprint_report')
		const summarySection = markdown.slice(markdown.indexOf('## Tags summary'))

		expect(summarySection.indexOf('#bugfix × 2')).toBeLessThan(
			summarySection.indexOf('#feature × 1'),
		)
	})

	it('omits the tag summary section when no entries have tags (missing tags edge case)', () => {
		const markdown = generateArtifact(
			[makeEntry({ date: '2026-01-05', tags: [] })],
			'sprint_report',
		)
		expect(markdown).not.toContain('## Tags summary')
	})
})

describe('brag_doc preset', () => {
	it('shows the fallback message when nothing qualifies as a highlight', () => {
		const markdown = generateArtifact(
			[makeEntry({ date: '2026-01-05', durationMinutes: 15, tags: ['chore'] })],
			'brag_doc',
		)

		expect(markdown).toContain('# Brag Doc')
		expect(markdown).toContain('go build something brag-worthy')
	})

	it('shows the fallback message for an empty entries list', () => {
		const markdown = generateArtifact([], 'brag_doc')
		expect(markdown).toContain('go build something brag-worthy')
	})

	it('includes entries at/above the default 60-minute threshold', () => {
		const big = makeEntry({ date: '2026-01-05', durationMinutes: 60, text: 'Big task' })
		const small = makeEntry({ date: '2026-01-06', durationMinutes: 15, text: 'Small task' })

		const markdown = generateArtifact([big, small], 'brag_doc')

		expect(markdown).toContain('Big task')
		expect(markdown).not.toContain('Small task')
	})

	it('includes short entries tagged with a default highlight tag', () => {
		const milestone = makeEntry({
			date: '2026-01-05',
			durationMinutes: 10,
			tags: ['milestone'],
			text: 'Hit a milestone',
		})

		const markdown = generateArtifact([milestone], 'brag_doc')

		expect(markdown).toContain('Hit a milestone')
	})

	it('respects a custom minMinutes option', () => {
		const entry = makeEntry({ date: '2026-01-05', durationMinutes: 20, text: 'Medium task' })

		expect(generateArtifact([entry], 'brag_doc')).not.toContain('Medium task')
		expect(
			generateArtifact([entry], 'brag_doc', { minMinutes: 20 }),
		).toContain('Medium task')
	})

	it('respects a custom highlightTags option', () => {
		const entry = makeEntry({
			date: '2026-01-05',
			durationMinutes: 10,
			tags: ['refactor'],
			text: 'Big refactor',
		})

		expect(generateArtifact([entry], 'brag_doc')).not.toContain('Big refactor')
		expect(
			generateArtifact([entry], 'brag_doc', { highlightTags: ['refactor'] }),
		).toContain('Big refactor')
	})

	it('groups highlighted entries by month', () => {
		const jan = makeEntry({ date: '2026-01-05', durationMinutes: 90, text: 'January win' })
		const feb = makeEntry({ date: '2026-02-05', durationMinutes: 90, text: 'February win' })

		const markdown = generateArtifact([jan, feb], 'brag_doc')

		expect(markdown).toContain('## 2026-01')
		expect(markdown).toContain('## 2026-02')
	})

	it('ends with a generated-by footer', () => {
		const markdown = generateArtifact(
			[makeEntry({ date: '2026-01-05', durationMinutes: 90 })],
			'brag_doc',
		)
		expect(markdown.trim().endsWith('_Generated by folio.ink_')).toBe(true)
	})
})

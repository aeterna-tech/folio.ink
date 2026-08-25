import { describe, it, expect } from 'vitest'
import {
	filterEntriesByDateRange,
	filterEntriesByTags,
	getPresetDateRange,
	buildDigestText,
} from './digest'

const entries = [
	{
		id: 1,
		date: '2026-08-01',
		durationMinutes: 60,
		text: 'Fixed login bug',
		tags: ['bugfix', 'auth'],
	},
	{
		id: 2,
		date: '2026-08-02',
		durationMinutes: 30,
		text: 'Wrote tests',
		tags: ['tests'],
	},
	{
		id: 3,
		date: '2026-08-05',
		durationMinutes: 90,
		text: 'Refactored API client',
		tags: ['refactor', 'api'],
	},
	{
		id: 4,
		date: '2026-08-05',
		durationMinutes: 15,
		text: '',
		tags: [],
	},
]

describe('filterEntriesByDateRange', () => {
	it('keeps entries within an inclusive [start, end] range', () => {
		const result = filterEntriesByDateRange(entries, {
			start: '2026-08-02',
			end: '2026-08-05',
		})
		expect(result.map(e => e.id)).toEqual([2, 3, 4])
	})

	it('treats a missing start as "no lower bound"', () => {
		const result = filterEntriesByDateRange(entries, { end: '2026-08-01' })
		expect(result.map(e => e.id)).toEqual([1])
	})

	it('treats a missing end as "no upper bound"', () => {
		const result = filterEntriesByDateRange(entries, { start: '2026-08-05' })
		expect(result.map(e => e.id)).toEqual([3, 4])
	})

	it('returns everything when no range is given', () => {
		expect(filterEntriesByDateRange(entries, {})).toHaveLength(entries.length)
	})

	it('returns nothing when the range excludes every entry', () => {
		const result = filterEntriesByDateRange(entries, {
			start: '2026-09-01',
			end: '2026-09-30',
		})
		expect(result).toHaveLength(0)
	})

	it('is inclusive on exact boundary dates', () => {
		const result = filterEntriesByDateRange(entries, {
			start: '2026-08-01',
			end: '2026-08-01',
		})
		expect(result.map(e => e.id)).toEqual([1])
	})
})

describe('filterEntriesByTags', () => {
	it('returns everything when no tags are given', () => {
		expect(filterEntriesByTags(entries, [])).toHaveLength(entries.length)
	})

	it('matches entries with ANY of the given tags by default', () => {
		const result = filterEntriesByTags(entries, ['tests', 'api'])
		expect(result.map(e => e.id)).toEqual([2, 3])
	})

	it('matches entries with ALL of the given tags when matchMode is "all"', () => {
		const result = filterEntriesByTags(entries, ['bugfix', 'auth'], 'all')
		expect(result.map(e => e.id)).toEqual([1])
	})

	it('does not match when only some of the "all" tags are present', () => {
		const result = filterEntriesByTags(entries, ['bugfix', 'tests'], 'all')
		expect(result).toHaveLength(0)
	})

	it('is case-insensitive', () => {
		const result = filterEntriesByTags(entries, ['BUGFIX'])
		expect(result.map(e => e.id)).toEqual([1])
	})

	it('excludes entries with no tags when a tag filter is active', () => {
		const result = filterEntriesByTags(entries, ['bugfix'])
		expect(result.some(e => e.id === 4)).toBe(false)
	})
})

describe('getPresetDateRange', () => {
	it('standup preset spans yesterday through today', () => {
		const reference = new Date('2026-08-22T12:00:00')
		const range = getPresetDateRange('standup', reference)
		expect(range).toEqual({ start: '2026-08-21', end: '2026-08-22' })
	})

	it('handles a standup range that crosses a month boundary', () => {
		const reference = new Date('2026-09-01T09:00:00')
		const range = getPresetDateRange('standup', reference)
		expect(range).toEqual({ start: '2026-08-31', end: '2026-09-01' })
	})

	it('brag preset has no bounds (all time)', () => {
		expect(getPresetDateRange('brag')).toEqual({
			start: undefined,
			end: undefined,
		})
	})

	it('falls back to an unbounded range for an unknown preset', () => {
		expect(getPresetDateRange('something-else')).toEqual({
			start: undefined,
			end: undefined,
		})
	})
})

describe('buildDigestText', () => {
	const project = { id: 1, name: 'folio.ink' }

	it('includes the project name in the heading', () => {
		const text = buildDigestText({
			project,
			entries: [entries[0]],
			preset: 'report',
		})
		expect(text).toContain('folio.ink')
	})

	it('groups entries under one heading per date', () => {
		const text = buildDigestText({
			project,
			entries: [entries[2], entries[3]],
			preset: 'report',
		})
		const dateHeadingCount = (text.match(/^## /gm) || []).length
		expect(dateHeadingCount).toBe(1) // обе записи — за 2026-08-05
	})

	it('falls back to a placeholder line when there are no entries', () => {
		const text = buildDigestText({ project, entries: [], preset: 'report' })
		expect(text).toMatch(/no entries/i)
	})

	it('adds a top-tags summary only for the brag preset', () => {
		const reportText = buildDigestText({ project, entries, preset: 'report' })
		const bragText = buildDigestText({ project, entries, preset: 'brag' })
		expect(reportText).not.toMatch(/Top tags/)
		expect(bragText).toMatch(/Top tags/)
	})

	it('formats an entry with empty notes using a placeholder', () => {
		const text = buildDigestText({
			project,
			entries: [entries[3]],
			preset: 'report',
		})
		expect(text).toContain('_no notes_')
	})

	it('appends tags to an entry line when present', () => {
		const text = buildDigestText({
			project,
			entries: [entries[0]],
			preset: 'report',
		})
		expect(text).toContain('#bugfix')
		expect(text).toContain('#auth')
	})
})

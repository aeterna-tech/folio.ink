import { describe, it, expect } from 'vitest'
import { filterByDateRange, filterByTags, parseISODate } from '../filters'

function makeEntry({ date, tags = [], durationMinutes = 30, text = '' }) {
	return { id: `${date}-${Math.random()}`, date, tags, durationMinutes, text }
}

describe('parseISODate', () => {
	it('returns null for null/undefined', () => {
		expect(parseISODate(null)).toBeNull()
		expect(parseISODate(undefined)).toBeNull()
	})

	it('parses a valid YYYY-MM-DD string', () => {
		const d = parseISODate('2026-01-05')
		expect(d.getFullYear()).toBe(2026)
		expect(d.getMonth()).toBe(0)
		expect(d.getDate()).toBe(5)
	})

	it('throws on a malformed string', () => {
		expect(() => parseISODate('05-01-2026')).toThrow()
	})

	it('throws on a non-existent calendar date', () => {
		expect(() => parseISODate('2026-02-30')).toThrow()
	})

	it('passes Date instances through unchanged', () => {
		const input = new Date(2026, 0, 5)
		expect(parseISODate(input)).toBe(input)
	})
})

describe('filterByDateRange', () => {
	it('returns all entries unchanged when no bounds are given', () => {
		const entries = [makeEntry({ date: '2026-01-01' }), makeEntry({ date: '2026-01-02' })]
		expect(filterByDateRange(entries)).toEqual(entries)
	})

	it('returns an empty array for an empty entries list', () => {
		expect(filterByDateRange([], '2026-01-01', '2026-01-31')).toEqual([])
	})

	it('includes entries exactly on the start and end boundaries', () => {
		const start = makeEntry({ date: '2026-01-01' })
		const mid = makeEntry({ date: '2026-01-15' })
		const end = makeEntry({ date: '2026-01-31' })
		const outside = makeEntry({ date: '2026-02-01' })

		const result = filterByDateRange(
			[start, mid, end, outside],
			'2026-01-01',
			'2026-01-31',
		)

		expect(result).toEqual([start, mid, end])
	})

	it('treats a start-only range as open-ended on the right', () => {
		const entries = [makeEntry({ date: '2026-01-01' }), makeEntry({ date: '2026-06-01' })]
		expect(filterByDateRange(entries, '2026-03-01')).toEqual([entries[1]])
	})

	it('treats an end-only range as open-ended on the left', () => {
		const entries = [makeEntry({ date: '2026-01-01' }), makeEntry({ date: '2026-06-01' })]
		expect(filterByDateRange(entries, null, '2026-03-01')).toEqual([entries[0]])
	})

	it('handles a single-day range (start === end)', () => {
		const target = makeEntry({ date: '2026-05-10' })
		const entries = [makeEntry({ date: '2026-05-09' }), target, makeEntry({ date: '2026-05-11' })]

		expect(filterByDateRange(entries, '2026-05-10', '2026-05-10')).toEqual([target])
	})

	it('returns an empty array when nothing falls in range', () => {
		const entries = [makeEntry({ date: '2026-01-01' }), makeEntry({ date: '2026-01-02' })]
		expect(filterByDateRange(entries, '2027-01-01', '2027-01-31')).toEqual([])
	})

	it('throws when start is after end', () => {
		expect(() => filterByDateRange([], '2026-05-10', '2026-01-01')).toThrow()
	})

	it('throws on an invalid date string', () => {
		expect(() => filterByDateRange([], '10-05-2026')).toThrow()
	})
})

describe('filterByTags', () => {
	it('returns all entries unchanged when tags is null', () => {
		const entries = [makeEntry({ date: '2026-01-01', tags: ['bugfix'] })]
		expect(filterByTags(entries, null)).toEqual(entries)
	})

	it('returns all entries unchanged when tags is an empty array', () => {
		const entries = [makeEntry({ date: '2026-01-01', tags: ['bugfix'] })]
		expect(filterByTags(entries, [])).toEqual(entries)
	})

	it('excludes entries with missing/empty tags when a filter is active', () => {
		const untagged = makeEntry({ date: '2026-01-01', tags: [] })
		const tagged = makeEntry({ date: '2026-01-02', tags: ['feature'] })

		expect(filterByTags([untagged, tagged], ['feature'])).toEqual([tagged])
	})

	it('matches case-insensitively', () => {
		const entry = makeEntry({ date: '2026-01-01', tags: ['BugFix'] })
		expect(filterByTags([entry], ['bugfix'])).toEqual([entry])
	})

	it('defaults to match "any"', () => {
		const e1 = makeEntry({ date: '2026-01-01', tags: ['bugfix'] })
		const e2 = makeEntry({ date: '2026-01-02', tags: ['feature'] })
		const e3 = makeEntry({ date: '2026-01-03', tags: ['docs'] })

		expect(filterByTags([e1, e2, e3], ['bugfix', 'feature'])).toEqual([e1, e2])
	})

	it('requires every tag when match is "all"', () => {
		const partial = makeEntry({ date: '2026-01-01', tags: ['bugfix'] })
		const full = makeEntry({ date: '2026-01-02', tags: ['bugfix', 'urgent'] })

		const result = filterByTags([partial, full], ['bugfix', 'urgent'], 'all')

		expect(result).toEqual([full])
	})

	it('returns an empty array for a tag combination that matches nothing (not an error)', () => {
		const entries = [
			makeEntry({ date: '2026-01-01', tags: ['bugfix'] }),
			makeEntry({ date: '2026-01-02', tags: ['feature'] }),
		]
		expect(filterByTags(entries, ['does-not-exist'])).toEqual([])
	})

	it('ignores blank/whitespace-only tag strings', () => {
		const entry = makeEntry({ date: '2026-01-01', tags: ['bugfix'] })
		expect(filterByTags([entry], ['', '   ', 'bugfix'])).toEqual([entry])
	})

	it('behaves like no filter when every requested tag is blank', () => {
		const entries = [makeEntry({ date: '2026-01-01', tags: ['bugfix'] })]
		expect(filterByTags(entries, ['', '   '])).toEqual(entries)
	})

	it('throws on an invalid match mode', () => {
		const entries = [makeEntry({ date: '2026-01-01', tags: ['x'] })]
		expect(() => filterByTags(entries, ['x'], 'xor')).toThrow()
	})
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// мока для react-i18next в тестах не нужен реальный перевод,
// t() просто возвращает сам ключ (или разумный дефолт для pluralization)
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key, options) => {
			if (key === 'projectCard.entry') {
				return `${options.count} entries`
			}
			return key
		},
	}),
}))

import ProjectCard from './ProjectCard'

const mockProject = {
	id: 1,
	name: 'folio.ink',
	description: 'Основной проект',
	color: '#2DD4BF',
}

const mockEntries = [
	{ projectId: 1, durationMinutes: 60 },
	{ projectId: 1, durationMinutes: 30 },
	{ projectId: 2, durationMinutes: 120 }, // другой проект, не должен считаться
]

describe('ProjectCard', () => {
	it('отображает имя и описание проекта', () => {
		render(
			<ProjectCard
				project={mockProject}
				entries={mockEntries}
				onSelect={vi.fn()}
				onEdit={vi.fn()}
				onDelete={vi.fn()}
			/>
		)

		expect(screen.getByText('folio.ink')).toBeInTheDocument()
		expect(screen.getByText('Основной проект')).toBeInTheDocument()
	})

	it('считает часы только по своему проекту', () => {
		render(
			<ProjectCard
				project={mockProject}
				entries={mockEntries}
				onSelect={vi.fn()}
				onEdit={vi.fn()}
				onDelete={vi.fn()}
			/>
		)

		// 60 + 30 = 90 минут = 1.5 часа, третья запись (projectId: 2) не считается
		expect(screen.getByText('1.5h')).toBeInTheDocument()
	})

	it('вызывает onSelect при клике на карточку', () => {
		const onSelect = vi.fn()
		render(
			<ProjectCard
				project={mockProject}
				entries={mockEntries}
				onSelect={onSelect}
				onEdit={vi.fn()}
				onDelete={vi.fn()}
			/>
		)

		fireEvent.click(screen.getByRole('button', { name: /folio.ink/i }))
		expect(onSelect).toHaveBeenCalledWith(1)
	})

	it('показывает подтверждение удаления и не вызывает onSelect', () => {
		const onSelect = vi.fn()
		const onDelete = vi.fn()
		render(
			<ProjectCard
				project={mockProject}
				entries={mockEntries}
				onSelect={onSelect}
				onEdit={vi.fn()}
				onDelete={onDelete}
			/>
		)

		fireEvent.click(screen.getByTitle('projectCard.deleteTooltip'))
		expect(screen.getByText('projectCard.confirmDelete')).toBeInTheDocument()
		expect(onSelect).not.toHaveBeenCalled()

		fireEvent.click(screen.getByText('projectCard.yes'))
		expect(onDelete).toHaveBeenCalledWith(1)
	})
})
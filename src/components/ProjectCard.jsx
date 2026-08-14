import { useState } from 'react'
import { useTranslation } from 'react-i18next'

function getProjectStats(entries, projectId) {
	const projectEntries = entries.filter(e => e.projectId === projectId)
	const minutes = projectEntries.reduce(
		(sum, e) => sum + (e.durationMinutes || 0),
		0,
	)
	return { minutes, count: projectEntries.length }
}

export default function ProjectCard({
	project,
	entries,
	onSelect,
	onEdit,
	onDelete,
}) {
	const { t } = useTranslation()
	const [isConfirming, setIsConfirming] = useState(false)
	const { minutes, count } = getProjectStats(entries, project.id)
	const hours = (minutes / 60).toFixed(1)

	// Форматирование текста записей (поддержка i18next pluralization)
	const entriesText = t('projectCard.entry', { count })

	const handleEditClick = e => {
		e.stopPropagation() // Предотвращаем проваливание клика в карточку (onSelect)
		onEdit(project)
	}

	const handleDeleteClick = e => {
		e.stopPropagation() // Предотвращаем проваливание клика в карточку (onSelect)
		setIsConfirming(true)
	}

	const handleCancelDelete = e => {
		e.stopPropagation()
		setIsConfirming(false)
	}

	const handleConfirmDelete = e => {
		e.stopPropagation()
		onDelete(project.id)
		setIsConfirming(false)
	}

	function handleCardKeyDown(e) {
		// Доступность: div role="button" сам не реагирует на Enter/Space,
		// это нужно навесить руками.
		if (isConfirming) return
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			onSelect(project.id)
		}
	}

	return (
		<div
			role='button'
			tabIndex={0}
			onClick={() => !isConfirming && onSelect(project.id)}
			onKeyDown={handleCardKeyDown}
			className={`group text-left bg-slate-900 border border-slate-800 rounded-lg p-5 transition-all flex flex-col gap-3 relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
				isConfirming
					? 'border-red-900/50 bg-red-950/10'
					: 'hover:border-slate-700 hover:bg-slate-900/80'
			}`}
		>
			{/* Верхняя панель: Имя проекта и Кнопка удаления */}
			<div className='flex items-center justify-between gap-2 w-full'>
				<div className='flex items-center gap-2.5 min-w-0'>
					<span
						className='w-2.5 h-2.5 rounded-full shrink-0'
						style={{ backgroundColor: project.color }}
					/>
					<h3 className='text-slate-100 font-semibold truncate'>
						{project.name}
					</h3>
				</div>

				{/* Контекстный блок удаления */}
				<div className='flex items-center z-10'>
					<button
						type='button'
						onClick={handleEditClick}
						title={t('projectCard.editTooltip')}
						className='opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-teal-400 hover:bg-slate-800 transition-all'
					>
						{/* SVG Иконка Пера */}
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth={1.8}
							stroke='currentColor'
							className='w-4 h-4'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10'
							/>
						</svg>
					</button>
					<button
						type='button'
						onClick={handleDeleteClick}
						title={t('projectCard.deleteTooltip')}
						className='opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-all'
					>
						{/* SVG Иконка Корзины */}
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth={1.8}
							stroke='currentColor'
							className='w-4 h-4'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0'
							/>
						</svg>
					</button>
				</div>
			</div>

			{/* Описание проекта */}
			<p className='text-sm text-slate-400 line-clamp-2 min-h-[2.5rem]'>
				{project.description || t('projectCard.noDescription')}
			</p>

			{/* Нижняя панель: Статистика */}
			<div className='flex items-center justify-between pt-3 border-t border-slate-800 mt-auto'>
				<span className='text-xs font-medium text-slate-500'>
					{entriesText}
				</span>
				<span className='font-mono text-xs text-teal-400 bg-teal-950/30 px-2 py-0.5 rounded border border-teal-900/30'>
					{hours}h
				</span>
			</div>

			{/* Всплывающее окно подтверждения удаления, адаптивное под размер карточки */}
			{isConfirming && (
				<div
					onClick={e => e.stopPropagation()}
					className='absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-slate-950/95 backdrop-blur-sm px-4 sm:px-6'
				>
					<div className='w-full max-w-[220px] sm:max-w-[240px] text-center'>
						<p className='text-sm text-slate-100 font-medium mb-3'>
							{t('projectCard.confirmDelete')}
						</p>
						<div className='flex flex-col sm:flex-row gap-2'>
							<button
								type='button'
								onClick={handleConfirmDelete}
								className='flex-1 py-2 rounded-md bg-red-500/10 border border-red-900/50 text-red-400 text-xs font-semibold hover:bg-red-500/20 hover:text-red-300 transition-colors'
							>
								{t('projectCard.yes')}
							</button>
							<button
								type='button'
								onClick={handleCancelDelete}
								className='flex-1 py-2 rounded-md border border-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-800 hover:text-slate-100 transition-colors'
							>
								{t('projectCard.no')}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}

import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LogEditor from '../components/LogEditor'
import DigestModal from '../components/DigestModal'

/**
 * Экран заметок/логов конкретного проекта — маршрут /projects/:id.
 *
 * Сам список записей и форма добавления/редактирования уже реализованы
 * в LogEditor.jsx (timeline слева + форма справа), поэтому эта страница —
 * тонкая обвязка на уровне роутинга:
 *   1. достаёт :id из URL (useParams),
 *   2. резолвит активный проект и его записи из данных, которые лежат
 *      выше по дереву (App.jsx — источник правды: entries всегда с
 *      бэкенда через getEntries/createEntry/updateEntry/deleteEntry,
 *      projects — с бэкенда, с localStorage только как офлайн-фолбэк),
 *   3. обрабатывает случаи "проект не найден" / "id битый".
 *
 * id из URL — всегда строка, а project.id может быть числом (обычный
 * случай — бэкенд, autoincrement) или строкой (mock-фолбэк для projects,
 * когда бэкенд недоступен) — поэтому сравнение идёт через String(...),
 * а не строгое ===.
 */
export default function ProjectNotes({
	projects,
	entries,
	entriesLoading,
	entriesError,
	onRetryEntries,
	isSavingEntry,
	onSaveEntry,
	onUpdateEntry,
	onDeleteEntry,
	projectTags,
}) {
	const { id } = useParams()
	const navigate = useNavigate()
	const { t } = useTranslation()
	const [showDigestModal, setShowDigestModal] = useState(false)

	const activeProject = useMemo(
		() => projects.find(p => String(p.id) === String(id)) ?? null,
		[projects, id],
	)

	// entries сейчас подтягиваются через getEntries(id) в App.jsx (см.
	// loadEntriesForActiveProject) при каждом заходе на этот маршрут —
	// здесь просто фильтруем уже загруженный общий список по id проекта.
	const projectEntries = useMemo(
		() => entries.filter(e => String(e.projectId) === String(id)),
		[entries, id],
	)

	if (!activeProject) {
		return (
			<div className='h-screen flex flex-col items-center justify-center gap-4 px-8 text-center'>
				<p className='text-slate-600 text-sm'>{t('logsScreen.selectFirst')}</p>
				<button
					type='button'
					onClick={() => navigate('/')}
					className='px-4 py-2 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-semibold transition-colors'
				>
					{t('nav.projects')}
				</button>
			</div>
		)
	}

	return (
		<div className='h-screen flex flex-col relative'>
			{entriesError && (
				<div className='shrink-0 flex items-center justify-between gap-3 border-b border-red-900/50 bg-red-950/20 px-8 py-2.5'>
					<p className='text-xs text-red-400'>
						{t('logsScreen.loadError')}
						<span className='block text-[11px] text-red-500/70 mt-0.5'>
							{entriesError}
						</span>
					</p>
					<button
						type='button'
						onClick={onRetryEntries}
						className='shrink-0 px-3 py-1.5 rounded-md border border-red-900/60 text-red-300 text-xs font-semibold hover:bg-red-900/30 transition-colors'
					>
						{t('projectsScreen.retry')}
					</button>
				</div>
			)}

			{!entriesLoading && (
				<button
					type='button'
					onClick={() => setShowDigestModal(true)}
					className='absolute top-6 right-8 z-10 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-200 text-xs font-semibold hover:bg-slate-800 hover:border-slate-600 transition-colors'
				>
					{t('digest.openButton')}
				</button>
			)}

			{entriesLoading ? (
				<div className='flex-1 flex items-center justify-center'>
					<p className='text-sm text-slate-500'>{t('logsScreen.loading')}</p>
				</div>
			) : (
				<LogEditor
					activeProject={activeProject}
					projectEntries={projectEntries}
					isSaving={isSavingEntry}
					onSaveEntry={onSaveEntry}
					onUpdateEntry={onUpdateEntry}
					onDeleteEntry={onDeleteEntry}
					existingTags={projectTags}
				/>
			)}

			{showDigestModal && (
				<DigestModal
					project={activeProject}
					entries={projectEntries}
					availableTags={projectTags}
					onClose={() => setShowDigestModal(false)}
				/>
			)}
		</div>
	)
}

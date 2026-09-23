import { useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LogEditor from '../components/LogEditor'
import DigestModal from '../components/DigestModal'

// Сколько полных дней прошло с указанной даты/datetime до "сейчас",
// по местному времени (сравниваем начало дня, а не точные моменты —
// иначе "сегодня утром" превращалось бы в diffDays=0, а "сегодня
// вечером после полуночи" — в 1, хотя по календарю это один и тот же день).
function daysSince(dateLike) {
	const then = new Date(dateLike)
	if (Number.isNaN(then.getTime())) return null
	const startOfThen = new Date(
		then.getFullYear(),
		then.getMonth(),
		then.getDate(),
	)
	const now = new Date()
	const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	return Math.round((startOfNow - startOfThen) / 86400000)
}

/**
 * Баннер "давно не обновлялось". Показывается на 7+ дне простоя, дальше
 * сам решает — говорить в днях или неделях (>=14 дней → неделями).
 *
 * Рендерится как absolute-оверлей поверх шапки проекта (не в потоке!) —
 * специально, чтобы не сдвигать остальной интерфейс: обычная разметка
 * страницы (заголовок проекта + кнопка "Дайджест", таймлайн, форма)
 * всегда остаётся на своих местах что с баннером, что без него, баннер
 * просто временно перекрывает верхнюю полосу.
 *
 * dismiss — только на время текущего показа экрана (см. useState в
 * ProjectNotes ниже), не персистится — при следующем заходе на проект,
 * если простой всё ещё актуален, баннер снова появится.
 */
function InactivityBanner({ diffDays, lastNote, onDismiss, onAddUpdate }) {
	const { t } = useTranslation()
	const showAsWeeks = diffDays >= 14
	const message = showAsWeeks
		? t('inactivityBanner.weeksMessage', { count: Math.floor(diffDays / 7) })
		: t('inactivityBanner.daysMessage', { count: diffDays })

	return (
		<div className='absolute top-0 inset-x-0 z-30 flex items-start gap-3 border-b border-amber-900/60 bg-amber-950 px-8 py-3 shadow-lg shadow-black/40'>
			<div className='flex-1 min-w-0'>
				<p className='text-sm text-amber-300'>{message}</p>
				{lastNote && (
					<p className='text-xs text-amber-400/70 mt-1 truncate'>
						{t('inactivityBanner.lastNote', { note: lastNote })}
					</p>
				)}
			</div>
			<div className='shrink-0 flex items-center gap-2'>
				<button
					type='button'
					onClick={onAddUpdate}
					className='px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors'
				>
					{t('inactivityBanner.addUpdate')}
				</button>
				<button
					type='button'
					onClick={onDismiss}
					className='px-2 py-1.5 rounded-md text-amber-500/70 hover:text-amber-300 hover:bg-amber-900/30 text-xs transition-colors'
				>
					{t('inactivityBanner.dismiss')}
				</button>
			</div>
		</div>
	)
}

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
	// Храним id проекта, для которого баннер скрыли, а не просто boolean —
	// так переключение на другой проект автоматически "сбрасывает" dismiss
	// без лишнего useEffect/setState (см. react-hooks/set-state-in-effect).
	const [dismissedForId, setDismissedForId] = useState(null)
	const logEditorRef = useRef(null)

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

	// "Последний раз обновлялось" — дата самой свежей записи; если записей
	// ещё нет вообще, откатываемся на дату создания проекта (created_at
	// приходит с бэкенда as-is, см. api/client.js). Если нет и того —
	// баннер просто не показываем, посчитать простой не от чего.
	const mostRecentEntry = useMemo(
		() =>
			projectEntries.length
				? [...projectEntries].sort(
						(a, b) => new Date(b.date) - new Date(a.date),
					)[0]
				: null,
		[projectEntries],
	)
	const lastActivityAt = mostRecentEntry?.date ?? activeProject?.created_at ?? null
	const diffDays = lastActivityAt ? daysSince(lastActivityAt) : null
	const showInactivityBanner =
		!entriesLoading &&
		diffDays !== null &&
		diffDays >= 7 &&
		dismissedForId !== id

	function handleAddUpdateClick() {
		logEditorRef.current?.focusForm()
	}

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
			{showInactivityBanner && (
				<InactivityBanner
					diffDays={diffDays}
					lastNote={mostRecentEntry?.whereStopped}
					onDismiss={() => setDismissedForId(id)}
					onAddUpdate={handleAddUpdateClick}
				/>
			)}

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

			{entriesLoading ? (
				<div className='flex-1 flex items-center justify-center'>
					<p className='text-sm text-slate-500'>{t('logsScreen.loading')}</p>
				</div>
			) : (
				<LogEditor
					ref={logEditorRef}
					activeProject={activeProject}
					projectEntries={projectEntries}
					isSaving={isSavingEntry}
					onSaveEntry={onSaveEntry}
					onUpdateEntry={onUpdateEntry}
					onDeleteEntry={onDeleteEntry}
					existingTags={projectTags}
					headerActions={
						<button
							type='button'
							onClick={() => setShowDigestModal(true)}
							className='px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-slate-200 text-xs font-semibold hover:bg-slate-800 hover:border-slate-600 transition-colors'
						>
							{t('digest.openButton')}
						</button>
					}
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

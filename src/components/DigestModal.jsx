import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
	filterEntriesByDateRange,
	filterEntriesByTags,
	getPresetDateRange,
	buildDigestText,
} from '../utils/digest'
import { exportProjectMarkdown } from '../api/client'

const PRESETS = ['standup', 'report', 'brag']

// Дублирует toLocalISODate из App.jsx/LogEditor.jsx/digest.js намеренно —
// компонент не должен тянуть зависимость на другие файлы ради одной
// маленькой чистой функции.
function toLocalISODate(date) {
	const d = new Date(date)
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

export default function DigestModal({ project, entries, availableTags, onClose }) {
	const { t, i18n } = useTranslation()
	const dateLocale = i18n.language?.startsWith('ru') ? 'ru-RU' : 'en-US'
	const today = toLocalISODate(new Date())

	const [preset, setPreset] = useState('standup')
	const [customStart, setCustomStart] = useState(today)
	const [customEnd, setCustomEnd] = useState(today)
	const [selectedTags, setSelectedTags] = useState([])
	const [copied, setCopied] = useState(false)
	const [isExportingFullHistory, setIsExportingFullHistory] = useState(false)
	const [fullHistoryExportError, setFullHistoryExportError] = useState(null)

	function toggleTag(tag) {
		setSelectedTags(prev =>
			prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag],
		)
	}

	const dateRange =
		preset === 'report'
			? { start: customStart, end: customEnd }
			: getPresetDateRange(preset)

	const filteredEntries = useMemo(() => {
		const byDate = filterEntriesByDateRange(entries, dateRange)
		return filterEntriesByTags(byDate, selectedTags)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entries, dateRange.start, dateRange.end, selectedTags])

	const digestText = useMemo(
		() => buildDigestText({ project, entries: filteredEntries, preset, dateLocale }),
		[project, filteredEntries, preset, dateLocale],
	)

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(digestText)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch (error) {
			console.error('Не удалось скопировать в буфер обмена:', error)
		}
	}

	function safeFilenamePart(name) {
		return (name || 'project')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
	}

	function downloadMarkdown(text, filename) {
		const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = filename
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	function handleExport() {
		// Пресеты (Стендап/Отчёт/Brag doc) фильтруют записи по датам/тегам
		// на фронте — на бэкенде для этого фильтра нет (GET /export там
		// смотрит только на ?format, без дат/тегов), поэтому экспорт под
		// пресеты остаётся клиентским: текст уже синтезирован выше
		// (buildDigestText), просто отдаём его как файл через Blob.
		// Для выгрузки ВСЕЙ истории проекта без фильтров — см.
		// handleExportFullHistory ниже, он бьёт в реальный бэкенд-роут.
		downloadMarkdown(
			digestText,
			`${safeFilenamePart(project?.name)}-${preset}-${today}.md`,
		)
	}

	async function handleExportFullHistory() {
		// GET /api/projects/<id>/export?format=md — реальный бэкенд-роут,
		// отдаёт ВСЕ записи проекта без фильтрации (см. комментарий в
		// api/client.js). Специально отдельная кнопка, а не замена
		// handleExport — семантика другая (без пресетов/фильтров).
		setFullHistoryExportError(null)
		setIsExportingFullHistory(true)
		try {
			const markdown = await exportProjectMarkdown(project.id)
			downloadMarkdown(
				markdown,
				`${safeFilenamePart(project?.name)}-full-history-${today}.md`,
			)
		} catch (error) {
			console.error('Не удалось выгрузить полную историю проекта:', error)
			setFullHistoryExportError(error.message)
		} finally {
			setIsExportingFullHistory(false)
		}
	}

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4'>
			<div className='w-full max-w-2xl max-h-[85vh] flex flex-col bg-slate-950 border border-slate-800 rounded-xl shadow-2xl'>
				<div className='flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0'>
					<h2 className='text-base font-semibold text-slate-100'>
						{t('digest.title')}
					</h2>
					<button
						type='button'
						onClick={onClose}
						title={t('modal.cancel')}
						className='p-1.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-colors'
					>
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
								d='M6 18 18 6M6 6l12 12'
							/>
						</svg>
					</button>
				</div>

				<div className='px-5 py-4 space-y-4 overflow-y-auto'>
					{/* Пресеты */}
					<div className='flex gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5 w-fit'>
						{PRESETS.map(p => (
							<button
								key={p}
								type='button'
								onClick={() => setPreset(p)}
								className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${
									preset === p
										? 'bg-slate-800 text-slate-100'
										: 'text-slate-500 hover:text-slate-300'
								}`}
							>
								{t(`digest.presets.${p}`)}
							</button>
						))}
					</div>

					{/* Произвольный диапазон дат — только для пресета "Отчёт" */}
					{preset === 'report' && (
						<div className='grid grid-cols-2 gap-3'>
							<div>
								<label className='block text-xs text-slate-500 mb-1'>
									{t('digest.startLabel')}
								</label>
								<input
									type='date'
									value={customStart}
									onChange={e => setCustomStart(e.target.value)}
									className='w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
								/>
							</div>
							<div>
								<label className='block text-xs text-slate-500 mb-1'>
									{t('digest.endLabel')}
								</label>
								<input
									type='date'
									value={customEnd}
									onChange={e => setCustomEnd(e.target.value)}
									className='w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
								/>
							</div>
						</div>
					)}

					{/* Фильтр по тегам */}
					{availableTags?.length > 0 && (
						<div>
							<label className='block text-xs text-slate-500 mb-1.5'>
								{t('digest.tagsLabel')}
							</label>
							<div className='flex flex-wrap gap-1.5'>
								{availableTags.map(tag => (
									<button
										key={tag}
										type='button'
										onClick={() => toggleTag(tag)}
										className={`text-[11px] px-2 py-1 rounded font-mono border transition-colors ${
											selectedTags.includes(tag)
												? 'bg-teal-950/40 border-teal-700 text-teal-300'
												: 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
										}`}
									>
										#{tag}
									</button>
								))}
							</div>
						</div>
					)}

					{/* Превью сгенерированного текста */}
					<div>
						<label className='block text-xs text-slate-500 mb-1.5'>
							{t('digest.previewLabel', { count: filteredEntries.length })}
						</label>
						<textarea
							readOnly
							value={digestText}
							rows={10}
							className='w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-300 font-mono leading-relaxed resize-none focus:outline-none'
						/>
					</div>
				</div>

				<div className='px-5 pt-4 pb-2 border-t border-slate-800 shrink-0 flex gap-2'>
					<button
						type='button'
						onClick={handleCopy}
						className='flex-1 py-2.5 rounded-md border border-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-900 transition-colors'
					>
						{copied ? t('digest.copied') : t('digest.copy')}
					</button>
					<button
						type='button'
						onClick={handleExport}
						className='flex-1 py-2.5 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-semibold transition-colors'
					>
						{t('digest.export')}
					</button>
				</div>

				{/* Отдельная опция — не относится к текущим пресету/фильтрам,
				    поэтому визуально и функционально отделена от основных кнопок. */}
				<div className='px-5 pb-4 shrink-0'>
					<button
						type='button'
						onClick={handleExportFullHistory}
						disabled={isExportingFullHistory}
						className='w-full text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50 transition-colors text-center underline decoration-dotted underline-offset-2'
					>
						{isExportingFullHistory
							? t('digest.exportingFullHistory')
							: t('digest.exportFullHistory')}
					</button>
					{fullHistoryExportError && (
						<p className='text-[11px] text-red-400 text-center mt-1'>
							{fullHistoryExportError}
						</p>
					)}
				</div>
			</div>
		</div>
	)
}

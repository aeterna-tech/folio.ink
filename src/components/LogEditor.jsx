import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

function escapeHtml(str) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Minimal markdown-ish renderer: bold, italic, inline code, code blocks,
// headings, bullet lists, line breaks. Intentionally lightweight, no deps.
function renderMarkdown(raw, emptyText) {
	if (!raw || !raw.trim()) {
		return `<p class="text-slate-600 italic">${emptyText}</p>`
	}

	let html = escapeHtml(raw)

	html = html.replace(
		/```([\s\S]*?)```/g,
		(_, code) =>
			`<pre class="bg-slate-950 border border-slate-800 rounded-md p-3 my-2 overflow-x-auto text-xs font-mono text-slate-300">${code.trim()}</pre>`,
	)
	html = html.replace(
		/`([^`]+)`/g,
		'<code class="bg-slate-800 text-teal-300 px-1.5 py-0.5 rounded text-[0.85em] font-mono">$1</code>',
	)
	html = html.replace(
		/\*\*([^*]+)\*\*/g,
		'<strong class="text-slate-100 font-semibold">$1</strong>',
	)
	html = html.replace(/\*([^*]+)\*/g, '<em class="text-slate-300">$1</em>')
	html = html.replace(
		/^### (.*)$/gm,
		'<h3 class="text-slate-100 font-semibold mt-3 mb-1">$1</h3>',
	)
	html = html.replace(
		/^## (.*)$/gm,
		'<h2 class="text-slate-100 font-bold text-base mt-3 mb-1">$1</h2>',
	)
	html = html.replace(
		/^# (.*)$/gm,
		'<h1 class="text-slate-100 font-bold text-lg mt-3 mb-1">$1</h1>',
	)
	html = html.replace(
		/^- (.*)$/gm,
		'<li class="ml-4 list-disc text-slate-300">$1</li>',
	)
	html = html.replace(/\n{2,}/g, '</p><p class="mt-2">')
	html = html.replace(/\n/g, '<br/>')

	return `<p>${html}</p>`
}

function EditIcon(props) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			fill='none'
			viewBox='0 0 24 24'
			strokeWidth={1.8}
			stroke='currentColor'
			className='w-4 h-4'
			{...props}
		>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				d='m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10'
			/>
		</svg>
	)
}

function DeleteIcon(props) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			fill='none'
			viewBox='0 0 24 24'
			strokeWidth={1.8}
			stroke='currentColor'
			className='w-4 h-4'
			{...props}
		>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				d='m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0'
			/>
		</svg>
	)
}

function XIcon(props) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			fill='none'
			viewBox='0 0 24 24'
			strokeWidth={1.8}
			stroke='currentColor'
			className='w-3.5 h-3.5'
			{...props}
		>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				d='M6 18 18 6M6 6l12 12'
			/>
		</svg>
	)
}

function formatDate(dateStr, locale) {
	const d = new Date(`${dateStr}T00:00:00`)
	return d.toLocaleDateString(locale, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	})
}

// Форматирует дату в YYYY-MM-DD по ЛОКАЛЬНОМУ времени (не UTC),
// чтобы избежать сдвига дня из-за часового пояса.
function toLocalISODate(date) {
	const d = new Date(date)
	const year = d.getFullYear()
	const month = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

function formatDuration(minutes) {
	const h = Math.floor(minutes / 60)
	const m = minutes % 60
	if (h === 0) return `${m}m`
	if (m === 0) return `${h}h`
	return `${h}h ${m}m`
}

/**
 * Поле выбора тегов записи:
 *   - уже выбранные теги — чипсы с крестиком удаления внутри самого поля;
 *   - под полем — плашки ВСЕХ тегов, которые уже встречались в этом
 *     проекте (кроме уже выбранных) — клик сразу добавляет тег;
 *   - по мере ввода в поле — выпадающий список подходящих тегов
 *     (подстрокой, без учёта регистра) для автокомплита;
 *   - Enter/запятая всегда добавляет то, что введено, даже если это
 *     совсем новый тег, которого не было в suggestions.
 *
 * `suggestions` приходит из App.jsx (см. loadProjectTags) — это реальный
 * GET /api/projects/:id/tags, а не локальное вычисление из уже открытых
 * записей. Сам TagPicker про это ничего не знает, ему всё равно откуда
 * взялся string[].
 */
function TagPicker({ value, onChange, suggestions, placeholder }) {
	const [draft, setDraft] = useState('')
	const [isOpen, setIsOpen] = useState(false)
	const [highlightedIndex, setHighlightedIndex] = useState(-1)
	const inputRef = useRef(null)

	const normalizedValue = value.map(t => t.toLowerCase())

	const filteredSuggestions = draft.trim()
		? suggestions
				.filter(tag => !normalizedValue.includes(tag.toLowerCase()))
				.filter(tag => tag.toLowerCase().includes(draft.trim().toLowerCase()))
				.slice(0, 8)
		: []

	const quickPicks = suggestions.filter(
		tag => !normalizedValue.includes(tag.toLowerCase()),
	)

	function addTag(rawTag) {
		const tag = rawTag.trim()
		if (!tag || normalizedValue.includes(tag.toLowerCase())) {
			setDraft('')
			setIsOpen(false)
			return
		}
		onChange([...value, tag])
		setDraft('')
		setIsOpen(false)
		setHighlightedIndex(-1)
		inputRef.current?.focus()
	}

	function removeTag(tag) {
		onChange(value.filter(t => t !== tag))
	}

	function handleKeyDown(e) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault()
			if (
				isOpen &&
				highlightedIndex >= 0 &&
				filteredSuggestions[highlightedIndex]
			) {
				addTag(filteredSuggestions[highlightedIndex])
			} else if (draft.trim()) {
				addTag(draft)
			}
		} else if (e.key === 'ArrowDown') {
			e.preventDefault()
			if (filteredSuggestions.length) {
				setIsOpen(true)
				setHighlightedIndex(i =>
					Math.min(i + 1, filteredSuggestions.length - 1),
				)
			}
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setHighlightedIndex(i => Math.max(i - 1, 0))
		} else if (e.key === 'Escape') {
			setIsOpen(false)
			setHighlightedIndex(-1)
		} else if (e.key === 'Backspace' && !draft && value.length > 0) {
			onChange(value.slice(0, -1))
		}
	}

	return (
		<div className='relative'>
			<div className='flex flex-wrap gap-1.5 items-center w-full bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 focus-within:ring-1 focus-within:ring-teal-500 focus-within:border-teal-500'>
				{value.map(tag => (
					<span
						key={tag}
						className='flex items-center gap-1 text-[11px] pl-2 pr-1 py-1 rounded bg-slate-800 text-teal-300 border border-slate-700 font-mono'
					>
						#{tag}
						<button
							type='button'
							onClick={() => removeTag(tag)}
							className='p-0.5 rounded hover:bg-slate-700 hover:text-white transition-colors'
							aria-label={`Remove ${tag}`}
						>
							<XIcon className='w-2.5 h-2.5' />
						</button>
					</span>
				))}
				<input
					ref={inputRef}
					type='text'
					value={draft}
					onChange={e => {
						setDraft(e.target.value)
						setIsOpen(true)
						setHighlightedIndex(-1)
					}}
					onKeyDown={handleKeyDown}
					onFocus={() => setIsOpen(true)}
					// Небольшая задержка перед закрытием: иначе onBlur успевает
					// сработать раньше onClick по пункту дропдауна (клик бы
					// просто не долетал) — onMouseDown ниже с preventDefault
					// решает то же самое для варианта с мышью.
					onBlur={() => setTimeout(() => setIsOpen(false), 120)}
					placeholder={value.length ? '' : placeholder}
					className='flex-1 min-w-[80px] bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none py-0.5'
				/>
			</div>

			{isOpen && filteredSuggestions.length > 0 && (
				<div className='absolute z-30 mt-1 w-full bg-slate-900 border border-slate-800 rounded-md shadow-lg shadow-black/40 max-h-48 overflow-y-auto py-1'>
					{filteredSuggestions.map((tag, i) => (
						<button
							key={tag}
							type='button'
							onMouseDown={e => e.preventDefault()}
							onClick={() => addTag(tag)}
							className={`w-full text-left px-3 py-1.5 text-sm font-mono transition-colors ${
								i === highlightedIndex
									? 'bg-slate-800 text-teal-300'
									: 'text-slate-300 hover:bg-slate-800/60'
							}`}
						>
							#{tag}
						</button>
					))}
				</div>
			)}

			{quickPicks.length > 0 && (
				<div className='flex flex-wrap gap-1.5 mt-2'>
					{quickPicks.map(tag => (
						<button
							key={tag}
							type='button'
							onClick={() => addTag(tag)}
							className='text-[11px] px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:border-teal-700 hover:text-teal-300 transition-colors font-mono'
						>
							+ #{tag}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

export default function LogEditor({
	activeProject,
	projectEntries,
	isSaving,
	onSaveEntry,
	onUpdateEntry,
	onDeleteEntry,
	existingTags = [],
}) {
	const { t, i18n } = useTranslation()
	const dateLocale = i18n.language?.startsWith('ru') ? 'ru-RU' : 'en-US'
	const today = toLocalISODate(new Date())
	const [date, setDate] = useState(today)
	const [duration, setDuration] = useState('')
	const [tags, setTags] = useState([])
	const [text, setText] = useState('')
	const [mode, setMode] = useState('edit')
	const [editingEntryId, setEditingEntryId] = useState(null)

	const sortedEntries = [...projectEntries].sort(
		(a, b) => new Date(b.date) - new Date(a.date),
	)

	const textareaRef = useRef(null)

	const emptyPreviewText = t('logEditor.emptyPreview')
	const isEditingEntry = Boolean(editingEntryId)

	/**
	 * Оборачивает выделение маркером с обеих сторон (bold/italic).
	 * Если ничего не выделено — вставляет плейсхолдер и выделяет его,
	 * чтобы пользователь мог сразу начать печатать поверх.
	 */
	function applyWrapFormatting(marker, placeholder) {
		const textarea = textareaRef.current
		if (!textarea) return

		const { selectionStart, selectionEnd, value } = textarea
		const selected = value.slice(selectionStart, selectionEnd)
		const hasSelection = selected.length > 0
		const inserted = hasSelection ? selected : placeholder

		const newValue =
			value.slice(0, selectionStart) +
			marker +
			inserted +
			marker +
			value.slice(selectionEnd)

		setText(newValue)

		const selStart = selectionStart + marker.length
		const selEnd = selStart + inserted.length

		// textarea управляется React (controlled) — курсор/выделение можно
		// восстановить только после того, как обновлённое value долетит до
		// DOM, поэтому setSelectionRange откладываем на следующий кадр.
		requestAnimationFrame(() => {
			textarea.focus()
			textarea.setSelectionRange(selStart, selEnd)
		})
	}

	/**
	 * Ставит префикс в начало строки/строк (heading, bullet list).
	 * Работает по границам строк, а не по точному выделению: если курсор
	 * просто стоит внутри строки — форматируется вся строка, если выделено
	 * несколько строк — префикс добавляется к каждой из них.
	 */
	function applyLinePrefixFormatting(prefix, placeholder) {
		const textarea = textareaRef.current
		if (!textarea) return

		const { selectionStart, selectionEnd, value } = textarea
		const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
		let lineEnd = value.indexOf('\n', selectionEnd)
		if (lineEnd === -1) lineEnd = value.length

		const block = value.slice(lineStart, lineEnd)
		const hasContent = block.trim().length > 0

		const newBlock = hasContent
			? block
					.split('\n')
					.map(line => (line.startsWith(prefix) ? line : prefix + line))
					.join('\n')
			: prefix + placeholder

		const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd)
		setText(newValue)

		requestAnimationFrame(() => {
			textarea.focus()
			if (hasContent) {
				const cursor = lineStart + newBlock.length
				textarea.setSelectionRange(cursor, cursor)
			} else {
				// Выделяем плейсхолдер целиком, чтобы можно было сразу
				// напечатать текст заголовка/пункта поверх него.
				textarea.setSelectionRange(
					lineStart + prefix.length,
					lineStart + newBlock.length,
				)
			}
		})
	}

	function resetForm() {
		setDate(today)
		setDuration('')
		setTags([])
		setText('')
		setMode('edit')
		setEditingEntryId(null)
	}

	function handleEditEntryClick(entry) {
		setEditingEntryId(entry.id)
		setDate(entry.date)
		setDuration(String(entry.durationMinutes ?? ''))
		setTags(entry.tags || [])
		setText(entry.text || '')
		setMode('edit')
	}

	function handleDeleteEntryClick(entryId) {
		onDeleteEntry(entryId)
		if (editingEntryId === entryId) {
			resetForm()
		}
	}

	function handleCancelEdit() {
		resetForm()
	}

	async function handleSubmit(e) {
		e.preventDefault()
		if (!duration || !text.trim() || isSaving) return

		// tags уже массив (см. TagPicker) — на всякий случай подчищаем
		// пустые/задвоенные значения перед отправкой.
		const cleanTags = Array.from(
			new Set(tags.map(tag => tag.trim()).filter(Boolean)),
		)

		let result
		if (isEditingEntry) {
			result = await onUpdateEntry({
				id: editingEntryId,
				projectId: activeProject.id,
				date,
				durationMinutes: Number(duration),
				text: text.trim(),
				tags: cleanTags,
			})
		} else {
			result = await onSaveEntry({
				id:
					typeof crypto !== 'undefined' && crypto.randomUUID
						? crypto.randomUUID()
						: `entry-${Date.now()}`,
				projectId: activeProject.id,
				date,
				durationMinutes: Number(duration),
				text: text.trim(),
				tags: cleanTags,
			})
		}

		// onSaveEntry/onUpdateEntry возвращают null при ошибке (см. App.jsx) —
		// в этом случае не сбрасываем форму, чтобы не потерять черновик.
		if (result) {
			resetForm()
		}
	}

	return (
		<div className='flex-1 min-h-0 h-full overflow-hidden flex flex-col'>
			<header className='px-8 py-6 border-b border-slate-800 shrink-0'>
				<div className='flex items-center gap-2.5'>
					<span
						className='w-3 h-3 rounded-full shrink-0'
						style={{ backgroundColor: activeProject.color }}
					/>
					<h2 className='text-xl font-semibold text-slate-100 truncate'>
						{activeProject.name}
					</h2>
				</div>
				{activeProject.description && (
					<p className='text-sm text-slate-500 mt-1'>
						{activeProject.description}
					</p>
				)}
			</header>

			<div className='flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2'>
				{/* Timeline */}
				<div className='overflow-y-auto border-r border-slate-800 px-8 py-6'>
					<h3 className='font-mono text-xs uppercase tracking-wider text-slate-500 mb-4'>
						{t('logEditor.timelineHeader', { count: sortedEntries.length })}
					</h3>

					{sortedEntries.length === 0 ? (
						<p className='text-sm text-slate-600 italic'>
							{t('logEditor.noEntries')}
						</p>
					) : (
						<ol className='relative border-l border-slate-800 ml-1.5 space-y-6 pb-4'>
							{sortedEntries.map(entry => (
								<li key={entry.id} className='ml-5 relative group'>
									<span
										className='absolute -left-[26px] top-1 w-2.5 h-2.5 rounded-full ring-4 ring-slate-950'
										style={{ backgroundColor: activeProject.color }}
									/>
									<div className='flex items-center gap-2 flex-wrap mb-1.5'>
										<span className='font-mono text-xs text-slate-500'>
											{formatDate(entry.date, dateLocale)}
										</span>
										<span className='font-mono text-xs px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-900'>
											+{formatDuration(entry.durationMinutes)}
										</span>
										{entry.tags?.map(tag => (
											<span
												key={tag}
												className='text-[11px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 font-mono'
											>
												#{tag}
											</span>
										))}
										<div className='ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
											<button
												type='button'
												onClick={() => handleEditEntryClick(entry)}
												title={t('logEditor.editTooltip')}
												className='p-1 rounded text-slate-500 hover:text-teal-400 hover:bg-slate-900 transition-all'
											>
												<EditIcon />
											</button>
											<button
												type='button'
												onClick={() => handleDeleteEntryClick(entry.id)}
												title={t('logEditor.deleteTooltip')}
												className='p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-900 transition-all'
											>
												<DeleteIcon />
											</button>
										</div>
									</div>
									<div
										className='text-sm text-slate-300 leading-relaxed'
										dangerouslySetInnerHTML={{
											__html: renderMarkdown(entry.text, emptyPreviewText),
										}}
									/>
								</li>
							))}
						</ol>
					)}
				</div>

				{/* Form */}
				<div className='overflow-y-auto px-8 py-6'>
					{isEditingEntry ? (
						<div className='flex items-center justify-between gap-3 mb-4 bg-teal-950/20 border border-teal-900/40 rounded-md pl-3 pr-2 py-2'>
							<span className='flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-teal-400'>
								<EditIcon className='w-3.5 h-3.5' />
								{t('logEditor.editEntry')}
							</span>
							<button
								type='button'
								onClick={handleCancelEdit}
								className='flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200 hover:bg-slate-800 hover:border-slate-600 hover:text-white transition-colors'
							>
								<XIcon />
								{t('logEditor.cancelEdit')}
							</button>
						</div>
					) : (
						<h3 className='font-mono text-xs uppercase tracking-wider text-slate-500 mb-4'>
							{t('logEditor.newEntry')}
						</h3>
					)}

					<form onSubmit={handleSubmit} className='space-y-4'>
						<div className='grid grid-cols-2 gap-3'>
							<div>
								<label className='block text-xs text-slate-500 mb-1'>
									{t('logEditor.dateLabel')}
								</label>
								<input
									type='date'
									value={date}
									onChange={e => setDate(e.target.value)}
									className='w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
									required
								/>
							</div>
							<div>
								<label className='block text-xs text-slate-500 mb-1'>
									{t('logEditor.durationLabel')}
								</label>
								<input
									type='number'
									min='1'
									placeholder={t('logEditor.durationPlaceholder')}
									value={duration}
									onChange={e => setDuration(e.target.value)}
									className='w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
									required
								/>
							</div>
						</div>

						<div>
							<label className='block text-xs text-slate-500 mb-1'>
								{t('logEditor.tagsLabel')}
							</label>
							<TagPicker
								value={tags}
								onChange={setTags}
								suggestions={existingTags}
								placeholder={t('logEditor.tagsPlaceholder')}
							/>
						</div>

						<div>
							<div className='flex items-center justify-between mb-1'>
								<label className='block text-xs text-slate-500'>
									{t('logEditor.notesLabel')}
								</label>
								<div className='flex gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5'>
									<button
										type='button'
										onClick={() => setMode('edit')}
										className={`px-2.5 py-1 text-xs rounded font-mono transition-colors ${
											mode === 'edit'
												? 'bg-slate-800 text-slate-100'
												: 'text-slate-500 hover:text-slate-300'
										}`}
									>
										{t('logEditor.editButton')}
									</button>
									<button
										type='button'
										onClick={() => setMode('preview')}
										className={`px-2.5 py-1 text-xs rounded font-mono transition-colors ${
											mode === 'preview'
												? 'bg-slate-800 text-slate-100'
												: 'text-slate-500 hover:text-slate-300'
										}`}
									>
										{t('logEditor.previewButton')}
									</button>
								</div>
							</div>

							{mode === 'edit' ? (
								<>
									<div className='flex items-center gap-1 mb-1.5 bg-slate-900 border border-slate-800 rounded-md p-1'>
										<button
											type='button'
											onClick={() =>
												applyWrapFormatting(
													'**',
													t('logEditor.toolbarBoldPlaceholder'),
												)
											}
											title={t('logEditor.toolbarBold')}
											className='w-7 h-7 flex items-center justify-center rounded text-xs font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors'
										>
											B
										</button>
										<button
											type='button'
											onClick={() =>
												applyWrapFormatting(
													'*',
													t('logEditor.toolbarItalicPlaceholder'),
												)
											}
											title={t('logEditor.toolbarItalic')}
											className='w-7 h-7 flex items-center justify-center rounded text-xs italic text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors'
										>
											I
										</button>
										<span className='w-px h-4 bg-slate-800 mx-0.5' />
										<button
											type='button'
											onClick={() =>
												applyLinePrefixFormatting(
													'# ',
													t('logEditor.toolbarHeadingPlaceholder'),
												)
											}
											title={t('logEditor.toolbarHeading')}
											className='w-7 h-7 flex items-center justify-center rounded text-xs font-mono font-semibold text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors'
										>
											H
										</button>
										<button
											type='button'
											onClick={() =>
												applyLinePrefixFormatting(
													'- ',
													t('logEditor.toolbarListPlaceholder'),
												)
											}
											title={t('logEditor.toolbarBulletList')}
											className='w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors'
										>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'
												strokeWidth={1.8}
												stroke='currentColor'
												className='w-3.5 h-3.5'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z'
												/>
											</svg>
										</button>
									</div>
									<textarea
										ref={textareaRef}
										value={text}
										onChange={e => setText(e.target.value)}
										placeholder={t('logEditor.textPlaceholder')}
										rows={10}
										className='w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200 font-mono leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500'
										required
									/>
								</>
							) : (
								<div
									className='w-full min-h-[15rem] bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-300 leading-relaxed'
									dangerouslySetInnerHTML={{
										__html: renderMarkdown(text, emptyPreviewText),
									}}
								/>
							)}
						</div>

						<button
							type='submit'
							disabled={isSaving}
							className='w-full py-2.5 rounded-md bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-sm font-semibold transition-colors'
						>
							{isSaving
								? t('logEditor.saving')
								: isEditingEntry
									? t('logEditor.updateButton')
									: t('logEditor.saveButton')}
						</button>
					</form>
				</div>
			</div>
		</div>
	)
}

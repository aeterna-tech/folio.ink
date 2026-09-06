const BASE_URL = 'http://localhost:5000' // Адрес, где запущен Python-бэкенд

// ---------------------------------------------------------------------------
// СТАТУС ЭНДПОИНТОВ (по routes/projects.py, routes/entries.py, routes/tags.py):
//
//   ✅ GET    /api/projects                    — есть
//   ✅ POST   /api/projects                    — есть
//   ✅ PUT    /api/projects/<id>               — есть
//   ✅ DELETE /api/projects/<id>               — есть (каскадно удаляет entries)
//   ✅ GET    /api/projects/<id>/entries        — есть
//   ✅ POST   /api/projects/<id>/entries        — есть (project_id только в пути, не в теле)
//   ✅ GET    /api/entries/<id>                 — есть
//   ✅ PUT    /api/entries/<id>                 — есть
//   ✅ DELETE /api/entries/<id>                 — есть
//   ✅ GET    /api/projects/<id>/tags           — есть (tags.py)
//
// Entry.to_dict() отдаёт tags как список строк ([tag.name for tag in self.tags]) —
// формат совпадает с тем, что ждёт фронт, маппинга не нужно. Tag.to_dict()
// в tags.py отдаёт {id, name} — там маппинг на имя всё же нужен (см. getProjectTags).
// ---------------------------------------------------------------------------

async function request(path, options = {}) {
	let response
	try {
		response = await fetch(`${BASE_URL}${path}`, {
			headers: { 'Content-Type': 'application/json' },
			...options,
		})
	} catch (error) {
		// Сеть недоступна / бэкенд не запущен / CORS.
		// cause привязан по стандарту Error, а не просто упомянут в тексте —
		// так стектрейс/девтулы видят исходную причину, а не только сообщение.
		throw new Error(
			`Не удалось достучаться до ${BASE_URL}${path}. Бэкенд запущен? CORS настроен (flask-cors)?`,
			{ cause: error },
		)
	}

	if (response.status === 404) {
		throw new Error(
			`404: эндпоинт ${options.method || 'GET'} ${path} не найден на бэкенде. Скорее всего, роут ещё не реализован — см. комментарий в шапке client.js.`,
		)
	}

	if (!response.ok) {
		// Пытаемся вытащить { "error": "..." } из тела ответа, как это
		// делает projects.py при 400
		let message = `Ошибка ${response.status} на ${path}`
		try {
			const body = await response.json()
			if (body?.error) message = body.error
		} catch {
			// тело не JSON — оставляем общее сообщение
		}
		throw new Error(message)
	}

	// 204 No Content (типично для DELETE) — тела не будет
	if (response.status === 204) return null

	return response.json()
}

// --- Проекты ---------------------------------------------------------------
// Бэкенд отдаёт поля as-is (name, color, description, created_at) —
// они уже совпадают по названию с фронтом, маппинг не нужен.

export const getProjects = async () => {
	return request('/api/projects')
}

export const createProject = async ({ name, color, description }) => {
	return request('/api/projects', {
		method: 'POST',
		body: JSON.stringify({ name, color, description }),
	})
}

// PUT /api/projects/<id>
export const updateProject = async (
	projectId,
	{ name, color, description },
) => {
	return request(`/api/projects/${projectId}`, {
		method: 'PUT',
		body: JSON.stringify({ name, color, description }),
	})
}

// DELETE /api/projects/<id> — каскадно удаляет и все entries проекта
export const deleteProject = async projectId => {
	return request(`/api/projects/${projectId}`, { method: 'DELETE' })
}

// --- Записи (Entry) ---------------------------------------------------------
// Бэкенд отдаёт project_id / duration_min (snake_case), фронт всюду
// использует projectId / durationMinutes (camelCase) — конвертируем на границе.

function normalizeEntry(raw) {
	return {
		id: raw.id,
		projectId: raw.project_id,
		date: raw.date,
		durationMinutes: raw.duration_min,
		text: raw.content ?? '',
		// Entry.to_dict() отдаёт tags как список строк — маппинг не нужен,
		// только страховка на случай null/undefined.
		tags: raw.tags ?? [],
	}
}

function denormalizeEntry(entry) {
	return {
		project_id: entry.projectId,
		date: entry.date,
		duration_min: entry.durationMinutes,
		content: entry.text,
		// _resolve_tags на бэке ждёт список строк с именами тегов и сам
		// делает get-or-create по Tag.name — здесь просто прокидываем как есть.
		tags: entry.tags ?? [],
	}
}

// GET /api/projects/<id>/entries
export const getEntries = async projectId => {
	const raw = await request(`/api/projects/${projectId}/entries`)
	return raw.map(normalizeEntry)
}

// POST /api/projects/<id>/entries
// ВАЖНО: project_id передаётся в URL, а не в теле — маршрут именно такой
// в entries.py (create_entry(project_id) читает его из пути). Раньше тут
// был POST на плоский /api/entries, которого на бэке нет вообще — все
// сохранения падали бы 404.
export const createEntry = async entry => {
	const { project_id, ...body } = denormalizeEntry(entry)
	const raw = await request(`/api/projects/${project_id}/entries`, {
		method: 'POST',
		body: JSON.stringify(body),
	})
	return normalizeEntry(raw)
}

// PUT /api/entries/<id>
export const updateEntry = async (entryId, entry) => {
	const raw = await request(`/api/entries/${entryId}`, {
		method: 'PUT',
		body: JSON.stringify(denormalizeEntry(entry)),
	})
	return normalizeEntry(raw)
}

// DELETE /api/entries/<id>
export const deleteEntry = async entryId => {
	return request(`/api/entries/${entryId}`, { method: 'DELETE' })
}

// --- Теги --------------------------------------------------------------
// GET /api/projects/<id>/tags
// Tag.to_dict() отдаёт {id, name} — TagPicker в LogEditor.jsx ждёт
// плоский string[], поэтому маппим на .name здесь, на границе.
export const getProjectTags = async projectId => {
	const raw = await request(`/api/projects/${projectId}/tags`)
	return raw.map(tag => tag.name)
}

// --- Экспорт проекта (сырые записи) -------------------------------------
// GET /api/projects/<id>/export?format=md
//
// Бэкенд больше не знает про пресеты (standup/sprint report/brag doc) —
// это целиком на фронтенде, см. src/utils/artifacts.js. Этот эндпоинт
// отдаёт только "сырые" entries проекта, в JSON или Markdown.
//
// ВАЖНО: бэкенд по умолчанию отдаёт JSON, если 'format' не передан явно —
// export_project() в projects.py требует ?format=md, иначе скачивания не
// будет, придёт JSON с телом ответа вместо файла.
//
// Возвращаем { blob, filename }, а не сразу триггерим download — сама
// логика "создать <a>, кликнуть, отозвать URL" осталась в компоненте
// (LogEditor.jsx), чтобы client.js не знал про DOM.
export const exportProject = async (projectId, { format = 'md' } = {}) => {
	const path = `/api/projects/${projectId}/export?format=${format}`

	let response
	try {
		response = await fetch(`${BASE_URL}${path}`)
	} catch (error) {
		throw new Error(
			`Не удалось достучаться до ${BASE_URL}${path}. Бэкенд запущен?`,
			{ cause: error },
		)
	}

	if (!response.ok) {
		let message = `Ошибка ${response.status} при экспорте проекта`
		try {
			const body = await response.json()
			if (body?.error) message = body.error
		} catch {
			// тело не JSON (например, уже упавший md-ответ) — оставляем
			// общее сообщение
		}
		throw new Error(message)
	}

	// Имя файла бэкенд кладёт в Content-Disposition (см. export_project) —
	// берём оттуда, а не собираем на фронте, чтобы не разъехалось.
	const disposition = response.headers.get('Content-Disposition') || ''
	const match = disposition.match(/filename="?([^"]+)"?/)
	const filename = match ? match[1] : `${projectId}-export.md`

	const blob = await response.blob()
	return { blob, filename }
}

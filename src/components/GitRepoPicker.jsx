import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getGitCommits } from '../api/client'

// Диалог выбора локальной папки с git-репозиторием.
//
// Использует @tauri-apps/plugin-dialog — работает только внутри Tauri
// (десктопная сборка). В обычном браузере (`npm run dev` без `tauri dev`)
// window.__TAURI_INTERNALS__ не определён, import всё равно не упадёт
// (модуль просто есть в бандле), но вызов open() в вебе не сработает —
// поэтому здесь отдельная проверка и понятная ошибка для этого случая,
// вместо непонятного исключения из плагина.
async function pickDirectory() {
	if (typeof window === 'undefined' || !window.__TAURI_INTERNALS__) {
		throw new Error('TAURI_UNAVAILABLE')
	}
	const { open } = await import('@tauri-apps/plugin-dialog')
	return open({ directory: true, multiple: false })
}

// onSelect(path, commits) — вызывается после успешного выбора папки И
// успешного ответа бэкенда (т.е. path подтверждён как git-репозиторий).
// Компонент специально не хранит "выбранный репозиторий" глобально —
// это решает вызывающий экран (GitRepoScreen), здесь только сам диалог
// + валидация через /api/git/commits.
export default function GitRepoPicker({ onSelect, limit = 10 }) {
	const { t } = useTranslation()
	const [selectedPath, setSelectedPath] = useState(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState(null)

	async function handlePick() {
		setError(null)
		let path
		try {
			path = await pickDirectory()
		} catch (err) {
			if (err.message === 'TAURI_UNAVAILABLE') {
				setError(t('git.desktopOnly'))
			} else {
				console.error('Не удалось открыть диалог выбора папки:', err)
				setError(t('git.dialogError'))
			}
			return
		}

		// Пользователь закрыл диалог, ничего не выбрав.
		if (!path) return

		setSelectedPath(path)
		setIsLoading(true)
		try {
			const commits = await getGitCommits(path, limit)
			onSelect?.(path, commits)
		} catch (err) {
			console.error('Не удалось прочитать git-репозиторий:', err)
			setError(err.message)
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className='space-y-3'>
			<button
				type='button'
				onClick={handlePick}
				disabled={isLoading}
				className='px-4 py-2 rounded-md bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 text-sm font-semibold transition-colors'
			>
				{isLoading ? t('git.loading') : t('git.pickFolder')}
			</button>

			{selectedPath && (
				<p className='text-xs text-slate-500 font-mono break-all'>
					{selectedPath}
				</p>
			)}

			{error && (
				<p className='text-sm text-red-400'>{error}</p>
			)}
		</div>
	)
}

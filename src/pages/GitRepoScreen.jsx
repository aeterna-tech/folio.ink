import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GitRepoPicker from '../components/GitRepoPicker'

// Отдельный экран для выбора локального git-репозитория и просмотра его
// последних коммитов. Сейчас это самостоятельная точка входа (вкладка
// в SideBar) — если репозиторий из этого экрана должен попадать в
// какой-то другой поток (например, привязываться к проекту), see комментарий
// у onSelect ниже: path/commits уже поднимаются наружу через колбэк,
// остаётся только решить, куда их передавать дальше.
export default function GitRepoScreen() {
	const { t } = useTranslation()
	const [repoPath, setRepoPath] = useState(null)
	const [commits, setCommits] = useState([])

	function handleSelect(path, fetchedCommits) {
		setRepoPath(path)
		setCommits(fetchedCommits)
	}

	return (
		<div className='h-screen overflow-y-auto px-8 py-6'>
			<div className='mb-6'>
				<h2 className='text-xl font-semibold text-slate-100'>
					{t('git.header')}
				</h2>
				<p className='text-sm text-slate-500 mt-1'>{t('git.subtitle')}</p>
			</div>

			<GitRepoPicker onSelect={handleSelect} />

			{repoPath && commits.length > 0 && (
				<div className='mt-6 space-y-2'>
					<h3 className='text-sm font-semibold text-slate-300'>
						{t('git.recentCommits', { count: commits.length })}
					</h3>
					<ul className='space-y-1.5'>
						{commits.map(commit => (
							<li
								key={commit.sha}
								className='flex items-start gap-3 text-sm border border-slate-800 rounded-md px-3 py-2 bg-slate-900/40'
							>
								<span className='font-mono text-teal-400 shrink-0'>
									{commit.short_sha}
								</span>
								<span className='text-slate-300 truncate'>
									{commit.message}
								</span>
								<span className='ml-auto text-xs text-slate-500 shrink-0'>
									{commit.author}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}

			{repoPath && commits.length === 0 && (
				<p className='mt-6 text-sm text-slate-500'>{t('git.noCommits')}</p>
			)}
		</div>
	)
}

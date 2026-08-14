import { useTranslation } from 'react-i18next'

function ProjectsIcon(props) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			fill='none'
			viewBox='0 0 24 24'
			strokeWidth={1.8}
			stroke='currentColor'
			className='w-[18px] h-[18px]'
			{...props}
		>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				d='M3.75 9.776c0-.34.128-.667.357-.917l2.5-2.72a1.5 1.5 0 0 1 1.107-.487h2.643c.397 0 .78.157 1.06.437l1.19 1.19c.28.28.663.437 1.06.437h4.826a1.5 1.5 0 0 1 1.5 1.5v8.634a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V9.776Z'
			/>
		</svg>
	)
}

function LogsIcon(props) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			fill='none'
			viewBox='0 0 24 24'
			strokeWidth={1.8}
			stroke='currentColor'
			className='w-[18px] h-[18px]'
			{...props}
		>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				d='M8.25 6.75h7.5M8.25 12h7.5m-7.5 5.25h4.5M6 3.75h12A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6A2.25 2.25 0 0 1 6 3.75Z'
			/>
		</svg>
	)
}

function StatsIcon(props) {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			fill='none'
			viewBox='0 0 24 24'
			strokeWidth={1.8}
			stroke='currentColor'
			className='w-[18px] h-[18px]'
			{...props}
		>
			<path
				strokeLinecap='round'
				strokeLinejoin='round'
				d='M3.75 19.5h16.5M7.5 19.5v-6.75m4.5 6.75V9.75m4.5 9.75V6m4.5 13.5V10.5'
			/>
		</svg>
	)
}

export default function SideBar({
	screen,
	setScreen,
	activeProjectId,
	backendConnected,
}) {
	const { t, i18n } = useTranslation()

	const navItems = [
		{ key: 'projects', label: t('nav.projects'), Icon: ProjectsIcon },
		{
			key: 'logs',
			label: t('nav.logs'),
			Icon: LogsIcon,
			disabled: !activeProjectId,
			disabledReason: t('nav.selectProjectFirst'),
		},
		{
			key: 'stats',
			label: t('nav.stats'),
			Icon: StatsIcon,
			disabled: !backendConnected,
			disabledReason: t('nav.backendRequired'),
		},
	]

	const currentLang = i18n.language?.startsWith('ru') ? 'ru' : 'en'

	function handleLanguageChange(lang) {
		i18n.changeLanguage(lang)
	}

	return (
		<aside className='h-screen w-56 shrink-0 bg-slate-950 border-r border-slate-800 flex flex-col'>
			<div className='px-5 py-6 border-b border-slate-800'>
				<h1 className='font-mono text-lg font-semibold text-slate-100 tracking-tight'>
					folio<span className='text-teal-400'>.ink</span>
				</h1>
				<p className='text-xs text-slate-500 mt-1'>{t('sidebar.tagline')}</p>
			</div>

			<nav className='flex-1 px-3 py-4 space-y-1 overflow-y-auto'>
				{navItems.map(item => {
					const isActive = screen === item.key
					const isDisabled = item.disabled
					const Icon = item.Icon
					return (
						<button
							key={item.key}
							type='button'
							disabled={isDisabled}
							onClick={() => !isDisabled && setScreen(item.key)}
							title={isDisabled ? item.disabledReason : undefined}
							className={[
								'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors border',
								isDisabled
									? 'text-slate-600 border-transparent cursor-not-allowed'
									: isActive
										? 'bg-slate-900 text-slate-100 border-slate-800'
										: 'text-slate-400 border-transparent hover:bg-slate-900 hover:text-slate-200',
							].join(' ')}
						>
							<Icon
								className={[
									'w-[18px] h-[18px] shrink-0',
									isDisabled
										? 'text-slate-700'
										: isActive
											? 'text-teal-400'
											: 'text-slate-500',
								].join(' ')}
							/>
							<span>{item.label}</span>
							{isDisabled && (
								<span className='ml-auto text-[10px] text-slate-700 font-mono'>
									{t('nav.na')}
								</span>
							)}
						</button>
					)
				})}
			</nav>

			<div className='px-5 py-4 border-t border-slate-800 space-y-3'>
				<div className='flex gap-1 bg-slate-900 border border-slate-800 rounded-md p-0.5'>
					<button
						type='button'
						onClick={() => handleLanguageChange('en')}
						aria-pressed={currentLang === 'en'}
						className={`flex-1 px-2.5 py-1 text-xs rounded font-mono transition-colors ${
							currentLang === 'en'
								? 'bg-slate-800 text-slate-100'
								: 'text-slate-500 hover:text-slate-300'
						}`}
					>
						{t('language.en')}
					</button>
					<button
						type='button'
						onClick={() => handleLanguageChange('ru')}
						aria-pressed={currentLang === 'ru'}
						className={`flex-1 px-2.5 py-1 text-xs rounded font-mono transition-colors ${
							currentLang === 'ru'
								? 'bg-slate-800 text-slate-100'
								: 'text-slate-500 hover:text-slate-300'
						}`}
					>
						{t('language.ru')}
					</button>
				</div>
				<p className='text-[11px] text-slate-600 font-mono'>
					{t('sidebar.version')}
				</p>
			</div>
		</aside>
	)
}

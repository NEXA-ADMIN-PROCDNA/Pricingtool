import { Sidebar } from './Sidebar'

export function MainLayout({
  children,
  title,
  action,
  scrollable = false,
  noPadding = false,
}: {
  children: React.ReactNode
  title?: string
  action?: React.ReactNode
  scrollable?: boolean
  noPadding?: boolean
}) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#F4F6FB' }}>
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {title && (
          <header
            className="flex items-center justify-between px-8 py-4 shrink-0 bg-white"
            style={{ borderBottom: '1px solid #D6DCE8' }}
          >
            <h1 className="text-xl font-bold" style={{ color: '#001E96' }}>{title}</h1>
            {action}
          </header>
        )}
        <main className={`flex flex-1 flex-col ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'} ${noPadding ? '' : 'px-8 py-6'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

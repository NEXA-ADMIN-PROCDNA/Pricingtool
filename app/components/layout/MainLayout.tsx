import { Sidebar } from './Sidebar'

export function MainLayout({
  children,
  title,
  action,
}: {
  children: React.ReactNode
  title?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {title && (
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-4 shrink-0">
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {action}
          </header>
        )}
        <main className="flex flex-1 flex-col overflow-hidden px-8 py-6">{children}</main>
      </div>
    </div>
  )
}

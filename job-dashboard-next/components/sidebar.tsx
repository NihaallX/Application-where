"use client"

import { LayoutDashboard, BarChart3, Eye, Activity, Settings2, LogOut } from 'lucide-react'

const navItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'DASHBOARD' },
  { id: 'analytics', icon: BarChart3, label: 'ANALYTICS' },
  { id: 'review', icon: Eye, label: 'REVIEW' },
  { id: 'monitor', icon: Activity, label: 'MONITOR' },
]

interface Props {
  active: string
  setActive: (id: string) => void
}

export function Sidebar({ active, setActive }: Props) {
  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="sticky top-24 h-[calc(100vh-8rem)] md:w-48 lg:w-64 bg-[#0D0D0D] rounded-2xl hidden md:flex flex-col p-8 overflow-y-auto">
        <nav className="flex flex-col gap-8">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex items-center gap-4 transition-colors text-left ${
                active === id ? 'text-[#E7E7E7]' : 'text-[#919191] hover:text-[#E7E7E7]'
              }`}
            >
              <Icon className="h-6 w-6 flex-shrink-0" />
              <span className="text-sm font-medium tracking-wide">{label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-8 border-t border-[#1F1F1F] flex flex-col gap-8">
          <button className="flex items-center gap-4 text-[#919191] hover:text-[#E7E7E7] transition-colors">
            <Settings2 className="h-6 w-6 flex-shrink-0" />
            <span className="text-sm font-medium tracking-wide">SETTINGS</span>
          </button>
          <button className="flex items-center gap-4 text-[#919191] hover:text-[#E7E7E7] transition-colors">
            <LogOut className="h-6 w-6 flex-shrink-0" />
            <span className="text-sm font-medium tracking-wide">LOGOUT</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around bg-[#0D0D0D] border-t border-[#1F1F1F] px-2 py-2 safe-area-inset-bottom">
        {navItems.map(({ id, icon: Icon, label }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors min-w-0 flex-1 ${
                isActive ? 'text-[#86efac]' : 'text-[#555] hover:text-[#919191]'
              }`}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="text-[9px] font-medium tracking-wider truncate">{label}</span>
              {isActive && <div className="w-1 h-1 rounded-full bg-[#86efac]" />}
            </button>
          )
        })}
      </nav>
    </>
  )
}

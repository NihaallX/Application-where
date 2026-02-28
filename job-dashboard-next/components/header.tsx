"use client"

import { AppLogo } from "@/components/app-logo"
import { Settings2, LogOut, ExternalLink } from 'lucide-react'
import { useClerk, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function Header() {
  const { signOut } = useClerk()
  const { user } = useUser()
  const router = useRouter()

  const handleSignOut = () => signOut(() => router.push("/"))

  const initials = user
    ? (user.firstName?.[0] ?? user.emailAddresses?.[0]?.emailAddress?.[0] ?? "?").toUpperCase()
    : "?"

  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-6 bg-black/10 backdrop-blur-[120px]">
      <AppLogo className="text-white" />
      <div className="flex items-center gap-3">
        <a
          href="https://mail.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1A1A1A] border border-[#333] text-[#919191] hover:text-white text-xs transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Gmail
        </a>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-10 w-10 rounded-full bg-gradient-to-br from-[#86efac] to-[#22c55e] hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/20 flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-[#0D0D0D] border-[#1F1F1F] text-white">
            {user?.primaryEmailAddress && (
              <div className="px-2 py-1.5 text-xs text-[#555] truncate border-b border-[#1F1F1F] mb-1">
                {user.primaryEmailAddress.emailAddress}
              </div>
            )}
            <DropdownMenuItem className="focus:bg-[#1F1F1F] focus:text-white cursor-pointer text-[#919191]">
              <Settings2 className="mr-2 h-4 w-4 text-[#919191]" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleSignOut}
              className="focus:bg-[#1F1F1F] focus:text-white cursor-pointer text-[#919191]"
            >
              <LogOut className="mr-2 h-4 w-4 text-[#919191]" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  Menu,
  LogOut,
  Search,
  ChevronDown,
  UserPlus,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import StatusBadge from './StatusBadge'
import api from '../lib/api'

const ICONS = {
  doctor_registered: UserPlus,
  doctor_approved: CheckCircle2,
  doctor_rejected: XCircle,
}

const ICON_TONE = {
  doctor_registered: 'bg-amber-light text-amber',
  doctor_approved: 'bg-brand-light text-brand',
  doctor_rejected: 'bg-danger-light text-danger',
}

function timeAgo(iso) {
  if (!iso) return 'recently'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

function getTimeGreeting() {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) {
    return { text: 'Good morning', emoji: '☀️' }
  } else if (hour >= 12 && hour < 17) {
    return { text: 'Good afternoon', emoji: '🌤️' }
  } else if (hour >= 17 && hour < 21) {
    return { text: 'Good evening', emoji: '🌆' }
  } else {
    return { text: 'Good evening', emoji: '🌙' }
  }
}

function statusLabel(status) {
  if (status === 'pending') return 'Pending'
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  return status || 'Pending'
}

export default function Topbar({ onMenuClick }) {
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [greeting, setGreeting] = useState(getTimeGreeting)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [allDoctors, setAllDoctors] = useState([])
  const [isLoadingSearch, setIsLoadingSearch] = useState(false)

  const ref = useRef(null)
  const profileRef = useRef(null)
  const searchRef = useRef(null)

  const { token, admin, logout } = useAuth()
  const { notifications, unreadCount, markRead } = useNotifications()
  const navigate = useNavigate()

  useEffect(() => {
    // Check and update greeting every minute
    const interval = setInterval(() => {
      setGreeting(getTimeGreeting())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Fetch doctors for search if not already loaded
  const loadDoctorsForSearch = useCallback(async () => {
    if (!token || allDoctors.length > 0 || isLoadingSearch) return
    setIsLoadingSearch(true)
    try {
      const res = await api.listDoctors(token, 'all')
      if (res && res.doctors) {
        setAllDoctors(res.doctors)
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingSearch(false)
    }
  }, [token, allDoctors.length, isLoadingSearch])

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const displayName = admin?.name
    ? (admin.name.toLowerCase().includes('admin') ? 'Zenve' : admin.name.split(' ')[0])
    : 'Zenve'

  // Filter doctors for instant search dropdown
  const searchResults = searchQuery.trim()
    ? allDoctors.filter((d) => {
        const q = searchQuery.toLowerCase().trim()
        return (
          (d.fullName || '').toLowerCase().includes(q) ||
          (d.email || '').toLowerCase().includes(q) ||
          (d.clinicName || '').toLowerCase().includes(q) ||
          (d.phone || '').toLowerCase().includes(q) ||
          (d.qualification || '').toLowerCase().includes(q) ||
          (d.status || '').toLowerCase().includes(q)
        )
      }).slice(0, 6)
    : []

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setSearchOpen(false)
      navigate(`/doctors?q=${encodeURIComponent(searchQuery.trim())}&tab=all`)
    } else if (e.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  const handleSelectDoctor = (d) => {
    setSearchOpen(false)
    navigate(`/doctors?select=${d.id}&tab=${d.status || 'all'}&q=${encodeURIComponent(d.fullName)}`)
  }

  const handleViewAllResults = () => {
    setSearchOpen(false)
    navigate(`/doctors?q=${encodeURIComponent(searchQuery.trim())}&tab=all`)
  }

  return (
    <header className="relative z-20 flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 lg:px-8 pt-3.5 pb-2 bg-transparent shrink-0">
      {/* Decorative Top-Right Pet Wave Banner */}
      <div className="absolute top-0 right-0 h-16 w-64 pointer-events-none overflow-hidden hidden xl:block z-0 opacity-70">
        <svg
          className="absolute top-0 right-0 w-full h-full text-indigo-50/50"
          viewBox="0 0 320 120"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 C100,25 210,40 320,20 L320,0 Z"
            fill="url(#topWaveGrad)"
          />
          <defs>
            <linearGradient id="topWaveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E0F2FE" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#E0E7FF" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#EDE9FE" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>

        {/* Cursive text and paw print in top-right */}
        <div className="absolute top-2.5 right-6 flex items-center gap-2 select-none opacity-85">
          <svg className="w-4 h-4 text-[#434EE8]/50 transform -rotate-12" viewBox="0 0 24 24" fill="currentColor">
            <ellipse cx="6.5" cy="7" rx="1.8" ry="2.5" />
            <ellipse cx="11" cy="5" rx="1.8" ry="2.7" />
            <ellipse cx="15.5" cy="6" rx="1.8" ry="2.6" />
            <ellipse cx="19" cy="8.5" rx="1.6" ry="2.2" />
            <path d="M7.5 13.5C6.2 14.8 6 17 7.2 18.5C8.5 20.2 11 20.8 13 20C15 19.3 17 18.2 17.5 16.2C18 14.5 16.5 13 14.8 13.3C13.2 13.5 12.4 12.2 11 12C9.5 11.8 8.4 12.3 7.5 13.5Z" />
          </svg>
          <div className="font-script text-[15px] text-[#4F5B93] leading-none tracking-wide text-right">
            <p>Healthy Doctors</p>
            <p className="flex items-center justify-end gap-1">
              Happier Pets <span className="text-xs">♡</span>
            </p>
          </div>
        </div>
      </div>

      {/* Left Greeting */}
      <div className="flex items-center gap-2.5 relative z-10 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shrink-0 shadow-xs"
          aria-label="Open menu"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>
        <div className="min-w-0">
          <h1 className="font-display text-[22px] lg:text-[24px] font-bold text-[#181E38] tracking-tight flex items-center gap-2 leading-tight">
            {greeting.text}, {displayName} <span className="text-xl">{greeting.emoji}</span>
          </h1>
          <p className="text-[12px] text-[#78809A] mt-0.5">
            Here&apos;s what&apos;s happening with your doctors today.
          </p>
        </div>
      </div>

      {/* Right Controls: Search, Bell, Profile */}
      <div className="flex items-center gap-2.5 relative z-10 shrink-0">
        {/* Search Bar */}
        <div className="relative flex items-center" ref={searchRef}>
          <Search className="absolute left-3.5 h-3.5 w-3.5 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search doctors, registrations..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              if (!searchOpen) setSearchOpen(true)
            }}
            onFocus={() => {
              loadDoctorsForSearch()
              if (searchQuery.trim().length > 0) setSearchOpen(true)
            }}
            onKeyDown={handleSearchKeyDown}
            className="w-52 md:w-60 lg:w-68 h-9 pl-9 pr-7 rounded-full border border-slate-200/90 bg-white/95 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-[#434EE8] focus:ring-2 focus:ring-[#434EE8]/10 shadow-xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSearchOpen(false)
              }}
              className="absolute right-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Instant Search Results Dropdown */}
          <AnimatePresence>
            {searchOpen && searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 top-full mt-2 w-80 sm:w-96 card p-0 overflow-hidden shadow-pop origin-top-right z-40 bg-white border border-slate-200 rounded-2xl"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-2.5 bg-slate-50/70">
                  <p className="text-xs font-semibold text-slate-700">
                    Search Results {searchResults.length > 0 && `(${searchResults.length})`}
                  </p>
                  {isLoadingSearch && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#434EE8]" />
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {searchResults.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSelectDoctor(d)}
                      className="w-full text-left flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#434EE8] font-bold text-xs group-hover:bg-[#434EE8] group-hover:text-white transition-colors">
                          {d.fullName ? d.fullName.charAt(0).toUpperCase() : 'D'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#434EE8] transition-colors">
                            {d.fullName}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {d.email} {d.clinicName && `· ${d.clinicName}`}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={statusLabel(d.status)} />
                    </button>
                  ))}

                  {searchResults.length === 0 && !isLoadingSearch && (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      No doctors found matching &ldquo;{searchQuery}&rdquo;
                    </div>
                  )}
                </div>

                <button
                  onClick={handleViewAllResults}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-[#434EE8] px-4 py-2.5 bg-slate-50 hover:bg-[#EEF2FF] border-t border-line transition-colors"
                >
                  <span>View all results for &ldquo;{searchQuery}&rdquo;</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications Bell */}
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-600 shadow-xs transition-colors hover:bg-slate-50"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#FF4242] px-1 text-[10px] font-bold text-white shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute right-0 mt-2 w-80 card p-0 overflow-hidden shadow-pop origin-top-right z-30"
              >
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="font-display text-base font-semibold text-ink">Notifications</p>
                  {unreadCount > 0 ? (
                    <span className="rounded-full bg-danger-light px-2 py-0.5 text-[11px] font-semibold text-danger">
                      {unreadCount} new
                    </span>
                  ) : (
                    <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] font-medium text-ink-faint">
                      Caught up
                    </span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.slice(0, 6).map((n) => {
                    const Icon = ICONS[n.type] || UserPlus
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (!n.read) markRead(n.id)
                          setOpen(false)
                          navigate('/doctors')
                        }}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 border-b border-line last:border-b-0 hover:bg-surface2 transition-colors ${
                          !n.read ? 'bg-admin-light' : ''
                        }`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ICON_TONE[n.type] || 'bg-surface2 text-ink-soft'}`}>
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">{n.title}</p>
                          <p className="text-xs text-ink-faint line-clamp-2">{n.message}</p>
                          <p className="text-[11px] text-ink-faint mt-0.5">{timeAgo(n.createdAt)}</p>
                        </div>
                      </button>
                    )
                  })}
                  {notifications.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      All caught up! No unread notifications.
                    </div>
                  )}
                </div>
                <Link
                  to="/notifications"
                  onClick={() => setOpen(false)}
                  className="block text-center text-xs font-semibold text-[#434EE8] px-4 py-2.5 border-t border-line hover:bg-slate-50 transition-colors"
                >
                  View all notifications
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Avatar Dropdown Pill */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-full border border-slate-200/90 bg-white hover:bg-slate-50 shadow-xs transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E8EDFC] text-[#434EE8] font-bold text-xs">
              ZA
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 card p-1.5 shadow-pop origin-top-right z-30"
              >
                <div className="px-3 py-2 border-b border-line mb-1">
                  <p className="text-xs font-semibold text-slate-800">Zenve Admin</p>
                  <p className="text-[11px] text-slate-400 truncate">admin@zenve.in</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-danger hover:bg-danger-light transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}

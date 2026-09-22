import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Search,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  Building2,
  ShieldCheck,
  UserPlus,
  X,
  User,
  GraduationCap,
  Calendar,
  MapPin,
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import api from '../lib/api'

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
]

const VERIFICATION_ITEMS = [
  { key: 'VETERINARY_REGISTRATION', field: 'veterinaryRegistrationVerified', label: 'Vet registration' },
  { key: 'KYC', field: 'kycVerified', label: 'KYC' },
  { key: 'DIGITAL_SIGNATURE', field: 'digitalSignatureVerified', label: 'Digital signature' },
  { key: 'STATE_COUNCIL_SYNC', field: 'stateCouncilSyncVerified', label: 'State council sync' },
]

const EMPTY_NEW_DOCTOR = {
  fullName: '',
  email: '',
  phone: '',
  clinicName: '',
  qualification: '',
  password: '',
}

function statusLabel(status) {
  if (status === 'pending') return 'Pending'
  if (status === 'approved') return 'Approved'
  if (status === 'rejected') return 'Rejected'
  return status || 'Pending'
}

const RAIL = {
  pending: 'border-l-amber',
  approved: 'border-l-brand',
  rejected: 'border-l-danger',
}

export default function Doctors() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialQuery = searchParams.get('q') || searchParams.get('search') || ''
  const initialTab = searchParams.get('tab') || (initialQuery ? 'all' : 'pending')

  const [tab, setTab] = useState(initialTab)
  const [query, setQuery] = useState(initialQuery)
  const [doctors, setDoctors] = useState([])
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, all: 0 })
  const [busyId, setBusyId] = useState(null)
  const [busyVerifyKey, setBusyVerifyKey] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newDoctor, setNewDoctor] = useState(EMPTY_NEW_DOCTOR)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const data = await api.listDoctors(token, tab)
      const rawDoctors = data?.doctors || []
      setDoctors(rawDoctors)
      setCounts(data?.counts || { pending: 0, approved: 0, rejected: 0, all: 0 })

      // Enrich missing fields (city, pincode, profileImage) asynchronously
      Promise.all(
        rawDoctors.map(async (doc) => {
          if (doc.email) {
            try {
              const liveProfile = await api.fetchDoctorProfile(doc.email)
              if (liveProfile) {
                return {
                  ...doc,
                  area: liveProfile.area || doc.area,
                  city: liveProfile.city || doc.city,
                  pincode: liveProfile.pincode || doc.pincode,
                  clinicName: liveProfile.clinicHospital || doc.clinicName,
                  qualification: liveProfile.qualification || doc.qualification,
                  profileImage: liveProfile.profileImage || doc.profileImage,
                }
              }
            } catch {}
          }
          return doc
        })
      ).then((enriched) => {
        setDoctors(enriched)
      }).catch(() => {})
    } catch {
      setDoctors([])
      setCounts({ pending: 0, approved: 0, rejected: 0, all: 0 })
    }
  }, [token, tab])

  useEffect(() => {
    load()
  }, [load])

  // Sync URL search params
  useEffect(() => {
    const qParam = searchParams.get('q') || searchParams.get('search') || ''
    const tabParam = searchParams.get('tab')
    const selectParam = searchParams.get('select') || searchParams.get('doctor')

    if (qParam !== query) {
      setQuery(qParam)
    }
    if (tabParam && tabParam !== tab) {
      setTab(tabParam)
    }
    if (selectParam && doctors.length > 0) {
      const match = doctors.find((d) => d.id === selectParam)
      if (match) {
        setSelectedDoctor(match)
      }
    }
  }, [searchParams, doctors])

  useEffect(() => {
    if (!selectedDoctor) return
    const updated = doctors.find((d) => d.id === selectedDoctor.id)
    if (updated) setSelectedDoctor(updated)
  }, [doctors])

  const handleQueryChange = (val) => {
    setQuery(val)
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev)
        if (val.trim()) {
          updated.set('q', val)
        } else {
          updated.delete('q')
          updated.delete('search')
        }
        return updated
      },
      { replace: true }
    )
  }

  const handleTabChange = (newTab) => {
    setTab(newTab)
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev)
        updated.set('tab', newTab)
        return updated
      },
      { replace: true }
    )
  }

  const handleApprove = async (id) => {
    setBusyId(id)
    try {
      await api.approveDoctor(token, id)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (id) => {
    const reason = window.prompt('Optional: reason for rejection')
    setBusyId(id)
    try {
      await api.rejectDoctor(token, id, reason || '')
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const handleVerify = async (id, item) => {
    setBusyVerifyKey(`${id}:${item}`)
    try {
      await api.verifyDoctor(token, id, item)
      await load()
    } finally {
      setBusyVerifyKey(null)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)
    try {
      await api.createDoctor(token, newDoctor)
      setShowCreate(false)
      setNewDoctor(EMPTY_NEW_DOCTOR)
      if (tab !== 'approved' && tab !== 'all') handleTabChange('approved')
      else await load()
    } catch (err) {
      setCreateError(err.message || 'Failed to create doctor account')
    } finally {
      setCreating(false)
    }
  }

  const filtered = doctors.filter((d) => {
    if (!query.trim()) return true
    const q = query.toLowerCase().trim()
    return (
      (d.fullName || '').toLowerCase().includes(q) ||
      (d.email || '').toLowerCase().includes(q) ||
      (d.clinicName || '').toLowerCase().includes(q) ||
      (d.phone || '').toLowerCase().includes(q) ||
      (d.qualification || '').toLowerCase().includes(q) ||
      (d.area || '').toLowerCase().includes(q) ||
      (d.city || '').toLowerCase().includes(q) ||
      (d.pincode ? String(d.pincode) : '').toLowerCase().includes(q) ||
      (d.status || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4 flex-1 min-h-0 flex flex-col pb-1">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-faint" />
          <input
            className="input pl-9 pr-8 w-full"
            placeholder="Search name, email, clinic, city, phone..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
          />
          {query && (
            <button
              onClick={() => handleQueryChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {query.trim() && (
          <div className="text-xs text-slate-500 font-medium">
            Found <span className="font-bold text-slate-800">{filtered.length}</span> {filtered.length === 1 ? 'doctor' : 'doctors'}
          </div>
        )}
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm sm:ml-auto">
          <UserPlus className="h-4 w-4" /> Create doctor
        </button>
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
              tab === t.key ? 'bg-admin text-white border-admin' : 'bg-surface text-ink-soft border-line hover:bg-surface2'
            }`}
          >
            {t.label} ({counts[t.key] ?? 0})
          </button>
        ))}
      </div>

      <div className="card divide-y divide-line overflow-y-auto flex-1 min-h-0 shadow-xs">
        {filtered.map((d) => (
          <div
            key={d.id}
            onClick={() => setSelectedDoctor(d)}
            className={`flex flex-col lg:flex-row lg:items-center gap-3.5 border-l-[3px] px-5 py-4 transition-colors hover:bg-surface2/60 cursor-pointer ${
              RAIL[d.status] || 'border-l-transparent'
            }`}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
              {d.profileImage ? (
                <img src={d.profileImage} alt={d.fullName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-admin-light text-admin font-bold text-xs">
                  {d.fullName ? d.fullName.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-ink truncate">{d.fullName}</p>
                <StatusBadge status={statusLabel(d.status)} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-ink-faint">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {d.email}
                </span>
                {d.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> {d.phone}
                  </span>
                )}
                {d.clinicName && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" /> {d.clinicName}
                  </span>
                )}
                {(d.area || d.city || d.pincode) && (
                  <span className="inline-flex items-center gap-1.5 text-indigo-600 font-medium bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-100">
                    <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    {[d.area, [d.city, d.pincode].filter(Boolean).join(' - ')].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              {d.status === 'rejected' && d.rejectionReason && (
                <p className="text-xs text-danger mt-1">Reason: {d.rejectionReason}</p>
              )}
              {d.status === 'approved' && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {VERIFICATION_ITEMS.map((v) => {
                    const verified = d[v.field]
                    const busy = busyVerifyKey === `${d.id}:${v.key}`
                    return verified ? (
                      <span
                        key={v.key}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-brand-light text-brand"
                      >
                        <ShieldCheck className="h-3 w-3" /> {v.label}
                      </span>
                    ) : (
                      <button
                        key={v.key}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleVerify(d.id, v.key)
                        }}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-surface2 disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3 w-3" /> {busy ? 'Verifying…' : `Verify ${v.label}`}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {d.status === 'pending' && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleApprove(d.id)
                  }}
                  disabled={busyId === d.id}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleReject(d.id)
                  }}
                  disabled={busyId === d.id}
                  className="btn-secondary text-sm disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-ink-faint flex flex-col items-center justify-center">
            {query.trim() ? (
              <>
                <Search className="h-8 w-8 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No doctors found matching &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Try adjusting your search keywords or switching tabs.
                </p>
                <div className="flex items-center gap-2 mt-3.5">
                  <button
                    onClick={() => handleQueryChange('')}
                    className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Clear search
                  </button>
                  {tab !== 'all' && (
                    <button
                      onClick={() => handleTabChange('all')}
                      className="text-xs font-semibold text-[#434EE8] bg-[#EEF2FF] hover:bg-[#E0E7FF] px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Search across all doctors ({counts.all})
                    </button>
                  )}
                </div>
              </>
            ) : (
              <p>No doctors in this view.</p>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="card w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-ink">Create doctor account</h2>
              <button
                onClick={() => {
                  setShowCreate(false)
                  setCreateError('')
                }}
                className="text-ink-faint hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <input
                className="input w-full"
                placeholder="Full name"
                required
                value={newDoctor.fullName}
                onChange={(e) => setNewDoctor((c) => ({ ...c, fullName: e.target.value }))}
              />
              <input
                className="input w-full"
                type="email"
                placeholder="Email"
                required
                value={newDoctor.email}
                onChange={(e) => setNewDoctor((c) => ({ ...c, email: e.target.value }))}
              />
              <input
                className="input w-full"
                placeholder="Phone"
                value={newDoctor.phone}
                onChange={(e) => setNewDoctor((c) => ({ ...c, phone: e.target.value }))}
              />
              <input
                className="input w-full"
                placeholder="Clinic name"
                value={newDoctor.clinicName}
                onChange={(e) => setNewDoctor((c) => ({ ...c, clinicName: e.target.value }))}
              />
              <input
                className="input w-full"
                placeholder="Qualification"
                value={newDoctor.qualification}
                onChange={(e) => setNewDoctor((c) => ({ ...c, qualification: e.target.value }))}
              />
              <input
                className="input w-full"
                type="password"
                placeholder="Password (min 6 characters)"
                required
                minLength={6}
                value={newDoctor.password}
                onChange={(e) => setNewDoctor((c) => ({ ...c, password: e.target.value }))}
              />

              {createError && <p className="text-xs text-danger">{createError}</p>}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false)
                    setCreateError('')
                  }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-primary text-sm disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedDoctor && (
        <DoctorProfileModal
          doctor={selectedDoctor}
          busyId={busyId}
          busyVerifyKey={busyVerifyKey}
          onClose={() => setSelectedDoctor(null)}
          onApprove={async (id) => {
            await handleApprove(id)
            setSelectedDoctor(null)
          }}
          onReject={async (id) => {
            await handleReject(id)
            setSelectedDoctor(null)
          }}
          onVerify={handleVerify}
        />
      )}
    </div>
  )
}

function DoctorProfileModal({ doctor, busyId, busyVerifyKey, onClose, onApprove, onReject, onVerify }) {
  const { token } = useAuth()
  const [d, setD] = useState(doctor)

  useEffect(() => {
    setD(doctor)
    let isMounted = true

    const fetchDetails = async () => {
      let freshAdmin = null
      let liveProfile = null

      if (token && doctor?.id) {
        try {
          freshAdmin = await api.getDoctor(token, doctor.id)
        } catch (e) {
          console.warn('getDoctor error:', e)
        }
      }

      if (doctor?.email) {
        try {
          liveProfile = await api.fetchDoctorProfile(doctor.email)
        } catch (e) {
          console.warn('fetchDoctorProfile error:', e)
        }
      }

      if (isMounted) {
        setD((prev) => {
          const merged = { ...prev }
          if (freshAdmin) {
            Object.assign(merged, freshAdmin)
          }
          if (liveProfile) {
            if (liveProfile.area) merged.area = liveProfile.area
            if (liveProfile.city) merged.city = liveProfile.city
            if (liveProfile.pincode) merged.pincode = liveProfile.pincode
            if (liveProfile.clinicHospital) merged.clinicName = liveProfile.clinicHospital
            if (liveProfile.qualification) merged.qualification = liveProfile.qualification
            if (liveProfile.profileImage) merged.profileImage = liveProfile.profileImage
          }
          return merged
        })
      }
    }

    fetchDetails()
    return () => { isMounted = false }
  }, [doctor, token])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-2xs">
              {d.profileImage ? (
                <img src={d.profileImage} alt={d.fullName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-admin-light text-admin font-bold text-sm">
                  {d.fullName ? d.fullName.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">{d.fullName}</h2>
              <StatusBadge status={statusLabel(d.status)} />
            </div>
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Basic Info Rows */}
          <div className="space-y-2.5 text-sm text-ink-soft bg-slate-50/70 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-ink-faint shrink-0" />
              <span className="text-ink">{d.email}</span>
            </div>
            {d.phone && (
              <div className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-ink-faint shrink-0" />
                <span className="text-ink">{d.phone}</span>
              </div>
            )}
            {d.clinicName && (
              <div className="flex items-center gap-2.5">
                <Building2 className="h-4 w-4 text-ink-faint shrink-0" />
                <span className="text-ink">{d.clinicName}</span>
              </div>
            )}
            {(d.area || d.city || d.pincode) && (
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-ink-faint shrink-0" />
                <span className="text-ink">{[d.area, [d.city, d.pincode].filter(Boolean).join(' - ')].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {d.createdAt && (
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-ink-faint shrink-0" />
                <span>Joined {new Date(d.createdAt).toLocaleDateString()}</span>
              </div>
            )}
            {d.status === 'rejected' && d.rejectionReason && (
              <p className="text-xs text-danger pt-1">Reason: {d.rejectionReason}</p>
            )}
          </div>
        </div>

        {d.status === 'approved' && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">Verifications</p>
            <div className="flex flex-wrap gap-1.5">
              {VERIFICATION_ITEMS.map((v) => {
                const verified = d[v.field]
                const busy = busyVerifyKey === `${d.id}:${v.key}`
                return verified ? (
                  <span
                    key={v.key}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-brand-light text-brand"
                  >
                    <ShieldCheck className="h-3 w-3" /> {v.label}
                  </span>
                ) : (
                  <button
                    key={v.key}
                    onClick={() => onVerify(d.id, v.key)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-surface2 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-3 w-3" /> {busy ? 'Verifying…' : `Verify ${v.label}`}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {d.status === 'pending' && (
          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              onClick={() => onApprove(d.id)}
              disabled={busyId === d.id}
              className="btn-primary text-sm disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" /> Approve
            </button>
            <button
              onClick={() => onReject(d.id)}
              disabled={busyId === d.id}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

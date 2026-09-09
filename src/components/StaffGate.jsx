import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Stethoscope, Building2, ShieldAlert, Lock, ArrowRight } from 'lucide-react'

// Lightweight prototype staff access gate
// No real auth — role stored in sessionStorage for the browser session only.

const ROLES = [
  {
    id: 'doctor',
    label: 'Doctor',
    sublabel: 'Access the Physician Console',
    icon: Stethoscope,
    color: 'emerald',
    target: '/doctor',
  },
  {
    id: 'admin',
    label: 'Administrator',
    sublabel: 'Access the Operations Dashboard',
    icon: Building2,
    color: 'blue',
    target: '/admin',
  },
]

export default function StaffGate() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Read state from App.jsx ProtectedStaffRoute if we were redirected
  const deniedRole = location.state?.deniedRole
  const requiredRole = location.state?.requiredRole
  const returnTo = location.state?.from

  const [selected, setSelected] = useState(null)

  function handleSelect(role) {
    setSelected(role.id)
  }

  function handleProceed() {
    if (!selected) return
    const role = ROLES.find(r => r.id === selected)
    if (!role) return

    sessionStorage.setItem('staffRole', selected)
    
    // Check if they are fulfilling a redirect
    if (requiredRole === selected && returnTo) {
      navigate(returnTo)
    } else {
      navigate(role.target)
    }
  }

  const colorMap = {
    emerald: {
      ring: 'ring-emerald-500 border-emerald-500 bg-emerald-50',
      icon: 'bg-emerald-600 text-white',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    blue: {
      ring: 'ring-blue-500 border-blue-500 bg-blue-50',
      icon: 'bg-blue-600 text-white',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white',
    },
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Header badge */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-base leading-tight">Staff Access</p>
            <p className="text-xs text-slate-500">Central OPD Portal — Apex Civil Hospital</p>
          </div>
        </div>

        {/* Prototype notice */}
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Prototype staff access control.</strong> No real credentials are required.
            Role selection is session-scoped and clears when the browser tab is closed.
          </p>
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-1 text-center">Select your role</h1>
        <p className="text-sm text-slate-500 text-center mb-6">
          Choose the role that matches your work station.
        </p>

        {/* Role cards */}
        <div className="space-y-3 mb-6">
          {ROLES.map((role) => {
            const Icon = role.icon
            const c = colorMap[role.color]
            const isSelected = selected === role.id
            return (
              <button
                key={role.id}
                onClick={() => handleSelect(role)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left active:scale-[0.98] ${
                  isSelected
                    ? `${c.ring} ring-2`
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
                style={{ minHeight: '72px' }}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isSelected ? c.icon : 'bg-slate-100 text-slate-500'
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-base">{role.label}</p>
                  <p className="text-xs text-slate-500">{role.sublabel}</p>
                </div>
                {isSelected && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10.28 2.28 3.989 8.575 1.695 6.28A1 1 0 0 0 .28 7.695l3 3a1 1 0 0 0 1.414 0l7-7A1 1 0 0 0 10.28 2.28z" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Cross-role denied message */}
        {deniedRole && (
          <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 flex items-start gap-2 animate-fade-in">
            <ShieldAlert className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-rose-700 font-medium leading-relaxed">
              Access denied to the requested area. Your session is currently scoped to the{' '}
              <strong>{deniedRole === 'doctor' ? 'Doctor Console' : 'Admin Dashboard'}</strong>.
              <br />Select a new role and proceed to switch.
            </p>
          </div>
        )}

        {/* Proceed button */}
        <button
          onClick={handleProceed}
          disabled={!selected}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
            selected
              ? `${colorMap[ROLES.find(r => r.id === selected)?.color]?.btn || 'bg-slate-700 hover:bg-slate-800 text-white'}`
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
          style={{ minHeight: '52px' }}
        >
          Proceed <ArrowRight className="w-5 h-5" />
        </button>

        <p className="text-center text-xs text-slate-400 mt-4">
          Patient Kiosk is publicly accessible at{' '}
          <a href="/patient" className="underline text-slate-500 hover:text-slate-700">/patient</a>
          {' '}and does not require staff access.
        </p>
      </div>
    </div>
  )
}

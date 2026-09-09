import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Menu, X, Stethoscope, User, Building2, ExternalLink, Lock, LogOut } from 'lucide-react'
import LandingPage     from './pages/LandingPage'
import PatientKiosk    from './pages/PatientKiosk'
import DoctorConsole   from './pages/DoctorConsole'
import AdminDashboard  from './pages/AdminDashboard'
import NotFound        from './pages/NotFound'
import StaffGate       from './components/StaffGate'

// ── Session-scoped staff role helpers ────────────────────────────────────────
function getStaffRole() {
  try { return sessionStorage.getItem('staffRole') } catch { return null }
}
function clearStaffRole() {
  try { sessionStorage.removeItem('staffRole') } catch {}
}

// ── Protected staff route ────────────────────────────────────────────────────
// If no role is set → show StaffGate (role selector).
// If role is set but doesn't match the required role → show StaffGate with denied state.
function ProtectedStaffRoute({ requiredRole, children }) {
  const role = getStaffRole()
  if (!role || role !== requiredRole) {
    return <StaffGate requiredRole={requiredRole} />
  }
  return children
}

// ── Enterprise role links (staff only) ───────────────────────────────────────
const STAFF_LINKS = [
  { path: '/doctor', label: 'Doctor Console',   icon: Stethoscope, role: 'doctor' },
  { path: '/admin',  label: 'Operations Audit', icon: Building2,   role: 'admin'  },
]

// ── Top Enterprise Header ────────────────────────────────────────────────────
function EnterpriseHeader() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const staffRole = getStaffRole()

  // Don't show the persistent header on the landing page or patient kiosk
  if (pathname === '/' || pathname === '/patient') return null

  return (
    <>
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-40 no-print">
        {/* NHM mission bar */}
        <div className="bg-emerald-700 text-emerald-50 text-[10px] font-medium text-center py-0.5 tracking-wider uppercase hidden md:block">
          National Health Mission - Ministry of Ayush - Government of India
        </div>

        <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Brand */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold leading-tight">Central OPD Intake Portal</div>
              <div className="text-[10px] text-slate-400 leading-tight hidden sm:block">
                Apex Civil Hospital – FHIR-Ready Structured Records
              </div>
            </div>
          </button>

          {/* Desktop nav — only show links matching current role */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800 rounded-xl p-1">
            <NavLink
              to="/patient"
              className={({ isActive }) =>
                `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                }`
              }
            >
              <User className="w-3.5 h-3.5" />
              <span>Node: Kiosk-01</span>
            </NavLink>

            {STAFF_LINKS.map(({ path, label, icon: Icon, role }) => {
              // Only show the link for the active session role
              if (staffRole && staffRole !== role) return null
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </NavLink>
              )
            })}

            {/* Staff login shortcut if no role yet */}
            {!staffRole && (
              <NavLink
                to="/doctor"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Staff Access</span>
              </NavLink>
            )}
          </nav>

          {/* Status + session role badge + hamburger */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {staffRole && (
              <div className="hidden lg:flex items-center gap-2">
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-900/50 border border-emerald-700/50 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {staffRole === 'doctor' ? 'Physician Session' : 'Admin Session'}
                </span>
                <button
                  onClick={() => { clearStaffRole(); navigate('/') }}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-700 transition-colors"
                  title="End staff session"
                >
                  <LogOut className="w-3 h-3" />
                  End Session
                </button>
              </div>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden w-11 h-11 rounded-xl bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors flex-shrink-0"
              style={{ minWidth: '44px', minHeight: '44px' }}
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-700 bg-slate-800 px-4 py-3 space-y-1">
            <NavLink
              to="/patient"
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 rounded-xl text-sm font-semibold transition-colors ${
                  isActive ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-700'
                }`
              }
              style={{ minHeight: '60px' }}
            >
              <User className="w-5 h-5" />
              <span>Patient Kiosk</span>
            </NavLink>

            {STAFF_LINKS.map(({ path, label, icon: Icon, role }) => {
              if (staffRole && staffRole !== role) return null
              return (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 rounded-xl text-sm font-semibold transition-colors ${
                      isActive ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-700'
                    }`
                  }
                  style={{ minHeight: '60px' }}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </NavLink>
              )
            })}

            <NavLink
              to="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-4 text-slate-400 hover:text-white text-sm font-medium transition-colors"
              style={{ minHeight: '48px' }}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Portal Hub</span>
            </NavLink>

            {staffRole && (
              <button
                onClick={() => { clearStaffRole(); navigate('/'); setMobileOpen(false) }}
                className="flex items-center gap-3 px-4 text-rose-400 hover:text-rose-300 text-sm font-medium transition-colors w-full"
                style={{ minHeight: '48px' }}
              >
                <LogOut className="w-4 h-4" />
                <span>End Staff Session</span>
              </button>
            )}
          </div>
        )}
      </header>
    </>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <EnterpriseHeader />
      <Routes>
        <Route path="/"        element={<LandingPage />} />
        <Route path="/patient" element={<PatientKiosk />} />
        <Route
          path="/doctor"
          element={
            <ProtectedStaffRoute requiredRole="doctor">
              <DoctorConsole />
            </ProtectedStaffRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedStaffRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedStaffRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

import { useEffect, useState } from 'react'
import {
  Building2, Stethoscope, Activity, ExternalLink,
  ShieldAlert, Heart, ChevronRight, CheckCircle2,
} from 'lucide-react'

const NAV_LINKS = [
  { label: 'Patient Kiosk',    path: '/patient', icon: Building2,   color: 'emerald', desc: 'OPD registration and multimodal voice intake',   view: 'Tablet / Kiosk View' },
  { label: 'Doctor Console',   path: '/doctor',  icon: Stethoscope, color: 'blue',    desc: 'Triage queue and structured SOAP clinical workstation', view: 'Physician Workstation' },
  { label: 'Admin Dashboard',  path: '/admin',   icon: Activity,    color: 'purple',  desc: 'Central hospital operations and DPDP compliance audit',  view: 'Hospital Administration' },
]

const FEATURES = [
  { icon: Activity,    label: 'AI-Powered Triage',      desc: 'Gemini 1.5 Flash auto-analyzes symptoms and flags emergency cases in real time', color: 'amber' },
  { icon: Activity,    label: 'Multilingual Voice',      desc: 'Native Web Speech API supporting Hindi, Marathi, and Indian English with live transcript streaming', color: 'blue' },
  { icon: Stethoscope, label: 'Dual Clinical Mode',      desc: 'Allopathic SOCRATES pain framework alongside Ayurvedic Dashavidha Pariksha', color: 'emerald' },
  { icon: ShieldAlert, label: 'DPDP Act 2023 Compliant', desc: 'Explicit consent gate, session-scoped data, immutable audit log, and purge-on-completion', color: 'violet' },
  { icon: Heart,       label: 'ABDM / ABHA Linkage',     desc: 'ABHA identifier validation and structured FHIR-aligned health records', color: 'rose' },
  { icon: Activity,    label: 'Realtime Data Sync',      desc: 'Firebase Firestore with hybrid BroadcastChannel mesh sync for resilient local fallback', color: 'cyan' },
]

const DEMO_SETUP = [
  { screen: 'Screen 1 / Tablet',  route: '/patient', label: 'Patient Kiosk',      instruction: 'Mount on wall-facing kiosk or hand to patient. Touch-optimised with 60px+ targets.' },
  { screen: 'Screen 2 / Laptop',  route: '/doctor',  label: "Doctor Console",     instruction: 'Physician workstation with real-time patient queue and SOAP note editor.' },
  { screen: 'Screen 3 / Monitor', route: '/admin',   label: 'Operations Audit',   instruction: 'Executive monitor showing live OPD throughput, triage distribution, and compliance log.' },
]

const COLOR_MAP = {
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700' },
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'text-blue-700',    btn: 'bg-blue-600 hover:bg-blue-700' },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  icon: 'text-purple-700',  btn: 'bg-purple-600 hover:bg-purple-700' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'text-amber-700',   btn: '' },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-200',  icon: 'text-violet-700',  btn: '' },
  rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    icon: 'text-rose-700',    btn: '' },
  cyan:    { bg: 'bg-cyan-50',    border: 'border-cyan-200',    icon: 'text-cyan-700',    btn: '' },
}

function useClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return t
}

export default function LandingPage() {
  const time = useClock()
  const [launching, setLaunching] = useState(false)

  const openRoute = (path) => window.open(path, '_blank', 'noopener,noreferrer')

  const launchAll = () => {
    setLaunching(true)
    NAV_LINKS.forEach(({ path }, i) => setTimeout(() => openRoute(path), i * 350))
    setTimeout(() => setLaunching(false), 1500)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Top Government Hospital Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="bg-emerald-700 text-emerald-50 text-[10px] font-medium text-center py-0.5 tracking-wider uppercase hidden md:block">
          National Health Mission - Ministry of Ayush - Government of India
        </div>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight leading-tight">Central OPD Intake Portal</div>
              <div className="text-xs text-slate-400 leading-tight">Apex Civil Hospital - Clinical Operations Hub</div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Node: Active Clinical Mode</span>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-slate-300 tabular-nums">
                {time.toLocaleTimeString('en-IN', { hour12: false })}
              </div>
              <div className="text-[11px] text-slate-400">
                {time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section - Official Hospital Light Mode */}
      <section className="bg-white border-b border-slate-200 py-14 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5 text-xs text-emerald-800 mb-5 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            National Health Mission - Problem Statement SIH26047
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-3">
            MediKiosk Clinical Intake System
            <span className="block text-emerald-700 text-2xl md:text-3xl font-bold mt-1">
              AI-Powered Digital Clinical Intake & Triage Portal
            </span>
          </h1>

          <p className="text-slate-600 text-base md:text-lg max-w-3xl mx-auto mb-6 leading-relaxed">
            Enterprise clinical workstation for Indian public hospital OPDs. Features multimodal multilingual speech recognition,
            instant algorithmic emergency triage, and integrated Allopathic (SOCRATES) and Ayush (Dashavidha Pariksha) frameworks.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-5 text-xs md:text-sm text-slate-600 mb-8 font-medium">
            {['Ministry of Ayush Compliant', 'DPDP Act 2023 Compliant', 'ABDM / ABHA Standards', 'HL7 / FHIR Architecture'].map((badge) => (
              <span key={badge} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {badge}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={launchAll}
              disabled={launching}
              className="inline-flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-colors shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {launching ? 'Initialising all portals...' : 'Launch All 3 Clinical Portals'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2.5">
            Opens Patient Kiosk, Doctor Console, and Operations Audit in dedicated browser windows
          </p>
        </div>
      </section>

      {/* Main 3-Portal Workstation Cards */}
      <section className="max-w-6xl mx-auto px-6 py-10 w-full">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Clinical Workstation Nodes</h2>
          <p className="text-xs text-slate-500">Select a portal node below or launch across separate displays</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {NAV_LINKS.map(({ label, path, icon: Icon, color, desc, view }) => {
            const c = COLOR_MAP[color]
            return (
              <div
                key={path}
                onClick={() => openRoute(path)}
                className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:border-slate-300 hover:shadow-md transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 ${c.bg} border ${c.border} rounded-xl flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${c.icon}`} />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                      {view}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{label}</h3>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">{desc}</p>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); openRoute(path) }}
                  className={`flex items-center gap-2 ${c.btn} text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-colors w-full justify-center shadow-sm`}
                >
                  <span>Launch {label}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Deployment Configuration Section - Light Hospital Card */}
      <section className="max-w-6xl mx-auto px-6 pb-10 w-full">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">3-Screen Deployment Configuration</h2>
              <p className="text-xs text-slate-500">Recommended setup for outpatient hospital intake and physician examination rooms</p>
            </div>
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded font-semibold hidden sm:inline">
              HL7 / FHIR Synchronized
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {DEMO_SETUP.map((s) => (
              <div key={s.route} className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-semibold text-emerald-700">{s.screen}</span>
                    <span className="text-[11px] font-mono text-slate-500">{s.route}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 mb-1">{s.label}</div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-4">{s.instruction}</p>
                </div>
                <button
                  onClick={() => openRoute(s.route)}
                  className="w-full text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>Open in new window</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section className="max-w-6xl mx-auto px-6 pb-10 w-full">
        <div className="mb-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Clinical Architecture & Standards</h2>
          <p className="text-xs text-slate-500">Engineered specifically for public healthcare infrastructure</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, label, desc, color }) => {
            const c = COLOR_MAP[color]
            return (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition-colors">
                <div className={`w-9 h-9 ${c.bg} border ${c.border} rounded-lg flex items-center justify-center mb-3`}>
                  <Icon className={`w-4 h-4 ${c.icon}`} />
                </div>
                <div className="text-sm font-bold text-slate-900 mb-1">{label}</div>
                <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Technology Stack Specifications */}
      <section className="max-w-6xl mx-auto px-6 pb-12 w-full">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">
            Technology Specifications & Compliance Stack
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'React 18 SPA', 'Vite 5', 'Tailwind CSS', 'Firebase Firestore',
              'Google AI Studio (Gemini 1.5 Flash)', 'Browser Web Speech API',
              'ABDM / ABHA Architecture', 'DPDP Act 2023 Rules', 'Lucide React Icons'
            ].map((tech) => (
              <span key={tech} className="px-2.5 py-1 bg-slate-50 text-slate-700 rounded-md text-xs font-medium border border-slate-200">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Official Hospital Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-5 px-6 text-center border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-left">
            <span className="font-semibold text-slate-200">Apex Civil Hospital - Central OPD Intake Portal</span>
            <span className="block text-[11px] text-slate-500">National Health Mission - Ministry of Ayush - Government of India</span>
          </div>
          <div className="text-xs text-slate-400">
            System Node: Active Clinical Station (HL7/FHIR Compliant) - Offline Local Bus Supported
          </div>
        </div>
      </footer>
    </div>
  )
}

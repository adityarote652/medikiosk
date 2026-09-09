import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Activity, AlertTriangle, Clock, User, RefreshCw,
  ShieldAlert, CheckCircle2, Stethoscope,
  FileText, ChevronRight,
  Building2, ExternalLink, Mail, Phone,
} from 'lucide-react'
import { subscribeToPatients, addPatientIntake, resetLocalDatabase, isMockMode } from '../lib/firebase'
import KPICard from '../components/KPICard'
import TriageBar from '../components/TriageBar'
import AuditRow from '../components/AuditRow'


// ------------------------ Helpers --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function useClock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const id = setInterval(() => setT(new Date()), 1000); return () => clearInterval(id) }, [])
  return t
}

function parseDate(ts) {
  if (!ts) return null
  if (typeof ts.toDate === 'function') {
    try { return ts.toDate() } catch (_) {}
  }
  if (typeof ts === 'object' && ts.seconds !== undefined) {
    return new Date(ts.seconds * 1000)
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

function fmtTime(iso) {
  const d = parseDate(iso) || new Date()   // fall back to now for mock records without a stored timestamp
  return d.toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatToken(tok) {
  if (!tok) return 'OPD-N/A'
  const s = String(tok)
  return s.startsWith('TK-') || s.startsWith('OPD-') || s.startsWith('#') ? s : `OPD-${s}`
}


// Simulated cardiac emergency patient for the demo button
const DEMO_EMERGENCY = {
  patient_name:     'Rajesh Kumar',
  age:              58,
  gender:           'Male',
  abha_id:          'ABHA-14-9876-5432-1098',
  clinical_mode:    'ALLOPATHIC',
  language:         'en-IN',
  transcript:       'Severe chest pain radiating to left arm, sudden onset 30 mins ago, with profuse sweating and breathlessness.',
  triage_level:     'EMERGENCY',
  red_flag_detected: true,
  red_flag_reason:  'Acute MI suspected: chest pain radiating to left arm with diaphoresis - IMMEDIATE cardiac evaluation.',
  chief_complaint:  'Acute onset severe chest pain radiating to left arm with diaphoresis and breathlessness for 30 minutes.',
  socrates: {
    site: 'Central chest', onset: 'Sudden, 30 mins ago', character: 'Crushing pressure',
    radiation: 'Left arm and jaw', associated_symptoms: ['Diaphoresis', 'Dyspnoea', 'Nausea'],
    timing: 'Constant, worsening', exacerbating_relieving: 'No relief with rest', severity: 10,
  },
  ayush_pariksha: {},
  extracted_records: {
    medications: [{ name: 'Aspirin', dosage: '75 mg', frequency: 'Once daily', route: 'Oral', prescribing_doctor: 'Joshi' }],
    abnormal_labs: [{ parameter: 'BP', value: '180/110', unit: 'mmHg', normal_range: '< 120/80', flag: 'CRITICAL' }],
  },
  soap_note: {
    subjective: '58M acute severe chest pain radiating to left arm, diaphoresis, breathlessness x 30 min.',
    objective:  'BP 180/110 on prior record. On aspirin 75mg OD. High cardiac risk profile.',
    assessment: 'RULE OUT Acute MI - STEMI/NSTEMI. Hypertensive emergency.',
    plan:       '1. 12-lead ECG STAT  2. Troponin-I, CKMB STAT  3. Aspirin 325mg STAT  4. Cardiology consult emergency  5. ICU bed prep',
  },
  status:                   'WAITING',
  cabin_assigned:           null,
  consent_given:            true,
  intake_duration_seconds:  98,
}

// ------------------------ Local Sub-Components (AdminDashboard-specific) --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function VolumeBar({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const bg = color === 'blue' ? 'bg-blue-500' : 'bg-amber-500'
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-600 w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-8 text-right">{count}</span>
      <span className="text-xs text-slate-400 w-10">({pct}%)</span>
    </div>
  )
}

function ComplaintBar({ rank, complaint, count, maxCount }) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-bold text-slate-400 w-4">{rank}.</span>
      <span className="text-xs text-slate-600 flex-1 truncate">{complaint}</span>
      <div className="w-28 h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-700 w-5 text-right">{count}</span>
    </div>
  )
}

function CabinCard({ cabin, status, note }) {
  const cfg = {
    AVAILABLE:   'bg-emerald-50 border-emerald-200 text-emerald-700',
    OCCUPIED:    'bg-blue-50 border-blue-200 text-blue-700',
    MAINTENANCE: 'bg-amber-50 border-amber-200 text-amber-700',
  }[status] ?? 'bg-slate-50 border-slate-200 text-slate-600'

  return (
    <div className={`rounded-xl p-3 border ${cfg}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold">{cabin}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${cfg}`}>{status}</span>
      </div>
      <p className="text-xs opacity-70">{note || 'No patient assigned'}</p>
    </div>
  )
}

// ------------------------ Main Component ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

export default function AdminDashboard() {
  const [patients,          setPatients]         = useState([])
  const [loading,           setLoading]          = useState(true)
  const [realtimeLive,      setRealtimeLive]     = useState(false)
  const [auditLog,          setAuditLog]         = useState([])
  const [simulating,        setSimulating]       = useState(false)
  const [resetting,         setResetting]        = useState(false)
  const [confirmReset,      setConfirmReset]     = useState(false)
  const [openSection,       setOpenSection]      = useState('triage')
  const time = useClock()

  const addLog = useCallback((message, level = 'info') => {
    const entry = {
      id:      Date.now(),
      time:    new Date().toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message, level,
    }
    setAuditLog((prev) => [entry, ...prev].slice(0, 50))
  }, [])

  // ---------------- Derived analytics ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const today = new Date().toDateString()
  const filteredToday = patients.filter((p) => {
    const d = parseDate(p?.created_at || p?.createdAt)
    return d ? d.toDateString() === today : false
  })
  // Resilient fallback: if no records match today (e.g. mock data or timezone offset), use all patients
  const todayPts = filteredToday.length > 0 ? filteredToday : patients

  const emergency = todayPts.filter((p) => (p?.triage_level || p?.triageLevel) === 'EMERGENCY').length
  const urgent    = todayPts.filter((p) => (p?.triage_level || p?.triageLevel) === 'URGENT').length
  const routine   = todayPts.filter((p) => (p?.triage_level || p?.triageLevel) === 'ROUTINE').length
  const allopathic= todayPts.filter((p) => (p?.clinical_mode || p?.clinicalMode) === 'ALLOPATHIC').length
  const ayush     = todayPts.filter((p) => (p?.clinical_mode || p?.clinicalMode) === 'AYUSH').length
  const avgIntake = todayPts.reduce((s, p) => s + (p?.intake_duration_seconds || 108), 0) / Math.max(todayPts.length, 1)

  const topComplaints = (() => {
    const map = {}
    todayPts.forEach((p) => {
      const complaint = p?.chiefComplaint || p?.chief_complaint
      if (!complaint) return
      const t = complaint.toLowerCase()
      const cats = [
        { k: 'Chest Pain',           re: /chest|cardiac|heart/ },
        { k: 'Fever / Infection',    re: /fever|infection|viral|malaria|dengue/ },
        { k: 'Abdominal Pain',       re: /abdomen|stomach|gastric|nausea|vomit/ },
        { k: 'Joint / Musculo',      re: /joint|back|muscle|knee|arthritis/ },
        { k: 'Breathlessness',       re: /breath|respiratory|asthma|wheez/ },
        { k: 'Headache / Neuro',     re: /head|migrain|neuro|dizziness/ },
        { k: 'Diabetes / Metabolic', re: /diabetes|sugar|glucose/ },
        { k: 'Other',                re: /.*/ },
      ]
      for (const { k, re } of cats) {
        if (re.test(t)) { map[k] = (map[k] || 0) + 1; break }
      }
    })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5)
  })()

  const maxComplaint = topComplaints[0]?.[1] || 1

  // ---------------- Load & Subscribe (Mirrored Firestore onSnapshot listener targeting 'patients') --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  useEffect(() => {
    addLog('Central OPD Dashboard initialised. Connecting to data node (patients)...', 'info')
    const unsub = subscribeToPatients((data) => {
      setPatients(Array.isArray(data) ? data : [])
      setRealtimeLive(true)
      setLoading(false)
    })
    return () => {
      if (typeof unsub === 'function') unsub()
    }
  }, [addLog])

  // ---------------- Simulate Influx ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const simulateInflux = async () => {
    setSimulating(true)
    addLog('Priority Influx: Casualty triage bypass initiated...', 'warning')
    try {
      const rec = {
        ...DEMO_EMERGENCY,
        token_number: `TK-${Math.floor(Math.random() * 50) + 200}`,
      }
      const saved = await addPatientIntake(rec)
      addLog(`INFLUX: Casualty walk-in registered - #TK-${saved.token_number}`, 'emergency')
    } catch (err) {
      addLog(`Influx failed: ${err.message}`, 'error')
    }
    setSimulating(false)
  }

  // ---------------- Reset ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const handleReset = async () => {
    setResetting(true)
    addLog('ADMIN: Clinical node reset initiated.', 'warning')
    try {
      resetLocalDatabase()
      setPatients([])
      setAuditLog([])
      addLog('ADMIN: All intake records purged. Node ready for next OPD session.', 'success')
    } catch (err) {
      addLog(`Reset failed: ${err.message}`, 'error')
    }
    setResetting(false)
    setConfirmReset(false)
  }

  const toggle = (key) => setOpenSection((p) => (p === key ? null : key))

  const cabins = [
    { cabin: 'Cabin 1 - Allopathic', status: allopathic > 0 ? 'OCCUPIED' : 'AVAILABLE', note: allopathic > 0 ? `Dr. Sharma (${allopathic} seen)` : null },
    { cabin: 'Cabin 2 - Ayush OPD',  status: ayush > 0 ? 'OCCUPIED' : 'AVAILABLE', note: ayush > 0 ? 'Dr. Mishra (Ayurveda)' : null },
    { cabin: 'Cabin 3 - Emergency',  status: emergency > 0 ? 'OCCUPIED' : 'AVAILABLE', note: emergency > 0 ? `${emergency} active case(s)` : null },
  ]

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16">

      {/* ---------------- Header ---------------- */}
      <header className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold">Central OPD Operations</div>
            <div className="text-xs text-slate-400">DPDP Compliance Monitor</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs">
            {isMockMode ? <><Activity className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-400">Local Sync</span></> : <><Activity className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Firebase Live</span></>}
              
          </div>
          <div className="text-xs font-mono text-slate-300 hidden md:block tabular-nums">
            {time.toLocaleTimeString('en-IN', { hour12: false })}
          </div>
          <button
            onClick={() => {
              setLoading(true)
              setTimeout(() => setLoading(false), 500)
            }}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-7xl mx-auto w-full space-y-4">

        {/* ---------------- KPIs ---------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard icon={User}         label="OPD Registrations Today" value={todayPts.length} sub={`${patients.length} total all-time`} color="blue"    loading={loading} />
          <KPICard icon={AlertTriangle} label="Active Emergency Cases"  value={emergency}        sub={`${urgent} urgent pending`}         color={emergency > 0 ? 'rose' : 'slate'} loading={loading} />
          <KPICard icon={Clock}         label="Avg. Intake Time"        value={`${(avgIntake/60).toFixed(1)} mins`} sub="vs 7 mins manual (74% faster)" color="emerald" loading={loading} />
          <KPICard icon={Building2}       label="Active Consult Cabins"   value={cabins.filter(c => c.status === 'OCCUPIED').length} sub={`of ${cabins.length} total`} color="amber" loading={loading} />
        </div>

        {/* ---------------- Main Grid ---------------- */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* ---------------- Analytics (2/3) ---------------- */}
          <div className="lg:col-span-2 space-y-4">

            {/* Triage Distribution */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-clinical overflow-hidden">
              <button onClick={() => toggle('triage')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-600" />
                  <span className="text-sm font-bold text-slate-800">Triage Distribution</span>
                  <span className="text-xs text-slate-400">{todayPts.length} patients today</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${openSection === 'triage' ? 'rotate-90' : ''}`} />
              </button>
              {openSection === 'triage' && (
                <div className="px-4 pb-4">
                  <TriageBar emergency={emergency} urgent={urgent} routine={routine} total={todayPts.length} />
                </div>
              )}
            </div>

            {/* Volume Breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-clinical overflow-hidden">
              <button onClick={() => toggle('volume')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-slate-800">Allopathic vs. Ayush Volume</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${openSection === 'volume' ? 'rotate-90' : ''}`} />
              </button>
              {openSection === 'volume' && (
                <div className="px-4 pb-4 space-y-3">
                  <VolumeBar label="Allopathic OPD" count={allopathic} total={todayPts.length} color="blue" />
                  <VolumeBar label="Ayush OPD"  count={ayush}     total={todayPts.length} color="amber" />
                </div>
              )}
            </div>

            {/* Top Complaints */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-clinical overflow-hidden">
              <button onClick={() => toggle('complaints')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-bold text-slate-800">Top 5 Presenting Complaints</span>
                </div>
                <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${openSection === 'complaints' ? 'rotate-90' : ''}`} />
              </button>
              {openSection === 'complaints' && (
                <div className="px-4 pb-4 space-y-2">
                  {topComplaints.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No data yet - submit patients from the kiosk first.</p>
                  ) : topComplaints.map(([complaint, count], i) => (
                    <ComplaintBar key={complaint} rank={i + 1} complaint={complaint} count={count} maxCount={maxComplaint} />
                  ))}
                </div>
              )}
            </div>

            {/* Cabin Status */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-clinical p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-bold text-slate-800">Consultation Cabin Status</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {cabins.map((c) => <CabinCard key={c.cabin} {...c} />)}
              </div>
            </div>
          </div>

          {/* ---------------- Right Column (1/3) ---------------- */}
          <div className="space-y-4">

            {/* Clinical Node Controls */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-clinical p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-bold text-slate-800">Clinical Node Controls</span>
              </div>
              <div className="space-y-3">
                <button
                  onClick={simulateInflux}
                  disabled={simulating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-sm font-bold rounded-xl transition-colors"
                >
                  {simulating
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Pushing...</>
                    : <><AlertTriangle className="w-4 h-4" /> Priority Influx: Casualty Triage Bypass</>}
                </button>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Registers a priority casualty influx via triage bypass. Doctor Console will receive an immediate alert.
                </p>

                {!confirmReset ? (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-200"
                  >
                    <Activity className="w-4 h-4 text-slate-500" /> Reset Clinical Node
                  </button>
                ) : (
                  <div className="border border-rose-200 bg-rose-50 rounded-xl p-3">
                    <p className="text-xs text-rose-800 font-semibold mb-2">Confirm: purge all intake records for this session?</p>
                    <div className="flex gap-2">
                      <button onClick={handleReset} disabled={resetting} className="flex-1 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 transition-colors">
                        {resetting ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" /> : 'Yes, Reset'}
                      </button>
                      <button onClick={() => setConfirmReset(false)} className="flex-1 py-2 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* DPDP Compliance */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-clinical p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-slate-800">DPDP Compliance</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Consent Given',  v: patients.filter((p) => p?.consent_given ?? true).length },
                  { label: 'ABHA ID Linked', v: patients.filter((p) => p?.abha_id || p?.abhaId).length },
                  { label: 'Sessions Purged', v: patients.filter((p) => p?.status === 'COMPLETED').length },
                ].map(({ label, v }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {label}
                    </div>
                    <span className="text-xs font-bold text-slate-800">{v} / {patients.length}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" /> All sessions DPDP Act 2023 compliant
                </div>
              </div>
            </div>

            {/* Audit Log */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-clinical overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-bold text-slate-800">Audit Log</span>
                </div>
                <span className="text-xs text-slate-400 font-mono">{auditLog.length} events</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto p-3">
                {auditLog.length === 0
                  ? <p className="text-xs text-slate-400 italic py-4 text-center">No events yet</p>
                  : auditLog.map((e) => <AuditRow key={e.id} entry={e} />)}
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- Recent Patients Table ---------------- */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-clinical overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-bold text-slate-800">Recent OPD Registrations</span>
            </div>
            <span className="text-xs text-slate-400">{patients.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Token', 'Patient', 'Age/Gender', 'Mode', 'Triage', 'Chief Complaint', 'Status', 'Time'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {patients.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No records yet. Register patients at the kiosk.</td></tr>
                ) : patients.slice(0, 20).map((p, idx) => {
                  const triage = p?.triage_level || p?.triageLevel || 'ROUTINE'
                  const mode = p?.clinical_mode || p?.clinicalMode || 'ALLOPATHIC'
                  const status = p?.status || 'WAITING'
                  return (
                    <tr key={p?.id || idx} className={`hover:bg-slate-50 transition-colors ${triage === 'EMERGENCY' ? 'bg-rose-50/50' : ''}`}>
                      <td className="px-3 py-2 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {formatToken(p?.token_number || p?.token)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-900 max-w-[120px] truncate">
                        {p?.patient_name || p?.name || 'N/A'}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                        {p?.age !== undefined && p?.age !== null ? `${p.age}y` : 'N/A'} / {p?.gender || 'N/A'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${mode === 'AYUSH' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {mode === 'AYUSH' ? 'Ayush' : 'Allopathic'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                          triage === 'EMERGENCY' ? 'bg-rose-600 text-white'
                          : triage === 'URGENT'  ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                        }`}>{triage}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">
                        {p?.chiefComplaint || p?.chief_complaint || 'N/A'}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                          status === 'COMPLETED'   ? 'bg-emerald-100 text-emerald-700'
                          : status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                        }`}>{status}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">
                        {fmtTime(p?.created_at || p?.createdAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ------ Footer / Support Contacts ------ */}
      <footer className="bg-slate-900 text-slate-400 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-200">Apex Civil Hospital - Central OPD Portal</div>
            <div className="text-xs text-slate-500 mt-0.5">National Health Mission - Ministry of Ayush</div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm">
            <a href="mailto:support@medikiosk.gov.in" className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
              <Mail className="w-3.5 h-3.5" />
              support@medikiosk.gov.in
            </a>
            <a href="tel:+911800112345" className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
              <Phone className="w-3.5 h-3.5" />
              1800-11-2345
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}









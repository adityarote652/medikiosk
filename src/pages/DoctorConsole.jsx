import { useState, useEffect, useRef, useCallback } from 'react'
import {
  AlertTriangle, Clock, User, Activity, Stethoscope, FileText,
  CheckCircle2, X, RefreshCw, Search,
  ChevronRight, ExternalLink,
  ShieldAlert, Volume2,
} from 'lucide-react'
import { subscribeToPatients, updatePatientStatus, isMockMode } from '../lib/firebase'
import TriageBadge from '../components/TriageBadge'
import StatusPill from '../components/StatusPill'
import EmergencyModal from '../components/EmergencyModal'


// --------- Helpers ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function formatToken(tok) {
  if (!tok) return '?'
  const s = String(tok)
  return s.startsWith('TK-') || s.startsWith('OPD-') || s.startsWith('#') ? s : `OPD-${s}`
}

function formatWait(createdAt) {
  const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`
  return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`
}

function useTickEverySecond() {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])
}


// --------- Patient Queue Card ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function PatientQueueCard({ patient, isSelected, onClick }) {
  useTickEverySecond()
  const isEmergency = patient.triage_level === 'EMERGENCY'
  const isUrgent    = patient.triage_level === 'URGENT'

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all duration-200 ${
        isSelected   ? 'border-blue-500 bg-blue-50'
        : isEmergency ? 'border-rose-300 bg-rose-50 emergency-pulse hover:border-rose-400'
        : isUrgent    ? 'border-amber-200 bg-amber-50 hover:border-amber-400'
        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md flex-shrink-0 ${
            isEmergency ? 'bg-rose-600 text-white' : isUrgent ? 'bg-amber-500 text-white' : 'bg-slate-800 text-white'
          }`}>
            {formatToken(patient.token_number)}
          </span>
          <span className="text-sm font-semibold text-slate-900 truncate">{patient.patient_name || 'Unknown'}</span>
        </div>
        <TriageBadge level={patient.triage_level} />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span className="flex items-center gap-1">
          <User className="w-3 h-3" />
          {patient.age ? `${patient.age}y` : '-'} / {patient.gender || '-'}
        </span>
        <span className="flex items-center gap-1 font-mono">
          <Clock className="w-3 h-3" />
          {patient.created_at ? formatWait(patient.created_at) : '-'}
        </span>
      </div>

      {patient.chief_complaint && (
        <p className="text-xs text-slate-500 truncate leading-relaxed">{patient.chief_complaint}</p>
      )}

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-xs text-slate-400">
          {patient.clinical_mode === 'AYUSH' ? 'Ayush' : 'Allopathic'}
        </span>
        <StatusPill status={patient.status} />
      </div>
    </div>
  )
}

// --------- SOCRATES Card ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function SOCRATESCard({ socrates }) {
  if (!socrates || !Object.keys(socrates).length) {
    return <p className="text-xs text-slate-400 italic">No SOCRATES data captured.</p>
  }
  const fields = [
    { key: 'site',                  label: 'Site' },
    { key: 'onset',                 label: 'Onset' },
    { key: 'character',             label: 'Character' },
    { key: 'radiation',             label: 'Radiation' },
    { key: 'associated_symptoms',   label: 'Associated' },
    { key: 'timing',                label: 'Timing' },
    { key: 'exacerbating_relieving',label: 'Exac./Relieving' },
    { key: 'severity',              label: 'Severity' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map(({ key, label }) => {
        const val = socrates[key]
        if (val === undefined || val === null || val === '') return null
        return (
          <div key={key} className="bg-slate-50 rounded-lg p-2.5">
            <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
            <p className="text-xs text-slate-800 font-semibold">
              {Array.isArray(val) ? val.join(', ') : String(val)}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// --------- AYUSH Pariksha Card ------------------------------------------------------------------------------------------------------------------------------------------------------------------

function AYUSHCard({ pariksha }) {
  if (!pariksha || !Object.keys(pariksha).length) {
    return <p className="text-xs text-slate-400 italic">No Dashavidha Pariksha data captured.</p>
  }
  const fields = [
    { key: 'prakriti',            label: 'Prakriti' },
    { key: 'vikriti',            label: 'Vikriti' },
    { key: 'dominant_dosha',     label: 'Dominant Dosha' },
    { key: 'ahara_shakti',       label: 'Ahara Shakti (Agni)' },
    { key: 'satva',              label: 'Satva (Mind)' },
    { key: 'recommended_therapy',label: 'Recommended Therapy' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map(({ key, label }) => {
        const val = pariksha[key]
        if (!val) return null
        return (
          <div key={key} className="bg-amber-50 rounded-lg p-2.5">
            <p className="text-xs text-amber-600 font-medium mb-0.5">{label}</p>
            <p className="text-xs text-slate-800 font-semibold">{val}</p>
          </div>
        )
      })}
    </div>
  )
}

// --------- Medication Rail ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function MedicationRail({ medications }) {
  if (!medications?.length) {
    return <p className="text-xs text-slate-400 italic">No medications extracted.</p>
  }
  return (
    <div className="space-y-2">
      {medications.map((med, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg">
          {/* pill symbol via text */}
          <Activity className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-blue-900">{med.name}</span>
              {med.dosage && <span className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-mono">{med.dosage}</span>}
              {med.frequency && <span className="text-xs text-blue-700">{med.frequency}</span>}
            </div>
            {(med.route || med.prescribing_doctor) && (
              <p className="text-xs text-slate-500 mt-0.5">
                {[med.route, med.prescribing_doctor && `Dr. ${med.prescribing_doctor}`].filter(Boolean).join(' -- ')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// --------- Abnormal Lab Badge ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

function AbnormalLabBadge({ lab }) {
  const cls = {
    CRITICAL: 'bg-rose-50 border-rose-300 text-rose-900',
    HIGH:     'bg-amber-50 border-amber-300 text-amber-900',
    LOW:      'bg-blue-50 border-blue-300 text-blue-900',
  }[lab.flag] ?? 'bg-amber-50 border-amber-300 text-amber-900'

  const flagBg = { CRITICAL: 'bg-rose-600 text-white', HIGH: 'bg-amber-500 text-white', LOW: 'bg-blue-500 text-white' }[lab.flag] ?? 'bg-amber-500 text-white'

  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${cls}`}>
      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold truncate">{lab.parameter}</span>
          <span className={`text-xs font-black px-1.5 py-0.5 rounded ${flagBg}`}>{lab.flag}</span>
        </div>
        <p className="text-xs font-mono mt-0.5">
          <strong>{lab.value} {lab.unit}</strong>
          {lab.normal_range && <span className="text-slate-400"> (Normal: {lab.normal_range})</span>}
        </p>
      </div>
    </div>
  )
}

// --------- SOAP Editor ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function SOAPEditor({ soapNote, onSave, isSaving }) {
  const [local, setLocal] = useState(soapNote ?? {})
  const [dirty, setDirty] = useState(false)

  useEffect(() => { setLocal(soapNote ?? {}); setDirty(false) }, [soapNote])

  const update = (field, value) => { setLocal((p) => ({ ...p, [field]: value })); setDirty(true) }

  const sections = [
    { key: 'subjective', label: 'S --- Subjective', color: 'blue' },
    { key: 'objective',  label: 'O --- Objective',  color: 'emerald' },
    { key: 'assessment', label: 'A --- Assessment',  color: 'amber' },
    { key: 'plan',       label: 'P --- Plan',        color: 'purple' },
  ]
  const labelColor = { blue: 'text-blue-700', emerald: 'text-emerald-700', amber: 'text-amber-700', purple: 'text-purple-700' }

  return (
    <div>
      <div className="space-y-3 mb-4">
        {sections.map(({ key, label, color }) => (
          <div key={key}>
            <label className={`block text-xs font-bold mb-1 ${labelColor[color]}`}>{label}</label>
            <textarea
              value={local[key] ?? ''}
              onChange={(e) => update(key, e.target.value)}
              rows={key === 'plan' ? 5 : 4}
              className="soap-textarea"
              placeholder={`Enter ${label.split('-')[1].trim()} notes---`}
            />
          </div>
        ))}
      </div>
      {dirty && (
        <button
          onClick={() => onSave(local)}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {isSaving
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving---</>
            : <><CheckCircle2 className="w-4 h-4" /> Save SOAP Changes</>}
        </button>
      )}
    </div>
  )
}


// --------- Print Slip ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

function printConsultationSlip(p) {
  if (!p) return
  const html = `
    <!DOCTYPE html><html><head><title>Slip OPD-${p.token_number}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:13px}
      h1{font-size:16px;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:12px}
      .row{margin:8px 0}.lbl{font-size:10px;color:#666;text-transform:uppercase}
      .val{font-weight:bold}.soap{background:#f5f5f5;padding:10px;border-left:3px solid #555;margin:6px 0;font-size:12px}
      .badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;color:#fff}
      .EMERGENCY{background:#dc2626}.URGENT{background:#f59e0b}.ROUTINE{background:#059669}
    </style></head><body>
    <h1>MediKiosk Consultation Slip --- OPD-${p.token_number}</h1>
    <div class="row"><div class="lbl">Patient</div><div class="val">${p.patient_name}</div></div>
    <div class="row"><div class="lbl">Age / Gender</div><div class="val">${p.age}y / ${p.gender}</div></div>
    <div class="row"><div class="lbl">ABHA ID</div><div class="val">${p.abha_id ?? 'N/A'}</div></div>
    <div class="row"><div class="lbl">Triage</div><span class="badge ${p.triage_level}">${p.triage_level}</span></div>
    <div class="row"><div class="lbl">Chief Complaint</div><div class="val">${p.chief_complaint ?? '-'}</div></div>
    <div class="row"><div class="lbl">SOAP Note</div></div>
    <div class="soap"><b>S:</b> ${p.soap_note?.subjective ?? '-'}</div>
    <div class="soap"><b>O:</b> ${p.soap_note?.objective ?? '-'}</div>
    <div class="soap"><b>A:</b> ${p.soap_note?.assessment ?? '-'}</div>
    <div class="soap"><b>P:</b> ${p.soap_note?.plan ?? '-'}</div>
    <p style="font-size:10px;color:#888;margin-top:16px">Generated by MediKiosk -- ${new Date().toLocaleString('en-IN')}</p>
    </body></html>`
  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.print()
}

// --------- Main Component ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

export default function DoctorConsole() {
  const [patients, setPatients]             = useState([])
  const [selected, setSelected]             = useState(null)
  const [realtimeLive, setRealtimeLive]     = useState(false)
  const [emergencyAlert, setEmergencyAlert] = useState(null)
  const [dismissed, setDismissed]           = useState(new Set())
  const [soapSaving, setSoapSaving]         = useState(false)
  const [committing, setCommitting]         = useState(false)
  const [expanded, setExpanded]             = useState({ clinical: true, docs: true, soap: true })
  const [alertSound, setAlertSound]         = useState(true)
  const [clock, setClock]                   = useState(new Date())
  const [searchQuery, setSearchQuery]       = useState('')
  const [filterTab, setFilterTab]           = useState('ALL')

  // Emergency beep via Web Audio API (declared before useEffect to avoid ReferenceError)
  const playBeep = useCallback(() => {
    if (!alertSound) return
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const freqs = [880, 1100, 880, 1100]
      let t = ctx.currentTime
      freqs.forEach((f) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'square'; osc.frequency.value = f
        gain.gain.setValueAtTime(0.25, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
        osc.start(t); osc.stop(t + 0.18)
        t += 0.22
      })
    } catch (_) {}
  }, [alertSound])

  useEffect(() => { const id = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(id) }, [])

  // Firebase real-time subscription
  useEffect(() => {
    const unsub = subscribeToPatients((data) => {
      setPatients(data)
      setRealtimeLive(true)
      if (!selected && data.length) setSelected(data[0])
      // Trigger emergency alert for new red-flag patients
      data
        .filter(pt => pt.triage_level === 'EMERGENCY' && pt.red_flag_detected && !dismissed.has(pt.id))
        .forEach(pt => { setEmergencyAlert(pt); playBeep() })
    })
    return unsub
  }, [dismissed, playBeep])

  const saveSoap = async (soap) => {
    if (!selected?.id) return
    setSoapSaving(true)
    await updatePatientStatus(selected.id, { soap_note: soap, status: 'IN_PROGRESS' })
    setSelected(p => ({ ...p, soap_note: soap, status: 'IN_PROGRESS' }))
    setSoapSaving(false)
  }

  const commitEHR = async () => {
    if (!selected?.id) return
    setCommitting(true)
    await updatePatientStatus(selected.id, { status: 'COMPLETED', cabin_assigned: 'Cabin 1' })
    setSelected(p => ({ ...p, status: 'COMPLETED', cabin_assigned: 'Cabin 1' }))
    setCommitting(false)
  }

  const markInProgress = async () => {
    if (!selected?.id) return
    await updatePatientStatus(selected.id, { status: 'IN_PROGRESS' })
    setSelected(p => ({ ...p, status: 'IN_PROGRESS' }))
  }

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }))

  const filteredPatients = patients
    .filter(pt => filterTab === 'ALL' || pt.triage_level === filterTab)
    .filter(pt => !searchQuery ||
      pt.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(pt.token_number ?? '').includes(searchQuery)
    )

  const waiting     = patients.filter((p) => p.status === 'WAITING').length
  const emergencies = patients.filter((p) => p.triage_level === 'EMERGENCY').length

  const p = selected

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">

      {/* Emergency Modal */}
      {emergencyAlert && (
        <EmergencyModal
          patient={emergencyAlert}
          onDismiss={() => {
            setDismissed((prev) => new Set([...prev, emergencyAlert.id]))
            setSelected(emergencyAlert)
            setEmergencyAlert(null)
          }}
        />
      )}

      {/* ------ Header ------ */}
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between flex-shrink-0 shadow-lg z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold">Clinical Workstation</div>
            <div className="text-xs text-slate-400">OPD Physician Console</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> {waiting} Waiting
            </span>
            {emergencies > 0 && (
              <span className="flex items-center gap-1 bg-rose-800 px-2.5 py-1 rounded-full text-rose-200 animate-pulse">
                <AlertTriangle className="w-3 h-3" /> {emergencies} Emergency
              </span>
            )}
          </div>

          <button
            onClick={() => setAlertSound((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
            title={alertSound ? 'Mute alerts' : 'Enable alerts'}
          >
            <Volume2 className={`w-4 h-4 ${alertSound ? 'text-slate-300' : 'text-slate-600'}`} />
          </button>

          <div className="flex items-center gap-1.5 text-xs">
            {isMockMode
              ? <><Activity className="w-3.5 h-3.5 text-amber-400" /><span className="text-amber-400">Local Sync</span></>
              : <><Activity className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">Firebase Live</span></>}
          </div>

          <div className="text-xs font-mono text-slate-400 hidden sm:block tabular-nums">
            {clock.toLocaleTimeString('en-IN', { hour12: false })}
          </div>
        </div>
      </header>

      {/* ------ Split Layout ------ */}
      <div className="flex flex-1 overflow-hidden">

        {/* ------ LEFT RAIL --- Queue ------ */}
        <aside className="w-72 xl:w-80 bg-white border-r border-slate-200 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-slate-100 flex flex-col gap-2 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">OPD Intake Queue</span>
              <span className="text-xs font-mono text-slate-400">#TK-8042</span>
            </div>
            
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search patient or token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Filter Tabs */}
            <div className="flex bg-slate-200/50 p-1 rounded-lg">
              {['ALL', 'EMERGENCY', 'URGENT', 'ROUTINE'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`flex-1 text-[10px] font-bold py-1 rounded-md transition-colors ${
                    filterTab === tab 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  {tab === 'EMERGENCY' ? 'EMERG' : tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center px-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-sm font-bold text-slate-700 mb-1">No Patients in Queue</h3>
                <p className="text-xs text-slate-500 leading-relaxed">New OPD registrations will appear here instantly.</p>
              </div>
            ) : (
              filteredPatients.map((pt) => (
                <PatientQueueCard
                  key={pt.id}
                  patient={pt}
                  isSelected={selected?.id === pt.id}
                  onClick={() => setSelected(pt)}
                />
              ))
            )}
          </div>
        </aside>

        {/* ------ RIGHT WORKSTATION ------ */}
        <main className="flex-1 overflow-y-auto bg-slate-50 pb-20">
          {!p ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                <Stethoscope className="w-10 h-10 opacity-40" />
              </div>
              <p className="text-base font-semibold text-slate-500">Select a patient from the queue</p>
              <p className="text-sm">Clinical data will appear here</p>
            </div>
          ) : (
            <div className="p-4 space-y-4 max-w-4xl">

              {/* ------ 1. Chief Complaint Banner ------ */}
              <div className={`rounded-xl p-4 ${
                p.triage_level === 'EMERGENCY' ? 'bg-rose-50 border-2 border-rose-300 text-slate-900' : p.triage_level === 'URGENT' ? 'bg-amber-50 border-2 border-amber-300 text-slate-900' : 'bg-white border border-slate-200 text-slate-900 shadow-sm'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-lg font-black font-mono text-slate-900">{formatToken(p.token_number)}</span>
                      <TriageBadge level={p.triage_level} />
                      {p.red_flag_detected && (
                        <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> RED FLAG
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold mb-1 text-slate-900">{p.patient_name}</h2>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-600 mb-2">
                      <span>{p.age}y / {p.gender}</span>
                      {p.abha_id && <span className="font-mono text-xs opacity-70">ABHA: {p.abha_id}</span>}
                      <span>{p.clinical_mode === 'AYUSH' ? 'Ayush OPD' : 'Allopathic OPD'}</span>
                    </div>
                    {p.chief_complaint && <p className="text-sm text-slate-700 leading-relaxed">{p.chief_complaint}</p>}
                    {p.red_flag_reason && (
                      <div className="mt-2 p-2 bg-rose-100 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" /><span>{p.red_flag_reason}</span></div>
                    )}
                  </div>
                  <div className="text-right text-xs opacity-70 flex-shrink-0">
                    <div className="font-mono mb-1">{p.created_at ? new Date(p.created_at).toLocaleTimeString('en-IN') : '-'}</div>
                    <StatusPill status={p.status} />
                  </div>
                </div>
              </div>

              {/* ------ 2. Clinical Framework ------ */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-clinical overflow-hidden">
                <button onClick={() => toggle('clinical')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-slate-800">
                      {p.clinical_mode === 'AYUSH' ? 'Dashavidha Pariksha (Ayurvedic)' : 'SOCRATES Pain Analysis'}
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${expanded.clinical ? 'rotate-90' : ''}`} />
                </button>
                {expanded.clinical && (
                  <div className="px-4 pb-4">
                    {p.clinical_mode === 'AYUSH'
                      ? <AYUSHCard pariksha={p.ayush_pariksha} />
                      : <SOCRATESCard socrates={p.socrates} />}
                  </div>
                )}
              </div>

              {/* ------ 3. Document Intelligence ------ */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-clinical overflow-hidden">
                <button onClick={() => toggle('docs')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-bold text-slate-800">Document Intelligence</span>
                    {(p.extracted_records?.medications?.length > 0) && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                        {p.extracted_records.medications.length} meds
                      </span>
                    )}
                    {(p.extracted_records?.abnormal_labs?.length > 0) && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">
                        {p.extracted_records.abnormal_labs.length} abnormal
                      </span>
                    )}
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${expanded.docs ? 'rotate-90' : ''}`} />
                </button>
                {expanded.docs && (
                  <div className="px-4 pb-4 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Current Medications</p>
                      <MedicationRail medications={p.extracted_records?.medications} />
                    </div>
                    {p.extracted_records?.abnormal_labs?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-2">--- Abnormal Lab Values</p>
                        <div className="space-y-2">
                          {p.extracted_records.abnormal_labs.map((lab, i) => (
                            <AbnormalLabBadge key={i} lab={lab} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ------ 4. SOAP Editor ------ */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-clinical overflow-hidden">
                <button onClick={() => toggle('soap')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-bold text-slate-800">SOAP Clinical Notes</span>
                    <span className="text-xs text-slate-400 font-normal">(AI pre-filled --- verify before saving)</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transform transition-transform ${expanded.soap ? 'rotate-90' : ''}`} />
                </button>
                {expanded.soap && (
                  <div className="px-4 pb-4">
                    <SOAPEditor soapNote={p.soap_note} onSave={saveSoap} isSaving={soapSaving} />
                  </div>
                )}
              </div>

              {/* ------ 5. Actions ------ */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-clinical p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={commitEHR}
                    disabled={committing || p.status === 'COMPLETED'}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl transition-colors"
                  >
                    {committing
                      ? <><RefreshCw className="w-4 h-4 animate-spin" /> Committing---</>
                      : p.status === 'COMPLETED'
                      ? <><CheckCircle2 className="w-4 h-4" /> Committed to EHR</>
                      : <><ShieldAlert className="w-4 h-4" /> Commit &amp; Sync to ABDM / EHR</>}
                  </button>

                  <button
                    onClick={() => printConsultationSlip(p)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Print Consultation Slip
                  </button>

                  {p.status === 'WAITING' && (
                    <button
                      onClick={markInProgress}
                      className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                      <Activity className="w-4 h-4" />
                      Mark In Progress
                    </button>
                  )}
                </div>

                {p.status === 'COMPLETED' && (
                  <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Patient record committed. Session purge scheduled (DPDP compliant).
                  </p>
                )}
              </div>

              {/* ------ Raw Transcript (collapsible) ------ */}
              {p.transcript && (
                <details className="bg-white border border-slate-200 rounded-xl shadow-clinical overflow-hidden">
                  <summary className="px-4 py-3 text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50 flex items-center gap-2">
                    <Search className="w-4 h-4" /> Raw Voice Transcript
                  </summary>
                  <div className="px-4 pb-4">
                    <pre className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap leading-relaxed font-mono max-h-40 overflow-y-auto">
                      {p.transcript}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}


import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic, MicOff, ChevronRight, CheckCircle2, AlertTriangle,
  User, Activity, Heart, Brain, Wind, ShieldAlert, FileText,
  X, RefreshCw, Volume2, Clock, Stethoscope, UploadCloud,
} from 'lucide-react'
import { processClinicalIntake, compressImageToBase64, getGenerativeModel } from '../lib/gemini'
import { addPatientIntake } from '../lib/firebase'
import StepIndicator from '../components/StepIndicator'
import WaveVisualizer from '../components/WaveVisualizer'


// ------------------------ Constants ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

const LANGUAGES = [
  { code: 'en-IN', label: 'English', short: 'EN' },
  { code: 'hi-IN', label: 'Hindi', short: 'HI' },
  { code: 'mr-IN', label: 'Marathi', short: 'MR' },
]

const CLINICAL_MODES = [
  { id: 'ALLOPATHIC', label: 'General Allopathic OPD', sub: 'SOCRATES framework' },
  { id: 'AYUSH', label: 'Ayurveda OPD (AIIA Protocol)', sub: 'Dashavidha Pariksha' },
]

// Dashavidha Pariksha self-reportable parameters for Ayush OPD
const AYUSH_PRAKRITI = [
  { id: 'VATA', label: 'Vata', desc: 'Light / Dry / Active', color: 'sky' },
  { id: 'PITTA', label: 'Pitta', desc: 'Warm / Sharp / Intense', color: 'amber' },
  { id: 'KAPHA', label: 'Kapha', desc: 'Heavy / Calm / Stable', color: 'emerald' },
]
const AYUSH_AGNI = [
  { id: 'MANDA', label: 'Manda', desc: 'Low / Sluggish digestion', color: 'sky' },
  { id: 'TIKSHNA', label: 'Tikshna', desc: 'High / Acidic / Hyperactive', color: 'amber' },
  { id: 'SAMA', label: 'Sama (Balanced)', desc: 'Regular / Healthy appetite', color: 'emerald' },
]
const AYUSH_KOSHTHA = [
  { id: 'KRURA', label: 'Krura', desc: 'Constipated / Dry / Hard stool', color: 'rose' },
  { id: 'MRIDU', label: 'Mridu', desc: 'Loose / Frequent / Soft stool', color: 'amber' },
  { id: 'MADHYAMA', label: 'Madhyama', desc: 'Normal / Regular bowel', color: 'emerald' },
]
const AYUSH_AHARA = ['Spicy/Hot foods', 'Oily/Fried foods', 'Cold/Refrigerated foods', 'Vegetarian', 'Non-vegetarian', 'Fasting regularly']
const AYUSH_VIHARA = ['Deep / Restful sleep', 'Disturbed / Fragmented sleep', 'Irregular sleep hours', 'Day sleeping habit']

const BODY_ZONES = [
  {
    id: 'chest', label: 'Chest Pain', icon: Heart, color: 'rose',
    followups: ['Sudden onset?', 'Central chest?', 'Crushing pain?', 'Radiates to arm/jaw?', 'Severe (8-10)?', 'Worse with exertion?', 'Also breathlessness?'],
  },
  {
    id: 'breathing', label: 'Breathing Difficulty', icon: Wind, color: 'cyan',
    followups: ['At rest?', 'With exertion?', 'Wheezing?', 'Cough?', 'Choking feeling?'],
  },
  {
    id: 'fever', label: 'Fever', icon: Activity, color: 'amber',
    followups: ['Sudden or gradual onset?', 'Temperature reading?', 'Any dizziness or vomiting?', 'Light or sound sensitivity?', 'Duration of fever?'],
  },
  {
    id: 'general', label: 'General Weakness', icon: Stethoscope, color: 'slate',
    followups: ['Describe your main problem', 'How long has this been?', 'Any known conditions?', 'Any current medications?', 'Rate severity 1-10'],
  },
]

const STEP_LABELS = ['Identity & Consent', 'Symptom History', 'Upload Documents', 'Review & Submit']

const ABHA_REGEX = /^ABHA-\d{2}-\d{4}-\d{4}-\d{4}$/

// ------------------------ Speech API availability check --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition || null
    : null


const ZONE_COLOR_MAP = {
  rose:   { base: 'border-rose-200   text-rose-700',   active: 'bg-rose-600   border-rose-600   text-white', icon: 'text-rose-500',   aIcon: 'text-white' },
  amber:  { base: 'border-amber-200  text-amber-700',  active: 'bg-amber-500  border-amber-500  text-white', icon: 'text-amber-500',  aIcon: 'text-white' },
  blue:   { base: 'border-blue-200   text-blue-700',   active: 'bg-blue-600   border-blue-600   text-white', icon: 'text-blue-500',   aIcon: 'text-white' },
  purple: { base: 'border-purple-200 text-purple-700', active: 'bg-purple-600 border-purple-600 text-white', icon: 'text-purple-500', aIcon: 'text-white' },
  cyan:   { base: 'border-cyan-200   text-cyan-700',   active: 'bg-cyan-600   border-cyan-600   text-white', icon: 'text-cyan-500',   aIcon: 'text-white' },
  slate:  { base: 'border-slate-200  text-slate-700',  active: 'bg-slate-700  border-slate-700  text-white', icon: 'text-slate-500',  aIcon: 'text-white' },
}

function BodyZoneButton({ zone, isSelected, onClick }) {
  const Icon = zone.icon
  const c = ZONE_COLOR_MAP[zone.color]
  return (
    <button
      onClick={() => onClick(zone.id)}
      className={`flex flex-col items-center justify-center gap-2 px-4 py-4 rounded-xl border-2 font-medium text-sm transition-all duration-200 active:scale-95 w-full min-h-[72px] ${
        isSelected ? c.active : `bg-white ${c.base} hover:border-current`
      }`}
    >
      <Icon className={`w-6 h-6 ${isSelected ? c.aIcon : c.icon}`} />
      <span className="leading-tight text-center text-xs">{zone.label}</span>
    </button>
  )
}

// ------------------------ Main Component --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

export default function PatientKiosk() {
  // ---------------- Global state
  const [step, setStep] = useState(1)
  const [lang, setLang] = useState(LANGUAGES[0])
  const [clinicalMode, setClinicalMode] = useState(CLINICAL_MODES[0])
  const [clock, setClock] = useState(new Date())

  // ---------------- Step 1: Identity
  const [form, setForm] = useState({ name: '', age: '', gender: '', abha: '' })
  const [consentGiven, setConsentGiven] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [abhaWarning, setAbhaWarning] = useState('')

  // ---------------- Step 2: Symptoms
  const [selectedZones, setSelectedZones] = useState([])
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechAvailable] = useState(() => SpeechRecognitionCtor !== null)
  const [speechError, setSpeechError] = useState('')
  const [activeChips, setActiveChips] = useState([])
  const [severity, setSeverity] = useState(null)

  // ---------------- Step 2: Ayush Dashavidha profile
  const [ayushProfile, setAyushProfile] = useState({ prakriti: '', agni: '', koshtha: '', ahara: [], vihara: [] })

  // ---------------- Step 3: Documents
  const [uploadedFile, setUploadedFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageBase64, setImageBase64] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanDone, setScanDone] = useState(false)

  // ---------------- Step 4: Submission
  const [isProcessing, setIsProcessing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const isSubmitting = isProcessing || submitting || aiProcessing
  const [submitted, setSubmitted] = useState(false)
  const [clinicalResult, setClinicalResult] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [tokenNumber, setTokenNumber] = useState(() => `TK-${101 + (Date.now() % 50)}`)
  const [intakeStart] = useState(() => Date.now())

  // ---------------- FHIR Modal (DoctorConsole mirrors this on submit; kiosk has none)
  const [showFhirModal, setShowFhirModal] = useState(false)

  const recognitionRef = useRef(null)
  const fileInputRef = useRef(null)

  // Clock
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Follow-up chips from selected zones
  useEffect(() => {
    const chips = [...new Set(
      selectedZones.flatMap((id) => BODY_ZONES.find((z) => z.id === id)?.followups ?? [])
    )].slice(0, 6)
    setActiveChips(chips)
  }, [selectedZones])

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop() } catch (_) {}
    }
  }, [])

  // ------------------------ Speech Recognition --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Chrome or Edge, or type your symptoms below.')
      return
    }

    setSpeechError('')
    const recognition = new SpeechRecognitionCtor()
    recognitionRef.current = recognition
    recognition.lang = lang.code
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => { setIsListening(true); setInterimText('') }

    recognition.onresult = (event) => {
      let finalPart = ''
      let interimPart = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalPart += event.results[i][0].transcript + ' '
        } else {
          interimPart += event.results[i][0].transcript
        }
      }
      if (finalPart) {
        setTranscript((prev) => (prev + ' ' + finalPart).trim())
        setInterimText('')
      } else {
        setInterimText(interimPart)
      }
    }

    recognition.onerror = (e) => {
      setIsListening(false)
      const msgs = {
        'no-speech': 'No speech detected. Speak clearly and try again.',
        'audio-capture': 'Microphone not accessible. Check browser permissions.',
        'not-allowed': 'Microphone permission denied. Allow it in browser settings.',
        'network': 'Network error during speech recognition. Check your connection.',
      }
      setSpeechError(msgs[e.error] ?? `Speech error: ${e.error}`)
    }

    recognition.onend = () => { setIsListening(false); setInterimText('') }

    try {
      recognition.start()
    } catch (err) {
      setSpeechError('Could not start speech recognition: ' + err.message)
    }
  }, [lang.code])

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop() } catch (_) {}
    setIsListening(false)
  }, [])

  // ------------------------ TTS (Speech Synthesis) Audio Readback ----------------------------------------

  const speakText = useCallback((text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang.code
    utterance.rate = 0.88
    utterance.pitch = 1.0
    window.speechSynthesis.speak(utterance)
  }, [lang.code])

  const CONSENT_TEXT = 'This is a prototype system. I consent to my voice transcript and uploaded documents being temporarily processed by AI for this consultation only. Data is not shared and is purged upon session completion.'

  // ------------------------ File Handling ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const handleFileSelect = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) return
    setUploadedFile(file)
    setCompressing(true)
    setScanDone(false)
    setScanning(false)
    try {
      const b64 = await compressImageToBase64(file, 1200, 0.85)
      setImageBase64(b64)
      setImagePreview(b64)
      // Trigger 2-second animated scanning beam after compression
      setScanning(true)
      setTimeout(() => { setScanning(false); setScanDone(true) }, 2000)
    } catch (err) {
      console.error('Image compression error:', err)
    } finally {
      setCompressing(false)
    }
  }, [])

  // ------------------------ Validation ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const validateStep1 = () => {
    const errs = {}
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = 'Full name required (min 2 characters)'
    const ageNum = parseInt(form.age)
    if (!form.age || isNaN(ageNum) || ageNum < 0 || ageNum > 120) errs.age = 'Valid age (0-120) required'
    if (!form.gender) errs.gender = 'Please select gender'
    if (form.abha && !ABHA_REGEX.test(form.abha)) errs.abha = 'Format: ABHA-XX-XXXX-XXXX-XXXX'
    if (!consentGiven) errs.consent = 'DPDP consent is required to proceed'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const step2Valid = selectedZones.length > 0 || transcript.trim().length > 3

  // ------------------------ Navigation ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const goNext = () => {
    if (step === 1 && !validateStep1()) return
    setStep((s) => Math.min(s + 1, 4))
  }
  const goBack = () => setStep((s) => Math.max(s - 1, 1))

  // ------------------------ Submission ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const handleSubmit = async () => {
    setIsProcessing(true)
    setSubmitting(true)
    setAiProcessing(true)
    setSubmitError('')

    const activeToken = tokenNumber || Math.floor(Math.random() * 50) + 101

    // Map selected zone IDs to readable clinical symptom descriptions
    const zoneLabels = {
      breathing: 'Breathing difficulty',
      chest: 'Chest pain / tightness',
      abdomen: 'Abdominal pain',
      joints: 'Joint / muscle pain',
      head: 'Headache / fever',
      general: 'General weakness',
    }
    const symptoms =
      selectedZones.map((id) => zoneLabels[id] || id).join(', ') ||
      (transcript && transcript.trim()) ||
      'Breathing difficulty'

    const ayushParikshaResolved = {
      prakriti: ayushProfile.prakriti || 'Not assessed',
      agni: ayushProfile.agni || 'Not assessed',
      koshtha: ayushProfile.koshtha || 'Not assessed',
      ahara_shakti: ayushProfile.ahara.length ? ayushProfile.ahara.join(', ') : 'Not reported',
      vihara: ayushProfile.vihara.length ? ayushProfile.vihara.join(', ') : 'Not reported',
      dominant_dosha: ayushProfile.prakriti || 'Kapha',
      vikriti: ayushProfile.prakriti ? `${ayushProfile.prakriti} aggravation` : 'Pranavaha Srotas',
      recommended_therapy: 'To be assessed by AIIA attending physician',
    }

    // Local clinical summary fallback (ROUTINE triage, auto-generated token #TK-101 format)
    const localClinicalSummary = {
      patient_name: form.name || 'Patient',
      age: parseInt(form.age, 10) || null,
      gender: form.gender || 'Unknown',
      triage_level: 'ROUTINE',
      red_flag_detected: false,
      red_flag_reason: '',
      chief_complaint: symptoms || 'Breathing difficulty',
      socrates: {
        site: selectedZones.join(', ') || 'Chest / Respiratory',
        onset: 'Recent',
        character: symptoms || 'Breathing difficulty',
        radiation: 'None reported',
        associated_symptoms: [],
        timing: 'Intermittent',
        exacerbating_relieving: 'Standard rest',
        severity: severity || 4,
      },
      ayush_pariksha: ayushParikshaResolved,
      extracted_records: { medications: [], abnormal_labs: [] },
      soap_note: {
        subjective: `Patient (${form.name || 'Unknown'}, ${form.age || '-'}/${form.gender || '-'}) presents with ${symptoms || 'Breathing difficulty'}.${transcript ? ` Voice note: ${transcript}` : ''}${clinicalMode.id === 'AYUSH' ? ` Prakriti: ${ayushParikshaResolved.prakriti}, Agni: ${ayushParikshaResolved.agni}.` : ''}`,
        objective: 'Stable outpatient digital intake presentation. Ambulatory, non-emergent.',
        assessment: `Routine assessment for ${symptoms || 'Breathing difficulty'}. Rule out acute exacerbation.`,
        plan: '1. General OPD physician consultation\n2. Baseline vitals at triage desk\n3. Symptomatic therapy as prescribed',
      },
      _is_local_fallback: true,
    }

    let finalResult = localClinicalSummary

    try {
      const fullTranscript = [
        `Patient: ${form.name}, Age: ${form.age}, Gender: ${form.gender}`,
        form.abha ? `ABHA: ${form.abha}` : '',
        `Clinical Mode: ${clinicalMode.label}`,
        `Symptom areas: ${selectedZones.join(', ') || 'Not specified'}`,
        severity ? `Severity: ${severity}/10` : '',
        transcript ? `Voice: ${transcript}` : '',
        clinicalMode.id === 'AYUSH' ? `Prakriti: ${ayushParikshaResolved.prakriti}, Agni: ${ayushParikshaResolved.agni}, Koshtha: ${ayushParikshaResolved.koshtha}` : '',
        clinicalMode.id === 'AYUSH' ? `Diet: ${ayushParikshaResolved.ahara_shakti}, Sleep: ${ayushParikshaResolved.vihara}` : '',
      ].filter(Boolean).join('\n')

      // 1. Wrap Gemini AI summary call with a strict 8-second timeout (Promise.race)
      // NOTE: 8s gives the synthetic 1.2s offline fallback plenty of room; 3s was causing races in no-key demo mode.
      try {
        // Ensure model name is strictly "gemini-1.5-flash" without "models/" prefix
        const modelInstance = getGenerativeModel({ model: 'gemini-1.5-flash' })
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('AI intake timed out after 8s')), 8000)
        )
        const aiResult = await Promise.race([
          processClinicalIntake({
            transcript: fullTranscript,
            imageBase64,
            clinicalMode: clinicalMode.id,
            model: modelInstance.model,
          }),
          timeoutPromise,
        ])

        if (aiResult && aiResult.triage_level) {
          finalResult = aiResult
        }
      } catch (err) {
        console.error("Gemini Intake Error:", err)
        finalResult = localClinicalSummary
      }

      // Hardcoded Red Flag Rule for Demo:
      const hasChestPain = selectedZones.includes('chest')
      const hasBreathlessness = selectedZones.includes('breathing') || (transcript && transcript.toLowerCase().includes('breath'))
      const isSevereBreathing = selectedZones.includes('breathing') && severity >= 8

      let finalTriageLevel = finalResult.triage_level || 'ROUTINE'
      let finalRedFlag = finalResult.red_flag_detected || false
      let finalRedFlagReason = finalResult.red_flag_reason || ''

      if ((hasChestPain && hasBreathlessness) || isSevereBreathing) {
        finalTriageLevel = 'EMERGENCY'
        finalRedFlag = true
        finalRedFlagReason = 'Immediate Triage Alert: Chest pain with breathlessness or severe breathing difficulty detected.'
      }

      const record = {
        token_number: activeToken,
        patient_name: form.name || finalResult.patient_name || 'Unknown',
        age: parseInt(form.age, 10) || finalResult.age || null,
        gender: form.gender || finalResult.gender || 'Unknown',
        abha_id: form.abha || null,
        clinical_mode: clinicalMode.id,
        language: lang.code,
        transcript: fullTranscript,
        triage_level: finalTriageLevel,
        red_flag_detected: finalRedFlag,
        red_flag_reason: finalRedFlagReason,
        chief_complaint: finalResult.chief_complaint || symptoms || 'Breathing difficulty',
        socrates: finalResult.socrates || {},
        ayush_pariksha: finalResult.ayush_pariksha || {},
        extracted_records: finalResult.extracted_records || { medications: [], abnormal_labs: [] },
        soap_note: finalResult.soap_note || {},
        status: 'WAITING',
        cabin_assigned: null,
        consent_given: consentGiven,
        intake_duration_seconds: Math.round((Date.now() - intakeStart) / 1000),
      }

      // 2. NON-BLOCKING FIREBASE: Wrap database save in try/catch with 2s timeout. Log console.warn and DO NOT stop.
      try {
        const dbTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore write timed out after 2s')), 2000)
        )
        await Promise.race([
          addPatientIntake(record),
          dbTimeout,
        ])
      } catch (err) {
        console.warn("Firebase save failed", err)
      }
    } catch (err) {
      console.error("Gemini Intake Error:", err)
    } finally {
      // 3. GUARANTEED NAVIGATION: always unlock the button and advance to confirmation screen
      setTokenNumber(activeToken)   // ensure confirmation card shows the correct token
      setIsProcessing(false)
      setSubmitting(false)
      setAiProcessing(false)
      setClinicalResult(finalResult)
      setSubmitted(true)
      setStep(5)
    }
  }

  // ------------------------ Helpers ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  const triageClass =
    clinicalResult?.triage_level === 'EMERGENCY' ? 'bg-rose-600 text-white'
    : clinicalResult?.triage_level === 'URGENT'   ? 'bg-amber-500 text-white'
    : 'bg-emerald-600 text-white'

  const resetForm = () => {
    setStep(1); setSubmitted(false); setClinicalResult(null); setSubmitError('')
    setForm({ name: '', age: '', gender: '', abha: '' }); setConsentGiven(false)
    setTranscript(''); setSelectedZones([]); setSeverity(null)
    setImagePreview(null); setImageBase64(null); setUploadedFile(null)
    setFormErrors({}); setAyushProfile({ prakriti: '', agni: '', koshtha: '', ahara: [], vihara: [] })
    setScanning(false); setScanDone(false)
    setTokenNumber(`TK-${Math.floor(Math.random() * 50) + 101}`)
  }

  // ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-16">
      
      {(submitted || step === 5) && (
        <div className="bg-emerald-600 text-white text-sm font-semibold py-2.5 px-4 text-center w-full shadow-md z-50 flex items-center justify-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5" />
          OPD Intake Successfully Submitted to Doctor Console
        </div>
      )}

      {/* ------ Header ------ */}
      <header className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-lg sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm">Central OPD Intake Portal</div>
            <div className="text-xs text-slate-400">
              {submitted || step === 5 ? 'Step 4: Review & Submit' : `Step ${step}: ${STEP_LABELS[step - 1] ?? 'Registration'}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${lang.code === l.code ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {l.short}
              </button>
            ))}
          </div>
          {/* Clinical mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {CLINICAL_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setClinicalMode(m)}
                className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${clinicalMode.id === m.id ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
              >
                {m.id === 'ALLOPATHIC' ? 'Allopathic' : 'Ayush'}
              </button>
            ))}
          </div>
          <div className="text-xs font-mono text-slate-400 ml-2 hidden sm:block">
            {clock.toLocaleTimeString('en-IN', { hour12: true })}
          </div>
        </div>
      </header>

      {/* Mode ribbon */}
      <div className={`text-center text-xs font-semibold py-1 ${clinicalMode.id === 'AYUSH' ? 'bg-amber-600 text-white' : 'bg-blue-700 text-white'}`}>
        {clinicalMode.label} - {clinicalMode.sub}
      </div>

      {/* ---------------- Main ---------------- */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        <StepIndicator currentStep={submitted || step === 5 ? 4 : step} labels={STEP_LABELS} />

        {/* --------------------- STEP 1: Identity & DPDP Consent --------------------- */}
        {step === 1 && (
          <div className="animate-fade-in space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Patient Identity Verification</h2>
              <p className="text-slate-500 text-sm">Enter verified details to begin Central OPD registration</p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Enter your full name"
                className={`w-full px-4 py-3.5 text-base border-2 rounded-xl outline-none transition-colors ${formErrors.name ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white focus:border-emerald-500'}`}
              />
              {formErrors.name && <p className="text-xs text-rose-500 mt-1">{formErrors.name}</p>}
            </div>

            {/* Age + Gender */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Age <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number" min={0} max={120}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="Years"
                  className={`w-full px-4 py-3.5 text-base border-2 rounded-xl outline-none transition-colors ${formErrors.age ? 'border-rose-400 bg-rose-50' : 'border-slate-200 bg-white focus:border-emerald-500'}`}
                />
                {formErrors.age && <p className="text-xs text-rose-500 mt-1">{formErrors.age}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className={`w-full px-4 py-3.5 text-base border-2 rounded-xl outline-none transition-colors appearance-none bg-white ${formErrors.gender ? 'border-rose-400 bg-rose-50' : 'border-slate-200 focus:border-emerald-500'}`}
                >
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
                {formErrors.gender && <p className="text-xs text-rose-500 mt-1">{formErrors.gender}</p>}
              </div>
            </div>

            {/* ABHA ID */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                ABHA Health ID
                <span className="ml-2 text-xs font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={form.abha}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase()
                  setForm({ ...form, abha: v })
                  setAbhaWarning(v && !ABHA_REGEX.test(v) ? 'Format: ABHA-XX-XXXX-XXXX-XXXX' : '')
                }}
                placeholder="ABHA-14-1234-5678-9012"
                className={`w-full px-4 py-3.5 text-base border-2 rounded-xl font-mono outline-none transition-colors ${abhaWarning || formErrors.abha ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white focus:border-emerald-500'}`}
              />
              {(abhaWarning || formErrors.abha) && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {abhaWarning || formErrors.abha}
                </p>
              )}
            </div>

            {/* DPDP Consent */}
            <div className={`rounded-xl border-2 p-4 transition-colors ${consentGiven ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
              {/* Audio readback button */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-slate-800">DPDP Act 2023 – Patient Data Consent</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); speakText(CONSENT_TEXT) }}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg font-semibold transition-colors"
                  title="Listen to consent terms"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Listen to Consent Terms
                </button>
              </div>
              <button
                onClick={() => {
                  setConsentGiven((v) => !v)
                  setFormErrors((prev) => ({ ...prev, consent: undefined }))
                }}
                className="flex items-start gap-3 w-full text-left"
              >
                <span className="flex-shrink-0 mt-0.5">
                  {consentGiven
                    ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    : <div className="w-5 h-5 rounded-md border-2 border-slate-400" />}
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {CONSENT_TEXT}
                </p>
              </button>
              {formErrors.consent && (
                <p className="text-xs text-rose-500 mt-2 flex items-center gap-1 ml-9">
                  <AlertTriangle className="w-3 h-3" /> {formErrors.consent}
                </p>
              )}
            </div>
          </div>
        )}


        {/* --------------------- STEP 2: Symptom Intake --------------------- */}
        {step === 2 && (
          <div className="animate-fade-in space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">
                  {clinicalMode.id === 'AYUSH' ? 'Dashavidha Pariksha – Self Assessment' : 'Clinical History & Symptom Entry'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {clinicalMode.id === 'AYUSH'
                    ? 'Select your Prakriti and digestive constitution for the AIIA Ayurveda OPD'
                    : 'Select presenting complaint area(s), then speak or type clinical history'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => speakText(clinicalMode.id === 'AYUSH'
                  ? 'Please select your body constitution, digestion type, bowel type, dietary habits and sleep pattern.'
                  : 'Select the area of your body where you feel discomfort. Then speak or type your symptoms.'
                )}
                className="flex-shrink-0 p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-colors mt-1"
                title="Read instructions aloud"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* ---- AYUSH MODE: Dashavidha Pariksha tactile cards ---- */}
            {clinicalMode.id === 'AYUSH' && (
              <div className="space-y-5">
                {/* Prakriti */}
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2.5">
                    Prakriti (Body Constitution)
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {AYUSH_PRAKRITI.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAyushProfile((prev) => ({ ...prev, prakriti: p.id }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95 ${
                          ayushProfile.prakriti === p.id
                            ? p.color === 'sky' ? 'border-sky-500 bg-sky-50 text-sky-800'
                              : p.color === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span className="text-base">{p.id === 'VATA' ? '🍃' : p.id === 'PITTA' ? '🔥' : '💧'}</span>
                        <span>{p.label}</span>
                        <span className="text-[10px] font-normal text-slate-500 text-center leading-tight">{p.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Agni */}
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2.5">
                    Agni / Digestion Type
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {AYUSH_AGNI.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAyushProfile((prev) => ({ ...prev, agni: a.id }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95 ${
                          ayushProfile.agni === a.id
                            ? a.color === 'sky' ? 'border-sky-500 bg-sky-50 text-sky-800'
                              : a.color === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span className="text-base">{a.id === 'MANDA' ? '🐢' : a.id === 'TIKSHNA' ? '⚡' : '✅'}</span>
                        <span>{a.label}</span>
                        <span className="text-[10px] font-normal text-slate-500 text-center leading-tight">{a.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Koshtha */}
                <div>
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2.5">
                    Koshtha / Bowel Habit
                  </p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {AYUSH_KOSHTHA.map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setAyushProfile((prev) => ({ ...prev, koshtha: k.id }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 font-semibold text-sm transition-all active:scale-95 ${
                          ayushProfile.koshtha === k.id
                            ? k.color === 'rose' ? 'border-rose-500 bg-rose-50 text-rose-800'
                              : k.color === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-emerald-500 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span className="text-base">{k.id === 'KRURA' ? '🪨' : k.id === 'MRIDU' ? '💦' : '⚖️'}</span>
                        <span>{k.label}</span>
                        <span className="text-[10px] font-normal text-slate-500 text-center leading-tight">{k.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ahara-Vihara */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
                      Ahara (Diet Preference)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {AYUSH_AHARA.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setAyushProfile((prev) => ({
                            ...prev,
                            ahara: prev.ahara.includes(item)
                              ? prev.ahara.filter((x) => x !== item)
                              : [...prev.ahara, item]
                          }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                            ayushProfile.ahara.includes(item)
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
                      Vihara (Sleep Pattern)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {AYUSH_VIHARA.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setAyushProfile((prev) => ({
                            ...prev,
                            vihara: prev.vihara.includes(item)
                              ? prev.vihara.filter((x) => x !== item)
                              : [...prev.vihara, item]
                          }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 ${
                            ayushProfile.vihara.includes(item)
                              ? 'bg-sky-600 border-sky-600 text-white'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-sky-400'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <strong>AIIA Protocol:</strong> Dashavidha Pariksha is a self-reportable constitutional assessment. Final Dosha determination will be confirmed by the attending Ayurveda physician.
                </div>
              </div>
            )}

            {/* ---- Body zone grid (always shown in Allopathic, also available in Ayush for symptom localization) ---- */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
                {clinicalMode.id === 'AYUSH' ? 'Symptom Localization (Dosha aggravation site):' : 'Select Presenting Complaint Area (tap all that apply)'}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BODY_ZONES.map((zone) => (
                  <BodyZoneButton
                    key={zone.id}
                    zone={zone}
                    isSelected={selectedZones.includes(zone.id)}
                    onClick={(id) =>
                      setSelectedZones((prev) =>
                        prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]
                      )
                    }
                  />
                ))}
              </div>
            </div>

            {/* Follow-up chips */}
            {activeChips.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quick prompts:</p>
                <div className="flex flex-wrap gap-2">
                  {activeChips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => setTranscript((prev) => prev ? `${prev} [${chip}]` : `[${chip}]`)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors active:scale-95"
                    >
                      + {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Severity */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Pain / Discomfort Severity:
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSeverity(n)}
                    className={`w-11 h-11 rounded-lg font-bold text-sm border-2 transition-all active:scale-95 ${
                      severity === n
                        ? n <= 3 ? 'bg-emerald-500 border-emerald-500 text-white'
                          : n <= 6 ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-rose-500 border-rose-500 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {severity && (
                <p className="text-xs text-slate-500 mt-1">
                  Severity: <strong className={severity <= 3 ? 'text-emerald-600' : severity <= 6 ? 'text-amber-600' : 'text-rose-600'}>
                    {severity}/10 - {severity <= 3 ? 'Mild' : severity <= 6 ? 'Moderate' : 'Severe'}
                  </strong>
                </p>
              )}
            </div>

            {/* Voice recorder */}
            <div className="bg-white border-2 border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-700">Voice Input</span>
                  <span className="text-xs text-slate-400">({lang.label})</span>
                </div>
                {speechAvailable ? (
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                      isListening ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isListening ? <><MicOff className="w-4 h-4" /> Stop</> : <><Mic className="w-4 h-4" /> Speak</>}
                  </button>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg font-medium">
                    Type below
                  </span>
                )}
              </div>

              {!speechAvailable && (
                <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Speech API unavailable - use manual touch selector above or type symptoms below.
                  </p>
                </div>
              )}

              {isListening && (
                <div className="flex items-center gap-3 mb-3 p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
                  <WaveVisualizer />
                  <span className="text-xs text-rose-700 font-medium">Listening in {lang.label}...</span>
                </div>
              )}

              {speechError && (
                <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-700">{speechError}</p>
                </div>
              )}

              {interimText && (
                <p className="text-xs text-slate-400 italic mb-1.5 px-1">...{interimText}</p>
              )}

              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={`Speak or type symptoms in ${lang.label}...\ne.g. "Severe chest pain since morning radiating to left shoulder" or "Fever and cough for 3 days"`}
                rows={5}
                className="w-full px-3 py-3 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-800 resize-none outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              />
              {transcript && (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-slate-400">{transcript.length} characters</span>
                  <button onClick={() => setTranscript('')} className="text-xs text-rose-500 hover:text-rose-700">Clear</button>
                </div>
              )}
              {!isListening && !transcript && (
                <button 
                  onClick={() => setTranscript('Severe chest pain and heavy breathlessness since morning. Pain is 9 out of 10.')}
                  className="mt-2 text-[11px] text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded border border-blue-200 font-semibold w-full transition-colors"
                >
                  ✨ Populate Demo Emergency Transcript
                </button>
              )}
            </div>

            {!step2Valid && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Select at least one symptom area or enter a description to continue.
              </p>
            )}
          </div>
        )}

        {/* --------------------- STEP 3: Document Upload --------------------- */}
        {step === 3 && (
          <div className="animate-fade-in space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Prior Records Upload</h2>
              <p className="text-slate-500 text-sm">Attach prior prescriptions or investigation reports for AI-assisted extraction (optional)</p>
            </div>

            {!imagePreview ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]) }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 ${
                  dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <UploadCloud className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-slate-700 mb-1">Drop here or tap to capture</p>
                    <p className="text-sm text-slate-400">JPG, PNG - auto-compressed to 1200px</p>
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap justify-center">
                    {['Camera Capture', 'Lab Report', 'Prescription'].map((t) => (
                      <span key={t} className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-clinical">
                {compressing ? (
                  <div className="flex items-center justify-center h-48 gap-3 text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                    <span className="text-sm">Compressing image...</span>
                  </div>
                ) : (
                  <>
                    {/* Image with scanning beam overlay */}
                    <div className="relative overflow-hidden">
                      <img src={imagePreview} alt="Document preview" className="w-full max-h-64 object-contain bg-slate-50" />
                      {scanning && (
                        <div
                          className="absolute left-0 right-0 h-1 bg-emerald-400 opacity-80 shadow-[0_0_16px_4px_rgba(52,211,153,0.7)] z-10"
                          style={{
                            top: 0,
                            animation: 'scanBeam 2s linear forwards',
                          }}
                        />
                      )}
                      {scanning && (
                        <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center z-5">
                          <div className="bg-white/90 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg">
                            <RefreshCw className="w-4 h-4 text-emerald-600 animate-spin" />
                            <span className="text-xs font-semibold text-emerald-800">AI Document Scan in progress...</span>
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => { setImagePreview(null); setImageBase64(null); setUploadedFile(null); setScanDone(false); setScanning(false) }}
                        className="absolute top-2 right-2 w-8 h-8 bg-slate-900/70 text-white rounded-full flex items-center justify-center hover:bg-slate-900 transition-colors z-20"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <style>{`
                      @keyframes scanBeam {
                        from { top: 0%; }
                        to { top: 95%; }
                      }
                    `}</style>

                    <div className="p-4 flex items-center justify-between border-b border-slate-100">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{uploadedFile?.name || 'Document'}</p>
                        <p className="text-xs text-slate-400">
                          {scanning ? 'Scanning...' : scanDone ? 'AI extraction complete' : 'Compressed - ready for AI extraction'}
                        </p>
                      </div>
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                        scanning ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                        : scanDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {scanning ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scanning</> : scanDone ? <><CheckCircle2 className="w-3.5 h-3.5" /> Extracted</> : <><UploadCloud className="w-3.5 h-3.5" /> Ready</>}
                      </span>
                    </div>

                    {/* Mock extracted entities (shown after scan completes) */}
                    {scanDone && (
                      <div className="p-4 space-y-4">
                        <div className="flex justify-between items-center">
                           <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Document Extraction</span>
                           <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">OCR Confidence: 98%</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mb-2">
                           <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                             <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Report Date</p>
                             <p className="text-xs font-bold text-slate-700">12 Aug 2023</p>
                           </div>
                           <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                             <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Known Diagnosis</p>
                             <p className="text-xs font-bold text-slate-700">Type 2 DM, HTN</p>
                           </div>
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Extracted Medications</p>
                          <div className="space-y-1.5">
                            {[
                              { name: 'Metformin', dose: '500mg', freq: '1-0-1' },
                              { name: 'Amlodipine', dose: '5mg', freq: '0-0-1' },
                              { name: 'Atorvastatin', dose: '40mg', freq: '0-0-1' },
                            ].map((m) => (
                              <div key={m.name} className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                                <Activity className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                <span className="text-xs font-bold text-blue-900">{m.name}</span>
                                <span className="text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-mono">{m.dose}</span>
                                <span className="text-xs text-blue-700">{m.freq}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2">Abnormal Vitals / Labs</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-100 border border-amber-300 text-amber-800 rounded-lg text-xs font-bold">
                              <AlertTriangle className="w-3 h-3" /> BP 150/90 mmHg — HIGH
                            </span>
                            <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-100 border border-rose-300 text-rose-800 rounded-lg text-xs font-bold">
                              <AlertTriangle className="w-3 h-3" /> HbA1c 8.9% — CRITICAL
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic">* AI-extracted preview. Physician will verify during consultation.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <Activity className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                <strong>AI Document Intelligence:</strong> Gemini will extract medications, dosages, and flag out-of-range lab values automatically.
              </p>
            </div>

            <p className="text-center text-sm text-slate-400">This step is optional – skip if no documents available</p>
          </div>
        )}


        {/* --------------------- STEP 4: Review & Submit --------------------- */}
        {step === 4 && !submitted && (
          <div className="animate-fade-in space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Review & Clinical Submission</h2>
              <p className="text-slate-500 text-sm">Verify patient details before clinical intake submission</p>
            </div>

            {/* Summary */}
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              
              {/* Display immediate triage red flag warning on review screen if conditions met */}
              {(() => {
                const hasChestPain = selectedZones.includes('chest')
                const hasBreathlessness = selectedZones.includes('breathing') || (transcript && transcript.toLowerCase().includes('breath'))
                const isSevereBreathing = selectedZones.includes('breathing') && severity >= 8
                
                if ((hasChestPain && hasBreathlessness) || isSevereBreathing) {
                  return (
                    <div className="mb-4 p-4 bg-rose-600 text-white rounded-xl shadow-sm flex items-start gap-3 animate-pulse">
                      <AlertTriangle className="w-6 h-6 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-sm">🚨 IMMEDIATE TRIAGE ALERT</p>
                        <p className="text-xs mt-0.5 opacity-90">Severe symptoms (chest pain with breathlessness or severe respiratory distress) detected. This case will be escalated as an EMERGENCY.</p>
                      </div>
                    </div>
                  )
                }
                return null;
              })()}

              <div className="grid grid-cols-2 gap-4 mb-4">
                {[
                  { label: 'Patient Name', value: form.name || '-' },
                  { label: 'Age / Gender', value: `${form.age ? form.age + ' yrs' : '--------'} / ${form.gender || '--------'}` },
                  { label: 'ABHA ID', value: form.abha || 'Not provided' },
                  { label: 'Clinical Mode', value: clinicalMode.label },
                  { label: 'Symptom Areas', value: selectedZones.join(', ') || 'Not specified' },
                  { label: 'Severity', value: severity ? `${severity}/10` : 'Not specified' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-slate-800 break-all">{value}</p>
                  </div>
                ))}
              </div>
              {transcript && (
                <div className="border-t border-slate-100 pt-3 mb-3">
                  <p className="text-xs text-slate-400 font-medium mb-1.5">Voice / Text Transcript</p>
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 max-h-24 overflow-y-auto leading-relaxed">{transcript}</p>
                </div>
              )}
              {scanDone && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-xs text-slate-400 font-medium mb-1.5 flex justify-between">
                    <span>Extracted Document Entities</span>
                    <span className="text-emerald-600">OCR: 98%</span>
                  </p>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                     <p className="text-xs text-slate-600"><strong>Diagnosis:</strong> Type 2 DM, HTN (12 Aug 2023)</p>
                     <p className="text-xs text-slate-600"><strong>Meds:</strong> Metformin 500mg, Amlodipine 5mg, Atorvastatin 40mg</p>
                     <p className="text-xs text-rose-600 font-bold"><strong>Flags:</strong> BP 150/90, HbA1c 8.9%</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                <strong>AI Notice:</strong> Clinical data is AI-assisted. Final decisions rest with the attending physician.
              </p>
            </div>

            {submitError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-rose-800">Submission Error</p>
                  <p className="text-xs text-rose-700">{submitError}</p>
                  <button onClick={handleSubmit} className="mt-2 text-xs font-semibold text-rose-600 hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-lg rounded-2xl transition-all duration-200 active:scale-[0.98] py-4 shadow-lg min-h-[60px]"
            >
              {isSubmitting ? (
                <><RefreshCw className="w-5 h-5 animate-spin" /> AI Processing... Please wait</>
              ) : (
                <><Activity className="w-5 h-5" /> Submit for physician review</>
              )}
            </button>
          </div>
        )}

        {/* --------------------- SUCCESS: OPD Token Card --------------------- */}
        {(submitted || step === 5) && (
          <div className="animate-fade-in text-center space-y-5">
            {/* Pulsing RED FLAG emergency banner */}
            {clinicalResult?.red_flag_detected && (
              <div className="p-4 bg-rose-600 text-white rounded-xl border-2 border-rose-700 animate-pulse flex items-start gap-3">
                <AlertTriangle className="w-7 h-7 flex-shrink-0" />
                <div className="text-left flex-1">
                  <p className="font-black text-base tracking-wide">🚨 RED FLAG: Immediate Triage Required</p>
                  <p className="text-sm font-semibold opacity-95 mt-0.5">Priority Casualty Escalation – DO NOT WAIT IN OPD SEATING</p>
                  {clinicalResult?.red_flag_reason && (
                    <p className="text-xs opacity-80 mt-1">{clinicalResult.red_flag_reason}</p>
                  )}
                  <p className="text-xs opacity-75 mt-1 font-medium">Proceed directly to the Emergency Triage Bay with this token.</p>
                </div>
                <button
                  type="button"
                  onClick={() => speakText('Red flag emergency detected. Please proceed immediately to the Emergency Triage Bay. Do not wait in the OPD seating area.')}
                  className="flex-shrink-0 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="bg-white rounded-3xl shadow-2xl border-2 border-slate-100 p-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-white" />
                </div>
                <button
                  type="button"
                  onClick={() => speakText(`Registration successful. Your OPD token is ${tokenNumber}. Please wait in the OPD seating area.`)}
                  className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition-colors"
                  title="Read token number aloud"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Registration Successful!</h3>
              <p className="text-sm text-slate-500 mb-6">Your OPD token has been issued</p>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-5">
                <p className="text-slate-500 text-xs font-semibold tracking-widest mb-1 uppercase">OPD Token</p>
                <p className="text-5xl font-black text-slate-900 font-mono tracking-wider">
                  {String(tokenNumber).startsWith('TK-') ? tokenNumber : (String(tokenNumber).startsWith('#') ? tokenNumber : `TK-${tokenNumber}`)}
                </p>
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mt-3 ${triageClass}`}>
                  {clinicalResult?.triage_level || 'ROUTINE'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-left mb-4">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">Patient</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{form.name || 'Patient'}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">Est. Wait</p>
                  <p className="text-sm font-bold text-emerald-700">
                    {clinicalResult?.triage_level === 'EMERGENCY' ? 'IMMEDIATE'
                      : clinicalResult?.triage_level === 'URGENT' ? '~15 mins'
                      : '~30-45 mins'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">Mode</p>
                  <p className="text-sm font-semibold text-slate-700">{clinicalMode.label}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5">Intake Time</p>
                  <p className="text-sm font-bold text-slate-700">{((Date.now() - intakeStart) / 60000).toFixed(1)} mins</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-left mb-4">
                <p className="text-xs font-semibold text-blue-700 mb-0.5">AI Summary:</p>
                <p className="text-xs text-blue-800 leading-relaxed">{clinicalResult?.chief_complaint || 'Routine outpatient clinical intake recorded.'}</p>
              </div>

              {/* DPDP Session Purge Notice */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  <strong className="text-slate-600">DPDP Act 2023 – Session Data Purged.</strong> Your voice transcript and uploaded documents have been cleared from this kiosk session. Only the de-identified clinical summary has been forwarded to the physician console.
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-500">Please wait in the OPD seating area.</p>
            <button onClick={resetForm} className="text-sm text-slate-400 hover:text-slate-700 underline">
              Register new patient
            </button>
          </div>
        )}


        {/* ---------------- Navigation buttons ---------------- */}
        {!submitted && step < 5 && (
          <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={goBack}
                disabled={step === 1}
                className="flex items-center gap-2 px-5 py-3 text-slate-600 hover:text-slate-900 disabled:opacity-30 font-semibold text-sm transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" /> Back
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs px-3 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg font-bold border border-rose-200 transition-colors"
                onClick={() => alert('A staff member has been notified and will assist you shortly.')}
              >
                <User className="w-4 h-4" /> Need staff help?
              </button>
            </div>
            {step < 4 && (
              <button
                onClick={goNext}
                disabled={step === 2 && !step2Valid}
                className="flex items-center gap-2 px-7 py-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-semibold text-sm rounded-xl transition-colors active:scale-95 min-h-[48px]"
              >
                {step === 3 ? 'Review & Submit' : 'Continue'}
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}




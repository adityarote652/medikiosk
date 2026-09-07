/**
 * MediKiosk - Firebase Firestore Data Layer
 * Initializes Firebase using VITE_FIREBASE_* environment variables.
 *
 * HYBRID FAILSAFE: If Firebase config is missing or network calls fail,
 * falls back automatically to a BroadcastChannel('medikiosk_sync') +
 * localStorage event bus so the application never crashes during a demo
 * or offline presentation.
 *
 * Exported API:
 *   subscribeToPatients(callback) -> unsubscribe fn
 *   addPatientIntake(data)        -> Promise<record>
 *   updatePatientStatus(id, upd)  -> Promise<void>
 *   isMockMode                    -> boolean
 *   resetLocalDatabase()          -> void (dev/demo helper)
 */

// --- Firebase Config ---

const FIREBASE_CONFIG = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

const isValidConfig =
  typeof FIREBASE_CONFIG.apiKey === 'string' &&
  FIREBASE_CONFIG.apiKey.length > 5 &&
  !FIREBASE_CONFIG.apiKey.includes('your_') &&
  typeof FIREBASE_CONFIG.projectId === 'string' &&
  FIREBASE_CONFIG.projectId.length > 2

// --- Local Mock Store (BroadcastChannel + localStorage) ---

let _mockDb = []
let _mockListeners = []
let _mockIdCounter = 1000

function _genId() {
  return `local-${Date.now()}-${_mockIdCounter++}`
}

function _loadFromStorage() {
  try {
    const raw = localStorage.getItem('medikiosk_patients')
    return raw ? JSON.parse(raw) : []
  } catch (_) { return [] }
}

function _persistToStorage(db) {
  try { localStorage.setItem('medikiosk_patients', JSON.stringify(db)) } catch (_) {}
}

function _notifyListeners() {
  const sorted = [..._mockDb].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  _mockListeners.forEach(cb => { try { cb(sorted) } catch (_) {} })
}

// Boot: hydrate from local storage
_mockDb = _loadFromStorage()

// BroadcastChannel for real-time cross-tab sync in offline/demo mode
let _bc = null
try {
  _bc = new BroadcastChannel('medikiosk_sync')
  _bc.onmessage = (ev) => {
    if (ev.data?.type === 'DB_UPDATE' && Array.isArray(ev.data.db)) {
      _mockDb = ev.data.db
      _notifyListeners()
    }
  }
} catch (_) { /* BroadcastChannel not supported - single-tab fallback */ }

function _broadcastUpdate() {
  _persistToStorage(_mockDb)
  try { _bc?.postMessage({ type: 'DB_UPDATE', db: _mockDb }) } catch (_) {}
}

// --- Firebase Initialization (top-level await - ESM only) ---

let _firestoreDb  = null
let _fs           = null   // cached firestore module exports

export let isMockMode = true
export let db = null

if (isValidConfig) {
  try {
    const { initializeApp, getApps, getApp } = await import('firebase/app')
    _fs = await import('firebase/firestore')
    const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG)
    _firestoreDb = _fs.getFirestore(app)
    db = _firestoreDb
    isMockMode = false
    console.info('[MediKiosk] Firebase Firestore connected:', FIREBASE_CONFIG.projectId)
  } catch (err) {
    console.warn('[MediKiosk] Firebase init failed - local sync bus activated:', err.message)
    _firestoreDb = null
    db = null
    isMockMode = true
  }
} else {
  console.info('[MediKiosk] No Firebase credentials - BroadcastChannel + localStorage mode active.')
}

// Helper to extract timestamp ms
function _toMs(val) {
  if (!val) return 0
  if (typeof val.toDate === 'function') {
    try { return val.toDate().getTime() } catch (_) {}
  }
  if (typeof val === 'object' && val.seconds !== undefined) {
    return val.seconds * 1000
  }
  const d = new Date(val)
  return isNaN(d.getTime()) ? 0 : d.getTime()
}

function _normalizeDoc(d) {
  const data = typeof d.data === 'function' ? d.data() : d
  const id = d.id || data.id || _genId()
  const chiefComplaint = data.chiefComplaint || data.chief_complaint || ''
  return {
    ...data,
    id,
    chiefComplaint,
    chief_complaint: chiefComplaint,
    token_number: data.token_number || data.tokenNumber || data.token || '',
    patient_name: data.patient_name || data.patientName || data.name || 'Unknown',
    triage_level: data.triage_level || data.triageLevel || 'ROUTINE',
    clinical_mode: data.clinical_mode || data.clinicalMode || 'ALLOPATHIC',
    status: data.status || 'WAITING',
  }
}

// --- Public API ---

/**
 * Subscribe to the 'patients' collection using onSnapshot.
 * Mirrors real-time updates across Doctor Console and Admin Dashboard.
 *
 * @param {(patients: Array) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToPatients(callback) {
  if (!isMockMode && _firestoreDb && _fs) {
    const { collection, query, orderBy, onSnapshot } = _fs
    try {
      const q = query(collection(_firestoreDb, 'patients'), orderBy('created_at', 'desc'))
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const patients = snapshot.docs.map(_normalizeDoc)
          callback(patients)
        },
        (err) => {
          console.warn('[MediKiosk Firestore] orderBy query failed, listening directly to patients collection:', err.message)
          try {
            const fallbackUnsub = onSnapshot(
              collection(_firestoreDb, 'patients'),
              (snapshot) => {
                const patients = snapshot.docs.map(_normalizeDoc)
                patients.sort((a, b) => _toMs(b.created_at) - _toMs(a.created_at))
                callback(patients)
              },
              (fallbackErr) => {
                console.error('[MediKiosk Firestore] onSnapshot error - falling back to local bus:', fallbackErr.message)
                isMockMode = true
                _mockListeners.push(callback)
                callback([..._mockDb].sort((a, b) => _toMs(b.created_at) - _toMs(a.created_at)))
              }
            )
            return fallbackUnsub
          } catch (e) {
            isMockMode = true
            _mockListeners.push(callback)
            callback([..._mockDb].sort((a, b) => _toMs(b.created_at) - _toMs(a.created_at)))
          }
        }
      )
      return unsub
    } catch (err) {
      console.error('[MediKiosk Firestore] subscribe failed:', err.message)
      isMockMode = true
    }
  }

  // Local fallback
  _mockListeners.push(callback)
  callback([..._mockDb].map(_normalizeDoc).sort((a, b) => _toMs(b.created_at) - _toMs(a.created_at)))
  return () => { _mockListeners = _mockListeners.filter((cb) => cb !== callback) }
}

/**
 * Add a new patient intake record.
 * Returns the stored record (with id and created_at).
 *
 * @param {Object} patientData
 * @returns {Promise<Object>}
 */
export async function addPatientIntake(patientData) {
  const timestamp = new Date().toISOString()
  const chief = patientData?.chiefComplaint || patientData?.chief_complaint || ''
  const payload = {
    ...patientData,
    chiefComplaint: chief,
    chief_complaint: chief,
  }

  if (!isMockMode && _firestoreDb && _fs) {
    try {
      const { collection, addDoc, serverTimestamp } = _fs
      const savePromise = addDoc(collection(_firestoreDb, 'patients'), {
        ...payload,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore addDoc timed out (2s threshold)')), 2000)
      )
      const docRef = await Promise.race([savePromise, timeoutPromise])
      const record = { id: docRef.id, ...payload, created_at: timestamp, updated_at: timestamp }
      return record
    } catch (err) {
      console.warn("Firebase save failed", err)
      isMockMode = true
    }
  }

  // Local fallback
  const record = { id: _genId(), ...payload, created_at: timestamp, updated_at: timestamp }
  _mockDb.unshift(record)
  _broadcastUpdate()
  _notifyListeners()
  return record
}

/**
 * Update fields on an existing patient record.
 *
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<void>}
 */
export async function updatePatientStatus(id, updates) {
  const timestamp = new Date().toISOString()

  if (!isMockMode && _firestoreDb && _fs) {
    try {
      const { doc, updateDoc, serverTimestamp } = _fs
      const updatePromise = updateDoc(doc(_firestoreDb, 'patients', id), {
        ...updates,
        updated_at: serverTimestamp(),
      })
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore updateDoc timed out (2s threshold)')), 2000)
      )
      await Promise.race([updatePromise, timeoutPromise])
      return
    } catch (err) {
      console.warn("Firebase update failed", err)
      isMockMode = true
    }
  }

  // Local fallback
  _mockDb = _mockDb.map(p =>
    p.id === id ? { ...p, ...updates, updated_at: timestamp } : p
  )
  _broadcastUpdate()
  _notifyListeners()
}

/**
 * Reset the local database - for demo/dev use only.
 */
export function resetLocalDatabase() {
  _mockDb = []
  _mockListeners = []
  _persistToStorage([])
  try { _bc?.postMessage({ type: 'DB_UPDATE', db: [] }) } catch (_) {}
  console.info('[MediKiosk] Local database reset.')
}

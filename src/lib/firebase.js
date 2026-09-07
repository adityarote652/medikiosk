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

if (isValidConfig) {
  try {
    const { initializeApp, getApps, getApp } = await import('firebase/app')
    _fs = await import('firebase/firestore')
    const app = getApps().length > 0 ? getApp() : initializeApp(FIREBASE_CONFIG)
    _firestoreDb = _fs.getFirestore(app)
    isMockMode = false
    console.info('[MediKiosk] Firebase Firestore connected:', FIREBASE_CONFIG.projectId)
  } catch (err) {
    console.warn('[MediKiosk] Firebase init failed - local sync bus activated:', err.message)
    _firestoreDb = null
    isMockMode = true
  }
} else {
  console.info('[MediKiosk] No Firebase credentials - BroadcastChannel + localStorage mode active.')
}

// --- Public API ---

/**
 * Subscribe to the patients collection, ordered by created_at desc.
 * Calls callback immediately with current data, then on every change.
 *
 * @param {(patients: Array) => void} callback
 * @returns {() => void} unsubscribe function
 */
export function subscribeToPatients(callback) {
  if (!isMockMode && _firestoreDb && _fs) {
    const { collection, query, orderBy, onSnapshot } = _fs
    const q = query(collection(_firestoreDb, 'patients'), orderBy('created_at', 'desc'))
    try {
      const unsub = onSnapshot(q,
        (snapshot) => {
          const patients = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
          callback(patients)
        },
        (err) => {
          console.error('[MediKiosk Firestore] onSnapshot error - falling back to local bus:', err.message)
          isMockMode = true
          _mockListeners.push(callback)
          callback([..._mockDb].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
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
  callback([..._mockDb].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
  return () => { _mockListeners = _mockListeners.filter(cb => cb !== callback) }
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

  if (!isMockMode && _firestoreDb && _fs) {
    try {
      const { collection, addDoc, serverTimestamp } = _fs
      const docRef = await addDoc(collection(_firestoreDb, 'patients'), {
        ...patientData,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      })
      const record = { id: docRef.id, ...patientData, created_at: timestamp, updated_at: timestamp }
      return record
    } catch (err) {
      console.warn("Firebase save failed", err)
      isMockMode = true
    }
  }

  // Local fallback
  const record = { id: _genId(), ...patientData, created_at: timestamp, updated_at: timestamp }
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
      await updateDoc(doc(_firestoreDb, 'patients', id), {
        ...updates,
        updated_at: serverTimestamp(),
      })
      return
    } catch (err) {
      console.error('[MediKiosk Firestore] updateDoc failed - updating locally:', err.message)
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

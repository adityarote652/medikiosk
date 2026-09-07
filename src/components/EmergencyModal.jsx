import { AlertTriangle, X } from 'lucide-react'

/**
 * EmergencyModal - Full-screen critical-alert modal for emergency patients.
 */
export default function EmergencyModal({ patient, onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div className="bg-rose-600 text-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-slide-in-up">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black">EMERGENCY ALERT</h2>
            <p className="text-rose-200 text-sm">Immediate clinical attention required</p>
          </div>
        </div>

        <div className="bg-rose-700/50 rounded-xl p-4 mb-5">
          <p className="font-bold text-lg mb-1">
            {patient?.patient_name ?? 'Unknown'} - {String(patient?.token_number ?? '').startsWith('TK-') ? patient?.token_number : `OPD-${patient?.token_number ?? '?'}`}
          </p>
          <p className="text-rose-200 text-sm">{patient?.red_flag_reason ?? 'Red flag detected in AI triage'}</p>
          {patient?.chief_complaint && (
            <p className="text-rose-100 text-xs mt-2 italic">"{patient.chief_complaint}"</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 bg-white text-rose-700 font-bold py-3 rounded-xl hover:bg-rose-50 transition-colors"
          >
            Acknowledge &amp; View Patient
          </button>
          <button onClick={onDismiss} className="px-4 py-3 bg-rose-700 hover:bg-rose-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

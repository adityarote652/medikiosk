import { CheckCircle2 } from 'lucide-react'

/**
 * StepIndicator - Multi-step progress bar for the patient kiosk wizard.
 */
export default function StepIndicator({ currentStep, labels }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const step = i + 1
        const done = step < currentStep
        const active = step === currentStep
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                  done ? 'bg-emerald-600 border-emerald-600 text-white'
                  : active ? 'bg-white border-emerald-600 text-emerald-600'
                  : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {done ? <CheckCircle2 className="w-5 h-5" /> : step}
              </div>
              <span className={`text-xs mt-1.5 font-medium hidden sm:block ${active || done ? 'text-emerald-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </div>
            {i < labels.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-18px] sm:mt-[-22px] transition-colors duration-300 ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

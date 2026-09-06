import { Link } from 'react-router-dom'
import { AlertTriangle, FileText } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* Header stripe matching enterprise nav */}
      <div className="bg-slate-900 h-1 w-full" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">

        {/* Icon */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-rose-50 border-2 border-rose-200 flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-rose-500" />
          </div>
          <span className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center border-2 border-white">
            404
          </span>
        </div>

        {/* Text */}
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">
          Page Not Found
        </h1>
        <p className="text-slate-500 text-sm max-w-sm mb-1 leading-relaxed">
          The requested clinical portal route could not be located on this node.
        </p>
        <p className="text-xs font-mono text-slate-400 mb-8 bg-slate-100 px-4 py-1.5 rounded-full inline-block border border-slate-200">
          ERR: ROUTE_NOT_REGISTERED - Node: OPD-01
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-xl text-sm transition-colors shadow-sm"
          >
            Return to Dashboard
          </Link>
          <Link
            to="/doctor"
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3 rounded-xl text-sm transition-colors border border-slate-200"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            Doctor Console
          </Link>
        </div>
      </div>

      {/* Footer strip */}
      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white">
        National Health Mission - Central OPD Intake Portal - Apex Civil Hospital
      </footer>
    </div>
  )
}

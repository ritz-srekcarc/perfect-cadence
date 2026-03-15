import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export function SeizureWarning({ onClose }: { onClose: (dontShowAgain: boolean) => void }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center gap-3 text-amber-400 mb-4">
          <AlertTriangle size={32} />
          <h2 className="text-xl font-bold">Photosensitivity Warning</h2>
        </div>
        <p className="text-zinc-300 mb-6 text-sm leading-relaxed">
          This experience contains flashing lights, strobing patterns, and other visual effects that may affect photosensitive individuals. Please proceed with caution.
        </p>
        <div className="flex items-center gap-2 mb-6">
          <input
            type="checkbox"
            id="dontShowAgain"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500"
          />
          <label htmlFor="dontShowAgain" className="text-xs text-zinc-400 cursor-pointer">
            Don't show this warning again
          </label>
        </div>
        <button
          onClick={() => onClose(dontShowAgain)}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}

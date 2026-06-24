import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDanger = true
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-slate-200"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${isDanger ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'}`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button 
                onClick={onClose}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight mb-2">
              {title}
            </h3>
            <p className="text-[11px] text-slate-500 leading-relaxed white-space-pre-wrap">
              {message}
            </p>
          </div>

          <div className="bg-slate-50 p-4 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-100 rounded transition-all"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-6 py-2 text-[10px] font-bold text-white uppercase tracking-widest rounded shadow-sm transition-all ${
                isDanger ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-200'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

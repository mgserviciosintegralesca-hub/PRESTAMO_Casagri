import React, { useState } from 'react';
import { Loan, LoanStatus, Currency, Worker } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatCurrency, cn } from '../lib/utils';
import { Landmark, Calendar, FileText, Upload, CheckCircle2, Search, AlertCircle, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  loans: Loan[];
  worker: Worker; // Current admin
}

export default function DisbursementManagement({ loans, worker }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [disbursementDate, setDisbursementDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);

  const pendingDisbursement = loans.filter(l => 
    l.status === LoanStatus.ACTIVE && !l.disbursementDate &&
    (l.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
     l.workerName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan || !reference) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // In a real app, we would upload the file to Firebase Storage
      // Here we will just simulate it by storing the filename
      const proofName = proofFile ? `COMPROBANTE_${reference}_${proofFile.name}` : `REF_${reference}`;

      await updateDoc(doc(db, 'loans', selectedLoan.id), {
        disbursementDate: new Date(disbursementDate).toISOString(),
        disbursementReference: reference,
        disbursementBy: worker.email,
        disbursementProofUrl: proofName,
        updatedAt: new Date().toISOString()
      });

      setSuccess('Abono registrado exitosamente.');
      setSelectedLoan(null);
      setReference('');
      setProofFile(null);
      
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error registering disbursement:', err);
      setError('Error al registrar el abono.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Landmark className="w-5 h-5 text-brand-600" />
              Registro de ABONO al trabajador
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Confirme la entrega de fondos a los trabajadores para préstamos aprobados.
            </p>
          </div>

          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Buscar por préstamo o trabajador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all uppercase"
            />
          </div>
        </div>
      </div>

      {success && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-3 text-xs font-bold"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>{success}</span>
        </motion.div>
      )}

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3 text-xs font-bold"
        >
          <AlertCircle className="w-4 h-4 text-red-500" />
          <span>{error}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending List */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Préstamos Pendientes por Abonar ({pendingDisbursement.length})</h3>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {pendingDisbursement.map(loan => (
              <button
                key={loan.id}
                onClick={() => {
                  setSelectedLoan(loan);
                  setReference('');
                  setProofFile(null);
                  setError(null);
                }}
                className={cn(
                  "w-full text-left p-4 rounded-lg border transition-all",
                  selectedLoan?.id === loan.id 
                    ? "bg-brand-50 border-brand-200 shadow-sm" 
                    : "bg-white border-slate-100 hover:border-brand-200 hover:bg-slate-50"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[9px] font-bold text-brand-600 font-mono">#{loan.loanNumber}</span>
                    <h4 className="text-xs font-bold text-slate-900 uppercase truncate max-w-[200px]">{loan.workerName}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold font-mono text-slate-900">{formatCurrency(loan.amountForeign, loan.currency)}</p>
                    <p className="text-[10px] font-bold text-slate-400">Total: {loan.totalInstallments} Meses</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Aprobado: {new Date(loan.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </button>
            ))}

            {pendingDisbursement.length === 0 && (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No hay abonos pendientes</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Detalles del Abono</h3>
          </div>
          
          {selectedLoan ? (
            <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
              <div className="p-4 bg-brand-50 rounded-lg border border-brand-100 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">Resumen del Préstamo</span>
                  <span className="text-[10px] font-mono text-brand-400">ID: {selectedLoan.id}</span>
                </div>
                <p className="text-sm font-bold text-slate-800 uppercase">{selectedLoan.workerName}</p>
                <p className="text-lg font-bold font-mono text-brand-700 mt-1">
                  {formatCurrency(selectedLoan.amountForeign, selectedLoan.currency)}
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fecha de Pago al Trabajador</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input 
                      type="date"
                      value={disbursementDate}
                      onChange={(e) => setDisbursementDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Número de Referencia / Comprobante</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input 
                      type="text"
                      placeholder="Ej: TRANS-992288"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Comprobante de Pago (Imagen/PDF)</label>
                  <div 
                    className={cn(
                      "relative border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center cursor-pointer",
                      proofFile ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200 hover:border-brand-300 hover:bg-white"
                    )}
                    onClick={() => document.getElementById('proof-upload')?.click()}
                  >
                    <input 
                      id="proof-upload"
                      type="file"
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    />
                    
                    {proofFile ? (
                      <>
                        <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-tight">{proofFile.name}</p>
                        <p className="text-[10px] text-emerald-500 mt-1 uppercase font-bold">Cambiar archivo</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-slate-300 mb-2" />
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Seleccionar o Arrastrar Archivo</p>
                        <p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">JPG, PNG o PDF (Máx 5MB)</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedLoan(null)}
                  className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reference}
                  className="flex-[2] py-3 bg-brand-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-brand-700 disabled:opacity-50 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Registrar Abono
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Landmark className="w-8 h-8 text-slate-300" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 uppercase mb-1">Seleccione un Préstamo</h4>
              <p className="text-xs text-slate-400 max-w-[200px]">Elija un préstamo de la lista de la izquierda para registrar su abono.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

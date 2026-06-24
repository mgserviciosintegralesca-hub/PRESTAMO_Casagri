import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { X, DollarSign, Calculator, Send, AlertCircle, User, ChevronDown, Loader2 } from 'lucide-react';
import { Worker, SystemSettings, Currency, LoanStatus, Loan, Motive, UserRole, RepaymentFrequency } from '../types';
import { collection, addDoc, getDocs, onSnapshot, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { formatCurrency, formatUSD, formatEUR, cn } from '../lib/utils';
import { createNotification } from '../lib/notifications';
import { NotificationType } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Props {
  worker: Worker;
  settings: SystemSettings | null;
  onClose: () => void;
}

export default function LoanForm({ worker: currentWorker, settings, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<Currency>(Currency.USD);
  const [displayName, setDisplayName] = useState(currentWorker.displayName || '');
  const [idNumber, setIdNumber] = useState(currentWorker.idNumber || '');
  const [department, setDepartment] = useState(currentWorker.department || '');
  const [determinationMode, setDeterminationMode] = useState<'months' | 'fixed_amount'>('months');
  const [installments, setInstallments] = useState('12');
  const [fixedInstallmentAmount, setFixedInstallmentAmount] = useState('');
  const [motiveId, setMotiveId] = useState('');
  const [subMotiveId, setSubMotiveId] = useState('');
  const [guarantee, setGuarantee] = useState('');
  const [creationDate, setCreationDate] = useState(new Date().toISOString().split('T')[0]);
  const [repaymentFrequency, setRepaymentFrequency] = useState<RepaymentFrequency>(RepaymentFrequency.MONTHLY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [motives, setMotives] = useState<Motive[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(currentWorker.uid);
  const [warningData, setWarningData] = useState<{
    count: number;
    totalUSD: number;
    balanceUSD: number;
    totalEUR: number;
    balanceEUR: number;
  } | null>(null);

  useEffect(() => {
    const worker = workers.find(w => w.uid === selectedWorkerId) || currentWorker;
    setDisplayName(worker.displayName || '');
    setIdNumber(worker.idNumber || '');
    setDepartment(worker.department || '');
  }, [selectedWorkerId, workers, currentWorker]);

  useEffect(() => {
    const unsubMotives = onSnapshot(collection(db, 'motives'), (snap) => {
      setMotives(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Motive)));
    });

    if (currentWorker.role === UserRole.ADMIN) {
      const unsubWorkers = onSnapshot(query(collection(db, 'workers'), orderBy('displayName')), (snap) => {
        setWorkers(snap.docs.map(doc => doc.data() as Worker));
      });
      return () => {
        unsubMotives();
        unsubWorkers();
      };
    }

    return unsubMotives;
  }, [currentWorker]);

  const selectedWorker = workers.find(w => w.uid === selectedWorkerId) || currentWorker;
  const currentMotive = motives.find(m => m.id === motiveId);

  const currentRate = currency === Currency.USD ? settings?.usdRate : settings?.eurRate;
  const amountNum = parseFloat(amount) || 0;
  const bsEquivalent = amountNum * (currentRate || 0);

  const executeSubmit = async () => {
    setLoading(true);
    try {
      // Update worker info if changed
      if (displayName !== selectedWorker.displayName || idNumber !== selectedWorker.idNumber || department !== selectedWorker.department) {
        await updateDoc(doc(db, 'workers', selectedWorker.uid), {
          displayName,
          idNumber,
          department,
        }).catch(err => console.error('Error updating worker profile:', err));
      }

      let totalInstallments = parseInt(installments);
      
      if (determinationMode === 'fixed_amount') {
        const fixedAmountNum = parseFloat(fixedInstallmentAmount);
        if (fixedAmountNum > 0 && amountNum > 0) {
          totalInstallments = Math.ceil(amountNum / fixedAmountNum);
        } else {
          throw new Error('El monto de la cuota fija debe ser mayor a cero.');
        }
      }

      const isoCreationDate = new Date(creationDate + 'T12:00:00').toISOString();

      const generateSequentialLoanNumber = async () => {
        try {
          const loansSnap = await getDocs(collection(db, 'loans'));
          let maxSequence = 0;
          
          loansSnap.forEach(doc => {
            const data = doc.data();
            const loanNum = data.loanNumber;
            if (loanNum && typeof loanNum === 'string' && loanNum.startsWith('CS-P')) {
              const numPart = loanNum.replace('CS-P', '');
              const parsed = parseInt(numPart, 10);
              if (!isNaN(parsed) && parsed > maxSequence) {
                maxSequence = parsed;
              }
            }
          });
          
          const nextSequence = maxSequence + 1;
          const paddedNum = String(nextSequence).padStart(6, '0');
          return `CS-P${paddedNum}`;
        } catch (err) {
          console.error('Error generating sequential loan number:', err);
          return 'CS-P000001';
        }
      };

      const autoLoanNumber = await generateSequentialLoanNumber();

      const newLoan: Omit<Loan, 'id'> = {
        loanNumber: autoLoanNumber,
        workerId: selectedWorker.uid,
        workerName: displayName,
        amountForeign: amountNum,
        currency,
        rateAtAgreement: currentRate || 0,
        motiveId: motiveId,
        subMotiveId: subMotiveId || null,
        status: LoanStatus.PENDING,
        totalInstallments: totalInstallments,
        repaymentFrequency: repaymentFrequency,
        remainingInstallments: totalInstallments,
        determinationMode: determinationMode,
        fixedInstallmentAmount: determinationMode === 'fixed_amount' ? parseFloat(fixedInstallmentAmount) : null,
        guaranteeInfo: guarantee,
        requestedBy: currentWorker.email,
        createdAt: isoCreationDate,
        updatedAt: new Date().toISOString()
      };

      const loanRef = await addDoc(collection(db, 'loans'), newLoan).catch(err => handleFirestoreError(err, OperationType.CREATE, 'loans'));

      // Notify Admins
      const adminQuery = query(collection(db, 'workers'), where('role', '==', UserRole.ADMIN));
      const adminDocs = await getDocs(adminQuery).catch(err => handleFirestoreError(err, OperationType.LIST, 'workers'));
      
      for (const adminDoc of adminDocs.docs) {
        await createNotification(
          adminDoc.id,
          'Nueva Solicitud de Préstamo',
          `El trabajador ${selectedWorker.displayName} ha solicitado un préstamo por ${formatCurrency(amountNum, currency)}.`,
          NotificationType.SYSTEM
        );
      }

      onClose();
    } catch (err) {
      console.error('Error creating loan:', err);
      setError('Error al enviar la solicitud. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !motiveId || !displayName || !idNumber || !department) {
      setError('Por favor completa todos los campos (Incluyendo Info del Trabajador).');
      return;
    }

    setLoading(true);
    try {
      // Check existing approved/active loans for warning
      const loansSnap = await getDocs(
        query(collection(db, 'loans'), where('workerId', '==', selectedWorker.uid))
      );
      const approvedLoans = loansSnap.docs
        .map(doc => doc.data() as Loan)
        .filter(l => l.status === LoanStatus.APPROVED || l.status === LoanStatus.ACTIVE);

      if (approvedLoans.length >= 2) {
        // Calculate amounts
        let totalUSD = 0;
        let balanceUSD = 0;
        let totalEUR = 0;
        let balanceEUR = 0;

        approvedLoans.forEach(l => {
          const amt = l.amountForeign || 0;
          const remaining = l.remainingInstallments || 0;
          const totalInst = l.totalInstallments || 1;
          const balance = remaining * (amt / totalInst);

          if (l.currency === Currency.USD) {
            totalUSD += amt;
            balanceUSD += balance;
          } else if (l.currency === Currency.EUR) {
            totalEUR += amt;
            balanceEUR += balance;
          }
        });

        setWarningData({
          count: approvedLoans.length,
          totalUSD,
          balanceUSD,
          totalEUR,
          balanceEUR
        });
        setLoading(false);
        return; // Stop submission to show warning modal
      }

      // No warning needed, proceed immediately
      await executeSubmit();
    } catch (err) {
      console.error('Error pre-checking active loans:', err);
      setError('Error al verificar el historial del trabajador. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white w-full max-w-xl rounded-lg shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh] border border-slate-300"
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
             <span className="dense-label !text-slate-800">Nueva_Solicitud_Indexada</span>
             <span className="text-[9px] px-1.5 py-0.5 bg-brand-600 text-white rounded font-bold uppercase tracking-widest">v.2.0</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded flex items-center gap-2 text-[11px] font-bold">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Worker Information Section */}
            <div className="space-y-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2 border-b border-slate-200 pb-2">
                <User className="w-4 h-4 text-brand-600" />
                <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Información del Solicitante</h3>
              </div>

              {/* Admin: Worker Selection */}
              {currentWorker.role === UserRole.ADMIN && (
                <div className="space-y-1.5">
                  <label className="dense-label block !text-slate-600">Vincular a Cuenta de Usuario</label>
                  <div className="relative">
                    <select 
                      value={selectedWorkerId}
                      onChange={(e) => setSelectedWorkerId(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded text-xs font-bold outline-none appearance-none"
                    >
                      {workers.map(w => (
                        <option key={w.uid} value={w.uid}>{w.displayName || w.email}</option>
                      ))}
                    </select>
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="dense-label block !text-slate-600">Número de Cédula / Código</label>
                  <input
                    type="text"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-xs font-bold outline-none uppercase"
                    placeholder="V-00000000"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="dense-label block !text-slate-600">Nombre y Apellido</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-xs font-bold outline-none uppercase"
                    placeholder="JUAN PEREZ"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="dense-label block !text-slate-600">Departamento / Unidad</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-xs font-bold outline-none uppercase"
                  placeholder="VENTAS / OPERACIONES / ADMINISTRACION"
                />
              </div>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Amount & Currency */}
            <div className="space-y-3">
              <label className="dense-label block !text-slate-600">Monto Operación</label>
              <div className="flex gap-px bg-slate-200 p-px rounded overflow-hidden">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white outline-none transition-all font-mono text-sm font-bold"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <select 
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="bg-slate-100 text-slate-700 px-3 py-2 font-bold text-xs outline-none hover:bg-slate-200 transition-colors"
                >
                  <option value={Currency.USD}>USD</option>
                  <option value={Currency.EUR}>EUR</option>
                </select>
              </div>
              
              <div className="bg-slate-900 p-3 rounded">
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 mb-1 uppercase tracking-widest">
                  <span>Equivalente_Estimado</span>
                  <span className="text-emerald-500 font-mono">Tasa: {currentRate || '---'}</span>
                </div>
                <p className="text-xl font-bold text-white font-mono tracking-tighter">
                  {formatCurrency(bsEquivalent, 'VES')}
                </p>
              </div>
            </div>

            {/* Installments & Motive */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center bg-slate-50 p-1 rounded-t border border-b-0 border-slate-200">
                  <button 
                    type="button"
                    onClick={() => setDeterminationMode('months')}
                    className={cn(
                      "flex-1 text-[9px] font-bold uppercase py-1 rounded transition-all",
                      determinationMode === 'months' ? "bg-white shadow-sm text-brand-600" : "text-slate-400 hover:text-slate-600"
                    )}
                  >Plazo (Meses)</button>
                  <button 
                    type="button"
                    onClick={() => setDeterminationMode('fixed_amount')}
                    className={cn(
                      "flex-1 text-[9px] font-bold uppercase py-1 rounded transition-all",
                      determinationMode === 'fixed_amount' ? "bg-white shadow-sm text-brand-600" : "text-slate-400 hover:text-slate-600"
                    )}
                  >Cuota Fija</button>
                </div>
                
                {determinationMode === 'months' ? (
                  <select 
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-b text-xs outline-none transition-all font-bold text-slate-700"
                  >
                    {[3, 6, 12, 18, 24, 36, 48, 60, 72, 84, 96, 108, 120].map(n => (
                      <option key={n} value={n}>{n} cuotas mensuales</option>
                    ))}
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={fixedInstallmentAmount}
                      onChange={(e) => setFixedInstallmentAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-b text-xs font-bold outline-none font-mono"
                      placeholder={`Monto en ${currency}...`}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <Calculator className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
                {determinationMode === 'fixed_amount' && parseFloat(fixedInstallmentAmount) > 0 && amountNum > 0 && (
                   <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter text-right">
                      Resultará en aprox. <span className="text-brand-600">{Math.ceil(amountNum / parseFloat(fixedInstallmentAmount))} pagos</span>
                   </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="dense-label block !text-slate-600">Categoría de Gasto</label>
                <select 
                  value={motiveId}
                  onChange={(e) => {
                    setMotiveId(e.target.value);
                    setSubMotiveId(''); // Reset sub-motive when motive changes
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none transition-all font-bold text-slate-700"
                >
                  <option value="">Selección obligatoria...</option>
                  {motives.map(m => (
                    <option key={m.id} value={m.id}>{m.name.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="dense-label block !text-slate-600">Frecuencia de Descuento</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setRepaymentFrequency(RepaymentFrequency.MONTHLY)}
                    className={cn(
                      "flex-1 py-2 rounded border text-[10px] font-bold uppercase transition-all",
                      repaymentFrequency === RepaymentFrequency.MONTHLY 
                        ? "bg-brand-50 border-brand-300 text-brand-700 shadow-sm" 
                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                    )}
                  >
                    Mensual
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRepaymentFrequency(RepaymentFrequency.BIWEEKLY)}
                    className={cn(
                      "flex-1 py-2 rounded border text-[10px] font-bold uppercase transition-all",
                      repaymentFrequency === RepaymentFrequency.BIWEEKLY 
                        ? "bg-brand-50 border-brand-300 text-brand-700 shadow-sm" 
                        : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
                    )}
                  >
                    Quincenal
                  </button>
                </div>
              </div>

              {currentMotive && currentMotive.subMotives && currentMotive.subMotives.length > 0 && (
                <div className="space-y-1.5">
                  <label className="dense-label block !text-slate-600">Sub-Tipo de Préstamo</label>
                  <select 
                    value={subMotiveId}
                    onChange={(e) => setSubMotiveId(e.target.value)}
                    className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded text-xs outline-none transition-all font-bold text-blue-700"
                  >
                    <option value="">Seleccione sub-tipo...</option>
                    {currentMotive.subMotives.map(sm => (
                      <option key={sm} value={sm}>{sm.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="dense-label block !text-slate-600">Información de Garantía</label>
            <textarea 
              value={guarantee}
              onChange={(e) => setGuarantee(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none transition-all min-h-[80px]"
              placeholder="Describa activos vinculados a este préstamo..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="dense-label block !text-slate-600">Fecha de Emisión</label>
              <div className="relative">
                 <input 
                   type="date"
                   value={creationDate}
                   onChange={(e) => setCreationDate(e.target.value)}
                   className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none uppercase"
                 />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
            >
              Regresar
            </button>
            <button 
              disabled={loading}
              className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Confirmar_Registro</span>
            </button>
          </div>
        </form>
      </motion.div>

      {warningData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setWarningData(null)}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-md rounded-lg shadow-2xl relative z-[70] overflow-hidden border border-amber-200"
          >
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-4 border border-amber-200">
                <AlertCircle className="w-6 h-6" />
              </div>
              
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight mb-2">
                Alerta de Límite de Préstamos Aprobados
              </h3>
              
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                El trabajador <strong className="text-slate-800 uppercase">{displayName}</strong> ya posee <strong className="text-brand-600">{warningData.count}</strong> préstamos aprobados o activos.
              </p>

              <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 mb-6 text-left">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wide">Límite Sugerido</span>
                  <span className="font-mono font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded text-[10px]">Hasta 2 préstamos</span>
                </div>
                
                <div className="border-t border-slate-200/60 pt-2 space-y-2">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Resumen de Préstamos Existentes:</p>
                  
                  {/* USD metrics if exist */}
                  {(warningData.totalUSD > 0 || warningData.balanceUSD > 0) && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-[10px] font-bold text-slate-600">Monto Total de Préstamos (USD)</span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {formatCurrency(warningData.totalUSD, Currency.USD)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-[10px] font-bold text-slate-600">Suma de Saldo Pendiente (USD)</span>
                        <span className="font-mono font-bold text-brand-600 text-xs">
                          {formatCurrency(warningData.balanceUSD, Currency.USD)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* EUR metrics if exist */}
                  {(warningData.totalEUR > 0 || warningData.balanceEUR > 0) && (
                    <div className="space-y-1 border-t border-slate-100 mt-2 pt-2">
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-[10px] font-bold text-slate-600">Monto Total de Préstamos (EUR)</span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {formatCurrency(warningData.totalEUR, Currency.EUR)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-0.5">
                        <span className="text-[10px] font-bold text-slate-600">Suma de Saldo Pendiente (EUR)</span>
                        <span className="font-mono font-bold text-brand-600 text-xs">
                          {formatCurrency(warningData.balanceEUR, Currency.EUR)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide text-center leading-normal max-w-xs mb-4">
                ¿¿Desea continuar con esta nueva solicitud??
              </p>
              
              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setWarningData(null)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    setWarningData(null);
                    await executeSubmit();
                  }}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
                >
                  Aceptar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

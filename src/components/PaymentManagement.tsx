import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loan, LoanStatus, Currency, NotificationType, PaymentMethod, Worker } from '../types';
import { CreditCard, DollarSign, Landmark, Save, AlertCircle, CheckCircle2, Wallet, Banknote, UserCheck, Trash2, Clock, Receipt, Coins } from 'lucide-react';
import { formatUSD, formatEUR, formatCurrency, cn, getNextInstallmentAmount } from '../lib/utils';
import { createNotification } from '../lib/notifications';
import { deleteDoc, limit, orderBy } from 'firebase/firestore';

interface Props {
  worker: Worker;
}

export default function PaymentManagement({ worker }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [inputCurrency, setInputCurrency] = useState<'bs' | 'usd' | 'eur' | 'usdt'>('bs');
  const [selectedRateType, setSelectedRateType] = useState<'usd' | 'eur' | 'usdt'>('usd');

  // Mixed Payment Support
  const [isMixed, setIsMixed] = useState(false);
  const [amountBs, setAmountBs] = useState('');
  const [amountUsd, setAmountUsd] = useState('');
  const [amountEur, setAmountEur] = useState('');

  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.BANK_TRANSFER);
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'loans'), where('status', '==', LoanStatus.ACTIVE));
    const unsub = onSnapshot(q, (snap) => {
      setLoans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });

    let unsubPayments: any;
    if (selectedLoanId) {
      setLoadingPayments(true);
      const qPay = query(collection(db, 'loans', selectedLoanId, 'payments'), orderBy('paymentDate', 'desc'), limit(5));
      unsubPayments = onSnapshot(qPay, (snap) => {
        setRecentPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoadingPayments(false);
      });
    } else {
      setRecentPayments([]);
    }

    return () => {
      unsub();
      unsubSettings();
      if (unsubPayments) unsubPayments();
    };
  }, [selectedLoanId]);

  const deletePayment = async (loanId: string, paymentId: string) => {
    if (!confirm('¿Eliminar este registro de pago?')) return;
    try {
      await deleteDoc(doc(db, 'loans', loanId, 'payments', paymentId));
      alert('Pago eliminado.');
      // Need to adjust loan balance manually if needed
    } catch (err) {
      console.error(err);
    }
  };

  const selectedLoan = loans.find(l => l.id === selectedLoanId);

  useEffect(() => {
    if (selectedLoan) {
      if (selectedLoan.currency === Currency.EUR) {
        setSelectedRateType('eur');
      } else {
        setSelectedRateType('usd');
      }
    }
  }, [selectedLoanId, loans]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    if (isMixed) {
      if (!amountBs && !amountUsd && !amountEur) {
        setMessage('Error: Debe ingresar al menos un monto');
        return;
      }
    } else {
      if (!amountInput) return;
    }

    setLoading(true);
    setMessage('');

    try {
      const usdRate = settings?.usdRate || 0;
      const eurRate = settings?.eurRate || 0;
      const usdtRate = settings?.usdtRate || usdRate || 0;

      if (usdRate === 0 || eurRate === 0) throw new Error('No se encontraron las tasas de cambio actuales');

      const loanRate = selectedLoan.currency === Currency.USD ? usdRate : eurRate;
      
      let finalAmountBs = 0;
      let finalAmountForeign = 0;
      let mixedBreakdown: any = null;
      let appliedRate = loanRate;

      if (selectedRateType === 'usd') {
        appliedRate = usdRate;
      } else if (selectedRateType === 'eur') {
        appliedRate = eurRate;
      } else if (selectedRateType === 'usdt') {
        appliedRate = usdtRate;
      }

      if (isMixed) {
        const b = parseFloat(amountBs || '0');
        const u = parseFloat(amountUsd || '0');
        const eVal = parseFloat(amountEur || '0');

        finalAmountBs = b + (u * usdRate) + (eVal * eurRate);
        finalAmountForeign = finalAmountBs / loanRate;
        mixedBreakdown = { bs: b, usd: u, eur: eVal };
      } else {
        const val = parseFloat(amountInput);
        if (inputCurrency === 'bs') {
          finalAmountBs = val;
          finalAmountForeign = val / appliedRate;
        } else if (inputCurrency === 'usd') {
          finalAmountBs = val * usdRate;
          finalAmountForeign = finalAmountBs / loanRate;
        } else if (inputCurrency === 'eur') {
          finalAmountBs = val * eurRate;
          finalAmountForeign = finalAmountBs / loanRate;
        } else if (inputCurrency === 'usdt') {
          finalAmountBs = val * usdtRate;
          finalAmountForeign = finalAmountBs / loanRate;
        }
      }

      // Convert selected date to ISO string
      const isoPaymentDate = new Date(paymentDate + 'T12:00:00').toISOString();

      // 1. Record payment
      await addDoc(collection(db, 'loans', selectedLoanId, 'payments'), {
        loanId: selectedLoanId,
        workerId: selectedLoan.workerId,
        amountBs: finalAmountBs,
        amountForeign: finalAmountForeign,
        rateApplied: appliedRate,
        method: isMixed ? PaymentMethod.MIXED : method,
        paymentDate: isoPaymentDate,
        referenceNumber: reference,
        status: 'confirmed',
        registeredBy: worker.email,
        mixedBreakdown
      });

      // 2. Update loan remaining installments
      const newRemaining = Math.max(0, selectedLoan.remainingInstallments - 1);
      const newStatus = newRemaining === 0 ? LoanStatus.COMPLETED : selectedLoan.status;

      // Find the first index that was pending and mark it
      const currentSchedule = selectedLoan.repaymentSchedule || [];
      const firstPendingIndex = currentSchedule.findIndex(i => i.status === 'pending');
      
      const updateData: any = {
        remainingInstallments: newRemaining,
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      if (firstPendingIndex !== -1) {
        const finalSchedule = currentSchedule.map((inst, idx) => 
          idx === firstPendingIndex ? { ...inst, status: 'paid' as const } : inst
        );
        updateData.repaymentSchedule = finalSchedule;
      }

      // Clean undefined values before updating Firestore
      const cleanData = JSON.parse(JSON.stringify(updateData));
      await updateDoc(doc(db, 'loans', selectedLoanId), cleanData);

      // 3. Notify Worker
      const notifyAmount = isMixed 
        ? `${finalAmountBs.toLocaleString()} BS (MIXTO)`
        : `${parseFloat(amountInput).toLocaleString()} ${inputCurrency.toUpperCase()}`;

      await createNotification(
        selectedLoan.workerId,
        'Pago Confirmado',
        `Se ha registrado con éxito su pago por ${notifyAmount} vía ${isMixed ? 'PAGO MIXTO' : method.replace('_', ' ').toUpperCase()} (REF: ${reference || 'N/A'}). Su saldo de cuotas ha sido actualizado.`,
        NotificationType.PAYMENT_CONFIRMED
      );

      setMessage('Pago registrado y notificado correctamente');
      setAmountInput('');
      setAmountBs('');
      setAmountUsd('');
      setAmountEur('');
      setReference('');
      setSelectedLoanId('');
      setIsMixed(false);
      setTimeout(() => setMessage(''), 3000);

    } catch (error: any) {
      console.error('Error recording payment:', error);
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMethodIcon = (m: PaymentMethod) => {
    switch (m) {
      case PaymentMethod.CASH_BS:
      case PaymentMethod.CASH_USD: return <Banknote className="w-4 h-4" />;
      case PaymentMethod.PAYROLL_DEDUCTION: return <UserCheck className="w-4 h-4" />;
      case PaymentMethod.MOBILE_PAYMENT: return <Wallet className="w-4 h-4" />;
      case PaymentMethod.USDT: return <Coins className="w-4 h-4 text-amber-500" />;
      default: return <Landmark className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="dense-card p-6 bg-white">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="w-4 h-4 text-slate-400" />
          <h3 className="dense-label !text-slate-800">Registrar Pago de Cuota</h3>
        </div>

        <form onSubmit={handleRecordPayment} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="dense-label block !text-slate-600">Seleccionar Préstamo Activo</label>
              <select 
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs outline-none transition-all font-bold text-slate-700"
              >
                <option value="">Seleccione un préstamo...</option>
                {loans.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.workerName} - {l.currency} {l.amountForeign} (ID: {l.id.slice(-6).toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {selectedLoan && (
              <div className="p-4 bg-slate-900 rounded border border-slate-700 text-white space-y-2">
                 <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span>Monto de la Cuota</span>
                    <span>Progreso: {selectedLoan.totalInstallments - selectedLoan.remainingInstallments}/{selectedLoan.totalInstallments}</span>
                 </div>
                 <p className="text-xl font-bold font-mono">
                    {formatCurrency(getNextInstallmentAmount(selectedLoan), selectedLoan.currency)}
                 </p>
                 <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                    <span>Equiv. Bs. HOY</span>
                    <span className="text-brand-400">
                        Bs. {(getNextInstallmentAmount(selectedLoan) * (selectedLoan.currency === Currency.USD ? settings?.usdRate || 36.5 : settings?.eurRate || 39.2)).toLocaleString()} 
                        <span className="ml-1 opacity-50 text-[7px]">(Tasa Ref)</span>
                    </span>
                 </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="dense-label block !text-slate-600">Método de Pago</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: PaymentMethod.BANK_TRANSFER, label: 'Transf. Bancaria' },
                  { id: PaymentMethod.MOBILE_PAYMENT, label: 'Pago Móvil' },
                  { id: PaymentMethod.CASH_BS, label: 'Efectivo Bs.' },
                  { id: PaymentMethod.CASH_USD, label: 'Efectivo USD' },
                  { id: PaymentMethod.PAYROLL_DEDUCTION, label: 'Dcto. Nómina' },
                  { id: PaymentMethod.USDT, label: 'USDT Cripto' }
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded text-[10px] font-bold border transition-all text-left uppercase tracking-tighter",
                      method === m.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                    )}
                  >
                    {getMethodIcon(m.id)}
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
               <div className="flex justify-between items-end">
                <label className="dense-label block !text-slate-600">Configuración del Monto</label>
                <button 
                  type="button"
                  onClick={() => setIsMixed(!isMixed)}
                  className={cn(
                    "px-3 py-1 rounded text-[8px] font-bold uppercase tracking-widest border transition-all",
                    isMixed ? "bg-brand-500 text-white border-brand-500 shadow-sm" : "bg-white text-slate-400 border-slate-200 hover:text-slate-600"
                  )}
                >
                  {isMixed ? "Desactivar Mixto" : "Activar Pago Mixto"}
                </button>
               </div>

              {isMixed ? (
                <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={amountBs}
                        onChange={(e) => setAmountBs(e.target.value)}
                        className="w-full pl-12 pr-3 py-2 bg-white border border-slate-200 rounded text-sm font-bold font-mono outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="0.00"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[9px] uppercase">BS</div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={amountUsd}
                        onChange={(e) => setAmountUsd(e.target.value)}
                        className="w-full pl-12 pr-3 py-2 bg-white border border-slate-200 rounded text-sm font-bold font-mono outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="0.00"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[9px] uppercase">USD</div>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={amountEur}
                        onChange={(e) => setAmountEur(e.target.value)}
                        className="w-full pl-12 pr-3 py-2 bg-white border border-slate-200 rounded text-sm font-bold font-mono outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="0.00"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[9px] uppercase">EUR</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-[9px] font-bold text-slate-500 uppercase flex justify-between">
                      Subtotal Estimado (Bs.):
                      <span className="text-brand-600 font-mono">
                        {(parseFloat(amountBs || '0') + (parseFloat(amountUsd || '0') * (settings?.usdRate || 0)) + (parseFloat(amountEur || '0') * (settings?.eurRate || 0))).toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-bold text-slate-400 uppercase">Moneda Única</span>
                    <div className="flex bg-slate-100 p-0.5 rounded gap-0.5">
                        {['bs', 'usd', 'eur', 'usdt'].map(curr => (
                          <button 
                              key={curr}
                              type="button" 
                              onClick={() => setInputCurrency(curr as any)}
                              className={cn("px-2 py-1 text-[9px] font-bold rounded transition-all uppercase", inputCurrency === curr ? "bg-white shadow-sm text-brand-600" : "text-slate-400 hover:text-slate-600")}
                          >{curr}</button>
                        ))}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required={!isMixed}
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      className="w-full pl-12 pr-3 py-3 bg-slate-50 border border-slate-200 rounded text-base font-bold font-mono outline-none focus:ring-1 focus:ring-brand-500"
                      placeholder="0.00"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase">
                        {inputCurrency}
                    </div>
                  </div>

                  {inputCurrency === 'bs' && (
                    <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-brand-500" />
                          Tasa Usada para el Cálculo (Seleccione)
                        </label>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'usd', label: 'BCV USD', rate: settings?.usdRate || 0 },
                          { id: 'eur', label: 'BCV EUR', rate: settings?.eurRate || 0 },
                          { id: 'usdt', label: 'USDT Cripto', rate: settings?.usdtRate || (settings?.usdRate || 0) }
                        ].map((option) => {
                          const isSelected = selectedRateType === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setSelectedRateType(option.id as 'usd' | 'eur' | 'usdt')}
                              className={cn(
                                "flex flex-col items-center justify-center p-2.5 rounded border transition-all text-center",
                                isSelected 
                                  ? "bg-brand-50 border-brand-500 text-brand-700 ring-2 ring-brand-500/20 shadow-sm font-bold"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                              )}
                            >
                              <span className="text-[8px] font-bold uppercase tracking-wider block mb-0.5">
                                {option.label}
                              </span>
                              <span className="font-mono text-[10px] font-bold">
                                {option.rate ? `Bs. ${option.rate.toFixed(2)}` : '---'}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      <p className="text-[8.5px] text-slate-400 tracking-tighter uppercase font-medium text-center mt-1 pb-1">
                        * Seleccione la tasa de cambio de amortización para el préstamo indexado.
                      </p>

                      {amountInput && parseFloat(amountInput) > 0 && (
                        <div className="mt-3 p-3 bg-emerald-50/80 border border-emerald-100 rounded-lg space-y-2">
                          <div className="flex justify-between items-center pb-1.5 border-b border-emerald-100">
                            <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest">
                              Simulación de Amortización
                            </span>
                            <span className="bg-emerald-600 text-white text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full">
                              Detalle del Descuento
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">Monto Recibido</p>
                              <p className="text-sm font-mono font-bold text-emerald-900">
                                Bs. {parseFloat(amountInput).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">
                                Amortiza al Préstamo {selectedLoan?.currency ? `(${selectedLoan.currency})` : ''}
                              </p>
                              <p className="text-sm font-mono font-black text-emerald-950">
                                {selectedLoan?.currency || 'USD'} {((parseFloat(amountInput) / (
                                  selectedRateType === 'usd' ? (settings?.usdRate || 1) :
                                  selectedRateType === 'eur' ? (settings?.eurRate || 1) :
                                  (settings?.usdtRate || settings?.usdRate || 1)
                                ))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>

                          <div className="text-[8.5px] font-mono font-bold text-emerald-700 uppercase tracking-wide bg-white/75 p-1.5 rounded border border-emerald-100 flex justify-between items-center">
                            <span>Tasa de Cambio Seleccionada:</span>
                            <span>
                              1 {selectedRateType.toUpperCase()} = Bs. {(
                                selectedRateType === 'usd' ? (settings?.usdRate || 0) :
                                selectedRateType === 'eur' ? (settings?.eurRate || 0) :
                                (settings?.usdtRate || settings?.usdRate || 0)
                              ).toFixed(4)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="dense-label block !text-slate-600">Referencia / Comprobante</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Ejem: 7283491 o Efectivo"
              />
            </div>

            <div className="space-y-1.5">
              <label className="dense-label block !text-slate-600">Fecha del Pago</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-bold outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {message && (
              <div className={cn(
                "p-3 rounded text-[10px] font-bold flex items-center gap-2",
                message.includes('Error') ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
              )}>
                {message.includes('Error') ? <AlertCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span className="uppercase tracking-widest">{message}</span>
              </div>
            )}

            <div className="pt-2">
                <button
                type="submit"
                disabled={loading || !selectedLoanId}
                className="w-full bg-brand-600 text-white px-6 py-3 rounded text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-brand-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-brand-500/20"
                >
                <Save className="w-4 h-4" />
                Registrar y Notificar Cobro
                </button>
                <p className="text-[9px] text-slate-400 text-center mt-3 uppercase tracking-tighter">
                    El trabajador recibirá una notificación instantánea de este cobro
                </p>
            </div>
          </div>
        </form>

        {selectedLoan && (
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-2 text-slate-400">
               <Clock className="w-3.5 h-3.5" />
               <h4 className="text-[10px] font-bold uppercase tracking-widest">Últimos Pagos de este Préstamo</h4>
            </div>
            
            {loadingPayments ? (
               <div className="py-8 text-center">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
               </div>
            ) : recentPayments.length === 0 ? (
               <div className="py-8 text-center border border-dashed border-slate-200 rounded text-[9px] font-bold text-slate-400 uppercase">
                  No hay pagos registrados para este préstamo
               </div>
            ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recentPayments.map(p => (
                     <div key={p.id} className="bg-slate-50 border border-slate-100 p-3 rounded flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                           <Receipt className="w-4 h-4 text-emerald-500" />
                           <div>
                              <p className="text-[10px] font-bold text-slate-800 uppercase tracking-tighter">REF: {p.referenceNumber || 'N/A'}</p>
                              <p className="text-[8px] text-slate-400 font-bold uppercase">{new Date(p.paymentDate).toLocaleDateString()}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="text-right">
                              <p className="text-[10px] font-bold text-emerald-600 font-mono">{formatCurrency(p.amountForeign, selectedLoan.currency)}</p>
                              <p className="text-[7px] text-slate-400 font-bold uppercase tracking-tighter">Bs. {p.amountBs.toLocaleString()}</p>
                           </div>
                            <button 
                              onClick={() => deletePayment(selectedLoanId, p.id)}
                              className="p-1 px-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Worker, SystemSettings, Loan, LoanStatus, Currency, Payment } from '../types';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PlusCircle, Wallet, History, FileText, CheckCircle2, Clock, AlertCircle, ArrowDownRight, ChevronDown, ChevronUp, Receipt, Calendar, Loader2 } from 'lucide-react';
import { cn, formatUSD, formatEUR, formatCurrency, getNextInstallmentAmount, getLoanRemainingBalance } from '../lib/utils';
import ExchangeRateWidget from './ExchangeRateWidget';
import LoanForm from './LoanForm';
import { motion, AnimatePresence } from 'motion/react';
import { checkUpcomingPayments } from '../lib/notifications';

interface Props {
  worker: Worker;
  settings: SystemSettings | null;
}

export default function Dashboard({ worker, settings }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [showLoanForm, setShowLoanForm] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'loans'),
      where('workerId', '==', worker.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loanData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
      setLoans(loanData);
      
      // Check for upcoming payments when loans update
      if (loanData.length > 0) {
        checkUpcomingPayments(worker.uid, loanData);
      }
    });

    return () => unsubscribe();
  }, [worker.uid]);

  const activeLoans = loans.filter(l => [LoanStatus.ACTIVE, LoanStatus.APPROVED, LoanStatus.PENDING].includes(l.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Panel de Control</h2>
          <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">Visión General del Trabajador</p>
        </div>
        <button 
          onClick={() => setShowLoanForm(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-1.5 rounded text-xs font-bold transition-all shadow-sm flex items-center gap-2"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>NUEVA SOLICITUD</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Summary Stats */}
        <div className="dense-card p-4 flex flex-col justify-between">
          <span className="dense-label">Deuda Pendiente (USD)</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-display text-slate-800">
              {formatUSD(activeLoans.reduce((acc, curr) => acc + (curr.currency === Currency.USD ? curr.amountForeign : 0), 0))}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1">
             <div className="w-1 h-1 rounded-full bg-blue-500"></div>
             <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Liquidación_Actualizada</span>
          </div>
        </div>

        <div className="dense-card p-4 flex flex-col justify-between">
          <span className="dense-label">Próximo Descuento</span>
          <div className="mt-2 text-2xl font-bold font-display text-brand-600">
            {formatUSD(activeLoans.reduce((acc, curr) => acc + getNextInstallmentAmount(curr), 0))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Estimado a tasa BCV</p>
        </div>

        <div className="dense-card p-4 flex flex-col justify-between">
          <span className="dense-label">Cuotas Pendientes</span>
          <div className="mt-2 text-2xl font-bold font-display text-slate-800">
            {activeLoans.reduce((acc, curr) => acc + curr.remainingInstallments, 0)}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 font-medium">Transacciones activas</p>
        </div>

        <div className="lg:block">
           <ExchangeRateWidget settings={settings} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Historial de Operaciones</h3>
            <div className="flex gap-2">
               <button className="p-1 text-slate-400 hover:text-slate-600"><FileText className="w-4 h-4" /></button>
            </div>
          </div>

          {loans.length === 0 ? (
            <div className="dense-card p-12 text-center text-slate-400 border-dashed">
              Aún no tienes préstamos registrados.
            </div>
          ) : (
            <div className="space-y-1">
              {loans.map(loan => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="dense-card flex flex-col">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
               <span className="dense-label">Normativas del Sistema</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                 <div className="w-4 h-4 rounded bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                 </div>
                 <p className="text-[11px] text-slate-600 leading-snug">
                    Cuotas indexadas a tasa BCV diaria según convenio laboral vigente.
                 </p>
              </div>
              <div className="flex gap-3">
                 <div className="w-4 h-4 rounded bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3 h-3" />
                 </div>
                 <p className="text-[11px] text-slate-600 leading-snug">
                    Descuento automático vía nómina quincenal o mensual.
                 </p>
              </div>
            </div>
          </div>

          <div className="dense-card p-4 bg-slate-900 text-white">
             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Asistencia_Técnica</span>
             <p className="text-[10px] mt-2 text-slate-300">Si detecta discrepancias en su saldo, contacte a RRHH o soporte técnico.</p>
             <button className="mt-4 w-full py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-[9px] font-bold transition-all uppercase tracking-widest">Abrir Ticket</button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showLoanForm && (
          <LoanForm 
            worker={worker} 
            settings={settings} 
            onClose={() => setShowLoanForm(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface LoanCardProps {
  loan: Loan;
}

const LoanCard: React.FC<LoanCardProps> = ({ loan }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isExpanded && payments.length === 0) {
      setLoading(true);
      const fetchPayments = async () => {
        try {
          const q = query(
            collection(db, 'loans', loan.id, 'payments'),
            orderBy('paymentDate', 'desc')
          );
          const snap = await getDocs(q);
          setPayments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment)));
        } catch (error) {
          console.error("Error fetching payments:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchPayments();
    }
  }, [isExpanded, loan.id]);

  const statusConfig = {
    [LoanStatus.PENDING]: { color: "bg-amber-100 text-amber-700", icon: Clock },
    [LoanStatus.APPROVED]: { color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
    [LoanStatus.ACTIVE]: { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    [LoanStatus.REJECTED]: { color: "bg-red-100 text-red-700", icon: AlertCircle },
    [LoanStatus.COMPLETED]: { color: "bg-slate-100 text-slate-700", icon: CheckCircle2 },
  };

  const { color, icon: StatusIcon } = statusConfig[loan.status];

  return (
    <div className="bg-white border border-slate-200 hover:border-slate-300 transition-all overflow-hidden rounded-sm mb-2 group">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className={cn("w-8 h-8 rounded flex items-center justify-center shrink-0", color)}>
            <StatusIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-slate-800">
                {loan.currency === Currency.USD ? formatUSD(loan.amountForeign) : formatEUR(loan.amountForeign)}
              </span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                ID: {loan.id.slice(-6).toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
                <p className="text-[10px] text-slate-500 font-medium">
                Solicitado: {new Date(loan.createdAt).toLocaleDateString()} • {loan.totalInstallments} meses
                </p>
                <div className="h-3 w-[1px] bg-slate-200"></div>
                <p className="text-[10px] font-bold text-brand-600 uppercase tracking-tighter">
                   Saldo: {formatCurrency(getLoanRemainingBalance(loan), loan.currency)}
                </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
             <div className="dense-label !text-slate-300">Progreso</div>
             <div className="text-[11px] font-bold text-slate-600">{loan.totalInstallments - loan.remainingInstallments} / {loan.totalInstallments}</div>
          </div>
          <div className="h-8 w-[1px] bg-slate-100 hidden sm:block"></div>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 bg-slate-50/30 overflow-hidden"
          >
            <div className="p-4 space-y-4">
               <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <History className="w-3 h-3" />
                    Historial de Pagos
                  </h4>
                  <div className="text-[9px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm uppercase tracking-tighter">
                    Tasa Inicial: {loan.rateAtAgreement} BS/{loan.currency}
                  </div>
               </div>

               <div className="space-y-2">
                  {loading ? (
                    <div className="py-8 text-center">
                       <Loader2 className="w-4 h-4 animate-spin text-brand-500 mx-auto" />
                       <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">Cargando pagos...</p>
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="py-6 text-center border border-dashed border-slate-200 rounded">
                       <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">No hay pagos registrados aún</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                       {payments.map((p) => (
                         <div key={p.id} className="bg-white p-3 rounded border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <div className="flex items-center gap-3">
                               <div className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center shrink-0">
                                  <Receipt className="w-3.5 h-3.5" />
                               </div>
                               <div>
                                  <p className="text-[11px] font-bold text-slate-800">
                                     PAGO_REF: {p.referenceNumber || 'N/A'}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                     <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter flex items-center gap-1">
                                        <Calendar className="w-2.5 h-2.5" />
                                        {new Date(p.paymentDate).toLocaleDateString()}
                                     </span>
                                     <span className="text-[9px] font-bold px-1.5 py-0.25 bg-slate-100 text-slate-500 rounded uppercase tracking-tighter">
                                        {p.method?.replace('_', ' ')}
                                     </span>
                                  </div>
                               </div>
                            </div>

                            <div className="flex sm:flex-col items-end gap-2 sm:gap-0 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                               <p className="text-[12px] font-bold text-emerald-600 font-mono">
                                  {formatCurrency(p.amountForeign, loan.currency)}
                               </p>
                               <div className="flex items-center gap-1.5">
                                  <p className="text-[9px] font-bold text-slate-400 line-through">
                                     Bs. {(p.amountForeign * loan.rateAtAgreement).toLocaleString()}
                                  </p>
                                  <ArrowDownRight className="w-2 h-2 text-slate-300" />
                                  <p className="text-[9px] font-bold text-slate-500">
                                     Bs. {p.amountBs.toLocaleString()}
                                  </p>
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
               </div>

               {loan.repaymentSchedule && (
                  <div className="mt-6">
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                        <Clock className="w-3 h-3" />
                        Plan de Cuotas
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {loan.repaymentSchedule.map((inst, idx) => (
                          <div 
                            key={idx} 
                            className={cn(
                                "p-2 rounded border text-center transition-all",
                                inst.status === 'paid' 
                                    ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                                    : "bg-white border-slate-100 text-slate-400"
                            )}
                          >
                            <p className="text-[8px] font-bold uppercase tracking-tighter opacity-70">CUOTA #{inst.installmentNumber}</p>
                            <p className="text-[10px] font-bold mt-0.5">{new Date(inst.dueDate).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}</p>
                            <div className="mt-1 flex justify-center">
                                {inst.status === 'paid' ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5 opacity-30" />}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



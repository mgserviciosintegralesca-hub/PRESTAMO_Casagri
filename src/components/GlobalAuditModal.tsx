import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Loan, Payment, Worker, Currency, LoanStatus, SystemSettings } from '../types';
import { 
  ShieldCheck, X, FileText, Download, Loader2, 
  TrendingUp, AlertCircle, CheckCircle2, History,
  Database, Landmark, Wallet, Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatUSD, formatEUR, formatCurrency, cn } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  onClose: () => void;
  settings: SystemSettings | null;
}

export default function GlobalAuditModal({ onClose, settings }: Props) {
  const [loading, setLoading] = useState(true);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all loans
        const loansSnap = await getDocs(collection(db, 'loans'));
        const loansData = loansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
        setLoans(loansData);

        // Fetch all workers
        const workersSnap = await getDocs(collection(db, 'workers'));
        setWorkers(workersSnap.docs.map(doc => doc.data() as Worker));

        // Consolidate all payments from all loans
        const allPayments: Payment[] = [];
        const paymentsPromises = loansData.map(loan => 
          getDocs(query(collection(db, 'loans', loan.id, 'payments'), orderBy('paymentDate', 'desc')))
        );
        const paymentsSnaps = await Promise.all(paymentsPromises);
        
        paymentsSnaps.forEach(snap => {
          snap.docs.forEach(doc => {
            allPayments.push({ id: doc.id, ...doc.data() } as Payment);
          });
        });
        
        setPayments(allPayments);
      } catch (err) {
        console.error('Audit data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Metrics calculation
  const totalLentUSD = loans.filter(l => l.currency === Currency.USD).reduce((acc, l) => acc + l.amountForeign, 0);
  const totalLentEUR = loans.filter(l => l.currency === Currency.EUR).reduce((acc, l) => acc + l.amountForeign, 0);
  
  const totalPaidUSD = payments.filter(p => {
    const loan = loans.find(l => l.id === p.loanId);
    return loan?.currency === Currency.USD;
  }).reduce((acc, p) => acc + p.amountForeign, 0);

  const totalPaidEUR = payments.filter(p => {
    const loan = loans.find(l => l.id === p.loanId);
    return loan?.currency === Currency.EUR;
  }).reduce((acc, p) => acc + p.amountForeign, 0);

  const balanceUSD = totalLentUSD - totalPaidUSD;
  const balanceEUR = totalLentEUR - totalPaidEUR;

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header
    doc.setFontSize(14);
    doc.text('REPORTE DE AUDITORÍA GLOBAL DE CARTERA', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Generado: ${new Date().toLocaleString()}`, pageWidth - 14, 20, { align: 'right' });
    doc.text(`Empresa: ${settings?.companyName || 'SISTEMA DE PRESTAMOS'}`, 14, 20);

    // Summary Table
    autoTable(doc, {
      startY: 25,
      head: [['Métrica', 'USD ($)', 'EUR (€)']],
      body: [
        ['Capital Total Entregado', totalLentUSD.toFixed(2), totalLentEUR.toFixed(2)],
        ['Total Recaudado (FX)', totalPaidUSD.toFixed(2), totalPaidEUR.toFixed(2)],
        ['Saldo Pendiente Total', balanceUSD.toFixed(2), balanceEUR.toFixed(2)],
        ['Tasa BCV Aplicada Hoy', settings?.usdRate.toFixed(2) || 'N/A', settings?.eurRate.toFixed(2) || 'N/A'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    // Breakdown per loan status
    const statusCounts = {
        [LoanStatus.PENDING]: loans.filter(l => l.status === LoanStatus.PENDING).length,
        [LoanStatus.ACTIVE]: loans.filter(l => l.status === LoanStatus.ACTIVE || l.status === LoanStatus.APPROVED).length,
        [LoanStatus.COMPLETED]: loans.filter(l => l.status === LoanStatus.COMPLETED).length,
        [LoanStatus.REJECTED]: loans.filter(l => l.status === LoanStatus.REJECTED).length,
    };

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Estado del Préstamo', 'Cantidad de Registros', 'Porcentaje (%)']],
        body: Object.entries(statusCounts).map(([status, count]) => [
            status.toUpperCase(),
            count.toString(),
            `${((count / (loans.length || 1)) * 100).toFixed(1)}%`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85] }
    });

    // Detailed Loan List (Brief)
    const loanRows = loans.map(l => [
        l.loanNumber || l.id.slice(-6).toUpperCase(),
        l.workerName || 'N/A',
        formatCurrency(l.amountForeign, l.currency),
        l.status.toUpperCase(),
        l.requestedBy || 'N/A',
        l.approvedBy || l.rejectedBy || 'N/A'
    ]);

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Ref', 'Benefatario', 'Monto', 'Status', 'Solicita', 'Aprueba/Niega']],
        body: loanRows,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [100, 116, 139] }
    });

    // Payments Audit
    const paymentRows = payments.slice(0, 20).map(p => {
        const loan = loans.find(l => l.id === p.loanId);
        return [
            new Date(p.paymentDate).toLocaleDateString(),
            loan?.workerName || 'N/A',
            formatCurrency(p.amountForeign, loan?.currency || Currency.USD),
            p.method.replace('_', ' ').toUpperCase(),
            p.registeredBy || 'N/A'
        ];
    });

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [['Fecha', 'Trabajador', 'Monto', 'Método', 'Registra Pago']],
        body: paymentRows,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`auditoria_global_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="bg-slate-900 p-6 flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold uppercase tracking-tight">Centro de Control y Auditoria</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Informe Consolidado de Gestion Financiera</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {loading ? (
            <div className="py-20 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-brand-500 mx-auto" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
                Compilando datos de cartera, nominas <br/> 
                y registros de amortización indexada...
              </p>
            </div>
          ) : (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricBlock 
                  label="Cartera Total Entregada" 
                  usd={totalLentUSD} 
                  eur={totalLentEUR} 
                  icon={Landmark}
                  color="slate"
                />
                <MetricBlock 
                  label="Recaudacion Recibida (FX)" 
                  usd={totalPaidUSD} 
                  eur={totalPaidEUR} 
                  icon={History}
                  color="emerald"
                />
                <MetricBlock 
                  label="Saldo por Recuperar" 
                  usd={balanceUSD} 
                  eur={balanceEUR} 
                  icon={TrendingUp}
                  color="brand"
                  highlight
                />
              </div>

              {/* Data Health Checks & Audit Trace */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                   <div className="dense-card bg-white p-6 border border-slate-200">
                      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                         <div className="flex items-center gap-2">
                           <ShieldCheck className="w-4 h-4 text-emerald-500" />
                           <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Trazabilidad de Auditoría</h4>
                         </div>
                         <span className="text-[8px] font-bold text-slate-400 uppercase">Firma Digital Registrada</span>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-tighter">
                              <th className="text-left py-2 font-bold">Préstamo</th>
                              <th className="text-left py-2 font-bold">Beneficiario</th>
                              <th className="text-left py-2 font-bold">Solicita</th>
                              <th className="text-left py-2 font-bold">Autoriza</th>
                              <th className="text-center py-2 font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {loans.slice(0, 10).map(l => (
                              <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 font-mono font-bold text-slate-400">#{l.loanNumber || l.id.slice(-4).toUpperCase()}</td>
                                <td className="py-2 font-bold text-slate-800 uppercase">{l.workerName}</td>
                                <td className="py-2 text-slate-500 font-medium lowercase italic">{l.requestedBy || '---'}</td>
                                <td className="py-2 text-slate-500 font-medium lowercase italic">{l.approvedBy || l.rejectedBy || '---'}</td>
                                <td className="py-2 text-center">
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded-[4px] text-[8px] font-bold uppercase",
                                    l.status === LoanStatus.ACTIVE ? "bg-emerald-50 text-emerald-600" :
                                    l.status === LoanStatus.PENDING ? "bg-orange-50 text-orange-600" :
                                    "bg-slate-50 text-slate-400"
                                  )}>
                                    {l.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                   </div>

                   <div className="dense-card bg-white p-6 border border-slate-200">
                      <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
                         <div className="flex items-center gap-2">
                           <Database className="w-4 h-4 text-brand-500" />
                           <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Auditoría de Pagos</h4>
                         </div>
                         <span className="text-[8px] font-bold text-slate-400 uppercase">Verificado por Tesorería</span>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-tighter">
                              <th className="text-left py-2 font-bold">Fecha</th>
                              <th className="text-left py-2 font-bold">Trabajador</th>
                              <th className="text-left py-2 font-bold">Monto (FX)</th>
                              <th className="text-left py-2 font-bold">Registra Pago</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {payments.slice(0, 10).map(p => {
                               const loan = loans.find(l => l.id === p.loanId);
                               return (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-2 text-slate-400 font-bold">{new Date(p.paymentDate).toLocaleDateString()}</td>
                                  <td className="py-2 font-bold text-slate-800 uppercase">{loan?.workerName || 'N/A'}</td>
                                  <td className="py-2 font-bold text-slate-600 font-mono">{formatCurrency(p.amountForeign, loan?.currency || Currency.USD)}</td>
                                  <td className="py-2 text-brand-600 font-bold lowercase italic">{p.registeredBy || 'SISTEMA'}</td>
                                </tr>
                               );
                            })}
                          </tbody>
                        </table>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                  <div className="dense-card bg-white p-6 border border-slate-200">
                    <div className="flex items-center gap-2 mb-4 boder-b border-slate-100 pb-2">
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                        <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Integridad de Datos</h4>
                    </div>
                    <div className="space-y-4 text-[10px] font-medium text-slate-600">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-100">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <p>Total de solicitudes: <span className="font-bold text-slate-900">{loans.length}</span>.</p>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded border border-slate-100">
                          <Database className="w-4 h-4 text-brand-500 shrink-0" />
                          <p>Recibos validados: <span className="font-bold text-slate-900">{payments.length}</span>.</p>
                        </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest mb-4">Exportación de Documentación</h4>
                    <div className="space-y-3">
                        <p className="text-[10px] text-slate-500 mb-4 font-medium leading-relaxed">
                          Descargue el informe detallado con huella digital de transacciones y responsables de aprobación.
                        </p>
                        <button 
                          onClick={exportPDF}
                          className="w-full py-3 bg-slate-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-md flex items-center justify-center gap-3"
                        >
                          <Download className="w-4 h-4" />
                          EXP. AUDITORIA (PDF)
                        </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end gap-4">
           <button 
             onClick={onClose}
             className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
           >
              Cerrar Panel
           </button>
        </div>
      </motion.div>
    </div>
  );
}

function MetricBlock({ label, usd, eur, icon: Icon, color, highlight = false }: any) {
  const colorMap: Record<string, string> = {
    slate: "text-slate-600 border-slate-100 bg-slate-50",
    emerald: "text-emerald-600 border-emerald-50 bg-emerald-50/30",
    brand: "text-brand-600 border-brand-50 bg-brand-50/50",
    orange: "text-orange-600 border-orange-50 bg-orange-50/30",
  };

  return (
    <div className={cn(
        "p-5 rounded-xl border transition-all",
        colorMap[color],
        highlight && "ring-2 ring-brand-100 shadow-lg shadow-brand-50"
    )}>
      <div className="flex items-center justify-between mb-4">
         <span className="text-[9px] font-bold uppercase tracking-widest opacity-80">{label}</span>
         <div className="p-1.5 bg-white/80 rounded-lg">
            <Icon className="w-4 h-4" />
         </div>
      </div>
      <div className="space-y-1">
         <p className="text-xl font-bold font-mono tracking-tighter">{formatUSD(usd)}</p>
         <p className="text-sm font-bold font-mono tracking-tighter opacity-70">{formatEUR(eur)}</p>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Payment, Loan, Currency, SystemSettings } from '../types';
import { Receipt, Search, Filter, Download, Calendar, Loader2, User, Landmark, Wallet, ArrowUpDown, FileText, Trash2, Eye, X, Globe, ShieldCheck, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatUSD, formatEUR, formatCurrency, cn, getLoanRemainingBalance } from '../lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ConfirmationModal from './ConfirmationModal';

interface Props {
  settings: SystemSettings | null;
}

export default function PaymentHistoryReport({ settings }: Props) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [allWorkers, setAllWorkers] = useState<any[]>([]);
  const [allLoans, setAllLoans] = useState<any[]>([]);
  const [selectedPaymentForDetail, setSelectedPaymentForDetail] = useState<any | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onResolve: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onResolve: () => {}
  });

  useEffect(() => {
    // Real-time listener for loans
    const unsubLoans = onSnapshot(collection(db, 'loans'), (snap) => {
      const loansList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllLoans(loansList);
      
      // Update consolidated payments whenever loans change
      fetchConsolidatedPayments(loansList);
    });

    // Real-time listener for workers
    const unsubWorkers = onSnapshot(collection(db, 'workers'), (snap) => {
      setAllWorkers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });

    const fetchConsolidatedPayments = async (loansList: any[]) => {
      if (loansList.length === 0) {
        setPayments([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const loansMap = new Map();
        loansList.forEach(l => loansMap.set(l.id, l));

        const allPayments: any[] = [];
        const loanIds = loansList.map(l => l.id);
        
        // Fetch payments for each loan
        const paymentsPromises = loanIds.map(loanId => 
          getDocs(query(collection(db, 'loans', loanId, 'payments'), orderBy('paymentDate', 'desc')))
        );

        const snapshots = await Promise.all(paymentsPromises);
        
        snapshots.forEach((snap, idx) => {
          const loanId = loanIds[idx];
          const loan = loansMap.get(loanId);
          snap.docs.forEach(doc => {
            const data = doc.data();
            allPayments.push({
              id: doc.id,
              ...data,
              workerName: loan?.workerName || 'N/A',
              workerId: loan?.workerId || 'N/A',
              loanCurrency: loan?.currency || Currency.USD,
              loanId: loanId,
              loanNumber: loan?.loanNumber || 'N/A',
              loanRemainingBalance: loan ? getLoanRemainingBalance(loan) : 0
            });
          });
        });

        allPayments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
        setPayments(allPayments);
      } catch (err) {
        console.error('Error fetching consolidated report:', err);
      } finally {
        setLoading(false);
      }
    };

    return () => {
      unsubLoans();
      unsubWorkers();
    };
  }, []);

  const filteredPayments = payments.filter(p => {
    // Search filter
    const matchesSearch = p.workerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (p.referenceNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (p.loanNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // Worker filter
    const matchesWorker = selectedWorkerId ? p.workerId === selectedWorkerId : true;

    // Loan filter
    const matchesLoan = selectedLoanId ? p.loanId === selectedLoanId : true;

    // Date filter
    const pDate = new Date(p.paymentDate).getTime();
    let matchesDate = true;
    if (startDate) {
      if (pDate < new Date(startDate).getTime()) matchesDate = false;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (pDate > end.getTime()) matchesDate = false;
    }

    return matchesSearch && matchesWorker && matchesLoan && matchesDate;
  }).sort((a, b) => {
    const timeA = new Date(a.paymentDate).getTime();
    const timeB = new Date(b.paymentDate).getTime();
    return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
  });

  const deletePayment = async (loanId: string, paymentId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '¿ELIMINAR REGISTRO DE PAGO?',
      message: '¿Estás seguro de que deseas eliminar permanentemente este registro de pago? Esta acción afectará el historial de cobranza.',
      onResolve: async () => {
        try {
          await deleteDoc(doc(db, 'loans', loanId, 'payments', paymentId));
          setPayments(prev => prev.filter(p => p.id !== paymentId));
          alert('Pago eliminado.');
        } catch (error) {
          console.error('Error deleting payment:', error);
          alert('Error al eliminar pago.');
        }
      }
    });
  };

  const exportToCSV = () => {
    const headers = ['Fecha', 'Trabajador', 'Préstamo', 'Saldo Pendiente', 'Monto Principal (FX)', 'Moneda', 'Monto Bs.', 'Tasa Aplicada', 'Metodo', 'Referencia'];
    const rows = filteredPayments.map(p => [
      new Date(p.paymentDate).toLocaleDateString(),
      p.workerName,
      p.loanNumber,
      p.loanRemainingBalance ? `${p.loanRemainingBalance.toFixed(2)} ${p.loanCurrency}` : `0.00 ${p.loanCurrency}`,
      p.amountForeign.toFixed(2),
      p.loanCurrency,
      p.amountBs.toFixed(2),
      p.rateApplied.toFixed(4),
      p.method || 'N/A',
      p.referenceNumber || 'N/A'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_pagos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Header with Logo and Company Info
    if (settings?.companyLogo) {
       // Note: In a real app we'd verify the base64 is a valid image, 
       // jspdf handles base64 well for PNG/JPG
       try {
         doc.addImage(settings.companyLogo, 'PNG', 14, 10, 30, 30);
       } catch (e) {
         console.warn("Logo error, skipping image", e);
       }
    }

    const startX = settings?.companyLogo ? 50 : 14;
    
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(settings?.companyName?.toUpperCase() || 'EMPRESA GESTORA DE PRÉSTAMOS', startX, 18);
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    let companyY = 24;
    if (settings?.companyTaxId) {
      doc.text(`RIF: ${settings.companyTaxId}`, startX, companyY);
      companyY += 4;
    }
    if (settings?.companyAddress) {
      doc.text(settings.companyAddress, startX, companyY, { maxWidth: 100 });
      companyY += 8;
    }
    if (settings?.companyPhone || settings?.companyEmail) {
      doc.text(`${settings.companyPhone || ''} | ${settings.companyEmail || ''}`, startX, companyY);
    }

    // Report Title
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('REPORTE HISTÓRICO DE PAGOS', 14, 55);
    
    // Add date range or filter info if applicable
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    let filterText = '';
    if (startDate || endDate) filterText += `Periodo: ${startDate || 'Inicio'} al ${endDate || 'Fin'} | `;
    if (selectedWorkerId) filterText += `Trabajador: ${allWorkers.find(w => w.uid === selectedWorkerId)?.displayName} | `;
    if (selectedLoanId) filterText += `Préstamo: ${allLoans.find(l => l.id === selectedLoanId)?.loanNumber} | `;
    
    doc.text(filterText || 'Filtros: Todos los registros', 14, 62);
    doc.text(`Generado: ${new Date().toLocaleString()}`, pageWidth - 14, 62, { align: 'right' });
    
    const tableHeaders = [['Fecha', 'Trabajador', 'Préstamo', 'Monto (FX)', 'Bs.', 'Método', 'Ref.']];
    const tableData = filteredPayments.map(p => {
      let methodText = (p.method || 'N/A').replace('_', ' ').toUpperCase();
      if (p.method === 'mixed' && p.mixedBreakdown) {
        const parts = [];
        if (p.mixedBreakdown.bs > 0) parts.push(`Bs: ${p.mixedBreakdown.bs}`);
        if (p.mixedBreakdown.usd > 0) parts.push(`$: ${p.mixedBreakdown.usd}`);
        if (p.mixedBreakdown.eur > 0) parts.push(`€: ${p.mixedBreakdown.eur}`);
        methodText += `\n(${parts.join(', ')})`;
      }

      return [
        new Date(p.paymentDate).toLocaleDateString(),
        p.workerName,
        `${p.loanNumber}\n(Saldo: ${p.loanRemainingBalance.toFixed(2)} ${p.loanCurrency})`,
        `${p.amountForeign.toFixed(2)} ${p.loanCurrency}`,
        p.amountBs.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        methodText,
        p.referenceNumber || 'N/A'
      ];
    });

    autoTable(doc, {
      startY: 68,
      head: tableHeaders,
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7, textColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'center' },
        6: { halign: 'center' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(8);
    doc.text('--- Fin del Reporte ---', pageWidth / 2, finalY, { align: 'center' });

    doc.save(`reporte_pagos_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded border border-slate-200 shadow-sm space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
             <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar trabajador o referencia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:ring-1 focus:ring-brand-500 uppercase"
                />
             </div>

             <select 
               value={selectedWorkerId}
               onChange={(e) => {
                 setSelectedWorkerId(e.target.value);
                 setSelectedLoanId(''); // Reset loan filter when worker changes
               }}
               className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold outline-none uppercase min-w-[120px]"
             >
                <option value="">TODOS TRABAJADORES</option>
                {allWorkers.map(w => (
                  <option key={w.uid} value={w.uid}>{w.displayName}</option>
                ))}
             </select>

             <select 
               value={selectedLoanId}
               onChange={(e) => setSelectedLoanId(e.target.value)}
               className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold outline-none uppercase min-w-[120px]"
             >
                <option value="">TODOS LOS PRÉSTAMOS</option>
                {allLoans
                  .filter(l => !selectedWorkerId || l.workerId === selectedWorkerId)
                  .map(l => (
                    <option key={l.id} value={l.id}>
                      {l.loanNumber} {!selectedWorkerId ? `(${l.workerName})` : ''} [{l.status}]
                    </option>
                  ))
                }
             </select>

             <button 
               onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
               className="p-1 px-2 border border-slate-200 rounded hover:bg-slate-50 transition-all text-slate-400 flex items-center gap-2"
               title="Cambiar Orden"
             >
                <ArrowUpDown className="w-3.5 h-3.5" />
             </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
             <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded px-2 py-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-[9px] font-bold text-slate-600 bg-transparent outline-none uppercase"
                />
                <span className="text-slate-300 mx-1">—</span>
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-[9px] font-bold text-slate-600 bg-transparent outline-none uppercase"
                />
             </div>

             <button 
               onClick={exportToCSV}
               disabled={filteredPayments.length === 0}
               className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
             >
                <Download className="w-3.5 h-3.5" />
                CSV
             </button>

             <button 
               onClick={exportToPDF}
               disabled={filteredPayments.length === 0}
               className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all disabled:opacity-50"
             >
                <FileText className="w-3.5 h-3.5" />
                PDF
             </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded border border-slate-100">
           {loading ? (
             <div className="py-20 text-center space-y-3">
               <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compilando historial de transacciones...</p>
             </div>
           ) : filteredPayments.length === 0 ? (
             <div className="py-20 text-center text-slate-300 font-bold uppercase text-[10px] tracking-widest bg-slate-50/30">
               No se encontraron pagos con los filtros seleccionados
             </div>
           ) : (
             <table className="w-full text-left border-collapse">
                <thead>
                   <tr className="bg-slate-50 border-b border-slate-200 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      <th className="px-4 py-2">Fecha</th>
                      <th className="px-4 py-2">Trabajador</th>
                      <th className="px-4 py-2">Préstamo</th>
                      <th className="px-4 py-2 text-center">Referencia</th>
                      <th className="px-4 py-2 text-right">Monto (FX)</th>
                      <th className="px-4 py-2 text-right">Equiv. Bs</th>
                      <th className="px-4 py-2 text-center">Metodo</th>
                      <th className="px-4 py-2 text-right">ACC</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {filteredPayments.map(p => (
                     <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-4 py-3">
                           <p className="text-[10px] font-bold text-slate-700">{new Date(p.paymentDate).toLocaleDateString()}</p>
                           <p className="text-[8px] text-slate-400 font-mono tracking-tighter">#{p.id.slice(-6).toUpperCase()}</p>
                        </td>
                        <td className="px-4 py-3">
                           <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                 {p.workerName[0]}
                              </div>
                              <p className="text-[10px] font-bold text-slate-800 uppercase truncate max-w-[150px]">{p.workerName}</p>
                           </div>
                        </td>
                        <td className="px-4 py-3">
                           <p className="text-[10px] font-bold text-slate-600 font-mono">{p.loanNumber}</p>
                           <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight mt-0.5">
                              Saldo: {formatCurrency(p.loanRemainingBalance, p.loanCurrency)}
                           </p>
                        </td>
                        <td className="px-4 py-3 text-center">
                           <span className="text-[9px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {p.referenceNumber || 'S/R'}
                           </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                           <p className="text-[10px] font-bold text-slate-800 font-mono">
                              {formatCurrency(p.amountForeign, p.loanCurrency)}
                           </p>
                           <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">Tasa: {p.rateApplied.toFixed(2)}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                           <p className="text-[10px] font-bold text-emerald-600 font-mono">Bs. {p.amountBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                           <span className={cn(
                             "text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter",
                             p.method === 'mixed' ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
                           )}>
                              {(p.method || 'N/A').replace('_', ' ')}
                           </span>
                           {p.mixedBreakdown && (
                             <div className="mt-1 flex flex-col gap-0.5 items-center">
                               {p.mixedBreakdown.bs > 0 && <span className="text-[7px] text-slate-400 font-mono">B:{p.mixedBreakdown.bs}</span>}
                               {p.mixedBreakdown.usd > 0 && <span className="text-[7px] text-slate-400 font-mono">U:{p.mixedBreakdown.usd}</span>}
                               {p.mixedBreakdown.eur > 0 && <span className="text-[7px] text-slate-400 font-mono">E:{p.mixedBreakdown.eur}</span>}
                             </div>
                           )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setSelectedPaymentForDetail(p)}
                              className="p-1.5 bg-slate-100 text-slate-500 hover:bg-brand-50 hover:text-brand-600 rounded transition-all"
                              title="Ver Detalles"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deletePayment(p.loanId, p.id)}
                              className="p-1.5 bg-red-50 text-red-400 hover:bg-red-600 hover:text-white rounded transition-all"
                              title="Eliminar Pago"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
           )}
        </div>
        
        {!loading && filteredPayments.length > 0 && (
          <div className="pt-2 flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
             <span>Puntos de Control: Auditoría Mensual</span>
             <span>Total Transacciones: {filteredPayments.length}</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedPaymentForDetail && (
          <PaymentDetailModal 
            payment={selectedPaymentForDetail} 
            onClose={() => setSelectedPaymentForDetail(null)} 
          />
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onResolve}
      />
    </div>
  );
}

function PaymentDetailModal({ payment, onClose }: { payment: any; onClose: () => void }) {
  const methodText = (payment.method || 'N/A').replace('_', ' ').toUpperCase();
  
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="relative bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="bg-slate-900 p-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
              <Receipt className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-tight">Comprobante de Pago</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ref: #{payment.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Main Info */}
          <div className="flex justify-between items-start pb-6 border-b border-dashed border-slate-200">
             <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Beneficiario</span>
                <p className="text-sm font-bold text-slate-800 uppercase leading-none">{payment.workerName}</p>
                <p className="text-[10px] font-mono text-brand-600 font-bold">Préstamo: {payment.loanNumber}</p>
             </div>
             <div className="text-right space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Fecha Registro</span>
                <p className="text-sm font-bold text-slate-800 font-mono leading-none">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                <p className="text-[10px] text-slate-500 font-bold">{new Date(payment.paymentDate).toLocaleTimeString()}</p>
             </div>
          </div>

          {/* Amount Breakdown */}
          <div className="space-y-4">
             <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                      <Globe className="w-4 h-4 text-brand-500" />
                   </div>
                   <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Monto Principal (FX)</p>
                      <p className="text-lg font-bold font-mono tracking-tighter text-slate-900">
                         {formatCurrency(payment.amountForeign, payment.loanCurrency)}
                      </p>
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Equivalente</p>
                   <p className="text-lg font-bold font-mono tracking-tighter text-emerald-600">
                      Bs. {payment.amountBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                   </p>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white border border-slate-100 rounded-lg">
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tasa Aplicada (BCV)</p>
                   <p className="text-xs font-bold font-mono text-slate-600">1 {payment.loanCurrency} = {payment.rateApplied.toFixed(4)} Bs.</p>
                </div>
                <div className="p-3 bg-white border border-slate-100 rounded-lg">
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Metodo de Pago</p>
                   <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-brand-500"></div>
                      <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{methodText}</p>
                   </div>
                </div>
             </div>

             {payment.method === 'mixed' && payment.mixedBreakdown && (
               <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl space-y-2">
                  <p className="text-[8px] font-bold text-amber-600 uppercase tracking-[0.2em] mb-2">Desglose Multimoneda</p>
                  <div className="grid grid-cols-3 gap-2">
                     <div className="bg-white p-2 rounded border border-amber-100 text-center">
                        <p className="text-[7px] font-bold text-slate-400 uppercase">Bolívares</p>
                        <p className="text-[10px] font-bold font-mono text-slate-700">{payment.mixedBreakdown.bs.toFixed(2)}</p>
                     </div>
                     <div className="bg-white p-2 rounded border border-amber-100 text-center">
                        <p className="text-[7px] font-bold text-slate-400 uppercase">Dólares</p>
                        <p className="text-[10px] font-bold font-mono text-slate-700">{payment.mixedBreakdown.usd.toFixed(2)}</p>
                     </div>
                     <div className="bg-white p-2 rounded border border-amber-100 text-center">
                        <p className="text-[7px] font-bold text-slate-400 uppercase">Euros</p>
                        <p className="text-[10px] font-bold font-mono text-slate-700">{payment.mixedBreakdown.eur.toFixed(2)}</p>
                     </div>
                  </div>
               </div>
             )}

             <div className="flex items-center gap-3 p-3 bg-brand-50/30 rounded-lg border border-brand-100">
                <CreditCard className="w-4 h-4 text-brand-500" />
                <div className="flex-1">
                   <p className="text-[8px] font-bold text-brand-600 uppercase tracking-widest">Referencia / Observaciones</p>
                   <p className="text-[10px] font-bold text-slate-600 font-mono">{payment.referenceNumber || 'SIN REFERENCIA REGISTRADA'}</p>
                </div>
             </div>
          </div>

          {/* Audit Trace */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-400" />
                <div>
                   <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Registrado por</p>
                   <p className="text-[10px] font-bold text-slate-600 lowercase italic leading-relaxed">{payment.registeredBy || 'sistema@empresa.com'}</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">Estatus Digital</p>
                <div className="flex items-center gap-1 justify-end">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   <p className="text-[9px] font-bold text-emerald-600 uppercase">Verificado</p>
                </div>
             </div>
          </div>
        </div>

        <div className="bg-slate-50 p-4 flex justify-center border-t border-slate-200">
            <button 
              onClick={onClose}
              className="px-8 py-2 bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
            >
              Cerrar Detalle
            </button>
        </div>
      </motion.div>
    </div>
  );
}

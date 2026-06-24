import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, setDoc, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Worker, UserRole, Loan, LoanStatus, Currency, Payment } from '../types';
import { Users, Search, Mail, Building2, Shield, UserPlus, MoreVertical, ExternalLink, History, Info, Receipt, Landmark, Wallet, Calendar, ArrowDownRight, CheckCircle2, Clock, X, Loader2, Trash2, Pencil } from 'lucide-react';
import { cn, formatUSD, formatEUR, formatCurrency, getLoanRemainingBalance } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationModal from './ConfirmationModal';

export default function WorkerManagement() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedWorkerForEdit, setSelectedWorkerForEdit] = useState<Worker | null>(null);
  const [selectedWorkerForHistory, setSelectedWorkerForHistory] = useState<Worker | null>(null);
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
    const unsub = onSnapshot(query(collection(db, 'workers'), orderBy('displayName')), (snap) => {
      setWorkers(snap.docs.map(doc => doc.data() as Worker));
    });
    return unsub;
  }, []);

  const filteredWorkers = workers.filter(w => 
    w.displayName.toLowerCase().includes(search.toLowerCase()) ||
    w.email.toLowerCase().includes(search.toLowerCase()) ||
    w.uid.toLowerCase().includes(search.toLowerCase()) ||
    (w.idNumber && w.idNumber.toLowerCase().includes(search.toLowerCase())) ||
    (w.cargo && w.cargo.toLowerCase().includes(search.toLowerCase())) ||
    (w.sucursal && w.sucursal.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleRole = async (worker: Worker) => {
    const newRole = worker.role === UserRole.ADMIN ? UserRole.EMPLOYEE : UserRole.ADMIN;
    try {
      await updateDoc(doc(db, 'workers', worker.uid), {
        role: newRole
      });
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const deleteWorker = async (uid: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: '¿ELIMINAR TRABAJADOR?',
      message: `¿Estás seguro de que deseas eliminar permanentemente a ${name}? Esta acción no se puede deshacer.`,
      onResolve: async () => {
        try {
          await deleteDoc(doc(db, 'workers', uid));
          alert('Trabajador eliminado del sistema');
        } catch (error) {
          console.error('Error deleting worker:', error);
          alert('Error al eliminar trabajador');
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button 
           onClick={() => setShowAddModal(true)}
           className="bg-slate-900 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Reg. Manual
        </button>
      </div>

      <div className="dense-card bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="dense-table-th">Trabajador / Cédula</th>
                <th className="dense-table-th">Contacto / Depto. / Cargo</th>
                <th className="dense-table-th">Rol Sistema</th>
                <th className="dense-table-th text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredWorkers.map((worker) => (
                <tr key={worker.uid} className="hover:bg-slate-50/50 transition-colors">
                  <td className="dense-table-td">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                        {worker.displayName[0]}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 uppercase text-[11px]">
                          {worker.displayName} 
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono tracking-tighter">CÉDULA / CÓDIGO: {worker.idNumber || worker.uid}</p>
                      </div>
                    </div>
                  </td>
                  <td className="dense-table-td">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <Mail className="w-3 h-3" />
                        <span>{worker.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <Building2 className="w-3 h-3" />
                        <span>
                          {worker.department || 'Sin Departamento'}
                          {worker.cargo && <span className="text-brand-600 font-bold"> • {worker.cargo.toUpperCase()}</span>}
                          {worker.sucursal && <span className="text-amber-600 font-bold font-mono text-[9px]"> • {worker.sucursal.toUpperCase()}</span>}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="dense-table-td">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest",
                      worker.role === UserRole.ADMIN ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                    )}>
                      {worker.role}
                    </span>
                  </td>
                  <td className="dense-table-td text-right">
                    <div className="flex items-center justify-end gap-2 text-slate-400">
                      <button 
                        onClick={() => setSelectedWorkerForEdit(worker)}
                        className="p-1.5 hover:text-brand-600 transition-colors"
                        title="Editar Trabajador"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setSelectedWorkerForHistory(worker)}
                        className="p-1.5 hover:text-brand-600 transition-colors"
                        title="Ver Historial de Pagos"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toggleRole(worker)}
                        className="p-1.5 hover:text-indigo-600 transition-colors"
                        title="Cambiar Rol"
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteWorker(worker.uid, worker.displayName)}
                        className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded transition-colors text-[9px] font-bold uppercase tracking-widest"
                        title="Eliminar Trabajador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        BORRAR
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredWorkers.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
              No se encontraron trabajadores
            </div>
          )}
        </div>
      </div>

      {showAddModal && <WorkerModal onClose={() => setShowAddModal(false)} />}
      {selectedWorkerForEdit && (
        <WorkerModal 
          workerToEdit={selectedWorkerForEdit} 
          onClose={() => setSelectedWorkerForEdit(null)} 
        />
      )}
      
      <AnimatePresence>
        {selectedWorkerForHistory && (
          <WorkerHistoryModal 
            worker={selectedWorkerForHistory} 
            onClose={() => setSelectedWorkerForHistory(null)} 
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

function WorkerHistoryModal({ worker, onClose }: { worker: Worker, onClose: () => void }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsMap, setPaymentsMap] = useState<Record<string, Payment[]>>({});
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
    const fetchData = async () => {
      setLoading(true);
      try {
        const loansQ = query(
          collection(db, 'loans'),
          where('workerId', '==', worker.uid),
          orderBy('createdAt', 'desc')
        );
        const loansSnap = await getDocs(loansQ);
        const loansData = loansSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
        setLoans(loansData);

        const newPaymentsMap: Record<string, Payment[]> = {};
        for (const loan of loansData) {
          const paymentsQ = query(
            collection(db, 'loans', loan.id, 'payments'),
            orderBy('paymentDate', 'desc')
          );
          const paymentsSnap = await getDocs(paymentsQ);
          newPaymentsMap[loan.id] = paymentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
        }
        setPaymentsMap(newPaymentsMap);
      } catch (err) {
        console.error('Error fetching history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [worker.uid]);

  const allPayments = Object.values(paymentsMap).flat() as Payment[];
  const totalPaidUSD = allPayments.reduce((acc, p) => acc + (loans.find(l => l.id === p.loanId)?.currency === Currency.USD ? p.amountForeign : 0), 0);
  const totalPaidEUR = allPayments.reduce((acc, p) => acc + (loans.find(l => l.id === p.loanId)?.currency === Currency.EUR ? p.amountForeign : 0), 0);
  
  const balanceUSD = loans.filter(l => l.currency === Currency.USD).reduce((acc, l) => acc + getLoanRemainingBalance(l), 0);
  const balanceEUR = loans.filter(l => l.currency === Currency.EUR).reduce((acc, l) => acc + getLoanRemainingBalance(l), 0);

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
        className="relative bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        <div className="bg-white p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-brand-50 text-brand-600 rounded flex items-center justify-center">
                <History className="w-5 h-5" />
             </div>
             <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Historial Financiero</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {worker.displayName} • {worker.department || 'Sin Departamento'}
                  {worker.cargo && ` • ${worker.cargo.toUpperCase()}`}
                </p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
             <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500 mx-auto" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Generando reporte de auditoría...</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                 <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pagado USD</span>
                       <Receipt className="w-3 h-3 text-emerald-500" />
                    </div>
                    <p className="text-lg font-bold text-slate-800 font-mono">{formatUSD(totalPaidUSD)}</p>
                 </div>
                 <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Pagado EUR</span>
                       <Receipt className="w-3 h-3 text-emerald-500" />
                    </div>
                    <p className="text-lg font-bold text-slate-800 font-mono">{formatEUR(totalPaidEUR)}</p>
                 </div>
                 <div className="bg-white p-3 rounded border border-brand-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[9px] font-bold text-brand-500 uppercase tracking-widest">Pendiente USD</span>
                       <Landmark className="w-3 h-3 text-brand-500" />
                    </div>
                    <p className="text-lg font-bold text-brand-600 font-mono">{formatUSD(balanceUSD)}</p>
                 </div>
                 <div className="bg-white p-3 rounded border border-brand-100 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                       <span className="text-[9px] font-bold text-brand-500 uppercase tracking-widest">Pendiente EUR</span>
                       <Wallet className="w-3 h-3 text-brand-500" />
                    </div>
                    <p className="text-lg font-bold text-brand-600 font-mono">{formatEUR(balanceEUR)}</p>
                 </div>
              </div>

              {/* Loans List */}
              <div className="space-y-4">
                 <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Desglose por Prestamo</h4>
                 {loans.length === 0 ? (
                   <div className="bg-white p-10 text-center rounded border border-dashed border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase">Sin movimientos registrados</p>
                   </div>
                 ) : (
                   loans.map(loan => {
                      const loanPayments = paymentsMap[loan.id] || [];
                      const loanPaid = loanPayments.reduce((acc, p) => acc + p.amountForeign, 0);
                      const loanRemaining = getLoanRemainingBalance(loan);
                      
                      return (
                        <div key={loan.id} className="bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
                           <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <span className={cn(
                                   "px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter",
                                   loan.status === LoanStatus.COMPLETED ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                 )}>
                                   {loan.status}
                                 </span>
                                 <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">REF: {loan.id.slice(-6).toUpperCase()}</span>
                                 <span className="text-[10px] font-bold text-slate-300">•</span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{loan.totalInstallments} CUOTAS</span>
                              </div>
                              <div className="text-right">
                                 <span className="text-[10px] font-bold text-slate-800">{formatCurrency(loan.amountForeign, loan.currency)}</span>
                                 <p className="text-[8px] font-bold text-slate-400 uppercase">Principal</p>
                              </div>
                           </div>
                           
                           <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Payments History table */}
                              <div className="space-y-3">
                                 <div className="flex items-center justify-between">
                                    <h5 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                       <Calendar className="w-3 h-3" />
                                       Cronograma de Pagos
                                    </h5>
                                    <span className="text-[9px] font-bold text-slate-500">{loanPayments.length} Pagos hechos</span>
                                 </div>
                                 
                                 <div className="space-y-1">
                                    {loanPayments.length === 0 ? (
                                      <p className="text-[9px] italic text-slate-400">Sin pagos recibidos</p>
                                    ) : (
                                       loanPayments.map(p => (
                                          <div key={p.id} className="bg-slate-50 p-2 rounded border border-slate-100 flex items-center justify-between group hover:bg-slate-100 transition-colors">
                                             <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 bg-white rounded border border-slate-200 flex items-center justify-center">
                                                   <Receipt className="w-3 h-3 text-emerald-500" />
                                                </div>
                                                <div>
                                                   <p className="text-[10px] font-bold text-slate-700">{new Date(p.paymentDate).toLocaleDateString()}</p>
                                                   <p className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter">REF: {p.referenceNumber || 'N/A'}</p>
                                                </div>
                                             </div>
                                             <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                   <p className="text-[10px] font-bold text-emerald-600 font-mono">{formatCurrency(p.amountForeign, loan.currency)}</p>
                                                   <p className="text-[8px] text-slate-400 font-bold">Bs. {p.amountBs.toLocaleString()}</p>
                                                </div>
                                                <button 
                                                  onClick={async (e) => {
                                                    e.stopPropagation();
                                                    setConfirmModal({
                                                       isOpen: true,
                                                       title: '¿ELIMINAR PAGO?',
                                                       message: 'Esta acción borrará el registro de pago permanentemente.',
                                                       onResolve: async () => {
                                                          try {
                                                            await deleteDoc(doc(db, 'loans', loan.id, 'payments', p.id));
                                                            setPaymentsMap(prev => ({
                                                              ...prev,
                                                              [loan.id]: prev[loan.id].filter(py => py.id !== p.id)
                                                            }));
                                                            alert('Pago eliminado correctamente');
                                                          } catch (err: any) {
                                                            alert('Error al eliminar: ' + err.message);
                                                          }
                                                       }
                                                    });
                                                  }}
                                                  className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded transition-all text-[8px] font-bold uppercase tracking-widest"
                                                >
                                                   <Trash2 className="w-3 h-3" />
                                                   BORRAR
                                                </button>
                                             </div>
                                          </div>
                                       ))
                                    )}
                                 </div>
                              </div>

                              {/* Balance & Progress */}
                              <div className="bg-slate-50/50 p-4 rounded-lg border border-slate-100 flex flex-col justify-center gap-4">
                                 <div className="space-y-4">
                                    <div>
                                       <div className="flex justify-between items-end mb-1">
                                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Progreso de Amortización</span>
                                          <span className="text-[10px] font-bold text-slate-800">{Math.round((loanPaid / loan.amountForeign) * 100)}%</span>
                                       </div>
                                       <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                          <div 
                                            className="h-full bg-brand-500 transition-all duration-500" 
                                            style={{ width: `${(loanPaid / loan.amountForeign) * 100}%` }}
                                          />
                                       </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                       <div className="bg-white p-3 rounded border border-slate-100 flex flex-col">
                                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Amortizado</span>
                                          <span className="text-sm font-bold text-slate-800 font-mono">{formatCurrency(loanPaid, loan.currency)}</span>
                                       </div>
                                       <div className="bg-white p-3 rounded border border-slate-100 flex flex-col">
                                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Remanente</span>
                                          <span className="text-sm font-bold text-brand-600 font-mono">{formatCurrency(loanRemaining, loan.currency)}</span>
                                       </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-200">
                                       <div className="flex items-center gap-2">
                                          <Info className="w-3.5 h-3.5 text-slate-400" />
                                          <p className="text-[9px] text-slate-500 font-medium leading-tight">
                                             Este prestamo tiene una tasa pactada de <span className="font-bold text-slate-700">{loan.rateAtAgreement} BS/{loan.currency}</span> al momento de la firma.
                                          </p>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                      )
                   })
                 )}
              </div>
            </>
          )}
        </div>

        <div className="bg-white p-4 border-t border-slate-200 flex justify-end">
           <button onClick={onClose} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase tracking-widest transition-all">
              Cerrar Reporte
           </button>
        </div>

        <ConfirmationModal 
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmModal.onResolve}
        />
      </motion.div>
    </div>
  );
}

const SUCURSALES = [
  'BARQUISIMETO',
  'QUIBOR',
  'BARINAS',
  'ACARIGUA',
  'VALLE DE LA PASCUA',
  'YARITAGUA'
];

interface WorkerModalProps {
  workerToEdit?: Worker | null;
  onClose: () => void;
}

function WorkerModal({ workerToEdit, onClose }: WorkerModalProps) {
  const [formData, setFormData] = useState({
    displayName: workerToEdit?.displayName || '',
    email: workerToEdit?.email || '',
    idNumber: workerToEdit?.idNumber || workerToEdit?.uid || '',
    department: workerToEdit?.department || '',
    cargo: workerToEdit?.cargo || '',
    sucursal: workerToEdit?.sucursal || '',
    role: workerToEdit?.role || UserRole.EMPLOYEE,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayNameClean = formData.displayName.trim();
    const idNumberClean = formData.idNumber.trim().toUpperCase();
    const sucursalClean = formData.sucursal.trim().toUpperCase();

    if (!idNumberClean || !displayNameClean) {
      setError('Cédula / código y nombre completo son obligatorios.');
      return;
    }
    if (!sucursalClean) {
      setError('Debe seleccionar una sucursal.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (workerToEdit) {
        // Edit mode - use original document ID (uid) to keep relational integrity for loans
        const originalUid = workerToEdit.uid;
        await setDoc(doc(db, 'workers', originalUid), {
          uid: originalUid,
          displayName: displayNameClean,
          email: formData.email.trim(),
          idNumber: idNumberClean,
          department: formData.department.trim(),
          cargo: formData.cargo.trim(),
          sucursal: sucursalClean,
          role: formData.role,
          createdAt: workerToEdit.createdAt || new Date().toISOString()
        }, { merge: true });
      } else {
        // Register mode - register with uppercase idNumber as custom document ID/uid
        await setDoc(doc(db, 'workers', idNumberClean), {
          uid: idNumberClean,
          displayName: displayNameClean,
          email: formData.email.trim(),
          idNumber: idNumberClean,
          department: formData.department.trim(),
          cargo: formData.cargo.trim(),
          sucursal: sucursalClean,
          role: formData.role,
          createdAt: new Date().toISOString()
        });
      }
      onClose();
    } catch (err: any) {
      console.error('Error saving worker:', err);
      setError(err.message || 'Error al guardar el trabajador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-lg shadow-2xl p-6 border border-slate-200">
        <h3 className="dense-label !text-slate-800 mb-6 font-mono tracking-tighter">
          {workerToEdit ? 'EDITAR_TRABAJADOR' : 'REGISTRO_MANUAL_SISTEMA'}
        </h3>
        
        {error && (
          <div className="mb-4 bg-red-50 border border-red-100 p-2 rounded text-[10px] font-bold text-red-600">
            {error.toUpperCase()}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cédula / Código</label>
            <input
              type="text"
              required
              value={formData.idNumber}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none uppercase"
              placeholder="V-00000000"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nombre Completo</label>
            <input
              type="text"
              required
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none uppercase"
              placeholder="Nombre y Apellido..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Corporativo</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none"
              placeholder="ejemplo@empresa.com"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sucursal</label>
            <select
              required
              value={formData.sucursal}
              onChange={(e) => setFormData({ ...formData, sucursal: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none"
            >
              <option value="">SELECCIONE SUCURSAL...</option>
              {SUCURSALES.map((suc) => (
                <option key={suc} value={suc}>
                  {suc}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Departamento</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none uppercase"
                placeholder="ADMINISTRACIÓN..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cargo / Puesto</label>
              <input
                type="text"
                value={formData.cargo}
                onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none uppercase"
                placeholder="ANALISTA..."
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rol / Perfil de Acceso</label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none"
            >
              <option value={UserRole.EMPLOYEE}>USUARIO BASE (EMPLEADO/LIMITE)</option>
              <option value={UserRole.ADMIN}>ADMINISTRADOR (ACCESO TOTAL)</option>
            </select>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="flex-1 py-2 bg-brand-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-brand-700 shadow-sm disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Datos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

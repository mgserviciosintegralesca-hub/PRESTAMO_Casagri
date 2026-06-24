import React, { useState, useEffect } from 'react';
import { Worker, SystemSettings, Loan, LoanStatus, Currency, UserRole, Payment, Motive, RepaymentFrequency } from '../types';
import { collection, query, onSnapshot, orderBy, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import jsPDF from 'jspdf';
import { 
  Users, Landmark, TrendingUp, CheckCircle2, XCircle, Wallet, Clock, Loader2,
  Search, Filter, Download, ArrowUpRight, ArrowDownRight,
  MoreVertical, FilePieChart, LayoutGrid, List, PlusCircle, History, Receipt, Calendar, Trash2, Eye, FileText
} from 'lucide-react';
import { formatUSD, formatEUR, formatCurrency, cn, getLoanRemainingBalance, getNextInstallmentAmount } from '../lib/utils';
import ExchangeRateWidget from './ExchangeRateWidget';
import LoanForm from './LoanForm';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, AreaChart, Area, PieChart, Pie } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

import WorkerManagement from './WorkerManagement';
import MotiveManagement from './MotiveManagement';
import SettingsManagement from './SettingsManagement';
import PaymentManagement from './PaymentManagement';
import DisbursementManagement from './DisbursementManagement';
import PaymentHistoryReport from './PaymentHistoryReport';
import ConfirmationModal from './ConfirmationModal';
import GlobalAuditModal from './GlobalAuditModal';

interface Props {
  worker: Worker;
  settings: SystemSettings | null;
}

import { createNotification } from '../lib/notifications';
import { NotificationType } from '../types';

export default function AdminDashboard({ worker, settings }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [motives, setMotives] = useState<Motive[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'active' | 'history' | 'payments' | 'paymentHistory' | 'disbursements' | 'stats' | 'workers' | 'motives' | 'settings'>('pending');
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [deletingLoanId, setDeletingLoanId] = useState<string | null>(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [selectedLoanForDetail, setSelectedLoanForDetail] = useState<Loan | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedWorkerIdForActive, setSelectedWorkerIdForActive] = useState('');
  const [selectedWorkerIdForStats, setSelectedWorkerIdForStats] = useState<string>('');
  const [selectedSucursalForStats, setSelectedSucursalForStats] = useState<string>('');
  const [selectedMotiveIdForStats, setSelectedMotiveIdForStats] = useState<string>('');
  const [selectedCurrencyForStats, setSelectedCurrencyForStats] = useState<Currency>(Currency.USD);
  const [selectedStatusForStats, setSelectedStatusForStats] = useState<string>('active');

  const [error, setError] = useState<string | null>(null);

  const getMotiveName = (motiveId: string) => {
    const motiveObj = motives.find(m => m.id === motiveId);
    if (motiveObj) return motiveObj.name.toUpperCase();
    if (motiveId === 'prestamo_personal') return 'PRÉSTAMO PERSONAL';
    if (motiveId === 'excedente_plan_salud') return 'EXCEDENTE PLAN DE SALUD';
    return motiveId.toUpperCase();
  };

  useEffect(() => {
    const unsubLoans = onSnapshot(collection(db, 'loans'), (snapshot) => {
      setLoans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan)));
    }, (err) => {
      console.error('Loans snapshot error:', err);
      setError('Error de lectura: PRÉSTAMOS');
    });

    const unsubWorkers = onSnapshot(collection(db, 'workers'), (snapshot) => {
      setWorkers(snapshot.docs.map(doc => ({ ...doc.data() } as Worker)));
    }, (err) => {
      console.error('Workers snapshot error:', err);
      setError('Error de lectura: TRABAJADORES');
    });

    const unsubMotives = onSnapshot(collection(db, 'motives'), (snapshot) => {
      setMotives(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Motive)));
    }, (err) => {
      console.error('Motives snapshot error:', err);
    });

    return () => {
      unsubLoans();
      unsubWorkers();
      unsubMotives();
    };
  }, []);

  const filteredLoansForTab = loans.filter(l => {
    // Date filter
    if (startDate || endDate) {
      const loanDate = new Date(l.createdAt).getTime();
      if (startDate && loanDate < new Date(startDate).getTime()) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (loanDate > end.getTime()) return false;
      }
    }

    // Worker filter for Active tab only
    if (activeTab === 'active' && selectedWorkerIdForActive && l.workerId !== selectedWorkerIdForActive) {
      return false;
    }

    return true;
  });

  const pendingLoans = filteredLoansForTab.filter(l => l.status === LoanStatus.PENDING);
  const activeLoans = filteredLoansForTab.filter(l => l.status === LoanStatus.ACTIVE || l.status === LoanStatus.APPROVED);
  
  const generateApprovalDocument = (loan: Loan, workerInfo: Worker, settings: SystemSettings | null) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header / Membrete
      let headerY = 20;
      
      // Logo (if exists)
      if (settings?.companyLogo) {
        try {
          // Note: In a production environment, you might need to handle CORS or convert to base64
          // For now, we attempt to add it if it's a data URI or compatible URL
          doc.addImage(settings.companyLogo, 'PNG', 20, headerY, 40, 20);
          headerY += 25;
        } catch (e) {
          console.warn("Logo could not be added to PDF", e);
        }
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      if (settings?.companyName) {
        doc.text(settings.companyName.toUpperCase(), 20, headerY);
        headerY += 5;
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      if (settings?.companyTaxId) {
        doc.text(`RIF: ${settings.companyTaxId}`, 20, headerY);
        headerY += 4;
      }
      if (settings?.companyAddress) {
        doc.text(settings.companyAddress, 20, headerY);
        headerY += 4;
      }
      if (settings?.companyPhone || settings?.companyEmail) {
        doc.text(`${settings?.companyPhone || ''} ${settings?.companyEmail ? ' | ' + settings.companyEmail : ''}`, 20, headerY);
      }

      // Title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('SOLICITUD DE PRÉSTAMO Y AUTORIZACIÓN DE DESCUENTO', pageWidth / 2, headerY + 15, { align: 'center' });
      
      // Date
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const date = new Date().toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      doc.text(`Fecha de Emisión: ${date}`, pageWidth - 25, headerY + 25, { align: 'right' });
      
      // Categorization Box
      const motiveObj = motives.find(m => m.id === loan.motiveId);
      const loanCategory = motiveObj ? motiveObj.name.toUpperCase() : 
                          loan.motiveId === 'prestamo_personal' ? 'PRÉSTAMO PERSONAL' : 
                          loan.motiveId === 'excedente_plan_salud' ? 'EXCEDENTE PLAN DE SALUD' : 
                          loan.motiveId.toUpperCase();
      
      const subMotiveText = (loan.subMotiveId || 'GENERAL').toUpperCase();
      const margin = 30; // Slightly larger margin for safety
      const contentWidth = pageWidth - (margin * 2);
      const colWidth = contentWidth / 2;
      
      const catLines1 = doc.splitTextToSize(loanCategory, colWidth - 15);
      const catLines2 = doc.splitTextToSize(subMotiveText, colWidth - 15);
      const maxLines = Math.max(catLines1.length, catLines2.length);
      const catBoxHeight = 12 + (maxLines * 5);
      
      const catY = headerY + 30;
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, catY, contentWidth, catBoxHeight, 'F');
      doc.rect(margin, catY, contentWidth, catBoxHeight, 'S');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('CATEGORÍA DE PRÉSTAMO:', margin + 5, catY + 6);
      doc.text('MOTIVO ESPECÍFICO:', pageWidth / 2 + 5, catY + 6);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(catLines1, margin + 5, catY + 12, { maxWidth: colWidth - 15 });
      doc.text(catLines2, pageWidth / 2 + 5, catY + 12, { maxWidth: colWidth - 15 });

      // Worker Info
      const ci = workerInfo.idNumber || '________________';
      const name = (workerInfo.displayName || 'N/A').toUpperCase();
      const amount = formatCurrency(loan.amountForeign, loan.currency);
      
      // Calculate deduction amount - Per user request: use the full installment value
      const installmentAmount = getNextInstallmentAmount(loan);
      const formattedDeduction = formatCurrency(installmentAmount, loan.currency);
      const isBiweekly = loan.repaymentFrequency === RepaymentFrequency.BIWEEKLY;
      const frequencyLabel = isBiweekly ? 'QUINCENAL' : 'MENSUAL';
      
      const bodyText = `Yo, ${name}, portador de la Cédula de Identidad ${ci}, solicito formalmente un préstamo por el MONTO total de ${amount}, para lo que autorizo libre y voluntariamente al Departamento de Talento Humano a realizar los descuentos ${frequencyLabel.toLowerCase()}es correspondientes a través de los pagos de nómina regulares, hasta la total cancelación del saldo adeudado del presente préstamo conforme a las condiciones aquí descritas.`;
      
      doc.setFontSize(11);
      const bodyLines = doc.splitTextToSize(bodyText, contentWidth - 5);
      const bodyY = catY + catBoxHeight + 15;
      doc.text(bodyLines, margin, bodyY, { 
        maxWidth: contentWidth,
        align: 'justify', 
        lineHeightFactor: 1.4 
      });
      
      const bodyHeight = (bodyLines.length * 11 * 1.4 * 0.3527); 
      
      // Installment Details Table Header
      const tableY = bodyY + bodyHeight + 15;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('DETALLE DE DESCUENTOS AUTORIZADOS', margin, tableY);

      // Details
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Monto Total del Préstamo:`, margin, tableY + 10);
      doc.text(`${amount}`, pageWidth - margin, tableY + 10, { align: 'right' });
      
      doc.text(`Número de Cuotas Autorizadas:`, margin, tableY + 17);
      doc.text(`${loan.totalInstallments} pagos`, pageWidth - margin, tableY + 17, { align: 'right' });

      doc.setFillColor(230, 245, 255);
      doc.rect(margin, tableY + 21, contentWidth, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`MONTO POR DESCUENTO ${frequencyLabel}:`, margin + 5, tableY + 28);
      doc.text(`${formattedDeduction}`, pageWidth - margin - 5, tableY + 28, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`ID de Control: ${loan.loanNumber || loan.id.slice(-6).toUpperCase()}`, margin, tableY + 38);

      // Signature and Thumbprint - Absolute positioning towards bottom
      const signatureY = 245;
      
      doc.line(30, signatureY, 90, signatureY); // Line for signature
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('FIRMA DEL TRABAJADOR', 60, signatureY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text(`C.I.: ${ci}`, 60, signatureY + 10, { align: 'center' });
      
      // Thumbprint box
      doc.rect(pageWidth - 70, signatureY - 35, 40, 50); // Box for thumbprint
      doc.setFontSize(8);
      doc.text('HUELLA DACTILAR (PULGAR)', pageWidth - 50, signatureY + 20, { align: 'center' });
      
      // Footer
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text('Documento de carácter administrativo generado electrónicamente por el Sistema de Gestión de Préstamos.', pageWidth / 2, 285, { align: 'center' });
      
      doc.save(`SOLICITUD_AUTORIZADA_${loan.loanNumber || loan.id.slice(-6)}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error al generar el documento PDF completo.');
    }
  };

  const handleApprove = async (loan: Loan) => {
    try {
      // Generate repayment schedule
      const schedule = [];
      if (loan.determinationMode === 'fixed_amount' && loan.fixedInstallmentAmount && loan.fixedInstallmentAmount > 0) {
        let remainingAmount = loan.amountForeign;
        const fixedAmt = loan.fixedInstallmentAmount;
        for (let i = 1; i <= loan.totalInstallments; i++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + i);
          
          let currentInstallmentAmount = fixedAmt;
          if (remainingAmount < fixedAmt) {
            currentInstallmentAmount = remainingAmount;
          }
          
          schedule.push({
            installmentNumber: i,
            dueDate: dueDate.toISOString(),
            amountForeign: Number(currentInstallmentAmount.toFixed(2)),
            status: 'pending' as const
          });
          remainingAmount = Math.max(0, remainingAmount - fixedAmt);
        }
      } else {
        const installmentAmount = loan.amountForeign / loan.totalInstallments;
        for (let i = 1; i <= loan.totalInstallments; i++) {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + i);
          schedule.push({
            installmentNumber: i,
            dueDate: dueDate.toISOString(),
            amountForeign: installmentAmount,
            status: 'pending' as const
          });
        }
      }

      await updateDoc(doc(db, 'loans', loan.id), {
        status: LoanStatus.ACTIVE,
        approvedBy: worker.email,
        repaymentSchedule: schedule,
        updatedAt: new Date().toISOString()
      });

      // Notify User
      await createNotification(
        loan.workerId,
        'Préstamo Aprobado',
        `Su solicitud de préstamo por ${formatCurrency(loan.amountForeign, loan.currency)} ha sido aprobada y activada.`,
        NotificationType.PAYMENT_CONFIRMED
      );

      // Automatically generate the document
      const workerInfo = workers.find(w => w.uid === loan.workerId);
      if (workerInfo) {
        generateApprovalDocument(loan, workerInfo, settings);
      }

    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  const handleReject = async (loan: Loan, reason?: string) => {
    try {
      await updateDoc(doc(db, 'loans', loan.id), {
        status: LoanStatus.REJECTED,
        rejectedBy: worker.email,
        rejectionReason: reason || '',
        updatedAt: new Date().toISOString()
      });

      // Notify User
      await createNotification(
        loan.workerId,
        'Solicitud de Préstamo Rechazada',
        `Lamentamos informarle que su solicitud de préstamo REF:${loan.id.slice(-6).toUpperCase()} no pudo ser aprobada. Motivo: ${reason || 'No especificado'}.`,
        NotificationType.SYSTEM
      );
    } catch (err) {
      console.error('Reject error:', err);
    }
  };

  const deleteLoan = async (loanId: string) => {
    setConfirmDeleteModal({
      isOpen: true,
      title: '¿ELIMINAR PRÉSTAMO DEFINITIVAMENTE?',
      message: `Esta acción borrará el préstamo y todos sus pagos asociados permanentemente.`,
      onResolve: async () => {
        setDeletingLoanId(loanId);
        try {
          const paymentsSnap = await getDocs(collection(db, 'loans', loanId, 'payments'));
          const deletePromises = paymentsSnap.docs.map(d => deleteDoc(doc(db, 'loans', loanId, 'payments', d.id)));
          await Promise.all(deletePromises);
          await deleteDoc(doc(db, 'loans', loanId));
          alert('Préstamo y sus pagos asociados eliminados con éxito.');
        } catch (err: any) {
          console.error('Delete loan error:', err);
          alert(`ERROR: No se pudo eliminar el préstamo.\nDetalle: ${err.message || 'Error de red o permisos'}`);
        } finally {
          setDeletingLoanId(null);
        }
      }
    });
  };
  const generateAIReport = async (loan: Loan) => {
    setGeneratingReport(loan.id);
    try {
      const response = await axios.post('/api/gemini/summarize-loan', { loanData: loan });
      alert("Análisis de IA (BCV Indexing):\n\n" + response.data.summary);
    } catch (error) {
      console.error("AI Report error:", error);
    } finally {
      setGeneratingReport(null);
    }
  };

  // Custom Tooltip for Charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg">
          <p className="text-[10px] font-bold text-slate-800 uppercase mb-2 border-b border-slate-100 pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{entry.name}:</span>
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-800">
                {entry.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Color palette for Pie charts
  const MOTIVE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  const statsData = [
    { name: 'Solicitados', value: loans.filter(l => l.status === LoanStatus.PENDING).length, color: '#f59e0b' },
    { name: 'Aprobados', value: loans.filter(l => l.status === LoanStatus.ACTIVE || l.status === LoanStatus.APPROVED).length, color: '#3b82f6' },
    { name: 'Negados', value: loans.filter(l => l.status === LoanStatus.REJECTED).length, color: '#ef4444' },
    { name: 'Finalizados', value: loans.filter(l => l.status === LoanStatus.COMPLETED).length, color: '#10b981' },
  ];

  // Calculate motive stats for distribution
  const motiveBalanceData = motives.map((m, idx) => {
    const motiveLoans = loans.filter(l => l.motiveId === m.id && (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.APPROVED));
    const saldo = motiveLoans.reduce((acc, l) => {
        const val = l.amountForeign / l.totalInstallments;
        return acc + (l.remainingInstallments * val);
    }, 0);

    return {
        name: m.name,
        value: Math.round(saldo),
        color: MOTIVE_COLORS[idx % MOTIVE_COLORS.length]
    };
  }).filter(d => d.value > 0);

  const totalBalanceAll = motiveBalanceData.reduce((acc, d) => acc + d.value, 0);

  // Global Audit Data (Total Principal vs Paid vs Balance)
  // Simplified sum of nominal values (FX units) for display
  const financialAuditData = (() => {
    const relevantLoans = loans.filter(l => 
        l.status === LoanStatus.ACTIVE || 
        l.status === LoanStatus.APPROVED || 
        l.status === LoanStatus.COMPLETED
    );

    const solicitado = relevantLoans.reduce((acc, l) => acc + l.amountForeign, 0);
    const saldo = relevantLoans.reduce((acc, l) => acc + getLoanRemainingBalance(l), 0);
    const pagado = relevantLoans.reduce((acc, l) => acc + Math.max(0, l.amountForeign - getLoanRemainingBalance(l)), 0);

    return [
        { name: 'Pagado', value: Math.round(pagado), color: '#10b981' },
        { name: 'Pendiente', value: Math.round(saldo), color: '#3b82f6' },
        { name: 'Total Solicitado', value: Math.round(solicitado), isReference: true }
    ];
  })();

  const totalPendingUSD = activeLoans
    .filter(l => l.currency === Currency.USD)
    .reduce((acc, l) => acc + getLoanRemainingBalance(l), 0);
  
  const totalPendingEUR = activeLoans
    .filter(l => l.currency === Currency.EUR)
    .reduce((acc, l) => acc + getLoanRemainingBalance(l), 0);

  // --- INTEGRATED METRICS: FILTRADO GLOBAL DE PRÉSTAMOS ---
  const filteredLoansForStats = (() => {
    return loans.filter(l => {
      // Filtro de Moneda
      if (l.currency !== selectedCurrencyForStats) return false;

      // Filtro de Estado
      let matchStatus = false;
      if (selectedStatusForStats === 'all') {
        matchStatus = true;
      } else if (selectedStatusForStats === 'active') {
        matchStatus = l.status === LoanStatus.ACTIVE || l.status === LoanStatus.APPROVED;
      } else if (selectedStatusForStats === 'completed') {
        matchStatus = l.status === LoanStatus.COMPLETED;
      } else if (selectedStatusForStats === 'pending') {
        matchStatus = l.status === LoanStatus.PENDING;
      }
      if (!matchStatus) return false;

      // Filtro de Trabajador
      if (selectedWorkerIdForStats && l.workerId !== selectedWorkerIdForStats) return false;

      // Obtener datos de la sucursal del trabajador
      const w = workers.find(work => work.uid === l.workerId);
      const s = w?.sucursal || 'SIN SUCURSAL';

      // Filtro de Sucursal
      if (selectedSucursalForStats && s.toUpperCase() !== selectedSucursalForStats.toUpperCase()) return false;

      // Filtro de Motivo
      if (selectedMotiveIdForStats && l.motiveId !== selectedMotiveIdForStats) return false;

      return true;
    });
  })();

  const SUCURSALES = [
    'BARQUISIMETO',
    'QUIBOR',
    'BARINAS',
    'ACARIGUA',
    'VALLE DE LA PASCUA',
    'YARITAGUA'
  ];

  // 1. Desglose de montos y saldos por SUCURSAL
  const sucursalAnalysisData = (() => {
    const branches = [...SUCURSALES, 'SIN SUCURSAL'];
    return branches.map(b => {
      const branchLoans = filteredLoansForStats.filter(l => {
        const w = workers.find(work => work.uid === l.workerId);
        const s = w?.sucursal || 'SIN SUCURSAL';
        return s.toUpperCase() === b.toUpperCase();
      });

      const totalAmt = branchLoans.reduce((sum, l) => sum + l.amountForeign, 0);
      const saldoTotal = branchLoans.reduce((sum, l) => sum + getLoanRemainingBalance(l), 0);
      const count = branchLoans.length;

      return {
        displayName: b,
        montoTotal: Math.round(totalAmt),
        saldoTotal: Math.round(saldoTotal),
        cantidadPrestamos: count
      };
    }).filter(d => d.montoTotal > 0 || d.cantidadPrestamos > 0);
  })();

  // 2. Desglose de montos y saldos por DEPARTAMENTO
  const departmentAnalysisData = (() => {
    const deptsSet = new Set<string>();
    workers.forEach(w => {
      if (w.department && w.department.trim()) {
        deptsSet.add(w.department.trim().toUpperCase());
      }
    });
    const depts = Array.from(deptsSet);
    depts.push('SIN DEPARTAMENTO');

    return depts.map(d => {
      const deptLoans = filteredLoansForStats.filter(l => {
        const w = workers.find(work => work.uid === l.workerId);
        const dept = w?.department || 'SIN DEPARTAMENTO';
        return dept.toUpperCase() === d.toUpperCase();
      });

      const totalAmt = deptLoans.reduce((sum, l) => sum + l.amountForeign, 0);
      const saldoTotal = deptLoans.reduce((sum, l) => sum + getLoanRemainingBalance(l), 0);
      const count = deptLoans.length;

      return {
        displayName: d,
        montoTotal: Math.round(totalAmt),
        saldoTotal: Math.round(saldoTotal),
        cantidadPrestamos: count
      };
    }).filter(d => d.montoTotal > 0 || d.cantidadPrestamos > 0);
  })();

  // 3. Desglose de montos y saldos por MOTIVO
  const motiveAnalysisData = (() => {
    return motives.map(m => {
      const motiveLoans = filteredLoansForStats.filter(l => l.motiveId === m.id);
      const totalAmt = motiveLoans.reduce((sum, l) => sum + l.amountForeign, 0);
      const saldoTotal = motiveLoans.reduce((sum, l) => sum + getLoanRemainingBalance(l), 0);
      const count = motiveLoans.length;

      return {
        displayName: m.name,
        montoTotal: Math.round(totalAmt),
        saldoTotal: Math.round(saldoTotal),
        cantidadPrestamos: count
      };
    }).filter(d => d.montoTotal > 0 || d.cantidadPrestamos > 0);
  })();

  // 4. Desglose de montos y saldos por TRABAJADOR
  const workerAnalysisData = (() => {
    return workers.map(w => {
      const workerLoans = filteredLoansForStats.filter(l => l.workerId === w.uid);
      const totalAmt = workerLoans.reduce((sum, l) => sum + l.amountForeign, 0);
      const saldoTotal = workerLoans.reduce((sum, l) => sum + getLoanRemainingBalance(l), 0);
      const count = workerLoans.length;

      return {
        displayName: w.displayName,
        montoTotal: Math.round(totalAmt),
        saldoTotal: Math.round(saldoTotal),
        cantidadPrestamos: count
      };
    }).filter(d => d.montoTotal > 0 || d.cantidadPrestamos > 0);
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Admin_Workspace</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-0.5">SISTEMA PARA CONTROL DE PRESTAMOS</p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <div className="bg-red-50 border border-red-100 px-3 py-1 rounded flex items-center gap-2">
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-tighter">{error}</span>
            </div>
          ) }
          <button 
            onClick={() => setShowLoanForm(true)}
            className="bg-brand-600 text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-brand-700 transition-all uppercase tracking-widest shadow-sm flex items-center gap-2"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Nuevo Préstamo
          </button>
          <button className="bg-white border border-slate-200 px-3 py-1 rounded text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all uppercase tracking-widest">
            Exportar_CSV
          </button>
          <button 
            onClick={() => setShowAuditModal(true)}
            className="bg-slate-900 text-white px-3 py-1 rounded text-[10px] font-bold hover:bg-slate-800 transition-all uppercase tracking-widest shadow-sm"
          >
            Auditoría
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-3">
            <StatCard label="Cartera USD" value={formatUSD(loans.filter(l => l.currency === Currency.USD).reduce((acc, l) => acc + l.amountForeign, 0))} icon={Landmark} />
            <div className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Saldo Pend.</span>
                <span className="text-[10px] font-bold text-brand-600 font-mono">{formatUSD(totalPendingUSD)}</span>
            </div>
        </div>
        <div className="space-y-3">
            <StatCard label="Cartera EUR" value={formatEUR(loans.filter(l => l.currency === Currency.EUR).reduce((acc, l) => acc + l.amountForeign, 0))} icon={Wallet} />
            <div className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded flex justify-between items-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Saldo Pend.</span>
                <span className="text-[10px] font-bold text-brand-600 font-mono">{formatEUR(totalPendingEUR)}</span>
            </div>
        </div>
        <StatCard label="Solicitudes" value={pendingLoans.length.toString()} icon={Clock} highlight />
        <StatCard label="Nómina Activa" value={workers.length.toString()} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {/* Filters & Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-slate-200 gap-4 pb-0">
            <div className="flex overflow-x-auto no-scrollbar">
              <TabButton active={activeTab === 'pending'} onClick={() => setActiveTab('pending')}>
                POR APROBAR <span className="ml-1 opacity-50">[{pendingLoans.length}]</span>
              </TabButton>
              <TabButton active={activeTab === 'active'} onClick={() => setActiveTab('active')}>
                PRÉSTAMOS ACTIVOS <span className="ml-1 opacity-50">[{activeLoans.length}]</span>
              </TabButton>
              <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
                VER TODOS <span className="ml-1 opacity-50">[{loans.length}]</span>
              </TabButton>
              <TabButton active={activeTab === 'payments'} onClick={() => setActiveTab('payments')}>
                REGISTRAR PAGOS
              </TabButton>
              <TabButton active={activeTab === 'disbursements'} onClick={() => setActiveTab('disbursements')}>
                REGISTRAR ABONOS
              </TabButton>
              <TabButton active={activeTab === 'paymentHistory'} onClick={() => setActiveTab('paymentHistory')}>
                REPORTE PAGOS
              </TabButton>
              <TabButton active={activeTab === 'workers'} onClick={() => setActiveTab('workers')}>
                TRABAJADORES
              </TabButton>
              <TabButton active={activeTab === 'motives'} onClick={() => setActiveTab('motives')}>
                TIPOS / MOTIVOS
              </TabButton>
              <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>
                CONFIGURACIÓN
              </TabButton>
              <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>
                MÉTRICAS
              </TabButton>
            </div>

            {(activeTab === 'pending' || activeTab === 'active' || activeTab === 'history') && (
              <div className="flex flex-wrap items-center gap-2 pb-2 px-4 sm:px-0">
                {(activeTab === 'active' || activeTab === 'history') && (
                  <select 
                    value={selectedWorkerIdForActive}
                    onChange={(e) => setSelectedWorkerIdForActive(e.target.value)}
                    className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 rounded p-1 shadow-sm outline-none uppercase tracking-tighter"
                  >
                    <option value="">TODOS TRABAJADORES</option>
                    {workers.map(w => (
                      <option key={w.uid} value={w.uid}>{w.displayName}</option>
                    ))}
                  </select>
                )}
                
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded p-1 shadow-sm">
                  <Calendar className="w-3 h-3 text-slate-400 ml-1" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-[9px] font-bold text-slate-600 outline-none p-0.5 uppercase tracking-tighter"
                  />
                  <span className="text-slate-300 mx-1">—</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-[9px] font-bold text-slate-600 outline-none p-0.5 uppercase tracking-tighter"
                  />
                  {(startDate || endDate) && (
                    <button 
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="p-1 hover:bg-slate-100 rounded-full"
                    >
                      <XCircle className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="min-h-[400px]">
            {activeTab === 'stats' ? (
              <div className="space-y-8 pb-12">
                {/* Chart 1: Status Distribution (Donut) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <div className="flex items-center justify-between mb-8 text-center md:text-left">
                    <div>
                      <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Estado de Solicitudes</h3>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">Distribución de préstamos por ciclo de vida (Conteo)</p>
                    </div>
                  </div>
                  
                  <div className="h-[280px] flex items-center flex-col md:flex-row">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statsData}
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {statsData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                          verticalAlign="middle" 
                          align="right" 
                          layout="vertical"
                          wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', paddingLeft: '20px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Portfolio Distribution by Motive (Pie) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                   <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Cartera por Motivo (Saldo Pendiente)</h3>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">Distribución del saldo activo en divisas (FX)</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Saldo Activo</p>
                       <p className="text-sm font-bold text-slate-800 font-mono tracking-tighter">
                          {totalBalanceAll.toLocaleString()} <span className="text-[10px] text-slate-400">UND</span>
                       </p>
                    </div>
                  </div>

                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={motiveBalanceData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={true}
                          stroke="none"
                        >
                           {motiveBalanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                          verticalAlign="bottom" 
                          align="center" 
                          wrapperStyle={{ fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest italic">
                      Monitorea la exposición de capital por tipo de préstamo en tiempo real
                    </p>
                  </div>
                </div>

                {/* Chart 3: Global Financial Health (Donut) */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                   <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Salud Financiera Global</h3>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">Relación entre capital entregado, recaudado y por cobrar</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 items-center">
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={financialAuditData.filter(d => !d.isReference)}
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            startAngle={90}
                            endAngle={450}
                          >
                            {financialAuditData.filter(d => !d.isReference).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-4 px-6">
                       {financialAuditData.map((item, idx) => (
                         <div key={idx} className={cn(
                           "p-3 rounded-lg border",
                           item.isReference ? "bg-slate-50 border-slate-200" : "bg-white border-slate-100"
                         )}>
                            <div className="flex items-center gap-2 mb-1">
                               {!item.isReference && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />}
                               <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.name}</span>
                            </div>
                            <p className={cn(
                              "text-lg font-bold font-mono tracking-tighter",
                              item.isReference ? "text-slate-800" : (item.name === 'Pagado' ? "text-emerald-600" : "text-brand-600")
                            )}>
                              {item.value.toLocaleString()} <span className="text-xs text-slate-400">UND</span>
                            </p>
                            {!item.isReference && (
                              <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
                                <div 
                                  className="h-full rounded-full" 
                                  style={{ 
                                    width: `${(item.value / financialAuditData.find(d => d.isReference)!.value * 100).toFixed(0)}%`,
                                    backgroundColor: item.color
                                  }} 
                                />
                              </div>
                            )}
                         </div>
                       ))}
                    </div>
                  </div>
                </div>

                {/* Visualizador Avanzado: Análisis por Trabajador */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-[11px] font-bold text-slate-800 uppercase tracking-widest">Dashboard Métrico Avanzado & Desglosado</h3>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                          Visualización interactiva y desglosada de montos y saldos pendientes por sucursal, departamento, motivo y empleado
                        </p>
                      </div>
                    </div>

                    {/* Controles del Gráfico */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Filtro de Sucursal */}
                      <div className="flex flex-col gap-1 min-w-[140px]">
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest">Sucursal</span>
                        <select
                          value={selectedSucursalForStats}
                          onChange={(e) => setSelectedSucursalForStats(e.target.value)}
                          className="text-[9px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none uppercase tracking-tighter cursor-pointer transition-all hover:border-slate-300"
                        >
                          <option value="">TODAS LAS SUCURSALES</option>
                          {SUCURSALES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                          <option value="SIN SUCURSAL">SIN SUCURSAL</option>
                        </select>
                      </div>

                      {/* Filtro de Trabajador */}
                      <div className="flex flex-col gap-1 min-w-[140px]">
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest">Trabajador</span>
                        <select
                          value={selectedWorkerIdForStats}
                          onChange={(e) => setSelectedWorkerIdForStats(e.target.value)}
                          className="text-[9px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none uppercase tracking-tighter cursor-pointer transition-all hover:border-slate-300"
                        >
                          <option value="">TODOS TRABAJADORES</option>
                          {workers.map(w => (
                            <option key={w.uid} value={w.uid}>{w.displayName}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filtro de Motivo de Préstamo */}
                      <div className="flex flex-col gap-1 min-w-[140px]">
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest">Motivo del Préstamo</span>
                        <select
                          value={selectedMotiveIdForStats}
                          onChange={(e) => setSelectedMotiveIdForStats(e.target.value)}
                          className="text-[9px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none uppercase tracking-tighter cursor-pointer transition-all hover:border-slate-300"
                        >
                          <option value="">TODOS LOS MOTIVOS</option>
                          {motives.map(m => (
                            <option key={m.id} value={m.id}>{m.name.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filtro de Moneda */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest">Moneda</span>
                        <select
                          value={selectedCurrencyForStats}
                          onChange={(e) => setSelectedCurrencyForStats(e.target.value as Currency)}
                          className="text-[9px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none uppercase tracking-tighter cursor-pointer transition-all hover:border-slate-300"
                        >
                          <option value={Currency.USD}>USD ($)</option>
                          <option value={Currency.EUR}>EUR (€)</option>
                        </select>
                      </div>

                      {/* Filtro de Estado */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[7.5px] font-bold text-slate-400 uppercase tracking-widest">Estado</span>
                        <select
                          value={selectedStatusForStats}
                          onChange={(e) => setSelectedStatusForStats(e.target.value)}
                          className="text-[9px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none uppercase tracking-tighter cursor-pointer transition-all hover:border-slate-300"
                        >
                          <option value="active">ACTIVOS / APROBADOS</option>
                          <option value="completed">FINALIZADOS</option>
                          <option value="pending">PENDIENTES</option>
                          <option value="all">TODOS LOS ESTADOS</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Tarjetas de Datos de Resumen Rápido */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Empleados en Filtro</p>
                      <p className="text-base font-bold text-slate-800 font-mono">
                        {workerAnalysisData.length} <span className="text-[9px] text-slate-400 uppercase font-sans font-normal">pers.</span>
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volumen Total Filtrado</p>
                      <p className="text-base font-bold text-brand-600 font-mono">
                        {selectedCurrencyForStats === Currency.USD ? '$' : '€'}{filteredLoansForStats.reduce((acc, l) => acc + l.amountForeign, 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Número de Préstamos</p>
                      <p className="text-base font-bold text-indigo-600 font-mono">
                        {filteredLoansForStats.length} <span className="text-[9px] text-slate-400 uppercase font-sans font-normal">créds.</span>
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Saldos Totales por Cobrar</p>
                      <p className="text-base font-bold text-emerald-600 font-mono">
                        {selectedCurrencyForStats === Currency.USD ? '$' : '€'}{Math.round(filteredLoansForStats.reduce((acc, l) => acc + getLoanRemainingBalance(l), 0)).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Renderizado de gráficos */}
                  {filteredLoansForStats.length === 0 ? (
                    <div className="h-[280px] flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-6 text-center">
                      <Users className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">No hay datos que coincidan con los filtros</p>
                      <p className="text-[8.5px] text-slate-400 uppercase tracking-tighter mt-1">Prueba cambiando los criterios de divisa, estado del préstamo, sucursal, motivo o seleccionando todos los trabajadores</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {/* Gráfico 1: Sucursal */}
                      <div className="p-4 bg-slate-50/30 border border-slate-100 rounded-xl transition-all hover:bg-white hover:shadow-xs">
                        <div className="mb-4">
                          <h4 className="text-[9.5px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-brand-600 rounded-full"></span>
                            Montos y Saldos por Sucursal ({selectedCurrencyForStats})
                          </h4>
                        </div>
                        <div className="h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sucursalAnalysisData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="displayName" 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                tickLine={false} 
                                tickFormatter={(val) => val.toUpperCase()} 
                              />
                              <YAxis 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                tickLine={false} 
                                axisLine={false} 
                              />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '7px', fontWeight: 'bold', paddingTop: '5px', textTransform: 'uppercase' }} />
                              <Bar 
                                dataKey="montoTotal" 
                                name="MONTO ASIGNADO" 
                                fill="#2563eb" 
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                              />
                              <Bar 
                                dataKey="saldoTotal" 
                                name="SALDO PENDIENTE" 
                                fill="#059669" 
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Gráfico 2: Departamento */}
                      <div className="p-4 bg-slate-50/30 border border-slate-100 rounded-xl transition-all hover:bg-white hover:shadow-xs">
                        <div className="mb-4">
                          <h4 className="text-[9.5px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                            Montos y Saldos por Departamento ({selectedCurrencyForStats})
                          </h4>
                        </div>
                        <div className="h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={departmentAnalysisData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="displayName" 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                tickLine={false} 
                                tickFormatter={(val) => val.toUpperCase()} 
                              />
                              <YAxis 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                tickLine={false} 
                                axisLine={false} 
                              />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '7px', fontWeight: 'bold', paddingTop: '5px', textTransform: 'uppercase' }} />
                              <Bar 
                                dataKey="montoTotal" 
                                name="MONTO ASIGNADO" 
                                fill="#6366f1" 
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                              />
                              <Bar 
                                dataKey="saldoTotal" 
                                name="SALDO PENDIENTE" 
                                fill="#d97706" 
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Gráfico 3: Motivos */}
                      <div className="p-4 bg-slate-50/30 border border-slate-100 rounded-xl transition-all hover:bg-white hover:shadow-xs">
                        <div className="mb-4">
                          <h4 className="text-[9.5px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                            Montos y Saldos por Motivo ({selectedCurrencyForStats})
                          </h4>
                        </div>
                        <div className="h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={motiveAnalysisData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="displayName" 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                tickLine={false} 
                                tickFormatter={(val) => val.toUpperCase()} 
                              />
                              <YAxis 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                tickLine={false} 
                                axisLine={false} 
                              />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '7px', fontWeight: 'bold', paddingTop: '5px', textTransform: 'uppercase' }} />
                              <Bar 
                                dataKey="montoTotal" 
                                name="MONTO ASIGNADO" 
                                fill="#8b5cf6" 
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                              />
                              <Bar 
                                dataKey="saldoTotal" 
                                name="SALDO PENDIENTE" 
                                fill="#ec4899" 
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Gráfico 4: Trabajador */}
                      <div className="p-4 bg-slate-50/30 border border-slate-100 rounded-xl transition-all hover:bg-white hover:shadow-xs">
                        <div className="mb-4">
                          <h4 className="text-[9.5px] font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                            Montos y Saldos por Trabajador ({selectedCurrencyForStats})
                          </h4>
                        </div>
                        <div className="h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={workerAnalysisData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="displayName" 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                tickLine={false} 
                                tickFormatter={(val) => val.toUpperCase()} 
                              />
                              <YAxis 
                                stroke="#94a3b8" 
                                fontSize={8} 
                                tickLine={false} 
                                axisLine={false} 
                              />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend wrapperStyle={{ fontSize: '7px', fontWeight: 'bold', paddingTop: '5px', textTransform: 'uppercase' }} />
                              <Bar 
                                dataKey="montoTotal" 
                                name="MONTO ASIGNADO" 
                                fill="#14b8a6" 
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                              />
                              <Bar 
                                dataKey="saldoTotal" 
                                name="SALDO PENDIENTE" 
                                fill="#f43f5e" 
                                radius={[4, 4, 0, 0]}
                                maxBarSize={20}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'workers' ? (
              <WorkerManagement />
            ) : activeTab === 'motives' ? (
              <MotiveManagement />
            ) : activeTab === 'payments' ? (
                <PaymentManagement worker={worker} />
            ) : activeTab === 'disbursements' ? (
                <DisbursementManagement loans={loans} worker={worker} />
            ) : activeTab === 'paymentHistory' ? (
                <PaymentHistoryReport settings={settings} />
            ) : activeTab === 'settings' ? (
              <SettingsManagement settings={settings} />
            ) : (
              <div className="space-y-px">
                {(activeTab === 'active' || activeTab === 'history') && (
                  <div className="bg-white border-x border-t border-slate-200 p-3 flex flex-wrap gap-6 items-center">
                    <div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Cartera Seleccionada</p>
                      <p className="text-sm font-bold text-slate-800 font-mono">
                        {formatUSD(activeLoans.filter(l => l.currency === Currency.USD).reduce((acc, l) => acc + l.amountForeign, 0))}
                        <span className="text-slate-300 mx-2">|</span>
                        {formatEUR(activeLoans.filter(l => l.currency === Currency.EUR).reduce((acc, l) => acc + l.amountForeign, 0))}
                      </p>
                    </div>
                    <div className="h-8 w-px bg-slate-100" />
                    <div>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Saldo Pendiente Total</p>
                      <p className="text-sm font-bold text-brand-600 font-mono">
                        {formatUSD(activeLoans.filter(l => l.currency === Currency.USD).reduce((acc, l) => acc + getLoanRemainingBalance(l), 0))}
                        <span className="text-slate-300 mx-2">|</span>
                        {formatEUR(activeLoans.filter(l => l.currency === Currency.EUR).reduce((acc, l) => acc + getLoanRemainingBalance(l), 0))}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-12 px-4 py-2 bg-slate-100/50 border border-slate-200 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="col-span-4">Trabajador / Referencia</div>
                  <div className="col-span-3 text-center">Monto (FX)</div>
                  <div className="col-span-2 text-center">Cuotas</div>
                  <div className="col-span-3 text-right">Acciones</div>
                </div>
                {(activeTab === 'pending' ? pendingLoans : activeTab === 'active' ? activeLoans : filteredLoansForTab).map(loan => (
                  <AdminLoanCard 
                    key={loan.id} 
                    loan={loan} 
                    onApprove={() => handleApprove(loan)} 
                    onReject={() => handleReject(loan)}
                    onAnalyze={() => generateAIReport(loan)}
                    onDelete={() => deleteLoan(loan.id)}
                    onViewDetail={() => setSelectedLoanForDetail(loan)}
                    isAnalyzing={generatingReport === loan.id}
                    isDeleting={deletingLoanId === loan.id}
                    getMotiveName={getMotiveName}
                  />
                ))}
                {(activeTab === 'pending' ? pendingLoans : activeTab === 'active' ? activeLoans : filteredLoansForTab).length === 0 && (
                  <div className="dense-card p-12 text-center text-slate-300 border-dashed bg-transparent">
                    SIN REGISTROS EN ESTA CATEGORÍA
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <ExchangeRateWidget settings={settings} isAdmin />
          
          <div className="dense-card flex flex-col bg-white">
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50">
               <span className="dense-label">Últimos Ingresos</span>
            </div>
            <div className="p-2 divide-y divide-slate-50">
              {workers.slice(0, 5).map(w => (
                <div key={w.uid} className="flex items-center gap-3 p-2 hover:bg-slate-50 transition-colors cursor-pointer rounded">
                  <div className="w-7 h-7 bg-slate-900 text-white rounded text-[10px] flex items-center justify-center font-bold">
                    {w.displayName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-800 truncate uppercase">{w.displayName}</p>
                    <p className="text-[9px] text-slate-400 font-bold tracking-tighter">{w.department || 'GLOBAL'}</p>
                  </div>
                </div>
              ))}
            </div>
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

      <ConfirmationModal 
        isOpen={confirmDeleteModal.isOpen}
        title={confirmDeleteModal.title}
        message={confirmDeleteModal.message}
        onClose={() => setConfirmDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDeleteModal.onResolve}
        confirmText="Borrar Permanentemente"
      />

      <AnimatePresence>
        {showAuditModal && (
          <GlobalAuditModal 
            onClose={() => setShowAuditModal(false)}
            settings={settings}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLoanForDetail && (
          <LoanDetailModal 
            loan={selectedLoanForDetail} 
            onClose={() => setSelectedLoanForDetail(null)}
            workers={workers}
            settings={settings}
            onGenerateDoc={(l, w) => generateApprovalDocument(l, w, settings)}
            onApprove={(l) => {
              handleApprove(l);
              setSelectedLoanForDetail(null);
            }}
            onReject={(l, reason) => {
              handleReject(l, reason);
              setSelectedLoanForDetail(null);
            }}
            getMotiveName={getMotiveName}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoanDetailModal({ loan, onClose, onApprove, onReject, workers, settings, onGenerateDoc, getMotiveName }: { 
  loan: Loan; 
  onClose: () => void;
  onApprove: (loan: Loan) => void;
  onReject: (loan: Loan, reason: string) => void;
  workers: Worker[];
  settings: SystemSettings | null;
  onGenerateDoc: (loan: Loan, worker: Worker) => void;
  getMotiveName: (motiveId: string) => string;
}) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const currentWorker = workers.find(w => w.uid === loan.workerId);

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
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="relative bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="bg-slate-900 p-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-500/20 rounded-lg flex items-center justify-center border border-brand-500/30">
              <History className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-tight">Revisión de Solicitud</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Ref: {loan.loanNumber || `#${loan.id.slice(-6).toUpperCase()}`}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-all"
          >
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
           <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Documento de Autorización</span>
           </div>
           <button 
            onClick={() => currentWorker && onGenerateDoc(loan, currentWorker)}
            className="bg-emerald-600 text-white px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm"
           >
             <Download className="w-3.5 h-3.5" />
             Descargar PDF
           </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-slate-100">
             <div className="space-y-4">
                <div>
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Trabajador</span>
                   <p className="text-sm font-bold text-slate-800 uppercase leading-none">{loan.workerName}</p>
                   <p className="text-[10px] text-slate-500 font-medium lowercase italic">{loan.requestedBy || 'N/A'}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Monto Solicitado</span>
                      <p className="text-lg font-bold font-mono tracking-tighter text-slate-900">
                         {formatCurrency(loan.amountForeign, loan.currency)}
                      </p>
                   </div>
                   <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Cuotas / Frecuencia</span>
                      <p className="text-lg font-bold font-mono tracking-tighter text-slate-900 leading-tight">
                         {loan.totalInstallments} <span className="text-[10px] text-slate-400">MESES</span>
                      </p>
                      <p className="text-[9px] font-bold text-brand-600 uppercase tracking-widest">
                        Pago {loan.repaymentFrequency === RepaymentFrequency.BIWEEKLY ? 'Quincenal' : 'Mensual'}
                      </p>
                   </div>
                </div>
             </div>

             <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-center gap-3">
                <div className="flex items-center justify-between">
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Tasa al Momento (BCV)</span>
                   <span className="text-[10px] font-bold font-mono text-brand-600">{loan.rateAtAgreement.toFixed(4)} Bs.</span>
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Cuota Mensual (FX)</span>
                   <span className="text-[10px] font-bold font-mono text-slate-800">{formatCurrency(getNextInstallmentAmount(loan), loan.currency)}</span>
                </div>
             </div>
          </div>

          <div className="space-y-3">
             <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <PlusCircle className="w-3 h-3" />
                Justificación y Garantía
             </h4>
             <div className="p-4 bg-white border border-slate-200 rounded-lg space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Motivo del Préstamo:</p>
                <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{getMotiveName(loan.motiveId)} {loan.subMotiveId ? `/ ${loan.subMotiveId}` : ''}</p>
                {loan.guaranteeInfo && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Garantía Declarada:</p>
                    <p className="text-xs text-slate-600 mt-1">{loan.guaranteeInfo}</p>
                  </div>
                )}
             </div>
          </div>

          {loan.status === LoanStatus.PENDING && (
            <div className="pt-6 mt-6 border-t border-slate-100">
               {isRejecting ? (
                 <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-50 p-6 rounded-xl border border-red-100 space-y-4"
                 >
                    <div className="flex items-center justify-between">
                       <h4 className="text-[11px] font-bold text-red-600 uppercase tracking-widest">Motivo de Negación</h4>
                       <button onClick={() => setIsRejecting(false)} className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase">Cancelar</button>
                    </div>
                    <textarea 
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Indique brevemente el motivo de la negación (esto se enviará al trabajador)..."
                      className="w-full p-4 bg-white border border-red-200 rounded-lg text-xs font-medium outline-none h-24 focus:ring-1 focus:ring-red-500"
                    />
                    <button 
                      onClick={() => onReject(loan, rejectionReason)}
                      disabled={!rejectionReason.trim()}
                      className="w-full py-3 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 disabled:opacity-50 transition-all shadow-md"
                    >
                      Confirmar Negación (Rechazar)
                    </button>
                 </motion.div>
               ) : (
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => setIsRejecting(true)}
                    className="py-4 bg-white border-2 border-slate-200 text-slate-500 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-2"
                  >
                    <XCircle className="w-5 h-5 text-red-400" />
                    Negar Solicitud
                  </button>
                  <button 
                    onClick={() => onApprove(loan)}
                    className="py-4 bg-brand-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg flex flex-col items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Aprobar Préstamo
                  </button>
                </div>
               )}
            </div>
          )}

          {loan.status === LoanStatus.REJECTED && (
             <div className="p-4 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Motivo de Negación</p>
                <p className="text-xs text-red-800 font-medium italic">"{loan.rejectionReason || 'No se proporcionó motivo'}"</p>
                <p className="text-[8px] text-red-400 font-bold uppercase mt-2">Negado por: {loan.rejectedBy}</p>
             </div>
          )}

          {loan.disbursementDate && (
             <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Detalles de Abono (PAGADO)</p>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Referencia</p>
                      <p className="text-xs font-bold text-slate-800 uppercase">{loan.disbursementReference}</p>
                   </div>
                   <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">Fecha de Abono</p>
                      <p className="text-xs font-bold text-slate-800">{new Date(loan.disbursementDate).toLocaleDateString()}</p>
                   </div>
                </div>
                <p className="text-[8px] text-emerald-500 font-bold uppercase mt-2">Ejecutado por: {loan.disbursementBy}</p>
             </div>
          )}
        </div>

        <div className="bg-slate-50 p-4 flex justify-center border-t border-slate-200">
            <button 
              onClick={onClose}
              className="px-8 py-2 bg-slate-800 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
            >
              Cerrar Revisión
            </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, highlight = false }: any) {
  return (
    <div className="dense-card p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="dense-label">{label}</span>
        <Icon className={cn("w-3.5 h-3.5", highlight ? "text-brand-600" : "text-slate-300")} />
      </div>
      <p className={cn("text-xl font-bold font-mono tracking-tighter", highlight ? "text-brand-600" : "text-slate-800")}>{value}</p>
    </div>
  );
}

function TabButton({ children, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-[10px] font-bold transition-all border-b-2 uppercase tracking-widest",
        active ? "border-brand-600 text-brand-600 bg-brand-50/30" : "border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}

interface AdminLoanCardProps {
  loan: Loan;
  onApprove: () => void;
  onReject: () => void;
  onAnalyze: () => void;
  onDelete: () => void;
  onViewDetail: () => void;
  isAnalyzing: boolean;
  isDeleting: boolean;
  getMotiveName: (motiveId: string) => string;
}

const AdminLoanCard: React.FC<AdminLoanCardProps> = ({ loan, onApprove, onReject, onAnalyze, onDelete, onViewDetail, isAnalyzing, isDeleting, getMotiveName }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
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

  const deletePayment = async (paymentId: string) => {
    setConfirmDeleteModal({
      isOpen: true,
      title: '¿ELIMINAR ESTE REGISTRO DE PAGO?',
      message: 'Esta acción es irreversible y afectará el balance del préstamo.',
      onResolve: async () => {
        try {
          // 1. Delete the payment document
          await deleteDoc(doc(db, 'loans', loan.id, 'payments', paymentId));
          
          // 2. Refetch local payments to update UI
          setPayments(prev => prev.filter(p => p.id !== paymentId));
          
          alert('Pago eliminado de la base de datos.');
        } catch (error: any) {
           console.error("Error deleting payment:", error);
           alert(`Error al eliminar pago: ${error.message}`);
        }
      }
    });
  };

  const balanceAmount = getLoanRemainingBalance(loan);
  const paidAmount = Math.max(0, loan.amountForeign - balanceAmount);

  return (
    <div className="bg-white border-x border-b border-slate-200 overflow-hidden">
      <div 
        className="p-3 flex items-center grid grid-cols-12 hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="col-span-4">
          <p className="text-[11px] font-bold text-slate-800 uppercase truncate">{loan.workerName}</p>
          <p className="text-[9px] text-slate-400 font-mono flex items-center gap-1">
            REF: {loan.loanNumber || `#${loan.id.slice(-6).toUpperCase()}`}
            {loan.motiveId && (
              <span className="text-slate-300 ml-1 italic">• {getMotiveName(loan.motiveId)}{loan.subMotiveId ? ` / ${loan.subMotiveId}` : ''}</span>
            )}
          </p>
        </div>
        <div className="col-span-4 text-center grid grid-cols-3 gap-1 px-4">
          <div>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Total</p>
            <p className="text-[10px] font-bold text-slate-700 font-mono">
              {formatCurrency(loan.amountForeign, loan.currency)}
            </p>
          </div>
          <div>
            <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-tighter">Pagado</p>
            <p className="text-[10px] font-bold text-emerald-600 font-mono">
              {formatCurrency(paidAmount, loan.currency)}
            </p>
          </div>
          <div>
            <p className="text-[8px] font-bold text-brand-500 uppercase tracking-tighter">Saldo</p>
            <p className="text-[10px] font-bold text-brand-600 font-mono">
              {formatCurrency(balanceAmount, loan.currency)}
            </p>
          </div>
        </div>
        <div className="col-span-1 text-center">
          <span className="text-[9px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
            {loan.totalInstallments - loan.remainingInstallments}/{loan.totalInstallments}M
          </span>
        </div>
        <div className="col-span-3 flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onViewDetail();
            }}
            className="p-1.5 bg-slate-100 text-slate-500 hover:bg-brand-50 hover:text-brand-600 rounded transition-all"
            title="Ver Detalles / Acciones"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            className="px-2 py-1 bg-red-600 text-white rounded text-[9px] font-bold uppercase tracking-tighter hover:bg-red-700 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            title="Eliminar Préstamo"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            BORRAR
          </button>
          
          <button 
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
            title="Analizar con IA"
          >
            {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePieChart className="w-3.5 h-3.5" />}
          </button>

          {loan.status === LoanStatus.PENDING ? (
            <>
              <button 
                onClick={onReject}
                className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-100 rounded text-[9px] font-bold uppercase tracking-tighter transition-all"
              >
                NEG
              </button>
              <button 
                onClick={onApprove}
                className="px-2 py-1 bg-brand-600 text-white hover:bg-brand-700 rounded text-[9px] font-bold uppercase tracking-tighter transition-all shadow-sm"
              >
                APR
              </button>
            </>
          ) : (
            <div className={cn(
              "px-2 py-1 rounded text-[9px] font-bold uppercase tracking-tighter",
              loan.disbursementDate ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
            )}>
              {loan.disbursementDate ? 'PAGADO' : loan.status}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-slate-50/50 border-t border-slate-100 overflow-hidden"
          >
            <div className="p-4">
               {/* Danger Zone for individual loan */}
               <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex gap-3">
                     <div className="w-8 h-8 bg-red-100 text-red-600 rounded flex items-center justify-center shrink-0">
                        <Trash2 className="w-4 h-4" />
                     </div>
                     <div>
                        <p className="text-[11px] font-bold text-red-900 uppercase tracking-tight">Zona de Control Crítico</p>
                        <p className="text-[9px] text-red-700 font-medium">Elimine este registro solo si fue un error. Esta acción borrará el préstamo y todos sus pagos asociados permanentemente.</p>
                     </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    disabled={isDeleting}
                    className="whitespace-nowrap px-4 py-2 bg-red-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                     {isDeleting && <Loader2 className="w-3 h-3 animate-spin" />}
                     BORRAR REGISTRO COMPLETO
                  </button>
               </div>

               <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <History className="w-3 h-3" />
                    Detalle de Amortización
                  </h4>
                  <div className="text-[8px] font-mono text-slate-400">
                    TASA_PATA: {loan.rateAtAgreement} BS/{loan.currency}
                  </div>
               </div>

               {loading ? (
                 <div className="py-4 text-center">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300 mx-auto" />
                 </div>
               ) : payments.length === 0 ? (
                 <div className="py-4 text-center border border-dashed border-slate-200 rounded text-[9px] text-slate-400 uppercase font-bold">
                    No hay pagos registrados
                 </div>
               ) : (
                 <div className="space-y-1">
                    {payments.map(p => (
                      <div key={p.id} className="bg-white border border-slate-100 p-2 rounded flex items-center justify-between group/payment">
                         <div className="flex items-center gap-3">
                            <Receipt className="w-3 h-3 text-emerald-500" />
                            <div>
                               <p className="text-[10px] font-bold text-slate-800 uppercase tracking-tighter">REF: {p.referenceNumber || 'N/A'}</p>
                               <p className="text-[8px] text-slate-400 uppercase tracking-tighter">{new Date(p.paymentDate).toLocaleDateString()} • {(p.method || '').replace('_', ' ')}</p>
                            </div>
                         </div>
                         <div className="flex items-center gap-3">
                            <div className="text-right">
                               <p className="text-[10px] font-bold text-emerald-600 font-mono">
                                  {formatCurrency(p.amountForeign, loan.currency)}
                               </p>
                               <p className="text-[8px] text-slate-400 font-bold tracking-tighter">
                                  Bs. {p.amountBs.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                            <button 
                              onClick={() => deletePayment(p.id)}
                              className="px-2 py-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded transition-all text-[9px] font-bold uppercase tracking-tighter flex items-center gap-1"
                              title="Eliminar Pago"
                            >
                                <Trash2 className="w-3 h-3" />
                                BORRAR
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
               )}

               {loan.repaymentSchedule && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                      {loan.repaymentSchedule.map((inst, idx) => (
                        <div 
                          key={idx}
                          title={`Cuota ${inst.installmentNumber}: ${inst.status}`}
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            inst.status === 'paid' ? "bg-emerald-500" : "bg-slate-200"
                          )}
                        />
                      ))}
                    </div>
                    <p className="text-[8px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">
                      Plan de Cuotas: {loan.repaymentSchedule.filter(i => i.status === 'paid').length} pagadas de {loan.totalInstallments}
                    </p>
                  </div>
               )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={confirmDeleteModal.isOpen}
        title={confirmDeleteModal.title}
        message={confirmDeleteModal.message}
        onClose={() => setConfirmDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDeleteModal.onResolve}
        confirmText="Confirmar Borrado"
      />
    </div>
  );
}



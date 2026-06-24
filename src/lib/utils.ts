import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loan } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'VES') {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatUSD(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatEUR(amount: number) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function getLoanRemainingBalance(loan: Loan): number {
  const is630Legacy = loan.amountForeign === 630 && loan.totalInstallments === 7;
  
  if (is630Legacy) {
    const paidCount = loan.totalInstallments - loan.remainingInstallments;
    const totalPaid = paidCount * 100;
    return Math.max(0, 630 - totalPaid);
  }

  if (loan.repaymentSchedule && loan.repaymentSchedule.length > 0) {
    return loan.repaymentSchedule
      .filter(i => i.status === 'pending')
      .reduce((sum, i) => sum + i.amountForeign, 0);
  }
  
  const fixedAmt = loan.fixedInstallmentAmount || (loan.amountForeign / (loan.totalInstallments || 1));
  const paidCount = loan.totalInstallments - loan.remainingInstallments;
  const totalPaid = paidCount * fixedAmt;
  return Math.max(0, loan.amountForeign - totalPaid);
}

export function getNextInstallmentAmount(loan: Loan): number {
  const is630Legacy = loan.amountForeign === 630 && loan.totalInstallments === 7;
  if (is630Legacy) {
    if (loan.remainingInstallments > 1) {
      return 100;
    } else if (loan.remainingInstallments === 1) {
      return 30;
    }
  }

  if (loan.repaymentSchedule && loan.repaymentSchedule.length > 0) {
    const nextPending = loan.repaymentSchedule.find(i => i.status === 'pending');
    if (nextPending) {
      return nextPending.amountForeign;
    }
  }
  return loan.amountForeign / (loan.totalInstallments || 1);
}


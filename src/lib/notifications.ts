import { collection, addDoc, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { NotificationType, AppNotification } from '../types';
import { handleFirestoreError, OperationType } from './firestore-errors';

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: NotificationType
) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    // Silent fail in UI but log for debugging
    try {
      handleFirestoreError(error, OperationType.CREATE, 'notifications');
    } catch (inner) {
      console.error('Detailed security error:', inner);
    }
  }
};

export const checkUpcomingPayments = async (workerId: string, loans: any[]) => {
  // Logic to check if any installment is due in the next 3 days
  // and if a notification has already been sent recently for it
  const today = new Date();
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(today.getDate() + 3);

  for (const loan of loans) {
    if (!loan.repaymentSchedule) continue;

    for (const installment of loan.repaymentSchedule) {
      if (installment.status === 'pending') {
        const dueDate = new Date(installment.dueDate);
        if (dueDate >= today && dueDate <= threeDaysFromNow) {
          // Check if we already notified for this installment in the last 7 days
          // to avoid spamming every day when someone logs in
          const q = query(
            collection(db, 'notifications'),
            where('userId', '==', workerId),
            where('type', '==', NotificationType.PAYMENT_DUE),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          
          const lastNotif = await getDocs(q);
          const shouldNotify = lastNotif.empty || 
            (new Date().getTime() - new Date(lastNotif.docs[0].data().createdAt).getTime()) > 7 * 24 * 60 * 60 * 1000;

          if (shouldNotify) {
            await createNotification(
                workerId,
                'Pago Próximo a Vencer',
                `Su cuota #${installment.installmentNumber} del préstamo REF:${loan.id.slice(-6).toUpperCase()} vence el día ${dueDate.toLocaleDateString()}.`,
                NotificationType.PAYMENT_DUE
            );
          }
        }
      }
    }
  }
};

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { AppNotification, Worker } from '../types';
import { Bell, CheckCircle2, Clock, Info, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface Props {
  worker: Worker;
}

export default function NotificationBell({ worker }: Props) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!worker.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', worker.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
      setLoading(false);
    });

    return () => unsub();
  }, [worker.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDoc(doc(db, 'notifications', id));
  };

  const clearAllNotifications = async () => {
    if (!confirm('¿Deseas eliminar todas las notificaciones?')) return;
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden"
            >
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <Bell className="w-3 h-3" />
                  Notificaciones
                </h3>
                {notifications.length > 0 && (
                  <button 
                    onClick={clearAllNotifications}
                    className="text-[9px] font-bold text-red-600 hover:text-red-700 uppercase"
                  >
                    Eliminar Todo
                  </button>
                )}
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-[9px] font-bold text-brand-600 hover:text-brand-700 uppercase"
                  >
                    Marcar todo como leído
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">Cargando...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-xs text-slate-400">No tienes notificaciones</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        className={cn(
                          "p-3 hover:bg-slate-50 transition-colors relative group",
                          !n.read && "bg-brand-50/30"
                        )}
                        onClick={() => !n.read && markAsRead(n.id)}
                      >
                        <div className="flex gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded shrink-0 flex items-center justify-center",
                            n.type === 'payment_confirmed' ? "bg-emerald-100 text-emerald-600" :
                            n.type === 'payment_due' ? "bg-amber-100 text-amber-600" :
                            "bg-blue-100 text-blue-600"
                          )}>
                            {n.type === 'payment_confirmed' ? <CheckCircle2 className="w-4 h-4" /> :
                             n.type === 'payment_due' ? <Clock className="w-4 h-4" /> :
                             <Info className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-[11px] font-bold text-slate-800", !n.read && "text-brand-700")}>
                                {n.title}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                {n.message}
                            </p>
                            <p className="text-[8px] text-slate-400 mt-1 uppercase font-mono">
                                {new Date(n.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <button 
                            onClick={(e) => deleteNotification(n.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {!n.read && (
                          <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-brand-500 rounded-full" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

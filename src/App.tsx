import React, { useState, useEffect } from 'react';
import { db } from './lib/firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { UserRole, Worker, SystemSettings } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, LogOut, Loader2, Landmark, Wallet, History, Settings, FileText, PlusCircle, Users } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import Layout from './components/Layout';

export default function App() {
  const [worker, setWorker] = useState<Worker | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSettings: (() => void) | null = null;
    let unsubscribeWorker: (() => void) | null = null;

    // 1. Listen to global settings
    unsubscribeSettings = onSnapshot(doc(db, "settings", "global"), async (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as SystemSettings);
      } else {
        // Initialize default settings
        const defaultSettings: SystemSettings = {
          usdRate: 36.5,
          eurRate: 39.2,
          lastUpdated: new Date().toISOString(),
          updatedBy: "system-init"
        };
        await setDoc(doc(db, "settings", "global"), defaultSettings);
        setSettings(defaultSettings);
      }
    });

    // 2. Read local session worker ID
    const storedWorkerId = localStorage.getItem('session_worker_id');
    if (storedWorkerId) {
      // Keep a real-time subscription to the worker document
      unsubscribeWorker = onSnapshot(doc(db, "workers", storedWorkerId), (snap) => {
        if (snap.exists()) {
          setWorker(snap.data() as Worker);
        } else {
          // Worker was deleted or doesn't exist anymore
          localStorage.removeItem('session_worker_id');
          setWorker(null);
        }
        setLoading(false);
      }, (err) => {
        console.error("Worker sync error:", err);
        setLoading(false);
      });
    } else {
      setWorker(null);
      setLoading(false);
    }

    return () => {
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribeWorker) unsubscribeWorker();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!worker) {
    return <Login />;
  }

  return (
    <Layout worker={worker} settings={settings}>
      <AnimatePresence mode="wait">
        <motion.div
          key={worker.role}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {worker.role === UserRole.ADMIN ? (
            <AdminDashboard worker={worker} settings={settings} />
          ) : (
            <Dashboard worker={worker} settings={settings} />
          )}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

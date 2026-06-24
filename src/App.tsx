import React, { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSettings: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Cleanup previous settings listener if any
      if (unsubscribeSettings) {
        unsubscribeSettings();
        unsubscribeSettings = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Listen to global settings - Only when signed in to avoid permission errors
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

        // Sync user profile
        try {
          const workerDoc = await getDoc(doc(db, "workers", firebaseUser.uid));
          const isBootstrapAdmin = firebaseUser.email === "cesar.guaimare@gmail.com";
          
          if (workerDoc.exists()) {
            const existingWorker = workerDoc.data() as Worker;
            // Auto-upgrade to admin if it's the specific user
            if (isBootstrapAdmin && existingWorker.role !== UserRole.ADMIN) {
              const upgradedWorker = { ...existingWorker, role: UserRole.ADMIN };
              await setDoc(doc(db, "workers", firebaseUser.uid), upgradedWorker, { merge: true });
              setWorker(upgradedWorker);
            } else {
              setWorker(existingWorker);
            }
          } else {
            // Create new profile
            const newWorker: Worker = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || "Empleado",
              email: firebaseUser.email || "",
              role: isBootstrapAdmin ? UserRole.ADMIN : UserRole.EMPLOYEE,
              createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, "workers", firebaseUser.uid), newWorker);
            setWorker(newWorker);
          }
        } catch (profileError) {
          console.error("Profile sync error:", profileError);
          // Minimum worker profile for bootstrap user even if Firestore fails (unlikely now with rules fix)
          if (firebaseUser.email === "cesar.guaimare@gmail.com") {
            setWorker({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || "Admin",
              email: firebaseUser.email || "",
              role: UserRole.ADMIN,
              createdAt: new Date().toISOString()
            });
          }
        }
      } else {
        setUser(null);
        setWorker(null);
        setSettings(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Guard: Don't render dashboard until worker profile is synchronized
  if (!worker) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
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

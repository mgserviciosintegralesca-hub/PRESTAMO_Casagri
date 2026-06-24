import React from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Landmark, LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-brand-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass p-8 rounded-3xl w-full max-w-md shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-200 rotate-3">
            <Landmark className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight uppercase tracking-tight">SISTEMA PARA CONTROL DE PRESTAMOS</h1>
            <p className="text-slate-500 text-sm">Plataforma administrativa de gestión de préstamos indexados</p>
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-semibold flex items-center justify-center space-x-3 transition-all active:scale-[0.98] group"
          >
            <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            <span>Acceder con Google</span>
          </button>

          <p className="text-xs text-slate-400">
            Acceso exclusivo para personal autorizado de la empresa.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

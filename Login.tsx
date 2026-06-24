import React, { useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Landmark, LogIn, Shield, User, Mail, Briefcase, Building, Key, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole, Worker } from '../types';

const SUCURSALES = [
  'BARQUISIMETO',
  'QUIBOR',
  'BARINAS',
  'ACARIGUA',
  'VALLE DE LA PASCUA',
  'YARITAGUA'
];

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile creation state
  const [isRegistering, setIsRegistering] = useState(false);
  const [regData, setRegData] = useState({
    displayName: '',
    email: '',
    idNumber: '',
    department: '',
    cargo: '',
    sucursal: '',
    role: UserRole.EMPLOYEE
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('Por favor, ingrese su usuario y la contraseña.');
      return;
    }

    if (password.trim() !== 'Casagri2026*') {
      setError('Contraseña incorrecta. Acceso denegado.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Format identifier for Firestore lookup
      const cleanId = identifier.trim().includes('@') 
        ? identifier.trim().toLowerCase() 
        : identifier.trim().toUpperCase();

      // 2. Look up worker profile
      const workerDoc = await getDoc(doc(db, 'workers', cleanId));

      if (workerDoc.exists()) {
        // Profile exists - Log in successfully
        localStorage.setItem('session_worker_id', cleanId);
        // Force window reload or allow App state to react
        window.location.reload();
      } else {
        // Profile doesn't exist - Transition to registration/creation mode
        const isEmail = identifier.trim().includes('@');
        setRegData({
          displayName: '',
          email: isEmail ? identifier.trim().toLowerCase() : '',
          idNumber: !isEmail ? identifier.trim().toUpperCase() : '',
          department: '',
          cargo: '',
          sucursal: '',
          role: UserRole.EMPLOYEE
        });
        setIsRegistering(true);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Error al iniciar sesión: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const displayNameClean = regData.displayName.trim();
    const idNumberClean = regData.idNumber.trim().toUpperCase();
    const emailClean = regData.email.trim();
    const sucursalClean = regData.sucursal.trim().toUpperCase();

    if (!displayNameClean || !idNumberClean) {
      setError('Cédula y nombre completo son obligatorios.');
      return;
    }

    if (!sucursalClean) {
      setError('Por favor, seleccione una sucursal.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create user document with uppercase idNumber as the custom ID
      const newWorker: Worker = {
        uid: idNumberClean,
        displayName: displayNameClean,
        email: emailClean,
        idNumber: idNumberClean,
        department: regData.department.trim(),
        cargo: regData.cargo.trim(),
        sucursal: sucursalClean,
        role: regData.role,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'workers', idNumberClean), newWorker);

      // Persist session ID
      localStorage.setItem('session_worker_id', idNumberClean);
      window.location.reload();
    } catch (err: any) {
      console.error('Registration error:', err);
      setError('Error al registrar perfil: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden px-4">
      {/* Background blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-brand-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-indigo-100 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass p-8 rounded-3xl w-full max-w-md shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-200 rotate-3">
            <Landmark className="w-7 h-7" />
          </div>
          
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-tight font-display">CASAGRI - CONTROL DE PRÉSTAMOS</h1>
            <p className="text-slate-500 text-xs font-medium">Gestión interna de préstamos indexados</p>
          </div>
        </div>

        {error && (
          <div className="my-4 bg-red-50 border border-red-100 p-3 rounded-xl text-xs font-bold text-red-600 uppercase">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {!isRegistering ? (
            <motion.form 
              key="login"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleLogin} 
              className="mt-6 space-y-4"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cédula o Email</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white transition-all uppercase placeholder:normal-case"
                    placeholder="Ej: V-12345678 o correo@empresa.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Contraseña Maestra</label>
                <div className="relative flex items-center">
                  <Key className="absolute left-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white transition-all"
                    placeholder="Contraseña del sistema..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center space-x-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <span>Validando...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Validar y Acceder</span>
                  </>
                )}
              </button>

              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-[10px] text-slate-500 font-medium text-center">
                Use la clave maestra autorizada <code className="font-mono font-bold text-slate-700 bg-slate-200 px-1 py-0.5 rounded">Casagri2026*</code> para acceder.
              </div>
            </motion.form>
          ) : (
            <motion.form 
              key="register"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleRegister} 
              className="mt-6 space-y-3.5"
            >
              <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-[10px] font-bold text-brand-700 uppercase leading-snug">
                ⚠️ Usuario nuevo detectado. Complete su perfil administrativo para acceder al sistema.
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cédula o Código</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={regData.idNumber}
                    onChange={(e) => setRegData({ ...regData, idNumber: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 uppercase focus:bg-white"
                    placeholder="V-00000000"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Nombre Completo</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={regData.displayName}
                    onChange={(e) => setRegData({ ...regData, displayName: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 uppercase focus:bg-white"
                    placeholder="Nombre y Apellido"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Correo Electrónico</label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white"
                    placeholder="correo@empresa.com"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Sucursal</label>
                <div className="relative flex items-center">
                  <Building className="absolute left-3 w-4 h-4 text-slate-400" />
                  <select
                    required
                    value={regData.sucursal}
                    onChange={(e) => setRegData({ ...regData, sucursal: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 focus:bg-white"
                  >
                    <option value="">SELECCIONE SUCURSAL...</option>
                    {SUCURSALES.map((suc) => (
                      <option key={suc} value={suc}>
                        {suc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Departamento</label>
                  <input
                    type="text"
                    value={regData.department}
                    onChange={(e) => setRegData({ ...regData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 uppercase focus:bg-white"
                    placeholder="Ej: Administración"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Cargo / Puesto</label>
                  <input
                    type="text"
                    value={regData.cargo}
                    onChange={(e) => setRegData({ ...regData, cargo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-brand-500 uppercase focus:bg-white"
                    placeholder="Ej: Analista"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">Rol / Perfil de Acceso</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegData({ ...regData, role: UserRole.EMPLOYEE })}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold uppercase transition-all ${regData.role === UserRole.EMPLOYEE ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    Usuario Base
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegData({ ...regData, role: UserRole.ADMIN })}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold uppercase transition-all ${regData.role === UserRole.ADMIN ? 'bg-brand-600 text-white border-brand-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                  >
                    Administrador
                  </button>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="flex-1 py-3 text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-2 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:shadow-md transition-all active:scale-[0.98]"
                >
                  {loading ? 'Creando...' : 'Crear y Acceder'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

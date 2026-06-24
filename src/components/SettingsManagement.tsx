import React, { useState } from 'react';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SystemSettings } from '../types';
import { Settings, Save, AlertCircle, TrendingUp, DollarSign, Landmark, Building2, Phone, Mail, MapPin, Fingerprint, Upload, AlertTriangle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  settings: SystemSettings | null;
}

export default function SettingsManagement({ settings }: Props) {
  const [usdRate, setUsdRate] = useState(settings?.usdRate?.toString() || '');
  const [eurRate, setEurRate] = useState(settings?.eurRate?.toString() || '');
  const [usdtRate, setUsdtRate] = useState(settings?.usdtRate?.toString() || settings?.usdRate?.toString() || '');
  const [companyName, setCompanyName] = useState(settings?.companyName || '');
  const [companyAddress, setCompanyAddress] = useState(settings?.companyAddress || '');
  const [companyPhone, setCompanyPhone] = useState(settings?.companyPhone || '');
  const [companyEmail, setCompanyEmail] = useState(settings?.companyEmail || '');
  const [companyTaxId, setCompanyTaxId] = useState(settings?.companyTaxId || '');
  const [companyLogo, setCompanyLogo] = useState(settings?.companyLogo || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmationInput, setResetConfirmationInput] = useState('');
  const [resetError, setResetError] = useState('');

  React.useEffect(() => {
    if (settings) {
      setUsdRate(settings.usdRate?.toString() || '');
      setEurRate(settings.eurRate?.toString() || '');
      setUsdtRate(settings.usdtRate?.toString() || settings.usdRate?.toString() || '');
      setCompanyName(settings.companyName || '');
      setCompanyAddress(settings.companyAddress || '');
      setCompanyPhone(settings.companyPhone || '');
      setCompanyEmail(settings.companyEmail || '');
      setCompanyTaxId(settings.companyTaxId || '');
      setCompanyLogo(settings.companyLogo || '');
    }
  }, [settings]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200000) { // 200KB limit for base64 storage
        setMessage('Error: El logo debe pesar menos de 200KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        usdRate: parseFloat(usdRate),
        eurRate: parseFloat(eurRate),
        usdtRate: parseFloat(usdtRate) || parseFloat(usdRate),
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
        companyTaxId,
        companyLogo,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'manual-admin'
      }, { merge: true });
      setMessage('Ajustes guardados correctamente');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error updating settings:', error);
      setMessage('Error al guardar ajustes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="dense-card p-6 bg-white">
        <form onSubmit={handleUpdateSettings} className="space-y-8">
          {/* Section: Economic Rates */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <h3 className="dense-label !text-slate-800">Parámetros Económicos (Indexación)</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <DollarSign className="w-3 h-3" />
                  Tasa BCV USD (VES)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={usdRate}
                  onChange={(e) => setUsdRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-bold font-mono outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="0.0000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Landmark className="w-3 h-3" />
                  Tasa BCV EUR (VES)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={eurRate}
                  onChange={(e) => setEurRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-bold font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="0.0000"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <DollarSign className="w-3 h-3 text-amber-500" />
                  Tasa USDT (VES)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={usdtRate}
                  onChange={(e) => setUsdtRate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm font-bold font-mono outline-none focus:ring-1 focus:ring-amber-500"
                  placeholder="0.0000"
                />
              </div>
            </div>
          </div>

          {/* Section: Branding & Company Info */}
          <div className="pt-8 border-t border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="w-4 h-4 text-slate-400" />
              <h3 className="dense-label !text-slate-800">Personalización de la Empresa</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Logo Upload Column */}
              <div className="md:col-span-4 space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Upload className="w-3 h-3" />
                  Logo Corporativo
                </label>
                <div className="relative group">
                  <div className="w-full h-32 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center bg-slate-50 overflow-hidden relative">
                    {companyLogo ? (
                      <img src={companyLogo} alt="Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-4">
                        <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-[8px] font-bold text-slate-400 uppercase">Sin Logo</p>
                      </div>
                    )}
                    <label className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <span className="text-white text-[9px] font-bold uppercase tracking-widest">Cambiar Foto</span>
                    </label>
                  </div>
                  <p className="text-[8px] text-slate-400 mt-2 italic">* Máximo 200KB. Formato PNG/JPG/WEBP recomendado.</p>
                  {companyLogo && (
                    <button 
                      type="button"
                      onClick={() => setCompanyLogo('')}
                      className="mt-2 text-[8px] font-bold text-red-500 uppercase hover:underline"
                    >
                      Remover Logo
                    </button>
                  )}
                </div>
              </div>

              {/* Data Column 1 */}
              <div className="md:col-span-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Building2 className="w-3 h-3" />
                    Nombre de la Empresa
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="NOMBRE COMERCIAL"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Fingerprint className="w-3 h-3" />
                    RIF / TAX ID
                  </label>
                  <input
                    type="text"
                    value={companyTaxId}
                    onChange={(e) => setCompanyTaxId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="J-00000000-0"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="admin@empresa.com"
                  />
                </div>
              </div>

              {/* Data Column 2 */}
              <div className="md:col-span-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Phone className="w-3 h-3" />
                    Teléfono de Contacto
                  </label>
                  <input
                    type="text"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none focus:ring-1 focus:ring-brand-500"
                    placeholder="+58 212 000 0000"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    Dirección Fiscal
                  </label>
                  <textarea
                    rows={4}
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-brand-500 resize-none"
                    placeholder="DIRECCIÓN COMPLETA"
                  />
                </div>
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-2 rounded text-[10px] font-bold flex items-center gap-2 ${message.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{message.toUpperCase()}</span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-brand-600 text-white px-8 py-2.5 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-brand-200"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar Configuración General
            </button>
          </div>
        </form>

        {/* Section: Danger Zone */}
        <div className="mt-12 pt-12 border-t border-slate-100">
           <div className="flex items-center gap-3 mb-6">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <h3 className="dense-label !text-red-600">Zona de Peligro / Mantenimiento</h3>
            </div>
            <div className="bg-red-50 border border-red-100 p-6 rounded-lg">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                     <p className="text-[11px] font-bold text-red-900 uppercase">Reiniciar Base de Datos</p>
                     <p className="text-[9px] text-red-700 font-medium">Esta acción eliminará todos los préstamos, pagos y notificaciones del sistema. Los trabajadores y motivos se conservarán.</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setResetConfirmationInput('');
                      setResetError('');
                      setShowResetModal(true);
                    }}
                    className="whitespace-nowrap px-6 py-2 bg-red-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 shadow-sm transition-all"
                  >
                    Borrar Todos los Préstamos
                  </button>
               </div>
            </div>
        </div>

        <div className="mt-8 p-4 bg-slate-50 rounded border border-slate-100">
           <div className="flex items-start gap-3">
              <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-slate-700 uppercase">Información de Personalización</p>
                <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">
                  Los datos de la empresa configurados aquí aparecerán en los encabezados de los reportes PDF, 
                  en la interfaz administrativa y en las notificaciones enviadas a los trabajadores.
                </p>
              </div>
           </div>
        </div>

      {/* Custom Confirmation Modal for DB Reset */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 font-sans">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 rounded-lg bg-red-50 text-red-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowResetModal(false);
                      setResetConfirmationInput('');
                      setResetError('');
                    }}
                    className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight mb-2">
                  ¿Reiniciar Base de Datos de Préstamos?
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                  Esta acción eliminará todos los préstamos, pagos y notificaciones del sistema de manera permanente. Esta operación es <strong className="text-red-600 font-bold uppercase">irreversible</strong>. Los trabajadores y motivos se conservarán.
                </p>

                <div className="space-y-2 mt-4 text-left">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    Para confirmar, por favor escriba la frase <span className="text-red-600 font-black">BORRAR TODO</span>:
                  </label>
                  <input
                    type="text"
                    value={resetConfirmationInput}
                    onChange={(e) => {
                      setResetConfirmationInput(e.target.value);
                      if (resetError) setResetError('');
                    }}
                    placeholder="Escriba BORRAR TODO aquí"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-red-500"
                  />
                  {resetError && (
                    <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest">{resetError}</p>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-4 flex gap-3 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetConfirmationInput('');
                    setResetError('');
                  }}
                  className="px-4 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:bg-slate-100 rounded transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={loading || resetConfirmationInput !== 'BORRAR TODO'}
                  onClick={async () => {
                    setLoading(true);
                    setResetError('');
                    try {
                      const loansSnap = await getDocs(collection(db, 'loans'));
                      for (const lDoc of loansSnap.docs) {
                        const pSnap = await getDocs(collection(db, 'loans', lDoc.id, 'payments'));
                        for (const pDoc of pSnap.docs) {
                          await deleteDoc(doc(db, 'loans', lDoc.id, 'payments', pDoc.id));
                        }
                        await deleteDoc(doc(db, 'loans', lDoc.id));
                      }
                      const nSnap = await getDocs(collection(db, 'notifications'));
                      for (const nDoc of nSnap.docs) {
                        await deleteDoc(doc(db, 'notifications', nDoc.id));
                      }
                      setShowResetModal(false);
                      setResetConfirmationInput('');
                      setMessage('Sistema reseteado con éxito');
                      setTimeout(() => setMessage(''), 3000);
                    } catch (err: any) {
                      console.error(err);
                      setResetError('Error de red o de permisos. Intente nuevamente.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-6 py-2 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 uppercase tracking-widest rounded shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirmar Borrado
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Motive } from '../types';
import { Plus, Trash2, X, Tag, ChevronRight, Hash } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmationModal from './ConfirmationModal';

export default function MotiveManagement() {
  const [motives, setMotives] = useState<Motive[]>([]);
  const [newMotive, setNewMotive] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedMotive, setExpandedMotive] = useState<string | null>(null);
  const [newSubMotive, setNewSubMotive] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    const unsub = onSnapshot(collection(db, 'motives'), (snap) => {
      setMotives(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Motive)));
    }, (err) => {
      console.error('Snapshot error:', err);
      setError('Error de permisos al cargar motivos');
    });
    return unsub;
  }, []);

  const handleAddMotive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMotive.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await addDoc(collection(db, 'motives'), {
        name: newMotive.trim(),
        subMotives: []
      });
      setNewMotive('');
    } catch (err: any) {
      console.error('Error adding motive:', err);
      setError(err.message || 'Error al añadir motivo');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMotive = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '¿ELIMINAR MOTIVO?',
      message: '¿Estás seguro de eliminar este motivo? Los préstamos existentes que lo usen seguirán manteniéndolo pero ya no aparecerá como opción.',
      onResolve: async () => {
        setError(null);
        try {
          await deleteDoc(doc(db, 'motives', id));
          alert('Motivo eliminado correctamente');
        } catch (err: any) {
          console.error('Error deleting motive:', err);
          setError(err.message || 'Error al eliminar');
        }
      }
    });
  };

  const handleAddSubMotive = async (motiveId: string) => {
    if (!newSubMotive.trim()) return;
    try {
      await updateDoc(doc(db, 'motives', motiveId), {
        subMotives: arrayUnion(newSubMotive.trim())
      });
      setNewSubMotive('');
    } catch (error) {
      console.error('Error adding sub-motive:', error);
    }
  };

  const handleDeleteSubMotive = async (motiveId: string, subMotive: string) => {
    try {
      await updateDoc(doc(db, 'motives', motiveId), {
        subMotives: arrayRemove(subMotive)
      });
    } catch (error) {
      console.error('Error deleting sub-motive:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="dense-card p-6 bg-white">
        <h3 className="dense-label mb-4">Configurar Tipos de Préstamo</h3>
        
        {error && (
          <div className="mb-4 bg-red-50 border border-red-100 p-2 rounded text-[10px] font-bold text-red-600 flex items-center gap-2">
            <X className="w-3 h-3 cursor-pointer" onClick={() => setError(null)} />
            {error.toUpperCase()}
          </div>
        )}
        
        <form onSubmit={handleAddMotive} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newMotive}
            onChange={(e) => setNewMotive(e.target.value)}
            placeholder="Nuevo motivo (Ej: Salud, Vivienda...)"
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-brand-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-brand-700 transition-all flex items-center gap-2"
          >
            <Plus className="w-3 h-3" />
            Añadir
          </button>
        </form>

        <div className="space-y-2">
          {motives.map((motive) => (
            <div key={motive.id} className="border border-slate-100 rounded overflow-hidden">
              <div 
                className={cn(
                  "flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 transition-colors",
                  expandedMotive === motive.id && "bg-slate-50"
                )}
                onClick={() => setExpandedMotive(expandedMotive === motive.id ? null : motive.id)}
              >
                <div className="flex items-center gap-3">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight">{motive.name}</span>
                  <span className="text-[9px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-500 font-bold">
                    {motive.subMotives.length} SUB-TIPOS
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteMotive(motive.id); }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded transition-all text-[9px] font-bold uppercase tracking-widest"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ELIMINAR
                  </button>
                  <ChevronRight className={cn("w-4 h-4 text-slate-300 transition-transform", expandedMotive === motive.id && "rotate-90")} />
                </div>
              </div>

              <AnimatePresence>
                {expandedMotive === motive.id && (
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden bg-white"
                  >
                    <div className="p-4 border-t border-slate-50 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newSubMotive}
                          onChange={(e) => setNewSubMotive(e.target.value)}
                          placeholder="Nuevo sub-motivo..."
                          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold outline-none"
                        />
                        <button
                          onClick={() => handleAddSubMotive(motive.id)}
                          className="bg-slate-900 text-white px-3 py-1.5 rounded text-[9px] font-bold uppercase tracking-widest"
                        >
                          Añadir Sub-Tipo
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {motive.subMotives.map((sub, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100">
                            <div className="flex items-center gap-2">
                              <Hash className="w-3 h-3 text-slate-400" />
                              <span className="text-[10px] font-medium text-slate-600">{sub}</span>
                            </div>
                            <button 
                              onClick={() => handleDeleteSubMotive(motive.id, sub)}
                              className="text-slate-300 hover:text-red-400"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {motives.length === 0 && (
            <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Sin motivos configurados.<br/>Use el formulario superior para añadir<br/>ej: Salud, Educación, Vivienda.
              </p>
            </div>
          )}
        </div>
      </div>

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

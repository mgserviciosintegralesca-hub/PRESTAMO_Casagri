import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { RefreshCw, TrendingUp, Calendar } from 'lucide-react';
import { SystemSettings } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Props {
  settings: SystemSettings | null;
  isAdmin?: boolean;
}

export default function ExchangeRateWidget({ settings, isAdmin }: Props) {
  const [loading, setLoading] = useState(false);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/rates');
      const { usd, eur } = response.data;
      
      if (isAdmin) {
        await setDoc(doc(db, 'settings', 'global'), {
          usdRate: usd,
          eurRate: eur,
          lastUpdated: new Date().toISOString(),
          updatedBy: 'system'
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dense-card p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <span className="dense-label flex items-center gap-2">
          <TrendingUp className="w-3 h-3 text-brand-600" />
          INDICADORES BCV
        </span>
        {isAdmin && (
          <button 
            onClick={fetchRates}
            disabled={loading}
            className="p-1 hover:bg-slate-100 rounded text-slate-400 disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center border-b border-slate-50 pb-1">
          <span className="text-[10px] font-bold text-slate-500 font-mono">USD/VES</span>
          <span className="text-sm font-bold font-mono text-brand-600">
            {settings?.usdRate ? formatCurrency(settings.usdRate, 'VES') : '---'}
          </span>
        </div>
        <div className="flex justify-between items-center border-b border-slate-50 pb-1">
          <span className="text-[10px] font-bold text-slate-500 font-mono">EUR/VES</span>
          <span className="text-sm font-bold font-mono text-emerald-600">
            {settings?.eurRate ? formatCurrency(settings.eurRate, 'VES') : '---'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-500 font-mono">USDT/VES</span>
          <span className="text-sm font-bold font-mono text-amber-600">
            {settings?.usdtRate ? formatCurrency(settings.usdtRate, 'VES') : (settings?.usdRate ? formatCurrency(settings.usdRate, 'VES') : '---')}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center space-x-1 text-[9px] text-slate-400">
          <Calendar className="w-2.5 h-2.5" />
          <span>{settings?.lastUpdated ? new Date(settings.lastUpdated).toLocaleDateString() : '---'}</span>
        </div>
        <span className="text-[8px] px-1 bg-brand-50 text-brand-600 rounded font-bold">SYNC_ON</span>
      </div>
    </div>
  );
}

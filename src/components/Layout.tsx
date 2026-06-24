import React from 'react';
import { Worker, UserRole, SystemSettings } from '../types';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogOut, Landmark, LayoutDashboard, Settings, HelpCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';
import NotificationBell from './NotificationBell';

interface LayoutProps {
  children: React.ReactNode;
  worker: Worker | null;
  settings: SystemSettings | null;
}

export default function Layout({ children, worker, settings }: LayoutProps) {
  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans text-slate-900">
      {/* Left Navigation Rail */}
      <aside className="w-16 bg-slate-900 flex flex-col items-center py-6 gap-8 shrink-0">
        <div className="w-10 h-10 bg-brand-600 rounded flex items-center justify-center text-white ring-2 ring-brand-400 ring-offset-2 ring-offset-slate-900 overflow-hidden">
          {settings?.companyLogo ? (
            <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-xl">{settings?.companyName?.[0] || 'L'}</span>
          )}
        </div>
        
        <nav className="flex flex-col gap-6">
          <RailItem icon={LayoutDashboard} active />
          {worker?.role === UserRole.ADMIN && <RailItem icon={Settings} />}
          <RailItem icon={HelpCircle} />
        </nav>

        <div className="mt-auto flex flex-col gap-6 pb-2">
          <button 
            onClick={() => signOut(auth)}
            className="p-2 text-slate-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-6 h-6" />
          </button>
          <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 border border-slate-700">
            {worker?.displayName?.[0] || 'U'}
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-6">
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-tight">
              {settings?.companyName || "SISTEMA PARA CONTROL DE PRESTAMOS"}
            </h1>
            <div className="h-4 w-[1px] bg-slate-200"></div>
            <div className="hidden md:flex gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">System_Status</span>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-mono text-emerald-600 font-bold">ACTIVE_SYNC</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {worker && <NotificationBell worker={worker} />}
             <div className="text-[10px] font-medium text-slate-400 hidden sm:block">
               {worker?.email}
             </div>
             <div className={cn(
               "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest",
               worker?.role === UserRole.ADMIN ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
             )}>
               {worker?.role}
             </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-slate-50 relative">
          <div className="p-6">
            {children}
          </div>
        </div>

        {/* System Footer */}
        <footer className="h-6 bg-slate-900 text-slate-500 flex items-center px-4 justify-between shrink-0">
          <div className="flex gap-4 items-center">
            <span className="text-[8px] font-mono tracking-widest">SVC_LOAN_INDEXER_RUNNING</span>
          </div>
          <div className="text-[8px] font-mono">V.2.4.0 • {new Date().toLocaleTimeString()}</div>
        </footer>
      </main>
    </div>
  );
}

function RailItem({ icon: Icon, active = false }: { icon: any, active?: boolean }) {
  return (
    <button className={cn(
      "p-2 rounded transition-all cursor-pointer",
      active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
    )}>
      <Icon className="w-5 h-5" />
    </button>
  );
}

'use client';

import React from 'react';
import Sidebar from './Sidebar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen text-white overflow-hidden relative">
      {/* Dynamic Animated Background */}
      <div className="animated-bg"></div>
      
      <Sidebar />
      <main className="flex-1 flex flex-col h-screen overflow-hidden z-10 relative">
        <div className="h-[70px] w-full border-b border-white/5 bg-[#000000]/40 backdrop-blur-2xl flex items-center px-8 sticky top-0 z-20 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
          <div className="text-xl font-bold tracking-tight">Workspace</div>
          <div className="flex-1"></div>
          <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] animate-pulse"></div>
            <span className="text-xs font-bold text-white/80 uppercase tracking-widest">System Ready</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

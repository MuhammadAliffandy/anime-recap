'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, Upload, Wand2, BookOpen, Film, Settings, Clapperboard, Trash2, MonitorPlay
} from 'lucide-react';
import { useVideoStore } from '@/stores/useVideoStore';

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const clearAll = useVideoStore(state => state.clearAll);

  const handleClearProject = () => {
    if (window.confirm('Are you sure you want to clear the entire project and start over? This will erase all episodes and progress.')) {
      clearAll();
      router.push('/');
    }
  };

  const navItems = [
    { href: '/',         icon: <Home size={20} />,        label: 'Dashboard'   },
    { href: '/ingest',   icon: <Upload size={20} />,      label: 'Ingest'      },
    { href: '/pipeline', icon: <Wand2 size={20} />,       label: 'AI Pipeline' },
    { href: '/prolog',   icon: <BookOpen size={20} />,    label: 'Prolog'      },
    { href: '/voice',    icon: <Film size={20} />,        label: 'Assembly'    },
    { href: '/editor',   icon: <Clapperboard size={20} />, label: 'Editor'     },
    { href: '/youtube',  icon: <MonitorPlay size={20} />, label: 'YouTube'     },
    { href: '/settings', icon: <Settings size={20} />,    label: 'Settings'    },
  ];

  return (
    <aside className="w-20 lg:w-64 h-screen bg-[#000000]/30 backdrop-blur-3xl border-r border-white/5 flex flex-col items-center lg:items-start py-6 sticky top-0 transition-all duration-300 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
      <div className="mb-10 w-full px-6 flex items-center justify-center lg:justify-start">
        <div className="text-3xl font-black tracking-tighter bg-gradient-to-br from-cyan-400 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
          AR
        </div>
        <div className="hidden lg:block ml-3 text-xl font-black text-white tracking-tight">
          Studio
        </div>
      </div>

      <nav className="flex-1 w-full flex flex-col gap-1.5 px-4">
        {navItems.map((item, i) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          // Divider before Settings
          const showDivider = i === navItems.length - 1;

          return (
            <React.Fragment key={item.href}>
              {showDivider && <div className="my-2 border-t border-white/5" />}
              <Link
                href={item.href}
                className={`flex items-center gap-4 px-3 lg:px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                  isActive
                    ? 'text-white shadow-[0_4px_20px_rgba(139,92,246,0.3)] border border-white/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                title={item.label}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/80 to-pink-500/80 opacity-80 -z-10" />
                )}
                <div
                  className={`transition-all duration-300 z-10 ${
                    isActive
                      ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'
                      : 'group-hover:scale-110'
                  }`}
                >
                  {item.icon}
                </div>
                <span
                  className={`hidden lg:block font-bold text-sm tracking-wide z-10 ${
                    isActive ? 'text-white' : ''
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Flow guide at bottom */}
      <div className="hidden lg:flex flex-col gap-1 px-5 pb-2 w-full">
        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest mb-1">Flow</p>
        {['Ingest', 'Pipeline', 'Prolog', 'Assembly', 'YouTube'].map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center shrink-0">
              <span className="text-[8px] font-black text-white/50">{i + 1}</span>
            </div>
            <span className="text-[10px] text-white/25 font-bold">{step}</span>
          </div>
        ))}

        <button 
          onClick={handleClearProject}
          className="mt-6 flex items-center gap-2 px-3 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all w-full text-left group"
        >
          <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
          <span className="text-[11px] font-bold tracking-wide">Clear Project</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;

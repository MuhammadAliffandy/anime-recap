'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Upload, Wand2, Mic, Clapperboard, Image as ImageIcon, Settings } from 'lucide-react';

const Sidebar = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: <Home size={20} />, label: 'Dashboard' },
    { href: '/ingest', icon: <Upload size={20} />, label: 'Ingest Video' },
    { href: '/pipeline', icon: <Wand2 size={20} />, label: 'AI Pipeline' },
    { href: '/voice', icon: <Mic size={20} />, label: 'Voice & Subs' },
    { href: '/editor', icon: <Clapperboard size={20} />, label: 'Editor' },
    { href: '/thumbnails', icon: <ImageIcon size={20} />, label: 'Thumbnails' },
    { href: '/settings', icon: <Settings size={20} />, label: 'Settings' },
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

      <nav className="flex-1 w-full flex flex-col gap-2 px-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-4 px-3 lg:px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                isActive 
                  ? 'text-white shadow-[0_4px_20px_rgba(139,92,246,0.3)] border border-white/10' 
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
              title={item.label}
            >
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/80 to-pink-500/80 opacity-80 -z-10"></div>
              )}
              {isActive && (
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;utf8,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%221%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22 opacity=%220.08%22/%3E%3C/svg%3E')] mix-blend-overlay -z-10"></div>
              )}
              <div className={`transition-all duration-300 z-10 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-hover:scale-110'}`}>
                {item.icon}
              </div>
              <span className={`hidden lg:block font-bold text-sm tracking-wide z-10 ${isActive ? 'text-white' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;

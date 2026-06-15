import { Upload, Wand2, BookOpen, Film } from 'lucide-react';
import Link from 'next/link';

const steps = [
  {
    step: 'Step 1',
    icon: <Upload size={22} />,
    title: 'Ingest Episodes',
    desc: 'Upload anime episodes in order. Configure opening & ending strip duration per episode.',
    href: '/ingest',
    color: 'cyan',
  },
  {
    step: 'Step 2',
    icon: <Wand2 size={22} />,
    title: 'AI Pipeline',
    desc: 'Each episode is stripped, transcribed, turned into a storytelling script, and voiced with TTS — in parallel.',
    href: '/pipeline',
    color: 'purple',
  },
  {
    step: 'Step 3',
    icon: <BookOpen size={22} />,
    title: 'Prolog',
    desc: 'AI writes an opening narration introducing the anime & season. Get your audience hooked from second one.',
    href: '/prolog',
    color: 'yellow',
  },
  {
    step: 'Step 4',
    icon: <Film size={22} />,
    title: 'Assemble & Export',
    desc: 'Combine prolog + all episode recaps into one final long-form video. Perfect for 1-hour season recaps.',
    href: '/voice',
    color: 'pink',
  },
];

const colorMap: Record<string, string> = {
  cyan:   'text-cyan-400   bg-cyan-400/10   border-cyan-400/20   group-hover:bg-cyan-400/20',
  purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20 group-hover:bg-purple-400/20',
  yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20 group-hover:bg-yellow-400/20',
  pink:   'text-pink-400   bg-pink-400/10   border-pink-400/20   group-hover:bg-pink-400/20',
};

const badgeMap: Record<string, string> = {
  cyan:   'text-cyan-400   bg-cyan-400/10   border-cyan-400/20',
  purple: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  pink:   'text-pink-400   bg-pink-400/10   border-pink-400/20',
};

export default function Home() {
  return (
    <div className="flex flex-col gap-12 mt-4 relative z-10">
      {/* Hero */}
      <div className="flex flex-col gap-4 relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/15 rounded-full blur-[80px] -z-10" />
        <div className="absolute top-10 left-60 w-60 h-60 bg-purple-600/15 rounded-full blur-[100px] -z-10" />

        <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-500 bg-clip-text text-transparent font-heading drop-shadow-lg tracking-tight">
          AnimeRecap Studio
        </h1>
        <p className="text-white/70 text-xl max-w-2xl font-medium leading-relaxed">
          Automate full-season anime recap videos. Upload episodes, AI writes the story, and you get a ready-to-upload long-form recap — no editing required.
        </p>

        <div className="flex items-center gap-4 mt-2">
          <Link href="/ingest" className="btn btn-primary text-base px-7 py-3">
            Get Started →
          </Link>
          <div className="text-white/40 text-sm font-medium">
            Works with 1 episode or a full season
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
        {steps.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="glass-card flex flex-col gap-4 group hover:scale-[1.01] transition-transform duration-300"
          >
            <div className="flex items-center justify-between">
              <span className={`font-bold uppercase tracking-[0.2em] text-xs px-3 py-1.5 rounded-full border ${badgeMap[s.color]}`}>
                {s.step}
              </span>
              <div className={`p-2.5 rounded-xl border transition-all duration-300 ${colorMap[s.color]}`}>
                {s.icon}
              </div>
            </div>
            <h3 className="text-2xl font-bold tracking-tight">{s.title}</h3>
            <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

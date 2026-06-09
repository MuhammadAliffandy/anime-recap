import { Layers, Wand2, MonitorPlay } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col gap-12 mt-4 relative z-10">
      <div className="flex flex-col gap-4 relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-[80px] -z-10"></div>
        <div className="absolute top-10 left-60 w-60 h-60 bg-purple-600/20 rounded-full blur-[100px] -z-10"></div>
        
        <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-500 bg-clip-text text-transparent font-heading drop-shadow-lg tracking-tight">
          AnimeRecap Studio
        </h1>
        <p className="text-white/70 text-xl max-w-3xl font-medium leading-relaxed">
          Automate your YouTube anime recap workflow with AI transcription, storytelling, and smart video editing. Everything you need, accelerated.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        {/* Step 1 */}
        <div className="glass-card flex flex-col gap-4 group">
          <div className="flex items-center justify-between">
            <div className="text-cyan-400 font-bold uppercase tracking-[0.2em] text-xs bg-cyan-400/10 px-3 py-1.5 rounded-full border border-cyan-400/20">Step 1</div>
            <div className="bg-cyan-400/10 p-2.5 rounded-xl text-cyan-400 transition-transform duration-300 group-hover:scale-110 group-hover:bg-cyan-400/20">
              <Layers size={22} />
            </div>
          </div>
          <h3 className="text-2xl font-bold mt-2 tracking-tight">Ingest & Merge</h3>
          <p className="text-white/50 text-sm leading-relaxed">Upload multiple video parts. We&apos;ll effortlessly merge them and auto-zoom to hide hardcoded subtitles seamlessly.</p>
        </div>
        
        {/* Step 2 */}
        <div className="glass-card flex flex-col gap-4 group">
          <div className="flex items-center justify-between">
            <div className="text-purple-400 font-bold uppercase tracking-[0.2em] text-xs bg-purple-400/10 px-3 py-1.5 rounded-full border border-purple-400/20">Step 2</div>
            <div className="bg-purple-400/10 p-2.5 rounded-xl text-purple-400 transition-transform duration-300 group-hover:scale-110 group-hover:bg-purple-400/20">
              <Wand2 size={22} />
            </div>
          </div>
          <h3 className="text-2xl font-bold mt-2 tracking-tight">AI Story Pipeline</h3>
          <p className="text-white/50 text-sm leading-relaxed">Extract audio, instantly transcribe with Whisper, and craft a highly engaging, viral recap script using cutting-edge LLMs.</p>
        </div>

        {/* Step 3 */}
        <div className="glass-card flex flex-col gap-4 group">
          <div className="flex items-center justify-between">
            <div className="text-pink-400 font-bold uppercase tracking-[0.2em] text-xs bg-pink-400/10 px-3 py-1.5 rounded-full border border-pink-400/20">Step 3</div>
            <div className="bg-pink-400/10 p-2.5 rounded-xl text-pink-400 transition-transform duration-300 group-hover:scale-110 group-hover:bg-pink-400/20">
              <MonitorPlay size={22} />
            </div>
          </div>
          <h3 className="text-2xl font-bold mt-2 tracking-tight">Edit & Export</h3>
          <p className="text-white/50 text-sm leading-relaxed">Add lifelike ElevenLabs voiceovers, perfectly timed subtitles, premium color grading, and export the final 4K video.</p>
        </div>
      </div>
    </div>
  );
}

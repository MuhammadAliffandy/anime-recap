import { writeFileSync } from 'fs';

function wordsToAss(words: any[]): string {
  const toAss = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const cs = Math.round((s % 1) * 100);
    return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  };

  const groups = [];
  let group = [];
  for (const w of words) {
    group.push(w);
    if (group.length >= 5) { groups.push(group); group = []; }
  }
  if (group.length) groups.push(group);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginV
Style: Default,Arial,60,&H0000FFFF,&H00000000,&H80000000,-1,1,3,2,2,50

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = groups.map(g => {
    const text = g.map(w => w.word).join(' ').trim();
    return `Dialogue: 0,${toAss(g[0].start)},${toAss(g[g.length-1].end)},Default,,0,0,0,,${text}`;
  }).join('\n');

  return header + events + '\n';
}

const words = [
  { word: "Hello", start: 0, end: 0.5 },
  { word: "world", start: 0.5, end: 1.0 },
];

console.log(wordsToAss(words));

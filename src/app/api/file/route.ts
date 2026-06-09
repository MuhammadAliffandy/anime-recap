import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = url.searchParams.get('name');
  const dir = url.searchParams.get('dir') || 'output';

  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 });

  const allowedDirs = ['uploads', 'output'];
  if (!allowedDirs.includes(dir)) return NextResponse.json({ error: 'Invalid directory' }, { status: 400 });

  const filepath = join(process.cwd(), dir, name);
  if (!existsSync(filepath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const stats = statSync(filepath);
  
  // A somewhat naive but functional streaming approach for Next.js 15
  // Using Node.js streams mapped to Web Streams
  const stream = createReadStream(filepath);
  
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    }
  });

  const ext = name.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    'mp4': 'video/mp4',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'webm': 'video/webm'
  };

  return new NextResponse(webStream, {
    headers: {
      'Content-Type': contentTypes[ext || ''] || 'application/octet-stream',
      'Content-Length': stats.size.toString(),
      'Accept-Ranges': 'bytes'
    }
  });
}

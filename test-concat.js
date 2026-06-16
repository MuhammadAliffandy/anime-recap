const g = require('google-tts-api');
const fs = require('fs');
async function test() {
  const res = await g.getAllAudioBase64('Hello world. '.repeat(30));
  const buffers = res.map(r => Buffer.from(r.base64, 'base64'));
  const finalBuffer = Buffer.concat(buffers);
  fs.writeFileSync('test-concat.mp3', finalBuffer);
  console.log('done, size:', finalBuffer.length);
}
test();

const g = require('google-tts-api');
async function test() {
  const res = await g.getAllAudioBase64('hello world '.repeat(30));
  console.log(Array.isArray(res));
  if (Array.isArray(res)) {
     console.log(res.length);
     console.log(Object.keys(res[0]));
  }
}
test();

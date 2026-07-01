const { OpenAI } = require("openai");

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

async function run() {
  const fs = require('fs');
  try {
    const res = await groq.audio.translations.create({
      file: fs.createReadStream('uploads/test.mp3'), // assume there's some audio
      model: 'whisper-large-v3',
    });
    console.log("Success:", res.text.substring(0, 50));
  } catch (e) {
    console.log("Error:", e.message);
  }
}
run();

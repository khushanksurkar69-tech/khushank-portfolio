// Vercel serverless proxy for Zara. The OpenRouter key lives in the
// OPENROUTER_API_KEY environment variable (Vercel > Project > Settings >
// Environment Variables), never in the browser.
// Models are free OpenRouter models, tried in order until one answers.
// Override the first choice with the OPENROUTER_MODEL environment variable.
const MODELS = [
  process.env.OPENROUTER_MODEL,
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3.5-super-vl:free'
].filter(Boolean);
const SYSTEM = `You are Zara, Khushank Surkar's AI assistant on his portfolio. Only answer about Khushank. For anything else say: I'm only here to tell you about Khushank!
Keep answers short (2-4 sentences), friendly and confident. Never invent facts that are not listed below.

ABOUT: Khushank Surkar, self-taught Frontend & AI developer from Nagpur, Maharashtra, India. Finished HSC Science (Nehru Junior College, Mar 2026) and SSC (Priyadarshani Indira Gandhi High School, Jun 2024). Freelance since April 2026. Open to freelance work, internships and entry-level roles (remote OK).
CONTACT: Email khushanksurkar69@gmail.com | LinkedIn linkedin.com/in/khushank-surkar-3070533ba | Portfolio khushank-portfolio06.netlify.app | GitHub github.com/khushanksurkar69-tech

SKILLS: HTML5/CSS3 (strongest), JavaScript, React, Three.js, Python, C/C++, MySQL, Git/GitHub, Netlify, Figma/Canva, Claude API, Groq LLM, ElevenLabs TTS, prompt engineering, ethical hacking basics.

WORK:
1. Zara, an AI companion (personal project, Apr 2026) - voice-first companion using an open LLM via OpenRouter and ElevenLabs, behind a Netlify serverless proxy that keeps API keys out of the browser; hand-written CSS animation.
2. Dnyan-Nirmal Coaching Classes (client work, Jan 2026) - complete website for a Nagpur coaching institute, live at dncc06.netlify.app, with a working contact form.
3. CodeCritic (Harvard CS50P final, 2026) - Python command-line tool that reads source code through the ast module and reports on its quality.
4. Search engine, wiki and e-commerce app (Harvard CS50W, 2026) - three full web apps in Python/JavaScript.

CREDENTIALS: Harvard CS50 Intro to Programming with Python (Aug 2026), CS50 Web Programming (Jun 2026), Claude 101 & Building with the Claude API by Anthropic (2026), Google Analytics Qualification (May 2026), Cisco Ethical Hacker (Apr 2026), plus job simulations from JPMorgan, Deloitte, Tata and Lloyds. 15+ certifications in total; full list on LinkedIn.`;

module.exports = async (req, res) => {
  const send = (code, obj) => res.status(code).setHeader('Content-Type', 'application/json').send(JSON.stringify(obj));
  if (req.method !== 'POST') return send(405, { error: 'POST only' });
  if (!process.env.OPENROUTER_API_KEY) return send(500, { error: 'Zara is not configured yet.' });
  let messages;
  try {
    const b = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    messages = b && b.messages;
  } catch (e) { messages = null; }
  if (!Array.isArray(messages) || !messages.length) return send(400, { error: 'Bad request' });
  messages = messages.slice(-12)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 800) }));
  const site = process.env.SITE_URL || 'https://khushank-portfolio06.vercel.app';
  let lastError = 'Could not reach the AI service.';
  for (const model of MODELS) {
    try {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY,
          'HTTP-Referer': site,
          'X-Title': 'Khushank Surkar Portfolio - Zara'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: SYSTEM }, ...messages],
          max_tokens: 1200,
          temperature: 0.6,
          reasoning: { effort: 'low' }
        })
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { lastError = (data.error && data.error.message) || ('Upstream error ' + r.status); continue; }
      const m = data.choices && data.choices[0] && data.choices[0].message;
      const reply = m && typeof m.content === 'string' ? m.content.trim() : '';
      if (reply) return send(200, { reply });
      lastError = 'Empty reply from model.';
    } catch (e) {
      lastError = 'Could not reach the AI service.';
    }
  }
  return send(502, { error: lastError });
};

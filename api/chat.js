// api/chat.js — Chat proxy (streaming SSE, limit 2GB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2gb',
    },
    responseLimit: false,
  },
};

const API_BASE = process.env.API_BASE || 'https://seren.up.railway.app';
const API_KEY  = process.env.API_KEY  || 'sk-129f2389480657c8-hmsrsn-63fadb1c';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body;
    if (!body || !body.messages) {
      return res.status(400).json({ error: 'Missing messages field' });
    }

    const upstream = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': body.stream ? 'text/event-stream' : 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({
        error: 'Upstream error',
        status: upstream.status,
        detail: errText.slice(0, 500),
      });
    }

    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
          if (res.flush) res.flush();
        }
      } catch (e) {
        console.error('Stream error:', e);
      } finally {
        res.end();
      }
      return;
    }

    const data = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(data);
  } catch (e) {
    console.error('chat proxy error:', e);
    return res.status(500).json({
      error: 'Internal server error',
      detail: String(e).slice(0, 300),
    });
  }
}
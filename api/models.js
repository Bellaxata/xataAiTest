// api/models.js — Proxy model list
export const config = {
  api: {
    bodyParser: false,
  },
};

const API_BASE = process.env.API_BASE || 'https://9router-production-c6d9.up.railway.app';
const API_KEY  = process.env.API_KEY  || 'sk-8a0c87e80415e1c6-rfugfq-846f936e';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const upstream = await fetch(`${API_BASE}/v1/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      },
    });

    const data = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(upstream.status).send(data);
  } catch (e) {
    console.error('models proxy error:', e);
    return res.status(502).json({ error: 'Upstream error', detail: String(e) });
  }
}
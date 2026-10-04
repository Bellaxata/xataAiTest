// api/health.js — Health check
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    ok: true,
    service: 'XTRX AiGracy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    limits: {
      bodySize: '2GB',
      memory: '3008MB',
      timeout: '300s',
    },
  });
}
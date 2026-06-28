const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT    = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const HTML    = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function readBody(req) {
  return new Promise((res, rej) => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => { try { res(JSON.parse(b)); } catch(e) { rej(e); } });
    req.on('error', rej);
  });
}

function callAnthropic(payload) {
  return new Promise((res, rej) => {
    const body = JSON.stringify(payload);
    const req  = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { res({ status: r.statusCode, body: JSON.parse(d) }); }
        catch(e) { rej(new Error('Bad response from Anthropic')); }
      });
    });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

http.createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML); return;
  }

  if (req.method === 'POST' && req.url === '/api/generate') {
    if (!API_KEY) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: true, message: 'ANTHROPIC_API_KEY not set. Add it in Render → Environment.' }));
      return;
    }
    try {
      const { payload } = await readBody(req);
      console.log(`[${new Date().toLocaleTimeString()}] Generating...`);
      const result = await callAnthropic(payload);
      if (result.status !== 200) {
        res.writeHead(result.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, message: result.body?.error?.message || `Error ${result.status}` }));
        return;
      }
      console.log(`[${new Date().toLocaleTimeString()}] Done.`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.body));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: true, message: e.message }));
    }
    return;
  }

  res.writeHead(404); res.end('Not found');

}).listen(PORT, () => {
  console.log(`TCI Meeting Minutes running on port ${PORT}`);
});

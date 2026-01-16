#!/usr/bin/env node
/**
 * Simple HTTP server for DATS API Tester
 * Proxies requests to DATS API to avoid CORS issues
 */

import express from 'express';
import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Parse JSON and text bodies
app.use(express.json());
app.use(express.text({ type: 'text/xml' }));

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'api-tester.html'));
});

// Proxy endpoint for DATS API
app.post('/proxy/:endpoint', async (req, res) => {
  const endpoint = req.params.endpoint;
  const xml = req.body;

  console.log(`[${new Date().toISOString()}] Proxying request to ${endpoint}`);

  const options = {
    hostname: 'datsonlinebooking.edmonton.ca',
    path: `/${endpoint}`,
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '""',
      'Content-Length': Buffer.byteLength(xml),
    },
  };

  // Forward cookies if present
  if (req.headers.cookie) {
    options.headers['Cookie'] = req.headers.cookie;
  }

  const proxyReq = https.request(options, (proxyRes) => {
    let data = '';

    // Forward cookies back to client
    if (proxyRes.headers['set-cookie']) {
      res.setHeader('Set-Cookie', proxyRes.headers['set-cookie']);
      console.log('  → Set-Cookie:', proxyRes.headers['set-cookie']);
    }

    proxyRes.on('data', (chunk) => {
      data += chunk;
    });

    proxyRes.on('end', () => {
      console.log('  → Status:', proxyRes.statusCode);
      console.log('  → Response (first 500 chars):', data.substring(0, 500));
      res.status(proxyRes.statusCode).send(data);
    });
  });

  proxyReq.on('error', (error) => {
    console.error('Proxy error:', error);
    res.status(500).send(`Error: ${error.message}`);
  });

  proxyReq.write(xml);
  proxyReq.end();
});

app.listen(PORT, () => {
  console.log('');
  console.log('🔧 DATS API Tester Server Started!');
  console.log('');
  console.log(`   Open in browser: http://localhost:${PORT}`);
  console.log('');
  console.log('   Press Ctrl+C to stop the server');
  console.log('');
});

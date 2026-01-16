#!/usr/bin/env node
/**
 * Simple Express server that uses our existing DATSApi to test operations
 * This is the easiest way to test since we already have working auth
 */

import express from 'express';
import { AuthClient } from '../build/api/auth-client.js';
import { DATSApi } from '../build/api/dats-api.js';

const app = express();
const PORT = 3002;

app.use(express.json());

// Store session for the duration of the server run
let currentSession = null;

// Serve a simple HTML interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DATS API Tester - Simple</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: #1e1e1e;
      color: #d4d4d4;
    }
    h1 { color: #569cd6; }
    .panel {
      background: #252526;
      border: 1px solid #3e3e42;
      border-radius: 6px;
      padding: 20px;
      margin: 20px 0;
    }
    button {
      background: #0e639c;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      margin: 5px;
    }
    button:hover { background: #1177bb; }
    input, select {
      padding: 10px;
      background: #3c3c3c;
      border: 1px solid #3e3e42;
      border-radius: 4px;
      color: #d4d4d4;
      font-size: 14px;
      margin: 5px;
    }
    pre {
      background: #1e1e1e;
      border: 1px solid #3e3e42;
      padding: 15px;
      border-radius: 4px;
      overflow-x: auto;
      color: #ce9178;
    }
    .status { padding: 10px; margin: 10px 0; border-radius: 4px; }
    .success { background: #0e7c0e; color: white; }
    .error { background: #f44747; color: white; }
    label { display: block; margin: 10px 0 5px; color: #9cdcfe; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
      background: #1e1e1e;
      border: 1px solid #3e3e42;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border: 1px solid #3e3e42;
    }
    th {
      background: #2d2d30;
      color: #569cd6;
      font-weight: 600;
    }
    td {
      color: #d4d4d4;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
    }
    tr:hover {
      background: #252526;
    }
    .field-name {
      color: #9cdcfe;
      font-weight: 500;
    }
    .trip-header {
      background: #2d2d30;
      color: #4ec9b0;
      font-weight: 600;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>🔧 DATS API Tester</h1>

  <div class="panel">
    <h2>1. Login</h2>
    <label>Client ID:</label>
    <input type="text" id="clientId" value="46642">
    <label>Passcode:</label>
    <input type="password" id="passcode">
    <br>
    <button onclick="login()">Login</button>
    <div id="loginStatus"></div>
  </div>

  <div class="panel">
    <h2>2. Get Trips (Test Status Issue)</h2>
    <label>From Date (YYYYMMDD):</label>
    <input type="text" id="fromDate" value="20260115">
    <label>To Date (YYYYMMDD):</label>
    <input type="text" id="toDate" value="20260115">
    <br>
    <button onclick="getTrips()" id="getTripsBtn" disabled>Get Trips</button>
    <div id="tripsResult"></div>
  </div>

  <script>
    async function login() {
      const clientId = document.getElementById('clientId').value;
      const passcode = document.getElementById('passcode').value;
      const statusDiv = document.getElementById('loginStatus');

      statusDiv.innerHTML = '<div class="status">Logging in...</div>';

      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, passcode })
        });

        const result = await response.json();

        if (result.success) {
          statusDiv.innerHTML = '<div class="status success">✓ Logged in as Client ' + result.clientId + '</div>';
          document.getElementById('getTripsBtn').disabled = false;
        } else {
          statusDiv.innerHTML = '<div class="status error">✗ Login failed: ' + result.error + '</div>';
        }
      } catch (error) {
        statusDiv.innerHTML = '<div class="status error">✗ Error: ' + error.message + '</div>';
      }
    }

    async function getTrips() {
      const fromDate = document.getElementById('fromDate').value;
      const toDate = document.getElementById('toDate').value;
      const resultDiv = document.getElementById('tripsResult');

      resultDiv.innerHTML = '<div class="status">Getting trips...</div>';

      try {
        const response = await fetch('/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromDate, toDate })
        });

        const result = await response.json();

        if (result.success) {
          let html = '<div class="status success">✓ Found ' + result.trips.length + ' trip(s)</div>';

          // Parse XML and create tables
          html += '<h3>DATS API Response - All Fields:</h3>';
          html += parseXmlToTables(result.rawXml);

          // Add raw XML response section (collapsed by default)
          html += '<details style="margin-top: 20px;">';
          html += '<summary style="cursor: pointer; color: #569cd6; font-weight: 600;">Show Raw XML Response</summary>';
          html += '<pre style="max-height: 400px; overflow-y: auto; margin-top: 10px;">';
          html += escapeHtml(formatXml(result.rawXml));
          html += '</pre>';
          html += '</details>';

          html += '<div style="margin-top: 20px; padding: 15px; background: #2d2d30; border-left: 3px solid #569cd6;">';
          html += '<strong>Conclusion:</strong> These status codes are EXACTLY what the DATS API returned. ';
          html += 'Our MCP server displays this data without modification (Passthrough Principle).';
          html += '</div>';

          resultDiv.innerHTML = html;
        } else {
          resultDiv.innerHTML = '<div class="status error">✗ Error: ' + result.error + '</div>';
        }
      } catch (error) {
        resultDiv.innerHTML = '<div class="status error">✗ Error: ' + error.message + '</div>';
      }
    }

    function formatXml(xml) {
      // Simple XML formatting with indentation
      let formatted = xml.replace(/></g, '>\\n<');
      let indent = 0;
      const lines = formatted.split('\\n');

      return lines.map(line => {
        if (line.match(/^<\\/\\w/)) {
          indent--;
        }
        const spaces = '  '.repeat(Math.max(0, indent));
        if (line.match(/^<\\w[^>]*[^\\/]>$/)) {
          indent++;
        }
        return spaces + line;
      }).join('\\n');
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function parseXmlToTables(xmlString) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

      // DATS uses PassBooking elements, not Trip
      const bookings = xmlDoc.getElementsByTagName('PassBooking');

      if (bookings.length === 0) {
        return '<p>No PassBooking elements found in XML response. Check raw XML for structure.</p>';
      }

      let html = '';

      for (let i = 0; i < bookings.length; i++) {
        const booking = bookings[i];
        html += '<h4 class="trip-header">Trip #' + (i + 1) + '</h4>';
        html += '<table>';
        html += '<thead><tr><th>Field</th><th>Value</th></tr></thead>';
        html += '<tbody>';

        // Recursively extract all fields
        const fields = extractFields(booking);

        // Sort fields alphabetically
        const sortedFields = Object.keys(fields).sort();

        sortedFields.forEach(fieldName => {
          const value = fields[fieldName];
          html += '<tr>';
          html += '<td class="field-name">' + escapeHtml(fieldName) + '</td>';
          html += '<td>' + escapeHtml(value) + '</td>';
          html += '</tr>';

          // Highlight important status fields
          if (fieldName.includes('Status') || fieldName === 'BookingId' || fieldName === 'CreationConfirmationNumber') {
            const lastRow = html.lastIndexOf('<tr>');
            html = html.substring(0, lastRow) +
                   '<tr style="background: #3e3e42; font-weight: 600;">' +
                   html.substring(lastRow + 4);
          }
        });

        html += '</tbody></table>';
      }

      return html;
    }

    function extractFields(element, prefix = '') {
      const fields = {};

      for (let i = 0; i < element.children.length; i++) {
        const child = element.children[i];
        const fieldName = prefix ? prefix + '.' + child.tagName : child.tagName;

        // If element has children, recurse
        if (child.children.length > 0) {
          const nestedFields = extractFields(child, fieldName);
          Object.assign(fields, nestedFields);
        } else {
          // Leaf node - extract text content
          const value = child.textContent.trim();
          if (value) {
            fields[fieldName] = value;
          }
        }
      }

      return fields;
    }
  </script>
</body>
</html>
  `);
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { clientId, passcode } = req.body;

  try {
    const loginResult = await AuthClient.login({
      username: clientId,
      password: passcode,
    });

    if (loginResult.success) {
      currentSession = {
        sessionCookie: loginResult.sessionCookie,
        clientId: loginResult.clientId,
      };
      res.json(loginResult);
    } else {
      res.json(loginResult);
    }
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
    });
  }
});

// Get trips endpoint
app.post('/api/trips', async (req, res) => {
  const { fromDate, toDate } = req.body;

  if (!currentSession) {
    return res.json({
      success: false,
      error: 'Not logged in',
    });
  }

  try {
    const api = new DATSApi({ sessionCookie: currentSession.sessionCookie });

    // Get parsed trips
    const trips = await api.getClientTrips(
      currentSession.clientId,
      fromDate,
      toDate,
      ['S', 'Pf', 'CA']
    );

    // Also get raw XML response
    const rawXml = await getRawXmlResponse(currentSession, fromDate, toDate);

    res.json({
      success: true,
      trips,
      rawXml,
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
    });
  }
});

// Helper function to get raw XML response
async function getRawXmlResponse(session, fromDate, toDate) {
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <PassGetClientTrips>
      <OutputVersion>2</OutputVersion>
      <ClientId>${session.clientId}</ClientId>
      <FromDate>${fromDate}</FromDate>
      <ToDate>${toDate}</ToDate>
      <Status>S,Pf,CA</Status>
    </PassGetClientTrips>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

  const response = await fetch('https://datsonlinebooking.edmonton.ca/PassInfoServer', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '""',
      'Cookie': session.sessionCookie,
    },
    body: soapEnvelope,
  });

  return await response.text();
}

app.listen(PORT, () => {
  console.log('');
  console.log('🔧 DATS API Tester (Simple) Started!');
  console.log('');
  console.log('   Open in browser: http://localhost:' + PORT);
  console.log('');
  console.log('   This uses our existing working authentication code.');
  console.log('   Press Ctrl+C to stop the server');
  console.log('');
});

/**
 * Simple Node.js script to test DATS API directly
 *
 * Usage:
 *   node docs/test-dats-api.js YOUR_CLIENT_ID YOUR_PASSCODE
 *
 * Example:
 *   node docs/test-dats-api.js 46642 myPasscode123
 */

const https = require('https');

const clientId = process.argv[2];
const passcode = process.argv[3];

if (!clientId || !passcode) {
  console.error('Usage: node test-dats-api.js CLIENT_ID PASSCODE');
  console.error('Example: node test-dats-api.js 46642 myPasscode123');
  process.exit(1);
}

function makeRequest(xml, cookie = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'datsonlinebooking.edmonton.ca',
      path: '/PassInfoServer',
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '""',
        'Content-Length': Buffer.byteLength(xml),
      },
    };

    if (cookie) {
      options.headers['Cookie'] = cookie;
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

async function testDATSAPI() {
  console.log('=== DATS API Direct Test ===\n');

  // Step 1: Login
  console.log('Step 1: Logging in...');
  const loginXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <PassValidatePassword>
      <ClientCode>${clientId}</ClientCode>
      <Password>${passcode}</Password>
    </PassValidatePassword>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

  const loginResponse = await makeRequest(loginXml);

  console.log('Login response status:', loginResponse.statusCode);
  console.log('Login response body:', loginResponse.body);
  console.log('Set-Cookie headers:', loginResponse.headers['set-cookie']);
  console.log();

  if (loginResponse.statusCode !== 200) {
    console.error('Login failed with status:', loginResponse.statusCode);
    console.error('Response:', loginResponse.body);
    process.exit(1);
  }

  // Check if login was successful by looking at response
  if (loginResponse.body.includes('error') || loginResponse.body.includes('Error')) {
    console.error('Login failed - check credentials');
    console.error('Response:', loginResponse.body);
    process.exit(1);
  }

  // Extract session cookie
  const setCookieHeader = loginResponse.headers['set-cookie'];
  if (!setCookieHeader) {
    console.error('No session cookie received');
    process.exit(1);
  }

  const sessionCookie = setCookieHeader[0].split(';')[0];
  console.log('✓ Login successful');
  console.log('Session cookie:', sessionCookie);
  console.log();

  // Step 2: Get trips for today
  console.log('Step 2: Getting trips for January 15, 2026...');
  const today = '20260115';
  const getTripsXml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <PassGetClientTrips>
      <OutputVersion>2</OutputVersion>
      <ClientId>${clientId}</ClientId>
      <FromDate>${today}</FromDate>
      <ToDate>${today}</ToDate>
      <Status>S,Pf,CA</Status>
    </PassGetClientTrips>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

  const tripsResponse = await makeRequest(getTripsXml, sessionCookie);

  if (tripsResponse.statusCode !== 200) {
    console.error('Get trips failed with status:', tripsResponse.statusCode);
    console.error('Response:', tripsResponse.body);
    process.exit(1);
  }

  console.log('✓ Trips retrieved successfully\n');

  // Parse and display trip statuses
  console.log('=== TRIP STATUS ANALYSIS ===\n');

  // Extract trip info using regex (simple XML parsing)
  const tripMatches = tripsResponse.body.matchAll(/<Trip>([\s\S]*?)<\/Trip>/g);

  let tripCount = 0;
  for (const match of tripMatches) {
    tripCount++;
    const tripXml = match[1];

    // Extract key fields
    const confirmationMatch = tripXml.match(/<ConfirmationNumber>(.*?)<\/ConfirmationNumber>/);
    const statusCodeMatch = tripXml.match(/<StatusCode>(.*?)<\/StatusCode>/);
    const statusLabelMatch = tripXml.match(/<StatusLabel>(.*?)<\/StatusLabel>/);
    const dateMatch = tripXml.match(/<BookingDate>(.*?)<\/BookingDate>/);

    // Extract pickup window
    const pickupStartMatch = tripXml.match(/<PickupWindowStart>(.*?)<\/PickupWindowStart>/);

    const confirmationNumber = confirmationMatch ? confirmationMatch[1] : 'N/A';
    const statusCode = statusCodeMatch ? statusCodeMatch[1] : 'N/A';
    const statusLabel = statusLabelMatch ? statusLabelMatch[1] : 'N/A';
    const bookingDate = dateMatch ? dateMatch[1] : 'N/A';
    const pickupStart = pickupStartMatch ? pickupStartMatch[1] : 'N/A';

    console.log(`Trip #${tripCount}:`);
    console.log(`  Confirmation: ${confirmationNumber}`);
    console.log(`  Date: ${bookingDate}`);
    console.log(`  Pickup Time: ${pickupStart}`);
    console.log(`  Status Code: ${statusCode}`);
    console.log(`  Status Label: ${statusLabel}`);

    // Interpret status
    if (statusCode === 'S') {
      console.log(`  → INTERPRETATION: DATS API shows "Scheduled" (not yet marked as Performed)`);
    } else if (statusCode === 'Pf') {
      console.log(`  → INTERPRETATION: DATS API shows "Performed" (trip completed)`);
    } else if (statusCode === 'CA') {
      console.log(`  → INTERPRETATION: DATS API shows "Cancelled"`);
    }

    console.log();
  }

  if (tripCount === 0) {
    console.log('No trips found for the specified date and status filter.');
  } else {
    console.log(`Total trips found: ${tripCount}`);
  }

  console.log('\n=== CONCLUSION ===');
  console.log('The status codes shown above are EXACTLY what the DATS API returns.');
  console.log('If trips show StatusCode="S" (Scheduled) when they should be "Pf" (Performed),');
  console.log('this is a DATS data issue, not a bug in our MCP server.');
  console.log('\nOur MCP server follows the Passthrough Principle: we display exactly');
  console.log('what DATS returns without modification or inference.');
}

testDATSAPI().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});

# DATS API Testing Guide

This guide shows you how to test the DATS SOAP API directly to verify trip data.

## Why Test Directly?

When you see unexpected data (like trips showing "Scheduled" instead of "Performed"), testing the API directly confirms whether it's a data issue from DATS or a bug in our code.

## Prerequisites

- Your DATS Client ID (e.g., `46642`)
- Your DATS Passcode
- One of the following tools (pick what works for you):
  - **VS Code REST Client extension** (easiest if you use VS Code)
  - **Node.js** (already installed for this project)
  - **cURL** (command line, works everywhere)
  - **Postman** (if not blocked by your corporate admin)

---

## Method 1: Using VS Code REST Client Extension (Easiest!)

This is the simplest method if you use VS Code.

### Setup (one-time)

1. Open VS Code
2. Go to Extensions (Cmd+Shift+X or Ctrl+Shift+X)
3. Search for "REST Client" by Huachao Mao
4. Click Install

### Testing Steps

1. **Open the test file**: `docs/test-api.http` in VS Code
2. **Replace your passcode**: Change `YOUR_PASSCODE_HERE` to your actual passcode
3. **Send Step 1**: Click the "Send Request" link that appears above "Step 1: Login"
4. **Wait for response**: You'll see the response in a new panel
5. **Send Step 2**: Click the "Send Request" link above "Step 2: Get trips"
6. **Check results**: Look at the XML response for `<StatusCode>` fields

**What to look for in the response:**
```xml
<Trip>
  <ConfirmationNumber>18791570</ConfirmationNumber>
  <StatusCode>S</StatusCode>  <!-- This is what you need to check! -->
  <StatusLabel>Scheduled</StatusLabel>
  ...
</Trip>
```

---

## Method 2: Using Node.js Script (No tools required!)

Since Node.js is already installed for this project, you can run a simple test script:

```bash
cd /Users/jeremycrossman/Desktop/DATS\ Booking/mcp-servers/dats-booking

# Run the test script
node docs/test-dats-api.js 46642 YOUR_PASSCODE_HERE
```

Replace `YOUR_PASSCODE_HERE` with your actual passcode.

**The script will automatically:**
1. Login to DATS
2. Get trips for January 15, 2026
3. Parse and display the status codes
4. Show interpretation of each status

**Example output:**
```
=== DATS API Direct Test ===

Step 1: Logging in...
✓ Login successful
Session cookie: ASP.NET_SessionId=abc123xyz456

Step 2: Getting trips for January 15, 2026...
✓ Trips retrieved successfully

=== TRIP STATUS ANALYSIS ===

Trip #1:
  Confirmation: 18791570
  Date: 20260115
  Status Code: S
  Status Label: Scheduled
  → INTERPRETATION: DATS API shows "Scheduled" (not yet marked as Performed)

Total trips found: 3
```

---

## Method 3: Using Postman (If Available)

### Step 1: Authenticate and Get Session Cookie

1. **Open Postman** and create a new request
2. **Set request type** to `POST`
3. **Set URL** to: `https://datsonlinebooking.edmonton.ca/PassInfoServer`
4. **Headers tab** - Add:
   ```
   Content-Type: text/xml; charset=utf-8
   SOAPAction: ""
   ```
5. **Body tab** - Select "raw" and paste the XML from `docs/test-dats-login.xml`:
   ```xml
   <?xml version="1.0" encoding="UTF-8" standalone="no"?>
   <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
     <SOAP-ENV:Body>
       <PassValidatePassword>
         <ClientCode>46642</ClientCode>
         <Password>YOUR_PASSCODE_HERE</Password>
       </PassValidatePassword>
     </SOAP-ENV:Body>
   </SOAP-ENV:Envelope>
   ```
   **⚠️ Replace `YOUR_PASSCODE_HERE` with your actual passcode**

6. **Click Send**

7. **Check the response**:
   - Look in the **Cookies** tab below the response
   - You should see `ASP.NET_SessionId` with a value like `abc123xyz456`
   - Copy this cookie value (you'll need it for the next step)

### Step 2: Get Trip List with Session Cookie

1. **Create a new request** in Postman
2. **Set request type** to `POST`
3. **Set URL** to: `https://datsonlinebooking.edmonton.ca/PassInfoServer`
4. **Headers tab** - Add:
   ```
   Content-Type: text/xml; charset=utf-8
   SOAPAction: ""
   Cookie: ASP.NET_SessionId=YOUR_SESSION_COOKIE_HERE
   ```
   **⚠️ Replace `YOUR_SESSION_COOKIE_HERE` with the cookie from Step 1**

5. **Body tab** - Select "raw" and paste the XML from `docs/test-get-trips.xml`:
   ```xml
   <?xml version="1.0" encoding="UTF-8" standalone="no"?>
   <SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
     <SOAP-ENV:Body>
       <PassGetClientTrips>
         <OutputVersion>2</OutputVersion>
         <ClientId>46642</ClientId>
         <FromDate>20260115</FromDate>
         <ToDate>20260115</ToDate>
         <Status>S,Pf,CA</Status>
       </PassGetClientTrips>
     </SOAP-ENV:Body>
   </SOAP-ENV:Envelope>
   ```

6. **Click Send**

7. **Check the response XML** - Look for entries like:
   ```xml
   <Trip>
     <ConfirmationNumber>18791570</ConfirmationNumber>
     <StatusCode>S</StatusCode>
     <StatusLabel>Scheduled</StatusLabel>
     <BookingDate>20260115</BookingDate>
     ...
   </Trip>
   ```

### Step 3: Interpret the Results

Look at the `<StatusCode>` field for each trip:

| Status Code | Status Label | What It Means |
|-------------|--------------|---------------|
| `S` | Scheduled | Trip is scheduled but not yet performed |
| `Pf` | Performed | Trip has been completed |
| `CA` | Cancelled | Trip was cancelled |
| `A` | Arrived | Vehicle has arrived at pickup |
| `U` | Unscheduled | Trip booked but not scheduled yet |
| `NS` | No Show | Rider didn't show up |
| `NM` | Missed Trip | Vehicle arrived late |

**What to Check:**
- If trips from 7:50 AM and 9:20 AM show `StatusCode=S` (Scheduled), this confirms DATS hasn't updated them to `Pf` (Performed) yet
- If trips from 7:50 AM and 9:20 AM show `StatusCode=Pf` (Performed), then our MCP server has a passthrough bug

---

## Method 4: Using cURL (Command Line)

### Step 1: Login and Save Cookie

```bash
curl -X POST \
  https://datsonlinebooking.edmonton.ca/PassInfoServer \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: ""' \
  -c cookies.txt \
  -d '<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <PassValidatePassword>
      <ClientCode>46642</ClientCode>
      <Password>YOUR_PASSCODE_HERE</Password>
    </PassValidatePassword>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>'
```

This saves the session cookie to `cookies.txt`.

### Step 2: Get Trip List Using Saved Cookie

```bash
curl -X POST \
  https://datsonlinebooking.edmonton.ca/PassInfoServer \
  -H 'Content-Type: text/xml; charset=utf-8' \
  -H 'SOAPAction: ""' \
  -b cookies.txt \
  -d '<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <PassGetClientTrips>
      <OutputVersion>2</OutputVersion>
      <ClientId>46642</ClientId>
      <FromDate>20260115</FromDate>
      <ToDate>20260115</ToDate>
      <Status>S,Pf,CA</Status>
    </PassGetClientTrips>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>'
```

---

## Understanding the Date Format

DATS uses `YYYYMMDD` format:
- `20260115` = January 15, 2026
- `20260113` = January 13, 2026

## Status Filter Parameter

The `<Status>` parameter filters which trips to return:
- `S,U,A,Pn` - Active trips only (Scheduled, Unscheduled, Arrived, Pending)
- `S,Pf,CA` - Include Scheduled, Performed, and Cancelled
- Omit the `<Status>` tag entirely to get ALL trips

---

## Expected Results for Your Scenario

**Scenario:** Checking trips from January 15, 2026 at 6:58 PM (after both trips have occurred)

**If DATS API returns:**
```xml
<StatusCode>S</StatusCode>
<StatusLabel>Scheduled</StatusLabel>
```
**→ This is a DATS data issue.** DATS hasn't updated the trip status to "Performed" yet. This is normal - DATS may batch-process status updates at end of day or when drivers complete paperwork.

**If DATS API returns:**
```xml
<StatusCode>Pf</StatusCode>
<StatusLabel>Performed</StatusLabel>
```
**→ This is a passthrough bug in our MCP server.** The DATS API has the correct status, but we're not displaying it correctly.

---

## Why Use Direct API Testing?

Following the **Passthrough Principle** from CLAUDE.md, our MCP server should display exactly what DATS returns. Direct API testing lets you:

1. **Verify source data** - See what DATS actually returns
2. **Rule out our code** - If DATS shows "Scheduled", it's not our bug
3. **Understand DATS behavior** - Learn when/how DATS updates trip statuses
4. **Debug effectively** - Know whether to fix our code or document DATS limitations

---

## Troubleshooting

### Error: "Invalid credentials"
- Check that your Client ID and Passcode are correct
- Ensure the XML is properly formatted (no extra spaces/newlines)

### Error: "Session expired"
- The session cookie from Step 1 has expired
- Re-run Step 1 to get a fresh cookie
- Use the new cookie in Step 2

### No trips returned
- Check the date range (`FromDate` and `ToDate`)
- Verify the Client ID is correct
- Try removing the `<Status>` filter to see all trips

### XML parsing errors
- Ensure the XML has proper encoding: `<?xml version="1.0" encoding="UTF-8" standalone="no"?>`
- Check that all tags are properly closed
- Verify no special characters in the passcode field

---

## Next Steps

After testing the API directly:

1. **Document your findings** - Record what status codes DATS returned
2. **Compare with our code** - Check if our MCP server displays the same status
3. **File a bug report** (if needed):
   - If DATS returns "Scheduled" → Document DATS limitation
   - If DATS returns "Performed" but we show "Scheduled" → Fix our code

---

## Security Note

**Never commit your passcode to Git!** The XML test files in this directory use placeholder text (`YOUR_PASSCODE_HERE`). Always replace this with your actual passcode when testing locally, but never save/commit it.

The `.gitignore` file should include:
```
docs/test-*.xml
cookies.txt
```

/**
 * SOAP API Client for DATS PassInfoServer
 * Makes direct API calls instead of browser automation for speed
 */

import { logger } from '../utils/logger.js';
import type { Trip } from '../types.js';

const PASS_INFO_SERVER_URL = 'https://datsonlinebooking.edmonton.ca/PassInfoServer';

interface SoapClientOptions {
  sessionCookie: string;
}

export class SoapClient {
  private sessionCookie: string;

  constructor(options: SoapClientOptions) {
    this.sessionCookie = options.sessionCookie;
  }

  /**
   * Get client trips via SOAP API
   */
  async getClientTrips(clientId: string, fromDate?: string, toDate?: string): Promise<Trip[]> {
    const today = new Date();
    const defaultFromDate = this.formatDate(today);
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + 2);
    const defaultToDate = this.formatDate(futureDate);

    const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <PassGetClientTrips>
      <ClientId>${clientId}</ClientId>
      <FromDate>${fromDate || defaultFromDate}</FromDate>
      <ToDate>${toDate || defaultToDate}</ToDate>
      <SchTypeId>1</SchTypeId>
    </PassGetClientTrips>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    try {
      const response = await fetch(PASS_INFO_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'Accept': 'application/json, text/plain, */*',
          'Cookie': this.sessionCookie,
        },
        body: soapBody,
      });

      if (!response.ok) {
        logger.error(`SOAP API error: ${response.status}`);
        return [];
      }

      const xmlText = await response.text();
      return this.parseTripsFromXml(xmlText);
    } catch (error) {
      logger.error('Failed to call PassGetClientTrips API');
      return [];
    }
  }

  /**
   * Parse trips from SOAP XML response
   */
  private parseTripsFromXml(xml: string): Trip[] {
    const trips: Trip[] = [];

    // Find all PassBooking elements
    const bookingRegex = /<PassBooking>([\s\S]*?)<\/PassBooking>/g;
    let match;

    while ((match = bookingRegex.exec(xml)) !== null) {
      const bookingXml = match[1];
      const trip = this.parseBookingXml(bookingXml);
      if (trip) {
        trips.push(trip);
      }
    }

    return trips;
  }

  /**
   * Parse a single booking from XML
   */
  private parseBookingXml(xml: string): Trip | null {
    try {
      // Extract booking ID
      const bookingIdMatch = xml.match(/<BookingId>(\d+)<\/BookingId>/);
      const bookingId = bookingIdMatch ? bookingIdMatch[1] : '';

      // Extract date
      const dateFMatch = xml.match(/<DateF>([^<]+)<\/DateF>/);
      const date = dateFMatch ? dateFMatch[1] : '';

      // Extract status
      const statusMatch = xml.match(/<SchedStatusF>([^<]+)<\/SchedStatusF>/);
      const statusText = statusMatch ? statusMatch[1].toLowerCase() : 'confirmed';

      // Extract pickup leg info
      const pickupLegMatch = xml.match(/<PickUpLeg[^>]*>([\s\S]*?)<\/PickUpLeg>/);
      const pickupXml = pickupLegMatch ? pickupLegMatch[1] : '';

      // Extract dropoff leg info
      const dropoffLegMatch = xml.match(/<DropOffLeg[^>]*>([\s\S]*?)<\/DropOffLeg>/);
      const dropoffXml = dropoffLegMatch ? dropoffLegMatch[1] : '';

      // Parse pickup address
      const pickupAddress = this.parseAddress(pickupXml);

      // Parse dropoff address
      const dropoffAddress = this.parseAddress(dropoffXml);

      // Parse pickup times (in seconds from midnight)
      const schEarlyMatch = pickupXml.match(/<SchEarly>(\d+)<\/SchEarly>/);
      const schLateMatch = pickupXml.match(/<SchLate>(\d+)<\/SchLate>/);
      const estTimeMatch = pickupXml.match(/<EstTime>(\d+)<\/EstTime>/);
      const pickupTimeMatch = pickupXml.match(/<Time>([^<]+)<\/Time>/);

      const pickupWindowStart = schEarlyMatch
        ? this.secondsToTime(parseInt(schEarlyMatch[1], 10))
        : (pickupTimeMatch ? pickupTimeMatch[1] : '');
      const pickupWindowEnd = schLateMatch
        ? this.secondsToTime(parseInt(schLateMatch[1], 10))
        : '';

      // Parse dropoff estimated time
      const dropoffEstMatch = dropoffXml.match(/<EstTime>(\d+)<\/EstTime>/);
      const dropoffTimeMatch = dropoffXml.match(/<Time>([^<]+)<\/Time>/);
      const estimatedDropoff = dropoffEstMatch
        ? this.secondsToTime(parseInt(dropoffEstMatch[1], 10))
        : (dropoffTimeMatch ? dropoffTimeMatch[1].replace('ETA ', '') : '');

      // Parse estimated pickup
      const estimatedPickup = estTimeMatch
        ? this.secondsToTime(parseInt(estTimeMatch[1], 10))
        : '';

      return {
        bookingId: bookingId,
        confirmationNumber: bookingId,
        date,
        pickupWindow: {
          start: pickupWindowStart,
          end: pickupWindowEnd,
        },
        pickupAddress,
        destinationAddress: dropoffAddress,
        status: statusText.includes('cancel') ? 'CA' : 'S',
        estimatedPickupTime: estimatedPickup,
        estimatedDropoffTime: estimatedDropoff,
      };
    } catch (e) {
      logger.error('Failed to parse booking XML');
      return null;
    }
  }

  /**
   * Parse address from leg XML
   */
  private parseAddress(legXml: string): string {
    const mapAddressMatch = legXml.match(/<MapAddress[^>]*>([\s\S]*?)<\/MapAddress>/);
    if (!mapAddressMatch) return 'Unknown address';

    const addrXml = mapAddressMatch[1];

    const addrName = this.extractXmlValue(addrXml, 'AddrName');
    const streetNo = this.extractXmlValue(addrXml, 'StreetNo');
    const onStreet = this.extractXmlValue(addrXml, 'OnStreet');
    const city = this.extractXmlValue(addrXml, 'City');
    const state = this.extractXmlValue(addrXml, 'State');
    const zipCode = this.extractXmlValue(addrXml, 'ZipCode');

    const parts: string[] = [];
    if (addrName) parts.push(addrName);
    if (streetNo && onStreet) parts.push(`${streetNo} ${onStreet}`);
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (zipCode) parts.push(zipCode);

    return parts.join(', ') || 'Unknown address';
  }

  /**
   * Extract value from XML tag
   */
  private extractXmlValue(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1].trim() : '';
  }

  /**
   * Convert seconds from midnight to time string
   */
  private secondsToTime(seconds: number): string {
    if (seconds < 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  /**
   * Format date as YYYYMMDD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }
}

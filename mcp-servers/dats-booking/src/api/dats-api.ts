/**
 * DATS SOAP API Client
 * Complete API client for all DATS PassInfoServer operations
 */

import { logger } from '../utils/logger.js';
import { ErrorCategory, type Trip, type BookTripInput, type BookTripOutput, type PickupWindow } from '../types.js';

const PASS_INFO_SERVER_URL = 'https://datsonlinebooking.edmonton.ca/PassInfoServer';
const PASS_INFO_SERVER_ASYNC_URL = 'https://datsonlinebooking.edmonton.ca/PassInfoServerAsync';

export interface DATSApiOptions {
  sessionCookie: string;
}

export interface ClientInfo {
  clientId: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: {
    streetNo: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  mobilityAids: string[];
  spaceType: string;
}

export interface SavedLocation {
  locationId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface BookingWindow {
  availableDates: string[];
  earliestTime: string;
  latestTime: string;
}

export interface TripSolution {
  solutionId: string;
  pickupTime: string;
  pickupWindow: PickupWindow;
  dropoffTime: string;
  fare: number;
}

export interface CancelTripResult {
  success: boolean;
  refCode?: string;
  message: string;
}

/**
 * DATS SOAP API Client
 */
export class DATSApi {
  private sessionCookie: string;

  constructor(options: DATSApiOptions) {
    this.sessionCookie = options.sessionCookie;
  }

  // ==================== AUTHENTICATION ====================

  /**
   * Validate client credentials
   */
  async validatePassword(clientId: string, password: string): Promise<boolean> {
    const soap = this.buildSoapRequest('PassValidatePassword', {
      ClientId: clientId,
      Password: password,
    });

    const response = await this.callApi(soap);
    return response.includes('RESULTOK') || response.includes('<Valid>1</Valid>');
  }

  /**
   * Log out the client
   */
  async logoff(clientId: string): Promise<void> {
    const soap = this.buildSoapRequest('PassClientLogoff', {
      ClientId: clientId,
    });
    await this.callApi(soap);
  }

  // ==================== CLIENT INFO ====================

  /**
   * Get client profile information
   */
  async getClientInfo(clientId: string): Promise<ClientInfo | null> {
    const soap = this.buildSoapRequest('PassGetClientInfo', {
      ClientId: clientId,
    });

    const response = await this.callApi(soap);
    return this.parseClientInfo(response);
  }

  /**
   * Get client's saved locations
   */
  async getSavedLocations(clientId: string): Promise<SavedLocation[]> {
    const soap = this.buildSoapRequest('PassGetClientLocationsMerged', {
      ClientId: clientId,
    });

    const response = await this.callApi(soap);
    return this.parseSavedLocations(response);
  }

  /**
   * Get all available mobility aids
   */
  async getMobilityAids(): Promise<Array<{ code: string; description: string }>> {
    const soap = this.buildSoapRequest('PassGetAllMobilityAids', {});

    const response = await this.callApi(soap);
    return this.parseMobilityAids(response);
  }

  // ==================== TRIPS ====================

  /**
   * Get client's trips
   */
  async getClientTrips(clientId: string, fromDate?: string, toDate?: string): Promise<Trip[]> {
    const today = new Date();
    const defaultFromDate = this.formatDate(today);
    const futureDate = new Date(today);
    futureDate.setMonth(futureDate.getMonth() + 2);
    const defaultToDate = this.formatDate(futureDate);

    const soap = this.buildSoapRequest('PassGetClientTrips', {
      ClientId: clientId,
      FromDate: fromDate || defaultFromDate,
      ToDate: toDate || defaultToDate,
      SchTypeId: '1',
    });

    const response = await this.callApi(soap);
    return this.parseTrips(response);
  }

  /**
   * Get frequently used trip patterns
   */
  async getFrequentTrips(clientId: string): Promise<Trip[]> {
    const soap = this.buildSoapRequest('PassGetMostFrequentClientTrips', {
      ClientId: clientId,
    });

    const response = await this.callApi(soap);
    return this.parseTrips(response);
  }

  // ==================== BOOKING ====================

  /**
   * Get available booking dates
   */
  async getBookingDaysWindow(clientId: string): Promise<string[]> {
    const soap = this.buildSoapRequest('PassBookingDaysWindow', {
      ClientId: clientId,
    });

    const response = await this.callApi(soap);
    return this.parseBookingDays(response);
  }

  /**
   * Get available booking times for a date
   */
  async getBookingTimesWindow(clientId: string, date: string): Promise<{ earliest: string; latest: string }> {
    const soap = this.buildSoapRequest('PassBookingTimesWindow', {
      ClientId: clientId,
      Date: date,
    });

    const response = await this.callApi(soap);
    return this.parseBookingTimes(response);
  }

  /**
   * Schedule a trip and get available solutions
   */
  async scheduleTrip(
    clientId: string,
    details: BookTripInput
  ): Promise<TripSolution[]> {
    const soap = this.buildSoapRequest('PassScheduleTrip', {
      ClientId: clientId,
      Date: details.pickupDate.replace(/-/g, ''),
      PickUpLeg: {
        ReqTime: this.timeToSeconds(details.pickupTime),
        RequestAddress: {
          AddressMode: 'A',
          Address: details.pickupAddress,
        },
      },
      DropOffLeg: {
        RequestAddress: {
          AddressMode: 'A',
          Address: details.destinationAddress,
        },
      },
    });

    const response = await this.callApi(soap);
    return this.parseTripSolutions(response);
  }

  /**
   * Create/confirm a trip booking
   */
  async createTrip(
    clientId: string,
    solutionId: string,
    details: BookTripInput
  ): Promise<BookTripOutput> {
    const soap = this.buildSoapRequest('PassCreateTrip', {
      ClientId: clientId,
      SolutionId: solutionId,
      Date: details.pickupDate.replace(/-/g, ''),
      MobilityAids: details.mobilityDevice || '',
      Companion: details.companion ? '1' : '0',
    });

    const response = await this.callApi(soap);
    return this.parseCreateTripResponse(response);
  }

  /**
   * Cancel a trip
   */
  async cancelTrip(clientId: string, bookingId: string, reason?: string): Promise<CancelTripResult> {
    const soap = this.buildSoapRequest('PassCancelTrip', {
      ClientId: clientId,
      BookingId: bookingId,
      CancellationReason: reason || '',
    });

    const response = await this.callApi(soap);
    return this.parseCancelTripResponse(response);
  }

  // ==================== HELPERS ====================

  /**
   * Build SOAP request XML
   */
  private buildSoapRequest(method: string, params: Record<string, unknown>): string {
    const paramsXml = this.objectToXml(params);

    return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <${method}>
      ${paramsXml}
    </${method}>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
  }

  /**
   * Convert object to XML
   */
  private objectToXml(obj: Record<string, unknown>, indent = ''): string {
    let xml = '';
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        xml += `${indent}<${key}>\n${this.objectToXml(value as Record<string, unknown>, indent + '  ')}${indent}</${key}>\n`;
      } else {
        xml += `${indent}<${key}>${value}</${key}>\n`;
      }
    }
    return xml;
  }

  /**
   * Call the SOAP API
   */
  private async callApi(soapBody: string, async = false): Promise<string> {
    const url = async ? PASS_INFO_SERVER_ASYNC_URL : PASS_INFO_SERVER_URL;

    try {
      const response = await fetch(url, {
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
        return '';
      }

      return await response.text();
    } catch (error) {
      logger.error('Failed to call SOAP API');
      return '';
    }
  }

  /**
   * Extract XML value
   */
  private extractXml(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1].trim() : '';
  }

  /**
   * Extract all matches for a tag
   */
  private extractAllXml(xml: string, tag: string): string[] {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'g');
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
      matches.push(match[1].trim());
    }
    return matches;
  }

  // ==================== PARSERS ====================

  private parseClientInfo(xml: string): ClientInfo | null {
    if (!xml.includes('PassGetClientInfoResult')) return null;

    return {
      clientId: this.extractXml(xml, 'ClientId'),
      firstName: this.extractXml(xml, 'FirstName'),
      lastName: this.extractXml(xml, 'LastName'),
      phone: this.extractXml(xml, 'Phone'),
      address: {
        streetNo: this.extractXml(xml, 'StreetNo'),
        street: this.extractXml(xml, 'OnStreet'),
        city: this.extractXml(xml, 'City'),
        state: this.extractXml(xml, 'State'),
        zipCode: this.extractXml(xml, 'ZipCode'),
      },
      mobilityAids: this.extractAllXml(xml, 'MobAidCode'),
      spaceType: this.extractXml(xml, 'PrefSpaceType'),
    };
  }

  private parseSavedLocations(xml: string): SavedLocation[] {
    const locations: SavedLocation[] = [];
    const locationRegex = /<Location[^>]*>([\s\S]*?)<\/Location>/g;
    let match;

    while ((match = locationRegex.exec(xml)) !== null) {
      const locXml = match[1];
      locations.push({
        locationId: this.extractXml(locXml, 'LocationId'),
        name: this.extractXml(locXml, 'AddrName') || this.extractXml(locXml, 'SiteName'),
        address: `${this.extractXml(locXml, 'StreetNo')} ${this.extractXml(locXml, 'OnStreet')}`,
        city: this.extractXml(locXml, 'City'),
        state: this.extractXml(locXml, 'State'),
        zipCode: this.extractXml(locXml, 'ZipCode'),
      });
    }

    return locations;
  }

  private parseMobilityAids(xml: string): Array<{ code: string; description: string }> {
    const aids: Array<{ code: string; description: string }> = [];
    const aidRegex = /<MobilityAid[^>]*>([\s\S]*?)<\/MobilityAid>/g;
    let match;

    while ((match = aidRegex.exec(xml)) !== null) {
      const aidXml = match[1];
      aids.push({
        code: this.extractXml(aidXml, 'MobAidCode'),
        description: this.extractXml(aidXml, 'Description'),
      });
    }

    return aids;
  }

  private parseTrips(xml: string): Trip[] {
    const trips: Trip[] = [];
    const bookingRegex = /<PassBooking>([\s\S]*?)<\/PassBooking>/g;
    let match;

    while ((match = bookingRegex.exec(xml)) !== null) {
      const trip = this.parseBookingXml(match[1]);
      if (trip) trips.push(trip);
    }

    return trips;
  }

  private parseBookingXml(xml: string): Trip | null {
    try {
      const bookingId = this.extractXml(xml, 'BookingId');
      const date = this.extractXml(xml, 'DateF') || this.extractXml(xml, 'RawDate');
      const status = this.extractXml(xml, 'SchedStatusF').toLowerCase();

      // Parse pickup leg
      const pickupMatch = xml.match(/<PickUpLeg[^>]*>([\s\S]*?)<\/PickUpLeg>/);
      const pickupXml = pickupMatch ? pickupMatch[1] : '';

      // Parse dropoff leg
      const dropoffMatch = xml.match(/<DropOffLeg[^>]*>([\s\S]*?)<\/DropOffLeg>/);
      const dropoffXml = dropoffMatch ? dropoffMatch[1] : '';

      // Pickup times
      const schEarly = parseInt(this.extractXml(pickupXml, 'SchEarly'), 10);
      const schLate = parseInt(this.extractXml(pickupXml, 'SchLate'), 10);
      const estPickup = parseInt(this.extractXml(pickupXml, 'EstTime'), 10);

      // Dropoff time
      const estDropoff = parseInt(this.extractXml(dropoffXml, 'EstTime'), 10);

      // Addresses
      const pickupAddr = this.parseAddressFromXml(pickupXml);
      const dropoffAddr = this.parseAddressFromXml(dropoffXml);

      return {
        confirmationNumber: bookingId,
        date: date.includes(',') ? date : this.formatDateDisplay(date),
        pickupWindow: {
          start: schEarly > 0 ? this.secondsToTime(schEarly) : '',
          end: schLate > 0 ? this.secondsToTime(schLate) : '',
        },
        pickupAddress: pickupAddr,
        destinationAddress: dropoffAddr,
        status: status.includes('cancel') ? 'cancelled' : 'confirmed',
        estimatedPickupTime: estPickup > 0 ? this.secondsToTime(estPickup) : undefined,
        estimatedDropoffTime: estDropoff > 0 ? this.secondsToTime(estDropoff) : undefined,
      };
    } catch {
      return null;
    }
  }

  private parseAddressFromXml(legXml: string): string {
    const addrMatch = legXml.match(/<MapAddress[^>]*>([\s\S]*?)<\/MapAddress>/);
    if (!addrMatch) return 'Unknown address';

    const addrXml = addrMatch[1];
    const name = this.extractXml(addrXml, 'AddrName');
    const streetNo = this.extractXml(addrXml, 'StreetNo');
    const street = this.extractXml(addrXml, 'OnStreet');
    const city = this.extractXml(addrXml, 'City');
    const state = this.extractXml(addrXml, 'State');
    const zip = this.extractXml(addrXml, 'ZipCode');

    const parts: string[] = [];
    if (name) parts.push(name);
    if (streetNo && street) parts.push(`${streetNo} ${street}`);
    if (city) parts.push(city);
    if (state) parts.push(state);
    if (zip) parts.push(zip);

    return parts.join(', ') || 'Unknown address';
  }

  private parseBookingDays(xml: string): string[] {
    return this.extractAllXml(xml, 'Date').map(d => this.formatDateDisplay(d));
  }

  private parseBookingTimes(xml: string): { earliest: string; latest: string } {
    const earliest = parseInt(this.extractXml(xml, 'EarliestTime'), 10);
    const latest = parseInt(this.extractXml(xml, 'LatestTime'), 10);

    return {
      earliest: earliest > 0 ? this.secondsToTime(earliest) : '6:00 AM',
      latest: latest > 0 ? this.secondsToTime(latest) : '11:00 PM',
    };
  }

  private parseTripSolutions(xml: string): TripSolution[] {
    const solutions: TripSolution[] = [];
    const solutionRegex = /<Solution[^>]*>([\s\S]*?)<\/Solution>/g;
    let match;

    while ((match = solutionRegex.exec(xml)) !== null) {
      const solXml = match[1];
      const schEarly = parseInt(this.extractXml(solXml, 'SchEarly'), 10);
      const schLate = parseInt(this.extractXml(solXml, 'SchLate'), 10);

      solutions.push({
        solutionId: this.extractXml(solXml, 'SolutionId'),
        pickupTime: this.secondsToTime(schEarly),
        pickupWindow: {
          start: this.secondsToTime(schEarly),
          end: this.secondsToTime(schLate),
        },
        dropoffTime: this.secondsToTime(parseInt(this.extractXml(solXml, 'EstDropoff'), 10)),
        fare: parseFloat(this.extractXml(solXml, 'Fare') || '0'),
      });
    }

    return solutions;
  }

  private parseCreateTripResponse(xml: string): BookTripOutput {
    if (xml.includes('RESULTOK') || xml.includes('<BookingId>')) {
      const bookingId = this.extractXml(xml, 'BookingId');
      const schEarly = parseInt(this.extractXml(xml, 'SchEarly'), 10);
      const schLate = parseInt(this.extractXml(xml, 'SchLate'), 10);

      return {
        success: true,
        confirmationNumber: bookingId,
        pickupWindow: schEarly > 0 ? {
          start: this.secondsToTime(schEarly),
          end: this.secondsToTime(schLate),
        } : undefined,
      };
    }

    const errorMsg = this.extractXml(xml, 'Message') || 'Booking failed';
    return {
      success: false,
      error: {
        category: ErrorCategory.BOOKING_CONFLICT,
        message: errorMsg,
        recoverable: true,
      },
    };
  }

  private parseCancelTripResponse(xml: string): CancelTripResult {
    if (xml.includes('RESULTOK')) {
      const refCode = this.extractXml(xml, 'CancelRefCode');
      return {
        success: true,
        refCode,
        message: 'Trip cancelled successfully',
      };
    }

    const errorMsg = this.extractXml(xml, 'Message') || 'Cancellation failed';
    return {
      success: false,
      message: errorMsg,
    };
  }

  // ==================== UTILITIES ====================

  private secondsToTime(seconds: number): string {
    if (seconds < 0 || isNaN(seconds)) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  private timeToSeconds(time: string): number {
    const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return 0;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 3600 + minutes * 60;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private formatDateDisplay(yyyymmdd: string): string {
    if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
    const year = yyyymmdd.substring(0, 4);
    const month = parseInt(yyyymmdd.substring(4, 6), 10);
    const day = parseInt(yyyymmdd.substring(6, 8), 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[month - 1]} ${day}, ${year}`;
  }
}

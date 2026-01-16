/**
 * DATS SOAP API Client
 * Complete API client for all DATS PassInfoServer operations
 */

import { logger } from '../utils/logger.js';
import { ErrorCategory, TRIP_STATUSES, type Trip, type TripPassenger, type BookTripInput, type BookTripOutput, type PickupWindow, type TripStatusCode, type TrackTripOutput, type VehicleInfo, type EventTrackingInfo } from '../types.js';

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

export interface Announcement {
  id: string;
  text: string;
  ttsText: string;
  groupDescription: string;
  startDate?: string;
  endDate?: string;
}

export interface ContactInfo {
  clientId: string;
  firstName: string;
  lastName: string;
  homePhone?: string;
  workPhone?: string;
  cellPhone?: string;
  email?: string;
  emergencyContacts: Array<{
    name: string;
    phone: string;
    relationship?: string;
  }>;
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
   * Get client contact information including emergency contacts
   */
  async getContactInfo(clientId: string): Promise<ContactInfo | null> {
    const soap = this.buildSoapRequest('PassGetClientContactInfo', {
      ClientId: clientId,
    });

    const response = await this.callApi(soap);
    logger.debug(`getContactInfo raw response: ${response.substring(0, 500)}`);
    return this.parseContactInfo(response, clientId);
  }

  /**
   * Get active announcements/remarks
   */
  async getAnnouncements(language = 'en'): Promise<Announcement[]> {
    // Use the /Remarks endpoint with SOAP request discovered in HAR analysis
    const soap = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <SOAP-ENV:Body>
    <GetActivePassRemarks>
      <LanguageName>${language}</LanguageName>
    </GetActivePassRemarks>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    try {
      const response = await fetch('https://datsonlinebooking.edmonton.ca/Remarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'Accept': 'application/json, text/plain, */*',
          'Cookie': this.sessionCookie,
        },
        body: soap,
      });

      if (!response.ok) {
        logger.warn(`Remarks endpoint returned ${response.status}`);
        return [];
      }

      const text = await response.text();
      return this.parseAnnouncementsXml(text);
    } catch (error) {
      logger.error('Failed to get announcements', error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Get client's merged locations (registered + frequent addresses)
   * NEW: Discovered from HAR analysis - PassGetClientLocationsMerged
   */
  async getClientLocationsMerged(clientId: string): Promise<import('../types.js').SavedLocation[]> {
    const soap = this.buildSoapRequest('PassGetClientLocationsMerged', {
      ClientId: clientId,
    });

    const response = await this.callApi(soap);
    logger.debug(`getClientLocationsMerged raw response: ${response.substring(0, 500)}`);
    return this.parseClientLocationsMerged(response);
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
    futureDate.setUTCMonth(futureDate.getUTCMonth() + 2);
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
   * Get most frequently used trip pairs for quick rebooking
   * NEW: Discovered from HAR analysis - PassGetMostFrequentClientTrips
   */
  async getMostFrequentClientTrips(clientId: string, fromDate: string): Promise<import('../types.js').FrequentTrip[]> {
    const soap = this.buildSoapRequest('PassGetMostFrequentClientTrips', {
      OutputVersion: '2',
      FromDate: fromDate,
      ClientId: clientId,
    });

    const response = await this.callApi(soap);
    return this.parseMostFrequentClientTrips(response);
  }

  // ==================== BOOKING ====================

  /**
   * Get available booking dates (3-day advance booking window)
   * NEW: Updated from HAR analysis with proper parameters
   */
  async getBookingDaysWindow(requestedTimeType: 'pickup' | 'dropoff' = 'pickup'): Promise<import('../types.js').BookingDaysWindow> {
    const soap = this.buildSoapRequest('PassBookingDaysWindow', {
      RequestedTimeType: requestedTimeType,
      CalendarDay: '1',
    });

    const response = await this.callApi(soap);
    return this.parseBookingDaysWindow(response);
  }

  /**
   * Get available time slots for specific route and date
   * NEW: Updated from HAR analysis with route coordinates
   */
  async getBookingTimesWindow(
    date: string,
    pickupLat: number,
    pickupLon: number,
    dropoffLat: number,
    dropoffLon: number,
    requestedTimeType: 'pickup' | 'dropoff' = 'pickup'
  ): Promise<import('../types.js').BookingTimesWindow> {
    const soap = this.buildSoapRequest('PassBookingTimesWindow', {
      CalendarDay: '1',
      Date: date,
      FirstBookingTime: '0',
      RequestedTimeType: requestedTimeType,
      Origin: {
        Lat: pickupLat.toString(),
        Lon: pickupLon.toString(),
      },
      Destination: {
        Lat: dropoffLat.toString(),
        Lon: dropoffLon.toString(),
      },
    });

    const response = await this.callApi(soap);
    return this.parseBookingTimesWindow(response);
  }

  /**
   * Get default booking settings and all available options
   * NEW: Discovered from HAR analysis - PassGetDefaultBooking
   */
  async getDefaultBooking(clientId: string, date: string): Promise<import('../types.js').DefaultBooking> {
    const soap = this.buildSoapRequest('PassGetDefaultBooking', {
      Date: date,
      ClientId: clientId,
    });

    const response = await this.callApi(soap);
    return this.parseDefaultBooking(response);
  }

  /**
   * Complete booking flow: CreateTrip -> ScheduleTrip -> SaveSolution
   * This is the correct 3-step flow discovered from HAR analysis
   */
  async bookTrip(clientId: string, details: BookTripInput): Promise<BookTripOutput> {
    // Step 1: Create trip draft with PassCreateTrip
    logger.info('Step 1: Creating trip draft with PassCreateTrip');
    const createResult = await this.createTripDraft(clientId, details);

    if (!createResult.bookingId) {
      return {
        success: false,
        error: {
          category: ErrorCategory.BOOKING_CONFLICT,
          message: createResult.error || 'Failed to create trip draft',
          recoverable: true,
        },
      };
    }

    logger.info(`Trip draft created with BookingId: ${createResult.bookingId}`);

    // Step 2: Get available solutions with PassScheduleTrip
    logger.info('Step 2: Getting solutions with PassScheduleTrip');
    const solutions = await this.scheduleTripByBookingId(createResult.bookingId);

    if (solutions.length === 0) {
      return {
        success: false,
        error: {
          category: ErrorCategory.BOOKING_CONFLICT,
          message: 'No available trip slots for the requested time',
          recoverable: true,
        },
      };
    }

    logger.info(`Found ${solutions.length} solutions`);

    // Step 3: Save the first solution with PassSaveSolution
    logger.info('Step 3: Confirming with PassSaveSolution');
    const saveResult = await this.saveSolution(
      createResult.bookingId,
      solutions[0].scheduleId,
      solutions[0].solutionSetNumber,
      solutions[0].solutionNumber
    );

    if (!saveResult.success) {
      return {
        success: false,
        error: {
          category: ErrorCategory.BOOKING_CONFLICT,
          message: saveResult.error || 'Failed to confirm booking',
          recoverable: true,
        },
      };
    }

    return {
      success: true,
      bookingId: createResult.bookingId,
      confirmationNumber: createResult.confirmationNumber || createResult.bookingId,
      pickupWindow: solutions[0].pickupWindow,
    };
  }

  /**
   * Step 1: Create trip draft
   * For pickup: Uses CH (Client Home) mode
   * For destination: Uses ZZ mode with geocoded address details
   */
  private async createTripDraft(clientId: string, details: BookTripInput): Promise<{
    bookingId?: string;
    confirmationNumber?: string;
    error?: string;
  }> {
    const pickupTime = this.timeToSeconds(details.pickupTime);

    // Geocode the destination address using Nominatim
    const destGeo = await this.geocodeAddress(details.destinationAddress);
    if (!destGeo) {
      return { error: `Could not geocode destination address: ${details.destinationAddress}` };
    }

    // Build pickup address XML - always geocode to ZZ format
    const pickupGeo = await this.geocodeAddress(details.pickupAddress);
    if (!pickupGeo) {
      return { error: `Could not geocode pickup address: ${details.pickupAddress}` };
    }

    // Format phone numbers for XML (empty string if not provided)
    const pickupPhone = details.pickupPhone ? this.escapeXml(details.pickupPhone) : '';
    const dropoffPhone = details.dropoffPhone ? this.escapeXml(details.dropoffPhone) : '';

    // Format comments (empty string if not provided)
    const pickupComments = details.pickupComments ? this.escapeXml(details.pickupComments) : '';
    const dropoffComments = details.dropoffComments ? this.escapeXml(details.dropoffComments) : '';

    // Determine space type based on mobility device
    const spaceType = details.mobilityDevice === 'wheelchair' ? 'WC' :
                      details.mobilityDevice === 'scooter' ? 'SC' : 'AM';

    // Mobility aids code
    const mobilityAids = details.mobilityDevice === 'wheelchair' ? 'WC' :
                         details.mobilityDevice === 'scooter' ? 'SC' :
                         details.mobilityDevice === 'walker' ? 'WA' : 'DL';

    // Map user-friendly purpose to DATS purpose ID
    const purposeMap: Record<string, number> = {
      'work': 18,
      'education': 19,
      'program': 6,
      'medical': 7,
      'dialysis': 8,
      'personal': 13,
      'shopping': 14,
      'refused': 17,
    };
    const purposeId = details.purpose ? purposeMap[details.purpose] : undefined;

    // Build additional passengers XML if specified
    // Note: HAR analysis shows CompanionMode stays 'S' even with passengers
    // Structure: <PassBookingPassengers><PassBookingPassenger>...</PassBookingPassenger></PassBookingPassengers>
    let passengersXml = '<PassBookingPassengers/>';
    if (details.additionalPassenger) {
      const passengerType = details.additionalPassenger.type === 'escort' ? 'ESC' :
                            details.additionalPassenger.type === 'pca' ? 'PCA' : 'GUE';
      const count = details.additionalPassenger.count || 1;
      passengersXml = `<PassBookingPassengers><PassBookingPassenger><PassengerType>${passengerType}</PassengerType><SpaceType>AM</SpaceType><PassengerCount>${count}</PassengerCount></PassBookingPassenger></PassBookingPassengers>`;
    }

    const pickupAddressXml = `<AddressMode tcftype='10'>ZZ</AddressMode>
          <BookingId tcftype='8'>0</BookingId>
          <EndPoint tcftype='8'>0</EndPoint>
          <Unit></Unit>
          <Phone>${pickupPhone}</Phone>
          <Lat>${pickupGeo.lat}</Lat>
          <Lon>${pickupGeo.lon}</Lon>
          <OnStreet>${pickupGeo.street}</OnStreet>
          <AtStreet/>
          <City>${pickupGeo.city}</City>
          <State>${pickupGeo.state}</State>
          <ZipCode>${pickupGeo.postalCode}</ZipCode>
          <GeoStatus>-1</GeoStatus>
          <JurisPolyId>0</JurisPolyId>
          <PolyId>0</PolyId>
          <AddrName/>
          <StreetNo>${pickupGeo.streetNo}</StreetNo>`;

    // Build the PassCreateTrip request matching the HAR format
    const soap = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <SOAP-ENV:Body>
    <PassCreateTrip>
      <RowsetFormat>1</RowsetFormat>
      <RuleId>2</RuleId>
      <SequenceId>1</SequenceId>
      <AutoSchedule>0</AutoSchedule>
      <WeekTemplate></WeekTemplate>
      <BookingType>C</BookingType>
      <ClientEligCondId></ClientEligCondId>
      <BookingPurposeId>${purposeId || ''}</BookingPurposeId>
      <FundingSourceId></FundingSourceId>
      <ClientTypeCode>CLI</ClientTypeCode>
      <CompanionMode tcftype='10'>S</CompanionMode>
      <PickUpLeg tcftype='11' shared='true'>
        <Comments>${pickupComments}</Comments>
        <EndPoint tcftype='8'>0</EndPoint>
        <RequestAddress tcftype='11' shared='true'>
          ${pickupAddressXml}
        </RequestAddress>
        <ReqTime>${pickupTime}</ReqTime>
      </PickUpLeg>
      <DropOffLeg tcftype='11' shared='true'>
        <Comments>${dropoffComments}</Comments>
        <EndPoint tcftype='8'>1</EndPoint>
        <RequestAddress tcftype='11' shared='true'>
          <AddressMode tcftype='10'>ZZ</AddressMode>
          <BookingId tcftype='8'>0</BookingId>
          <EndPoint tcftype='8'>1</EndPoint>
          <Unit></Unit>
          <Phone>${dropoffPhone}</Phone>
          <Lat>${destGeo.lat}</Lat>
          <Lon>${destGeo.lon}</Lon>
          <OnStreet>${destGeo.street}</OnStreet>
          <AtStreet/>
          <City>${destGeo.city}</City>
          <State>${destGeo.state}</State>
          <ZipCode>${destGeo.postalCode}</ZipCode>
          <GeoStatus>-1</GeoStatus>
          <JurisPolyId>0</JurisPolyId>
          <PolyId>0</PolyId>
          <AddrName/>
          <StreetNo>${destGeo.streetNo}</StreetNo>
        </RequestAddress>
      </DropOffLeg>
      <SpaceType>${spaceType}</SpaceType>
      <Product>PassWebG3</Product>
      ${passengersXml}
      <ClientId>${clientId}</ClientId>
      <Date>${details.pickupDate.replace(/-/g, '')}</Date>
      <PaymentTypesDetail>1</PaymentTypesDetail>
      <PrepaidReq>0</PrepaidReq>
      <MobilityAids>${mobilityAids}</MobilityAids>
    </PassCreateTrip>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    const response = await this.callApi(soap);

    // Check for errors
    if (response.includes('<Type>error</Type>')) {
      const errorMsg = this.extractXml(response, 'Message') || 'Unknown error';
      logger.error(`PassCreateTrip error: ${errorMsg}`);
      return { error: errorMsg };
    }

    const bookingId = this.extractXml(response, 'BookingId');
    const confirmationNumber = this.extractXml(response, 'CreationConfirmationNumber');

    return { bookingId, confirmationNumber };
  }

  /**
   * Geocode an address using OpenStreetMap Nominatim
   * Falls back to parsing street number from input address
   */
  private async geocodeAddress(address: string): Promise<{
    lat: number;
    lon: number;
    streetNo: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
  } | null> {
    try {
      // Extract street number from the input address (e.g., "9713 160 St" -> "9713")
      const streetNoMatch = address.match(/^(\d+)\s/);
      const inputStreetNo = streetNoMatch ? streetNoMatch[1] : '';

      // Add Edmonton, AB to the address for better results
      const searchAddress = address.includes('Edmonton') ? address : `${address}, Edmonton, AB, Canada`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&addressdetails=1&limit=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DATS-Booking-MCP/1.0',
        },
      });

      const results = await response.json() as Array<{
        lat: string;
        lon: string;
        address: {
          house_number?: string;
          road?: string;
          city?: string;
          town?: string;
          state?: string;
          postcode?: string;
        };
      }>;

      if (results.length === 0) {
        logger.warn(`No geocoding results for: ${address}`);
        return null;
      }

      const result = results[0];
      const addr = result.address;

      // Use input street number if Nominatim didn't return one
      const streetNo = addr.house_number || inputStreetNo;

      logger.info(`Geocoded "${address}" -> lat=${result.lat}, lon=${result.lon}, streetNo=${streetNo}, street=${addr.road}`);

      // Convert to DATS format (lat/lon in microdegrees as integers)
      return {
        lat: Math.round(parseFloat(result.lat) * 1000000),
        lon: Math.round(parseFloat(result.lon) * 1000000),
        streetNo: streetNo,
        street: (addr.road || '').toUpperCase(),
        city: (addr.city || addr.town || 'EDMONTON').toUpperCase(),
        state: 'AB',
        postalCode: (addr.postcode || '').replace(/\s/g, ''),
      };
    } catch (error) {
      logger.error('Geocoding failed', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * Step 2: Get solutions for existing booking
   */
  private async scheduleTripByBookingId(bookingId: string): Promise<Array<{
    solutionNumber: string;
    solutionSetNumber: string;
    scheduleId: string;
    pickupWindow: PickupWindow;
  }>> {
    const soap = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <SOAP-ENV:Body>
    <PassScheduleTrip>
      <RowsetFormat>1</RowsetFormat>
      <BookingId>${bookingId}</BookingId>
      <PaymentTypesDetail>1</PaymentTypesDetail>
    </PassScheduleTrip>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    const response = await this.callApi(soap);

    // Check for errors
    if (response.includes('<Type>error</Type>')) {
      const errorMsg = this.extractXml(response, 'Message') || 'Unknown error';
      logger.error(`PassScheduleTrip error: ${errorMsg}`);
      throw new Error(`DATS API error: ${errorMsg}`);
    }

    // Parse solutions
    const solutions: Array<{
      solutionNumber: string;
      solutionSetNumber: string;
      scheduleId: string;
      pickupWindow: PickupWindow;
    }> = [];

    const scheduleId = this.extractXml(response, 'ScheduleId');
    const solutionSetNumber = this.extractXml(response, 'SolutionSetNumber');

    const solutionRegex = /<PassTripSolution>([\s\S]*?)<\/PassTripSolution>/g;
    let match;

    while ((match = solutionRegex.exec(response)) !== null) {
      const solXml = match[1];
      const earlyTime = parseInt(this.extractXml(solXml, 'EarlyTime'), 10);
      const lateTime = parseInt(this.extractXml(solXml, 'LateTime'), 10);

      solutions.push({
        solutionNumber: this.extractXml(solXml, 'SolutionNumber'),
        solutionSetNumber,
        scheduleId,
        pickupWindow: {
          start: this.secondsToTime(earlyTime),
          end: this.secondsToTime(lateTime),
        },
      });
    }

    return solutions;
  }

  /**
   * Step 3: Save/confirm the solution
   */
  private async saveSolution(
    bookingId: string,
    scheduleId: string,
    solutionSetNumber: string,
    solutionNumber: string
  ): Promise<{ success: boolean; error?: string }> {
    const soap = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <SOAP-ENV:Body>
    <PassSaveSolution>
      <RowsetFormat>1</RowsetFormat>
      <ScheduleId>${scheduleId}</ScheduleId>
      <SolutionSetNumber>${solutionSetNumber}</SolutionSetNumber>
      <SolutionNumber>${solutionNumber}</SolutionNumber>
      <BookingId>${bookingId}</BookingId>
    </PassSaveSolution>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    const response = await this.callApi(soap);

    // Check for errors
    if (response.includes('<Type>error</Type>')) {
      const errorMsg = this.extractXml(response, 'Message') || 'Unknown error';
      logger.error(`PassSaveSolution error: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    if (response.includes('RESULTOK') || response.includes('SOLNSAVED')) {
      return { success: true };
    }

    return { success: false, error: 'Unknown save solution error' };
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

  /**
   * Track a trip in real-time
   * Returns live vehicle location, ETA, and driver info for imminent trips
   */
  async trackTrip(clientId: string, bookingId?: string): Promise<TrackTripOutput> {
    // NOTE: Do NOT send date/time parameters - the DATS portal only sends duration and ClientId
    // Including date/time causes the API to return no results even for active trips
    const soap = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" SOAP-ENV:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <SOAP-ENV:Body>
    <PassPullForImminentArrivals>
      <duration>60</duration>
      <ClientId>${clientId}</ClientId>
    </PassPullForImminentArrivals>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;

    const response = await this.callApi(soap, true); // Use async endpoint
    return this.parseTrackTripResponse(response, bookingId);
  }

  /**
   * Parse the tracking response from PassPullForImminentArrivals
   */
  private parseTrackTripResponse(xml: string, requestedBookingId?: string): TrackTripOutput {
    if (!xml || !xml.includes('PassPullForImminentArrivalsResponse')) {
      return {
        success: false,
        bookingId: requestedBookingId || '',
        pickup: this.emptyEventInfo(),
        dropoff: this.emptyEventInfo(),
        lastChecked: new Date().toISOString(),
        error: {
          category: ErrorCategory.SYSTEM_ERROR,
          message: 'No tracking data available',
          recoverable: true,
        },
      };
    }

    // Find the booking element (may have multiple if multiple trips)
    const bookingRegex = /<booking>([\s\S]*?)<\/booking>/g;
    let match;
    let bookingXml: string | null = null;

    while ((match = bookingRegex.exec(xml)) !== null) {
      const bXml = match[1];
      const foundBookingId = this.extractXml(bXml, 'BookingId');

      // If a specific booking was requested, find it
      if (requestedBookingId) {
        if (foundBookingId === requestedBookingId) {
          bookingXml = bXml;
          break;
        }
      } else {
        // Otherwise, take the first one
        bookingXml = bXml;
        break;
      }
    }

    if (!bookingXml) {
      return {
        success: false,
        bookingId: requestedBookingId || '',
        pickup: this.emptyEventInfo(),
        dropoff: this.emptyEventInfo(),
        lastChecked: new Date().toISOString(),
        error: {
          category: ErrorCategory.VALIDATION_ERROR,
          message: 'Live tracking not available. DATS has not dispatched a vehicle yet. Use get_trips to check current trip status.',
          recoverable: true,
        },
      };
    }

    const bookingId = this.extractXml(bookingXml, 'BookingId');

    // Parse pickup event
    const pickupMatch = bookingXml.match(/<Pickup[^>]*>([\s\S]*?)<\/Pickup>/);
    const pickup = pickupMatch ? this.parseEventInfo(pickupMatch[1], 'PU') : this.emptyEventInfo();

    // Parse dropoff event
    const dropoffMatch = bookingXml.match(/<Dropoff[^>]*>([\s\S]*?)<\/Dropoff>/);
    const dropoff = dropoffMatch ? this.parseEventInfo(dropoffMatch[1], 'DO') : this.emptyEventInfo();

    // Parse vehicle info
    const vehicleMatch = bookingXml.match(/<Vehicle[^>]*>([\s\S]*?)<\/Vehicle>/);
    const vehicle = vehicleMatch ? this.parseVehicleInfo(vehicleMatch[1]) : undefined;

    // Get provider and run info from events
    const eventMatch = bookingXml.match(/<Event>([\s\S]*?)<\/Event>/);
    const provider = eventMatch ? this.extractXml(eventMatch[1], 'ProviderName') : undefined;
    const runName = eventMatch ? this.extractXml(eventMatch[1], 'RunName') : undefined;

    // Get address info from Events (more complete than Pickup/Dropoff)
    const eventsRegex = /<Event>([\s\S]*?)<\/Event>/g;
    let eventIdx = 0;
    while ((match = eventsRegex.exec(bookingXml)) !== null) {
      const eventXml = match[1];
      const activity = this.extractXml(eventXml, 'Activity');
      if (activity === 'PU' && !pickup.address) {
        pickup.address = this.formatEventAddress(eventXml);
      } else if (activity === 'DO' && !dropoff.address) {
        dropoff.address = this.formatEventAddress(eventXml);
      }
      eventIdx++;
    }

    const lastCheckTime = this.extractXml(xml, 'lastCheckTime');
    const lastChecked = lastCheckTime ? this.secondsToTime(Math.floor(parseInt(lastCheckTime, 10) / 1000)) : new Date().toISOString();

    return {
      success: true,
      bookingId,
      pickup,
      dropoff,
      vehicle,
      provider,
      runName,
      lastChecked,
    };
  }

  /**
   * Parse event tracking info from XML
   */
  private parseEventInfo(xml: string, _activity: 'PU' | 'DO'): EventTrackingInfo {
    const estTime = parseInt(this.extractXml(xml, 'EstTime'), 10);
    const eta = parseInt(this.extractXml(xml, 'ETA'), 10);
    const lat = parseInt(this.extractXml(xml, 'Lat'), 10) / 1000000;
    const lon = parseInt(this.extractXml(xml, 'Lon'), 10) / 1000000;
    const actualArrive = parseInt(this.extractXml(xml, 'ActualArriveTime'), 10);
    const actualDepart = parseInt(this.extractXml(xml, 'ActualDepartTime'), 10);
    const isImminent = this.extractXml(xml, 'ImminentEvent') === '1';

    // Determine status
    let status: 'scheduled' | 'arrived' | 'departed' | 'completed' = 'scheduled';
    if (actualDepart > 0) {
      status = 'departed';
    } else if (actualArrive > 0) {
      status = 'arrived';
    }

    return {
      estimatedTime: estTime > 0 ? this.secondsToTime(estTime) : '',
      eta: eta > 0 ? this.secondsToTime(eta) : '',
      location: { lat, lon },
      address: '', // Will be filled from Events section
      actualArriveTime: actualArrive > 0 ? this.secondsToTime(actualArrive) : undefined,
      actualDepartTime: actualDepart > 0 ? this.secondsToTime(actualDepart) : undefined,
      isImminent,
      status,
    };
  }

  /**
   * Parse vehicle info from XML
   */
  private parseVehicleInfo(xml: string): VehicleInfo {
    const lat = parseInt(this.extractXml(xml, 'Lat'), 10) / 1000000;
    const lon = parseInt(this.extractXml(xml, 'Lon'), 10) / 1000000;
    const avlUpdateTime = parseInt(this.extractXml(xml, 'AVLUpdateTime'), 10);

    return {
      vehicleNumber: this.extractXml(xml, 'VehicleNumber'),
      make: this.extractXml(xml, 'Make'),
      model: this.extractXml(xml, 'Model'),
      description: this.extractXml(xml, 'Description'),
      driverName: this.extractXml(xml, 'DriverName'),
      driverBadgeNum: this.extractXml(xml, 'DriverBadgeNum'),
      driverPhone: this.extractXml(xml, 'DriverPhone') || undefined,
      location: { lat, lon },
      lastUpdate: avlUpdateTime > 0 ? this.secondsToTime(avlUpdateTime) : '',
    };
  }

  /**
   * Format address from event XML
   */
  private formatEventAddress(xml: string): string {
    const streetNo = this.extractXml(xml, 'StreetNo');
    const onStreet = this.extractXml(xml, 'OnStreet');
    const city = this.extractXml(xml, 'City');
    const state = this.extractXml(xml, 'State');

    if (!streetNo && !onStreet) return '';
    return `${streetNo} ${onStreet}, ${city}, ${state}`.trim();
  }

  /**
   * Create empty event info for error responses
   */
  private emptyEventInfo(): EventTrackingInfo {
    return {
      estimatedTime: '',
      eta: '',
      location: { lat: 0, lon: 0 },
      address: '',
      isImminent: false,
      status: 'scheduled',
    };
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
        const errorBody = await response.text();
        logger.error(`SOAP API error: ${response.status} - ${errorBody.substring(0, 500)}`);
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
    // Note: [^>]* allows for XML attributes like <Tag attr="value">
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
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

  private parseClientLocationsMerged(xml: string): import('../types.js').SavedLocation[] {
    const locations: import('../types.js').SavedLocation[] = [];
    const locationRegex = /<Location[^>]*>([\s\S]*?)<\/Location>/g;
    let match;

    while ((match = locationRegex.exec(xml)) !== null) {
      const locXml = match[1];
      const addrNumber = this.extractXml(locXml, 'AddrNumber');
      const legId = this.extractXml(locXml, 'LegId');

      locations.push({
        addressMode: (this.extractXml(locXml, 'AddressMode') || 'LL') as 'R' | 'LL',
        addrType: (this.extractXml(locXml, 'AddrType') || 'AD') as 'CH' | 'CM' | 'AD' | 'LO',
        addrDescr: this.extractXml(locXml, 'AddrDescr') || 'Address',
        addrName: this.extractXml(locXml, 'AddrName') || undefined,
        addrNumber: addrNumber ? parseInt(addrNumber, 10) : undefined,
        legId: legId ? parseInt(legId, 10) : undefined,
        streetNo: this.extractXml(locXml, 'StreetNo') || '',
        onStreet: this.extractXml(locXml, 'OnStreet') || '',
        unit: this.extractXml(locXml, 'Unit') || undefined,
        city: this.extractXml(locXml, 'City') || '',
        state: this.extractXml(locXml, 'State') || '',
        zipCode: this.extractXml(locXml, 'ZipCode') || '',
        lon: parseInt(this.extractXml(locXml, 'Lon') || '0', 10),
        lat: parseInt(this.extractXml(locXml, 'Lat') || '0', 10),
        source: (this.extractXml(locXml, 'Source') || 'Frequent') as 'Both' | 'Registered' | 'Frequent',
        comments: this.extractXml(locXml, 'Comments') || undefined,
        phone: this.extractXml(locXml, 'Phone') || undefined,
        atStreet: this.extractXml(locXml, 'AtStreet') || undefined,
      });
    }

    logger.debug(`parseClientLocationsMerged found ${locations.length} locations`);
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

  private parseMostFrequentClientTrips(xml: string): import('../types.js').FrequentTrip[] {
    const trips: import('../types.js').FrequentTrip[] = [];
    const tripRegex = /<FrequentTrip[^>]*>([\s\S]*?)<\/FrequentTrip>/g;
    let match;

    while ((match = tripRegex.exec(xml)) !== null) {
      const tripXml = match[1];

      // Parse pickup leg (EndPoint="0")
      const pickupLegRegex = /<BookingLeg[^>]*>([\s\S]*?)<EndPoint>0<\/EndPoint>[\s\S]*?<\/BookingLeg>/;
      const pickupMatch = pickupLegRegex.exec(tripXml);

      // Parse dropoff leg (EndPoint="1")
      const dropoffLegRegex = /<BookingLeg[^>]*>([\s\S]*?)<EndPoint>1<\/EndPoint>[\s\S]*?<\/BookingLeg>/;
      const dropoffMatch = dropoffLegRegex.exec(tripXml);

      if (pickupMatch && dropoffMatch) {
        const pickupXml = pickupMatch[1];
        const dropoffXml = dropoffMatch[1];

        trips.push({
          bookingId: this.extractXml(tripXml, 'BookingId') || '',
          useCount: parseInt(this.extractXml(tripXml, 'UseCount') || '0', 10),
          mobilityAids: this.extractXml(tripXml, 'MobAids') || '',
          pickup: {
            addressMode: this.extractXml(pickupXml, 'AddressMode') || '',
            addrName: this.extractXml(pickupXml, 'AddrName') || undefined,
            streetNo: this.extractXml(pickupXml, 'StreetNo') || '',
            onStreet: this.extractXml(pickupXml, 'OnStreet') || '',
            unit: this.extractXml(pickupXml, 'Unit') || undefined,
            city: this.extractXml(pickupXml, 'City') || '',
            state: this.extractXml(pickupXml, 'State') || '',
            zipCode: this.extractXml(pickupXml, 'ZipCode') || '',
            lon: parseInt(this.extractXml(pickupXml, 'Lon') || '0', 10),
            lat: parseInt(this.extractXml(pickupXml, 'Lat') || '0', 10),
            extra: this.extractXml(pickupXml, 'Extra') || undefined,
          },
          dropoff: {
            addressMode: this.extractXml(dropoffXml, 'AddressMode') || '',
            addrName: this.extractXml(dropoffXml, 'AddrName') || undefined,
            streetNo: this.extractXml(dropoffXml, 'StreetNo') || '',
            onStreet: this.extractXml(dropoffXml, 'OnStreet') || '',
            unit: this.extractXml(dropoffXml, 'Unit') || undefined,
            city: this.extractXml(dropoffXml, 'City') || '',
            state: this.extractXml(dropoffXml, 'State') || '',
            zipCode: this.extractXml(dropoffXml, 'ZipCode') || '',
            lon: parseInt(this.extractXml(dropoffXml, 'Lon') || '0', 10),
            lat: parseInt(this.extractXml(dropoffXml, 'Lat') || '0', 10),
            extra: this.extractXml(dropoffXml, 'Extra') || undefined,
          },
        });
      }
    }

    logger.debug(`parseMostFrequentClientTrips found ${trips.length} frequent trips`);
    return trips;
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
      const creationConfNum = this.extractXml(xml, 'CreationConfirmationNumber');
      const date = this.extractXml(xml, 'DateF') || this.extractXml(xml, 'RawDate');

      // Parse pickup leg
      const pickupMatch = xml.match(/<PickUpLeg[^>]*>([\s\S]*?)<\/PickUpLeg>/);
      const pickupXml = pickupMatch ? pickupMatch[1] : '';

      // Parse dropoff leg
      const dropoffMatch = xml.match(/<DropOffLeg[^>]*>([\s\S]*?)<\/DropOffLeg>/);
      const dropoffXml = dropoffMatch ? dropoffMatch[1] : '';

      // CRITICAL FIX: Get status from EventsInfo within PickUpLeg, NOT from top-level SchedStatusF
      // The top-level SchedStatusF may show "Scheduled" even for completed trips
      // The actual trip status is in PickUpLeg.EventsInfo.SchedStatusF (e.g., "Performed")
      const eventsInfoMatch = pickupXml.match(/<EventsInfo[^>]*>([\s\S]*?)<\/EventsInfo>/);
      const eventsInfoXml = eventsInfoMatch ? eventsInfoMatch[1] : '';

      // Try to get status from EventsInfo first, fall back to top-level SchedStatusF
      let schedStatusF = this.extractXml(eventsInfoXml, 'SchedStatusF');
      if (!schedStatusF) {
        // Fallback to top-level status (for trips without EventsInfo)
        schedStatusF = this.extractXml(xml, 'SchedStatusF');
      }
      const status = schedStatusF.toLowerCase();

      // Extract provider info from EventsProviderInfo
      // Try PickUpLeg first, then fall back to PassBooking level
      let providerInfoMatch = pickupXml.match(/<EventsProviderInfo[^>]*>([\s\S]*?)<\/EventsProviderInfo>/);
      if (!providerInfoMatch) {
        // Fallback: try PassBooking level (outside PickUpLeg)
        providerInfoMatch = xml.match(/<EventsProviderInfo[^>]*>([\s\S]*?)<\/EventsProviderInfo>/);
      }
      const providerInfoXml = providerInfoMatch ? providerInfoMatch[1] : '';
      const providerName = this.extractXml(providerInfoXml, 'ProviderName') || undefined;
      const providerDescription = this.extractXml(providerInfoXml, 'Description') || undefined;

      // Pickup times
      const schEarly = parseInt(this.extractXml(pickupXml, 'SchEarly'), 10);
      const schLate = parseInt(this.extractXml(pickupXml, 'SchLate'), 10);
      const estPickup = parseInt(this.extractXml(pickupXml, 'EstTime'), 10);

      // Dropoff time
      const estDropoff = parseInt(this.extractXml(dropoffXml, 'EstTime'), 10);

      // Addresses
      const pickupAddr = this.parseAddressFromXml(pickupXml);
      const dropoffAddr = this.parseAddressFromXml(dropoffXml);

      // Phone numbers from legs
      const pickupPhone = this.extractPhoneFromLeg(pickupXml);
      const dropoffPhone = this.extractPhoneFromLeg(dropoffXml);

      // Comments from legs
      const pickupComments = this.extractXml(pickupXml, 'Comments') || undefined;
      const dropoffComments = this.extractXml(dropoffXml, 'Comments') || undefined;

      // Space type and mobility device
      const spaceType = this.extractXml(xml, 'SpaceType');
      const mobilityDevice = this.spaceTypeToMobilityDevice(spaceType);

      // Fare
      const fareAmount = this.extractXml(xml, 'FareAmount');
      const fare = fareAmount ? `$${parseFloat(fareAmount).toFixed(2)}` : undefined;

      // Additional passengers
      const additionalPassengers = this.parsePassengers(xml);

      // Use status from DATS API directly - no inference needed
      const statusCode = this.mapApiStatusToCode(status);
      const statusInfo = TRIP_STATUSES[statusCode];

      return {
        bookingId: bookingId,
        confirmationNumber: creationConfNum || bookingId,
        date: date.includes(',') ? date : this.formatDateDisplay(date),
        pickupWindow: {
          start: schEarly > 0 ? this.secondsToTime(schEarly) : '',
          end: schLate > 0 ? this.secondsToTime(schLate) : '',
        },
        pickupAddress: pickupAddr,
        destinationAddress: dropoffAddr,
        status: statusCode,
        statusLabel: statusInfo.label,
        statusDescription: statusInfo.description,
        estimatedPickupTime: estPickup > 0 ? this.secondsToTime(estPickup) : undefined,
        estimatedDropoffTime: estDropoff > 0 ? this.secondsToTime(estDropoff) : undefined,
        spaceType: spaceType || undefined,
        mobilityDevice,
        additionalPassengers: additionalPassengers.length > 0 ? additionalPassengers : undefined,
        pickupPhone,
        dropoffPhone,
        pickupComments,
        dropoffComments,
        fare,
        providerName,
        providerDescription,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract phone number from leg XML
   */
  private extractPhoneFromLeg(legXml: string): string | undefined {
    const addrMatch = legXml.match(/<(?:Request|Map)Address[^>]*>([\s\S]*?)<\/(?:Request|Map)Address>/);
    if (addrMatch) {
      const phone = this.extractXml(addrMatch[1], 'Phone');
      return phone || undefined;
    }
    return undefined;
  }

  /**
   * Convert space type code to human-readable mobility device
   */
  private spaceTypeToMobilityDevice(spaceType: string): string | undefined {
    const mapping: Record<string, string> = {
      'WC': 'Wheelchair',
      'SC': 'Scooter',
      'AM': 'Ambulatory',
      'WA': 'Walker',
    };
    return mapping[spaceType] || undefined;
  }

  /**
   * Map DATS API status string to TripStatusCode
   * SchedStatusF values: "Scheduled", "Unscheduled", "No Show", "Arrived",
   *                      "Cancelled", "Pending", "Performed", "Missed Trip", "Refused"
   */
  private mapApiStatusToCode(apiStatus: string): TripStatusCode {
    const status = apiStatus.toLowerCase().trim();

    // Map by keywords (order matters - check more specific patterns first)
    if (status.includes('unscheduled')) return 'U';
    if (status.includes('scheduled')) return 'S';
    if (status.includes('no show')) return 'NS';
    if (status.includes('arrived')) return 'A';
    if (status.includes('cancel')) return 'CA';
    if (status.includes('pending')) return 'Pn';
    if (status.includes('performed')) return 'Pf';
    if (status.includes('missed')) return 'NM';
    if (status.includes('refused')) return 'R';

    // Default to Unscheduled for unknown statuses
    return 'U';
  }

  /**
   * Parse additional passengers from booking XML
   */
  private parsePassengers(xml: string): TripPassenger[] {
    const passengers: TripPassenger[] = [];
    const passengerRegex = /<PassBookingPassenger[^>]*>([\s\S]*?)<\/PassBookingPassenger>/g;
    let match;

    while ((match = passengerRegex.exec(xml)) !== null) {
      const passengerXml = match[1];
      const typeCode = this.extractXml(passengerXml, 'PassengerType');
      const count = parseInt(this.extractXml(passengerXml, 'PassengerCount') || '1', 10);

      if (typeCode) {
        const typeMapping: Record<string, 'escort' | 'pca' | 'guest'> = {
          'ESC': 'escort',
          'PCA': 'pca',
          'GUE': 'guest',
        };
        const type = typeMapping[typeCode];
        if (type) {
          passengers.push({ type, count });
        }
      }
    }

    return passengers;
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

  private parseBookingDaysWindow(xml: string): import('../types.js').BookingDaysWindow {
    const availableDates: import('../types.js').AvailableDate[] = [];
    const dateRegex = /<AvailableCasualBookingDay[^>]*>([\s\S]*?)<\/AvailableCasualBookingDay>/g;
    let match;

    while ((match = dateRegex.exec(xml)) !== null) {
      const dateXml = match[1];
      availableDates.push({
        date: this.extractXml(dateXml, 'Date') || '',
        dayOfWeek: parseInt(this.extractXml(dateXml, 'DayOfWeek') || '0', 10),
        rawDate: this.extractXml(dateXml, 'RawDate') || '',
      });
    }

    const maxDays = this.extractXml(xml, 'CasualBookingMaxDaysAdvance');
    const minDays = this.extractXml(xml, 'CasualBookingMinDaysAdvance');
    const sameDayElement = this.extractXml(xml, 'CasualAllowSameDayBooking');

    return {
      maxDaysAdvance: maxDays ? parseInt(maxDays, 10) : 3,
      minDaysAdvance: minDays ? parseInt(minDays, 10) : 0,
      sameDayAllowed: sameDayElement !== undefined && sameDayElement !== '',
      availableDates,
    };
  }

  private parseBookingTimesWindow(xml: string): import('../types.js').BookingTimesWindow {
    const timeSlots: import('../types.js').TimeSlot[] = [];
    const timeRegex = /<PassBookingTime[^>]*>([\s\S]*?)<\/PassBookingTime>/g;
    let match;

    while ((match = timeRegex.exec(xml)) !== null) {
      const timeXml = match[1];
      const previousDate = this.extractXml(timeXml, 'PreviousDate');

      timeSlots.push({
        time: parseInt(this.extractXml(timeXml, 'Time') || '0', 10),
        lastBookingTime: parseInt(this.extractXml(timeXml, 'LastBookingTime') || '0', 10),
        index: parseInt(this.extractXml(timeXml, 'Index') || '0', 10),
        previousDate: previousDate ? parseInt(previousDate, 10) : undefined,
      });
    }

    return {
      date: this.extractXml(xml, 'Date') || '',
      currentTime: parseInt(this.extractXml(xml, 'CurrentTime') || '0', 10),
      firstBookingTime: parseInt(this.extractXml(xml, 'FirstBookingTime') || '0', 10),
      lastBookingTime: parseInt(this.extractXml(xml, 'LastBookingTime') || '0', 10),
      timeInterval: parseInt(this.extractXml(xml, 'TimeInterval') || '600', 10),
      threshold: parseInt(this.extractXml(xml, 'Threshold') || '0', 10),
      timeSlots,
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

  private parseDefaultBooking(xml: string): import('../types.js').DefaultBooking {
    // Parse passenger types
    const passengerTypes: import('../types.js').PassengerTypeInfo[] = [];
    const passengerTypeRegex = /<PassPassengerType[^>]*>([\s\S]*?)<\/PassPassengerType>/g;
    let match;

    while ((match = passengerTypeRegex.exec(xml)) !== null) {
      const ptXml = match[1];
      const fareTypeId = this.extractXml(ptXml, 'FareTypeId');
      const reqdAsAddPass = this.extractXml(ptXml, 'ReqdAsAddPass');

      passengerTypes.push({
        abbreviation: this.extractXml(ptXml, 'Abbreviation') || '',
        description: this.extractXml(ptXml, 'Description') || '',
        defaultSpaceType: this.extractXml(ptXml, 'DefaultSpaceType') || '',
        fareTypeId: fareTypeId ? parseInt(fareTypeId, 10) : undefined,
        reqdAsAddPass: reqdAsAddPass ? parseInt(reqdAsAddPass, 10) : undefined,
      });
    }

    // Parse space types (mobility aids)
    const spaceTypes: import('../types.js').SpaceTypeInfo[] = [];
    const spaceTypeRegex = /<PassSpaceType[^>]*>([\s\S]*?)<\/PassSpaceType>/g;

    while ((match = spaceTypeRegex.exec(xml)) !== null) {
      const stXml = match[1];
      spaceTypes.push({
        abbreviation: this.extractXml(stXml, 'Abbreviation') || '',
        description: this.extractXml(stXml, 'Description') || '',
      });
    }

    // Parse fare types
    const fareTypes: import('../types.js').FareTypeInfo[] = [];
    const fareTypeRegex = /<PassFareType[^>]*>([\s\S]*?)<\/PassFareType>/g;

    while ((match = fareTypeRegex.exec(xml)) !== null) {
      const ftXml = match[1];
      fareTypes.push({
        fareType: parseInt(this.extractXml(ftXml, 'FareType') || '0', 10),
        abbreviation: this.extractXml(ftXml, 'Abbreviation') || '',
        description: this.extractXml(ftXml, 'Description') || '',
      });
    }

    // Parse booking purposes
    const purposes: import('../types.js').BookingPurpose[] = [];
    const purposeRegex = /<PassBookingPurpose[^>]*>([\s\S]*?)<\/PassBookingPurpose>/g;

    while ((match = purposeRegex.exec(xml)) !== null) {
      const purpXml = match[1];
      purposes.push({
        bookingPurposeId: parseInt(this.extractXml(purpXml, 'BookingPurposeId') || '0', 10),
        abbreviation: this.extractXml(purpXml, 'Abbreviation') || '',
        description: this.extractXml(purpXml, 'Description') || '',
        code: this.extractXml(purpXml, 'Code') || this.extractXml(purpXml, 'Abbreviation') || '',
      });
    }

    logger.debug(
      `parseDefaultBooking found ${passengerTypes.length} passenger types, ` +
        `${spaceTypes.length} space types, ${fareTypes.length} fare types, ` +
        `${purposes.length} purposes`
    );

    return {
      passengerTypes,
      spaceTypes,
      fareTypes,
      purposes,
    };
  }

  private parseContactInfo(xml: string, clientId: string): ContactInfo | null {
    if (!xml.includes('PassGetClientContactInfoResponse')) {
      logger.debug('parseContactInfo: Response does not contain PassGetClientContactInfoResponse');
      return null;
    }

    const emergencyContacts: Array<{ name: string; phone: string; relationship?: string }> = [];
    let homePhone: string | undefined;
    let workPhone: string | undefined;
    let cellPhone: string | undefined;
    let email: string | undefined;

    // Try to extract name from the response
    let firstName = this.extractXml(xml, 'FirstName');
    let lastName = this.extractXml(xml, 'LastName');

    // Parse ContactInfo elements
    const contactRegex = /<ContactInfo[^>]*>([\s\S]*?)<\/ContactInfo>/g;
    let match;
    let contactCount = 0;

    while ((match = contactRegex.exec(xml)) !== null) {
      contactCount++;
      const contactXml = match[1];
      const addressType = this.extractXml(contactXml, 'AddressType');
      const deviceAbbr = this.extractXml(contactXml, 'DeviceAbbr');
      const connectString = this.extractXml(contactXml, 'ConnectString');
      const comments = this.extractXml(contactXml, 'Comments');

      logger.debug(`Contact ${contactCount}: AddressType=${addressType}, DeviceAbbr=${deviceAbbr}`);

      // CE = Contact/Emergency contact
      if (addressType === 'CE') {
        emergencyContacts.push({
          name: comments || 'Unknown',
          phone: connectString || '',
          relationship: undefined,
        });
      }
      // CH = Client Home contact info
      else if (addressType === 'CH') {
        if (deviceAbbr === 'CELL' || deviceAbbr === 'Cell') {
          cellPhone = connectString;
        } else if (deviceAbbr === 'Email' || deviceAbbr === 'EMAIL') {
          email = connectString;
        } else if (deviceAbbr === 'HOME' || deviceAbbr === 'Home') {
          homePhone = connectString;
        } else if (deviceAbbr === 'WORK' || deviceAbbr === 'Work') {
          workPhone = connectString;
        }
      }
    }

    logger.debug(`parseContactInfo found ${contactCount} ContactInfo elements, ${emergencyContacts.length} emergency contacts`);

    return {
      clientId,
      firstName,
      lastName,
      homePhone,
      workPhone,
      cellPhone,
      email,
      emergencyContacts,
    };
  }

  private parseAnnouncementsXml(xml: string): Announcement[] {
    const announcements: Announcement[] = [];

    // Parse Record elements from GetActivePassRemarksResponse
    const remarkRegex = /<Record>([\s\S]*?)<\/Record>/g;
    let match;

    while ((match = remarkRegex.exec(xml)) !== null) {
      const remarkXml = match[1];
      const id = this.extractXml(remarkXml, 'RemarkId');
      const ttsText = this.extractXmlWithAttributes(remarkXml, 'TtsText');
      const groupDescr = this.extractXmlWithAttributes(remarkXml, 'RemarkGroupDescr');

      if (ttsText) {
        announcements.push({
          id: id || `remark-${announcements.length}`,
          text: ttsText,
          ttsText: ttsText,
          groupDescription: groupDescr || 'General Announcements',
          startDate: undefined,
          endDate: undefined,
        });
      }
    }

    return announcements;
  }

  /**
   * Extract XML value, handling elements with cattr attributes
   */
  private extractXmlWithAttributes(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
    return match ? match[1].trim() : '';
  }

  // ==================== UTILITIES ====================

  /**
   * Escape special XML characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

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
    const year = date.getUTCFullYear();
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = date.getUTCDate().toString().padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private formatDateDisplay(yyyymmdd: string): string {
    if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
    const year = parseInt(yyyymmdd.substring(0, 4), 10);
    const month = parseInt(yyyymmdd.substring(4, 6), 10);
    const day = parseInt(yyyymmdd.substring(6, 8), 10);

    // Create UTC date to get correct day of week (timezone-neutral)
    const date = new Date(Date.UTC(year, month - 1, day));
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayOfWeek = days[date.getUTCDay()];

    return `${dayOfWeek}, ${months[month - 1]} ${day}, ${year}`;
  }

}

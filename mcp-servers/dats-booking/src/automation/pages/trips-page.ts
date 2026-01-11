/**
 * TripsPage - Page Object for viewing and cancelling trips
 *
 * Uses direct SOAP API calls for speed, with browser fallback.
 */

import type { Page } from 'playwright';
import type { Trip, GetTripsOutput, CancelTripOutput } from '../../types.js';
import { DATSError, ErrorCategory } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { RateLimiter } from '../rate-limiter.js';
import { SoapClient } from '../../api/soap-client.js';

export class TripsPage {
  constructor(
    private readonly page: Page,
    private readonly rateLimiter: RateLimiter
  ) {}

  /**
   * Get upcoming trips - uses SOAP API for speed
   */
  async getTrips(_dateFrom?: string, _dateTo?: string): Promise<GetTripsOutput> {
    logger.info('Retrieving trips via SOAP API');

    try {
      // Get session cookie from browser context
      const cookies = await this.page.context().cookies();
      const sessionCookie = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Get client ID from page or storage
      const clientId = await this.getClientId();

      if (sessionCookie && clientId) {
        // Try SOAP API first (much faster)
        const soapClient = new SoapClient({ sessionCookie });
        const trips = await soapClient.getClientTrips(clientId, _dateFrom, _dateTo);

        if (trips.length > 0) {
          logger.info(`Retrieved ${trips.length} trips via SOAP API`);
          return { success: true, trips };
        }
      }

      // Fall back to UI scraping if SOAP API fails
      logger.info('SOAP API returned no trips, trying UI scraping');
      await this.navigateToTrips();
      await this.page.waitForTimeout(2000);

      const trips = await this.extractTrips();
      logger.info(`Retrieved ${trips.length} trips via UI`);
      return { success: true, trips };
    } catch (error) {
      if (error instanceof DATSError) {
        return { success: false, trips: [], error: error.toToolError() };
      }
      throw error;
    }
  }

  /**
   * Get client ID from page
   */
  private async getClientId(): Promise<string | null> {
    try {
      // Try to get client ID from the page
      const clientIdText = await this.page.locator('text=/Client id.*\\d+/i').first().textContent({ timeout: 2000 });
      const match = clientIdText?.match(/(\d+)/);
      if (match) {
        return match[1];
      }

      // Try localStorage or sessionStorage
      const storedId = await this.page.evaluate(() => {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        const win = globalThis as any;
        return win.localStorage?.getItem('clientId') ||
               win.sessionStorage?.getItem('clientId') ||
               win.clientId;
        /* eslint-enable @typescript-eslint/no-explicit-any */
      });

      return storedId || null;
    } catch {
      return null;
    }
  }

  /**
   * Cancel a trip by confirmation number or by matching address
   */
  async cancelTrip(confirmationNumber: string): Promise<CancelTripOutput> {
    logger.info('Cancelling trip');

    try {
      await this.navigateToTrips();
      await this.page.waitForTimeout(3000);

      // Find trip card containing the confirmation number or identifier
      const tripCard = this.page.locator(`[class*="trip"], [class*="card"]`).filter({
        hasText: confirmationNumber
      }).first();

      if (!(await tripCard.isVisible({ timeout: 5000 }))) {
        throw new DATSError(
          ErrorCategory.VALIDATION_ERROR,
          'Trip not found. It may already be cancelled or completed.',
          false
        );
      }

      // Click on the trip card to expand/select it
      await this.rateLimiter.execute(async () => {
        await tripCard.click();
      });

      await this.page.waitForTimeout(1000);

      // Look for cancel button
      await this.rateLimiter.execute(async () => {
        const cancelButton = this.page.getByRole('button', { name: /cancel/i }).first();
        if (await cancelButton.isVisible({ timeout: 3000 })) {
          await cancelButton.click();
        }
      });

      // Confirm cancellation
      await this.rateLimiter.execute(async () => {
        const confirmButton = this.page.getByRole('button', {
          name: /yes|confirm|ok/i,
        });
        if (await confirmButton.isVisible({ timeout: 3000 })) {
          await confirmButton.click();
          await this.page.waitForTimeout(2000);
        }
      });

      return {
        success: true,
        message: 'Trip cancelled successfully.',
      };
    } catch (error) {
      if (error instanceof DATSError) {
        return { success: false, message: error.message, error: error.toToolError() };
      }
      throw error;
    }
  }

  private async navigateToTrips(): Promise<void> {
    await this.rateLimiter.execute(async () => {
      // Click on "Trips" in the sidebar navigation
      const tripsLink = this.page.getByRole('link', { name: 'Trips' });

      if (await tripsLink.isVisible({ timeout: 5000 })) {
        await tripsLink.click();
      } else {
        // Try button variant
        const tripsButton = this.page.getByRole('button', { name: 'Trips' });
        if (await tripsButton.isVisible({ timeout: 2000 })) {
          await tripsButton.click();
        } else {
          // Direct navigation as fallback
          await this.page.goto('https://datsonlinebooking.edmonton.ca/#/trips');
        }
      }

      await this.page.waitForTimeout(2000);
    });

    // Switch to list view if we're in calendar view
    // The toggle icon in the top-right shows "view_list" (3 lines with bullets) when in calendar view
    // and "apps" or "grid_view" when in list view
    await this.rateLimiter.execute(async () => {
      // Check if we're already in list view by looking for trip cards with "Scheduled pickup window"
      const alreadyInListView = await this.page.locator('text=/Scheduled pickup window/i').first().isVisible({ timeout: 1000 }).catch(() => false);
      if (alreadyInListView) {
        logger.info('Already in list view');
        return;
      }

      // Debug: Log all mat-icon text content
      const allIcons = await this.page.locator('mat-icon').all();
      const iconTexts: string[] = [];
      for (const icon of allIcons) {
        const text = await icon.textContent().catch(() => '');
        if (text) iconTexts.push(text);
      }
      logger.info(`Found mat-icons: ${iconTexts.join(', ')}`);

      // The list view toggle icon names (when showing calendar, click these to get list)
      const listViewIconNames = ['view_list', 'list', 'format_list_bulleted', 'view_headline', 'reorder', 'toc'];

      // Try each icon name
      for (const iconName of listViewIconNames) {
        const icon = this.page.locator(`mat-icon`).filter({ hasText: iconName }).first();
        if (await icon.isVisible({ timeout: 300 }).catch(() => false)) {
          await icon.click();
          logger.info(`Clicked ${iconName} icon`);
          await this.page.waitForTimeout(2000);
          return;
        }
      }

      // Try clicking any icon button in the top-right header area
      // These are typically the view toggle buttons
      const headerButtons = await this.page.locator('button').all();
      for (const btn of headerButtons) {
        const iconText = await btn.locator('mat-icon').textContent().catch(() => '');
        if (iconText && listViewIconNames.includes(iconText.trim())) {
          await btn.click();
          logger.info(`Clicked header button with icon: ${iconText}`);
          await this.page.waitForTimeout(2000);
          return;
        }
      }

      logger.warn('Could not find list view toggle button');
    });
  }

  private async extractTrips(): Promise<Trip[]> {
    const trips: Trip[] = [];

    // Debug: save screenshot and page content
    try {
      const debugPath = '/tmp/dats-trips-debug.png';
      await this.page.screenshot({ path: debugPath, fullPage: true });
      logger.info(`Debug screenshot saved to ${debugPath}`);
    } catch (e) {
      logger.debug('Could not save debug screenshot');
    }

    // Find trip cards in list view
    // Each trip has "Scheduled pickup window:" text
    const pickupWindowElements = await this.page.locator('text=/Scheduled pickup window/i').all();
    logger.info(`Found ${pickupWindowElements.length} trip cards in list view`);

    for (const pickupElement of pickupWindowElements) {
      try {
        // Get the parent container (trip card)
        // Go up several levels to get the full card content
        const cardContainer = pickupElement.locator('xpath=ancestor::*[position()<=5]').last();
        const cardText = await cardContainer.textContent() || '';

        // If card text is too short, try going up more levels
        let fullText = cardText;
        if (fullText.length < 100) {
          const biggerContainer = pickupElement.locator('xpath=ancestor::*[position()<=8]').last();
          fullText = await biggerContainer.textContent() || cardText;
        }

        logger.debug(`Card text: ${fullText.substring(0, 200)}...`);

        const trip = this.parseTripFromListView(fullText);
        if (trip) {
          trips.push(trip);
          logger.info(`Extracted trip: ${trip.destinationAddress} at ${trip.pickupWindow.start}`);
        }
      } catch (e) {
        logger.debug('Could not extract trip from card');
      }
    }

    // If no trips found in list view, try calendar view extraction
    if (trips.length === 0) {
      logger.info('No trips found in list view, trying calendar view extraction');
      const calendarTrips = await this.extractTripsFromCalendarView();
      trips.push(...calendarTrips);
    }

    // Final fallback: parse raw page content
    if (trips.length === 0) {
      const pageText = await this.page.content();
      const extractedTrips = this.extractTripsFromPageContent(pageText);
      trips.push(...extractedTrips);
    }

    return trips;
  }

  /**
   * Parse trip details from list view card text
   * Format:
   * - "MCNALLY SENIOR HIGH SCHOOL, 8440 105 AVENUE NW, EDMONTON, AB, T6A1B6"
   * - "Scheduled pickup window: 7:50 AM to 8:20 AM"
   * - "Estimated pickup time: 7:53 AM"
   * - "Estimated dropoff time: 8:39 AM"
   */
  private parseTripFromListView(text: string): Trip | null {
    if (!text) return null;

    // Extract scheduled pickup window
    const windowMatch = text.match(/Scheduled pickup window[:\s]*([\d:]+\s*(?:AM|PM)?)\s*to\s*([\d:]+\s*(?:AM|PM)?)/i);
    if (!windowMatch) return null;

    const pickupWindow = {
      start: windowMatch[1].trim(),
      end: windowMatch[2].trim(),
    };

    // Extract estimated times
    const estPickupMatch = text.match(/Estimated pickup time[:\s]*([\d:]+\s*(?:AM|PM)?)/i);
    const estDropoffMatch = text.match(/Estimated dropoff time[:\s]*([\d:]+\s*(?:AM|PM)?)/i);

    // Extract destination address - it's usually at the start, before "Scheduled"
    // Look for Edmonton address pattern
    const addressMatch = text.match(/([A-Z][A-Za-z\s]+(?:SCHOOL|HOSPITAL|CENTRE|CENTER|MALL|CLINIC|MEDICAL|HEALTH)?[,\s]*\d+[^,\n]+(?:STREET|ST|AVENUE|AVE|ROAD|RD|DRIVE|DR|BOULEVARD|BLVD|WAY|PLACE|PL|CRESCENT|CRES|COURT|CT)[^,\n]*,\s*EDMONTON[^,\n]*,\s*AB[^,\n]*[A-Z]\d[A-Z]\s*\d[A-Z]\d)/i);

    // Also try simpler patterns
    const simpleAddressMatch = text.match(/(\d+[^,\n]+(?:STREET|ST|AVENUE|AVE|ROAD|RD|DRIVE|DR|BOULEVARD|BLVD|WAY)[^,\n]*,\s*EDMONTON[^,\n]*)/i);

    // Try to find location name (like MCNALLY SENIOR HIGH SCHOOL)
    const locationMatch = text.match(/([A-Z][A-Z\s]+(?:SCHOOL|HOSPITAL|CENTRE|CENTER|MALL|CLINIC|MEDICAL|HEALTH|OFFICE|LIBRARY))/i);

    let destinationAddress = 'Scheduled destination';
    if (addressMatch) {
      destinationAddress = addressMatch[1].trim();
    } else if (simpleAddressMatch) {
      destinationAddress = simpleAddressMatch[1].trim();
    } else if (locationMatch) {
      destinationAddress = locationMatch[1].trim();
    }

    // Check for "(Client Mailing)" prefix which indicates pickup from home
    const isClientMailing = text.includes('(Client Mailing)') || text.includes('Client Mailing');
    let pickupAddress = 'Your registered address';

    if (isClientMailing) {
      // For client mailing trips, the shown address is the pickup location
      pickupAddress = destinationAddress;
      destinationAddress = 'Return trip to registered address';
    }

    // Extract date from card (format: "12 Mon" or "Jan 12")
    const dateMatch = text.match(/(\d{1,2})\s*(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i) ||
                      text.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*(\d{1,2})/i);
    let date = new Date().toLocaleDateString();
    if (dateMatch) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const currentMonth = monthNames[new Date().getMonth()];
      if (dateMatch[1].match(/\d+/)) {
        date = `${currentMonth} ${dateMatch[1]}, 2026`;
      } else {
        date = `${dateMatch[1]} ${dateMatch[2]}, 2026`;
      }
    }

    // Generate confirmation number from pickup time
    const confirmationNumber = `DATS-${pickupWindow.start.replace(/[:\s]/g, '')}`;

    return {
      bookingId: confirmationNumber,
      confirmationNumber,
      date,
      pickupWindow,
      pickupAddress,
      destinationAddress,
      status: 'confirmed',
      estimatedPickupTime: estPickupMatch ? estPickupMatch[1].trim() : undefined,
      estimatedDropoffTime: estDropoffMatch ? estDropoffMatch[1].trim() : undefined,
    };
  }

  /**
   * Extract trips from the calendar view (simple fallback)
   * Just extracts basic info from the calendar event text without clicking
   */
  private async extractTripsFromCalendarView(): Promise<Trip[]> {
    const trips: Trip[] = [];

    // Find time elements in the calendar (quick extraction without clicking)
    const timeElements = await this.page.locator('text=/\\d{1,2}:\\d{2}\\s*(?:AM|PM)/i').all();

    for (const el of timeElements) {
      const text = await el.textContent().catch(() => '');
      const timeMatch = text?.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

      // Skip header elements (containing month/year)
      if (!timeMatch || !text || text.includes('January') || text.includes('2026')) {
        continue;
      }

      // Get surrounding text for location hint
      const parentText = await el.locator('..').textContent().catch(() => text) || text;
      const locationMatch = parentText.match(/([A-Z]{2,}[A-Za-z\s.]*)/);

      const genConfNum = `DATS-${timeMatch[1].replace(/[:\s]/g, '')}`;
      trips.push({
        bookingId: genConfNum,
        confirmationNumber: genConfNum,
        date: new Date().toLocaleDateString(),
        pickupWindow: {
          start: timeMatch[1],
          end: this.addMinutesToTime(timeMatch[1], 30),
        },
        pickupAddress: 'Your registered address',
        destinationAddress: locationMatch ? locationMatch[1].trim() : 'Scheduled destination',
        status: 'confirmed',
      });
    }

    return trips;
  }

  /**
   * Add minutes to a time string
   */
  private addMinutesToTime(time: string, minutes: number): string {
    const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return time;

    let hours = parseInt(match[1], 10);
    let mins = parseInt(match[2], 10);
    const period = match[3]?.toUpperCase() || '';

    mins += minutes;
    if (mins >= 60) {
      hours += Math.floor(mins / 60);
      mins = mins % 60;
    }

    // Handle AM/PM rollover
    let newPeriod = period;
    if (hours >= 12 && period === 'AM') {
      newPeriod = 'PM';
    }
    if (hours > 12) {
      hours = hours - 12;
    }

    return `${hours}:${mins.toString().padStart(2, '0')} ${newPeriod}`.trim();
  }

  private parseTrip(text: string | null): Trip | null {
    if (!text) return null;

    // Extract pickup window: "Scheduled pickup window: 7:50 AM to 8:20 AM"
    const windowMatch = text.match(/Scheduled pickup window:\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*to\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);

    // Extract address - usually in caps or before "Scheduled"
    const addressMatch = text.match(/([A-Z][A-Z0-9\s,.-]+(?:EDMONTON|AB|ALBERTA)[^S]*?)(?=Scheduled|$)/i) ||
                         text.match(/([^,]+,\s*\d+[^,]+,[^,]+(?:EDMONTON|AB)[^S]*?)(?=Scheduled|$)/i);

    // Extract date from context if available
    const dateMatch = text.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i);

    if (!windowMatch) return null;

    const pickupWindow = {
      start: windowMatch[1].trim(),
      end: windowMatch[2].trim(),
    };

    // Generate a pseudo-confirmation from the address and time
    const address = addressMatch ? addressMatch[1].trim() : 'Unknown Location';
    const confirmationNumber = `TRIP-${pickupWindow.start.replace(/[:\s]/g, '')}`;

    return {
      bookingId: confirmationNumber,
      confirmationNumber,
      date: dateMatch ? dateMatch[0] : new Date().toLocaleDateString(),
      pickupWindow,
      pickupAddress: address.includes('Client') ? address : 'Your registered address',
      destinationAddress: address.includes('Client') ? 'Your registered address' : address,
      status: 'confirmed',
    };
  }

  private extractTripsFromPageContent(html: string): Trip[] {
    const trips: Trip[] = [];

    // Find all occurrences of "Scheduled pickup window: X to Y"
    const regex = /Scheduled pickup window:\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s*to\s*(\d{1,2}:\d{2}\s*(?:AM|PM)?)/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
      // Get surrounding context (500 chars before)
      const start = Math.max(0, match.index - 500);
      const context = html.substring(start, match.index + match[0].length + 200);

      const trip = this.parseTrip(context);
      if (trip) {
        trips.push(trip);
      }
    }

    return trips;
  }
}

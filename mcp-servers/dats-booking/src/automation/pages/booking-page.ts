/**
 * BookingPage - Page Object for creating DATS bookings
 */

import type { Page } from 'playwright';
import type { BookTripInput, BookTripOutput, PickupWindow } from '../../types.js';
import { DATSError, ErrorCategory } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import type { RateLimiter } from '../rate-limiter.js';
import { validateBookingRequest } from '../../utils/validation.js';

export class BookingPage {
  constructor(
    private readonly page: Page,
    private readonly rateLimiter: RateLimiter
  ) {}

  /**
   * Create a new DATS booking
   */
  async createBooking(details: BookTripInput): Promise<BookTripOutput> {
    const validationError = validateBookingRequest(details);
    if (validationError) {
      return {
        success: false,
        error: {
          category: ErrorCategory.BUSINESS_RULE_VIOLATION,
          message: validationError,
          recoverable: true,
        },
      };
    }

    logger.info('Creating new booking');

    try {
      await this.navigateToBookingForm();
      await this.fillPickupDetails(details);
      await this.fillDestinationDetails(details);
      await this.fillAdditionalOptions(details);
      await this.submitBooking();
      const result = await this.extractConfirmation();
      logger.info('Booking created successfully');
      return result;
    } catch (error) {
      if (error instanceof DATSError) {
        return { success: false, error: error.toToolError() };
      }
      throw error;
    }
  }

  private async navigateToBookingForm(): Promise<void> {
    await this.rateLimiter.execute(async () => {
      const bookingLink = this.page
        .locator('a[href*="booking"], button:has-text("Book")')
        .first();
      if (await bookingLink.isVisible()) {
        await bookingLink.click();
      } else {
        await this.page.goto('https://datsonlinebooking.edmonton.ca/#/booking');
      }
      await this.page.waitForTimeout(3000);
    });
  }

  private async fillPickupDetails(details: BookTripInput): Promise<void> {
    await this.rateLimiter.execute(async () => {
      const dateInput = this.page
        .locator('input[type="date"], input[placeholder*="date" i]')
        .first();
      await dateInput.fill(details.pickupDate);
    });

    await this.rateLimiter.execute(async () => {
      const timeInput = this.page
        .locator('input[type="time"], input[placeholder*="time" i]')
        .first();
      await timeInput.fill(details.pickupTime);
    });

    await this.rateLimiter.execute(async () => {
      const addressInput = this.page
        .locator('input[placeholder*="pickup" i], input[aria-label*="pickup" i]')
        .first();
      await addressInput.fill(details.pickupAddress);
      await this.page.waitForTimeout(1000);
      const firstOption = this.page
        .locator('.autocomplete-option, [role="option"]')
        .first();
      if (await firstOption.isVisible({ timeout: 2000 })) {
        await firstOption.click();
      }
    });
  }

  private async fillDestinationDetails(details: BookTripInput): Promise<void> {
    await this.rateLimiter.execute(async () => {
      const destInput = this.page
        .locator(
          'input[placeholder*="destination" i], input[aria-label*="destination" i]'
        )
        .first();
      await destInput.fill(details.destinationAddress);
      await this.page.waitForTimeout(1000);
      const firstOption = this.page
        .locator('.autocomplete-option, [role="option"]')
        .first();
      if (await firstOption.isVisible({ timeout: 2000 })) {
        await firstOption.click();
      }
    });
  }

  private async fillAdditionalOptions(details: BookTripInput): Promise<void> {
    if (details.mobilityDevice && details.mobilityDevice !== 'none') {
      await this.rateLimiter.execute(async () => {
        const deviceSelect = this.page.locator(
          'select[name*="mobility" i], [aria-label*="mobility" i]'
        );
        if (await deviceSelect.isVisible()) {
          // Get all options and find matching one
          const options = await deviceSelect.locator('option').allTextContents();
          const matchingOption = options.find((opt) =>
            opt.toLowerCase().includes(details.mobilityDevice!.toLowerCase())
          );
          if (matchingOption) {
            await deviceSelect.selectOption({ label: matchingOption });
          }
        }
      });
    }

    if (details.companion) {
      await this.rateLimiter.execute(async () => {
        const companionCheckbox = this.page.locator(
          'input[type="checkbox"][name*="companion" i], label:has-text("companion") input'
        );
        if (await companionCheckbox.isVisible()) {
          await companionCheckbox.check();
        }
      });
    }

    if (details.returnTrip) {
      await this.rateLimiter.execute(async () => {
        const returnCheckbox = this.page.locator(
          'input[type="checkbox"][name*="return" i], label:has-text("return") input'
        );
        if (await returnCheckbox.isVisible()) {
          await returnCheckbox.check();
        }
      });
    }
  }

  private async submitBooking(): Promise<void> {
    await this.rateLimiter.execute(async () => {
      const submitButton = this.page.getByRole('button', {
        name: /submit|book|confirm/i,
      });
      await submitButton.click();
      await this.page.waitForTimeout(3000);
    });
  }

  private async extractConfirmation(): Promise<BookTripOutput> {
    await this.page.waitForSelector(
      '[class*="confirmation"], [class*="success"], :text-matches("DATS-\\\\d+")',
      { timeout: 10000 }
    );

    const confirmationText = await this.page
      .locator('[class*="confirmation-number"], :text-matches("DATS-\\\\d+")')
      .textContent();
    const confirmationMatch = confirmationText?.match(/DATS-\d+|\d{6,}/);
    const confirmationNumber = confirmationMatch?.[0] ?? 'UNKNOWN';

    const windowText = await this.page
      .locator('[class*="pickup-window"], :text-matches("\\\\d{1,2}:\\\\d{2}")')
      .textContent();
    const pickupWindow = this.parsePickupWindow(windowText);

    return {
      success: true,
      confirmationNumber,
      pickupWindow,
    };
  }

  private parsePickupWindow(text: string | null): PickupWindow | undefined {
    if (!text) return undefined;

    const timePattern =
      /(\d{1,2}:\d{2})\s*(?:AM|PM)?\s*[-–]\s*(\d{1,2}:\d{2})\s*(?:AM|PM)?/i;
    const match = text.match(timePattern);

    if (match) {
      return { start: match[1], end: match[2] };
    }
    return undefined;
  }
}

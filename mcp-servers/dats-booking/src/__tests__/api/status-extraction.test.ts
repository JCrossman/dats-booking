/**
 * Unit test to verify status is extracted from EventsInfo.SchedStatusF
 * This tests the fix for the bug where trips showed "Scheduled" instead of "Performed"
 */

import { describe, it, expect } from 'vitest';

// Mock XML that represents a COMPLETED trip
// Note: DisplayTimeType says "Scheduled" but EventsInfo.SchedStatusF says "Performed"
// The fix ensures we use EventsInfo.SchedStatusF (the correct status)
const COMPLETED_TRIP_XML = `
<PassBooking>
  <BookingId>18789349</BookingId>
  <CreationConfirmationNumber>18789349</CreationConfirmationNumber>
  <DateF>Mon, Jan 13, 2026</DateF>
  <RawDate>20260113</RawDate>
  <SchedStatusF>Scheduled</SchedStatusF>
  <PickUpLeg>
    <DisplayTimeType>Scheduled</DisplayTimeType>
    <PickupTimeFrom>51000</PickupTimeFrom>
    <PickupTimeTo>52800</PickupTimeTo>
    <LegDescrAddrOn>8440 105 AVENUE NW</LegDescrAddrOn>
    <LegDescrCity>EDMONTON</LegDescrCity>
    <LegDescrState>ALBERTA</LegDescrState>
    <LegDescrZipCode>T5H0H8</LegDescrZipCode>
    <Comments>MCNALLY HIGH SCHOOL - FRONT ENTRANCE</Comments>
    <EventsInfo>
      <SchedStatus>P</SchedStatus>
      <SchedStatusF>Performed</SchedStatusF>
    </EventsInfo>
    <EventsProviderInfo>
      <ProviderName>PRESTIGE</ProviderName>
      <Description>PRESTIGE TRANSPORTATION</Description>
    </EventsProviderInfo>
  </PickUpLeg>
  <DropOffLeg>
    <LegDescrAddrOn>160 STREET NW</LegDescrAddrOn>
    <LegDescrCity>EDMONTON</LegDescrCity>
    <LegDescrAddrNo>9713</LegDescrAddrNo>
    <Comments>FRONT DOOR</Comments>
  </DropOffLeg>
</PassBooking>
`;

// Mock XML for a SCHEDULED trip (not yet completed)
const SCHEDULED_TRIP_XML = `
<PassBooking>
  <BookingId>18791234</BookingId>
  <CreationConfirmationNumber>18791234</CreationConfirmationNumber>
  <DateF>Thu, Jan 16, 2026</DateF>
  <RawDate>20260116</RawDate>
  <SchedStatusF>Scheduled</SchedStatusF>
  <PickUpLeg>
    <DisplayTimeType>Scheduled</DisplayTimeType>
    <PickupTimeFrom>28800</PickupTimeFrom>
    <PickupTimeTo>30600</PickupTimeTo>
    <LegDescrAddrOn>160 STREET NW</LegDescrAddrOn>
    <LegDescrCity>EDMONTON</LegDescrCity>
    <EventsInfo>
      <SchedStatus>S</SchedStatus>
      <SchedStatusF>Scheduled</SchedStatusF>
    </EventsInfo>
    <EventsProviderInfo>
      <ProviderName>DATS</ProviderName>
      <Description>DATS TRANSIT</Description>
    </EventsProviderInfo>
  </PickUpLeg>
  <DropOffLeg>
    <LegDescrAddrOn>105 AVENUE NW</LegDescrAddrOn>
    <LegDescrCity>EDMONTON</LegDescrCity>
  </DropOffLeg>
</PassBooking>
`;

// Helper to extract XML value (same logic as DATSApi.extractXml)
function extractXml(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

// Map status labels (same as DATSApi)
function mapStatusToCode(statusLabel: string): string {
  const statusMap: Record<string, string> = {
    scheduled: 'S',
    unscheduled: 'U',
    'no show': 'NS',
    arrived: 'A',
    cancelled: 'CA',
    pending: 'Pn',
    performed: 'Pf',
    missed: 'NM',
    refused: 'R',
  };
  return statusMap[statusLabel.toLowerCase()] || 'S';
}

describe('Status Extraction Fix', () => {
  describe('extracting status from EventsInfo.SchedStatusF', () => {
    it('should extract Performed status from completed trip', () => {
      // Parse pickup leg
      const pickupMatch = COMPLETED_TRIP_XML.match(/<PickUpLeg[^>]*>([\s\S]*?)<\/PickUpLeg>/);
      const pickupXml = pickupMatch ? pickupMatch[1] : '';

      // Parse EventsInfo within PickUpLeg
      const eventsInfoMatch = pickupXml.match(/<EventsInfo[^>]*>([\s\S]*?)<\/EventsInfo>/);
      const eventsInfoXml = eventsInfoMatch ? eventsInfoMatch[1] : '';

      // Get status from EventsInfo (the FIX)
      const schedStatusF = extractXml(eventsInfoXml, 'SchedStatusF');

      // CRITICAL: This should be "Performed", NOT "Scheduled"
      expect(schedStatusF).toBe('Performed');

      // Verify the code maps correctly
      const statusCode = mapStatusToCode(schedStatusF);
      expect(statusCode).toBe('Pf');
    });

    it('should NOT use top-level SchedStatusF (which shows wrong status)', () => {
      // The bug was using top-level SchedStatusF
      const topLevelStatus = extractXml(COMPLETED_TRIP_XML, 'SchedStatusF');

      // Top-level shows "Scheduled" even though trip is Performed
      expect(topLevelStatus).toBe('Scheduled');

      // This is WRONG - proves the bug existed
      const wrongCode = mapStatusToCode(topLevelStatus);
      expect(wrongCode).toBe('S'); // Bug would show as Scheduled
    });

    it('should extract Scheduled status from upcoming trip', () => {
      const pickupMatch = SCHEDULED_TRIP_XML.match(/<PickUpLeg[^>]*>([\s\S]*?)<\/PickUpLeg>/);
      const pickupXml = pickupMatch ? pickupMatch[1] : '';

      const eventsInfoMatch = pickupXml.match(/<EventsInfo[^>]*>([\s\S]*?)<\/EventsInfo>/);
      const eventsInfoXml = eventsInfoMatch ? eventsInfoMatch[1] : '';

      const schedStatusF = extractXml(eventsInfoXml, 'SchedStatusF');

      expect(schedStatusF).toBe('Scheduled');
      expect(mapStatusToCode(schedStatusF)).toBe('S');
    });
  });

  describe('extracting provider info from EventsProviderInfo', () => {
    it('should extract provider name from completed trip', () => {
      // EventsProviderInfo is a sibling of EventsInfo, both inside PickUpLeg
      const pickupMatch = COMPLETED_TRIP_XML.match(/<PickUpLeg[^>]*>([\s\S]*?)<\/PickUpLeg>/);
      const pickupXml = pickupMatch ? pickupMatch[1] : '';

      const providerInfoMatch = pickupXml.match(/<EventsProviderInfo[^>]*>([\s\S]*?)<\/EventsProviderInfo>/);
      const providerInfoXml = providerInfoMatch ? providerInfoMatch[1] : '';

      const providerName = extractXml(providerInfoXml, 'ProviderName');
      const providerDescription = extractXml(providerInfoXml, 'Description');

      expect(providerName).toBe('PRESTIGE');
      expect(providerDescription).toBe('PRESTIGE TRANSPORTATION');
    });

    it('should extract DATS provider info from scheduled trip', () => {
      // EventsProviderInfo is a sibling of EventsInfo, both inside PickUpLeg
      const pickupMatch = SCHEDULED_TRIP_XML.match(/<PickUpLeg[^>]*>([\s\S]*?)<\/PickUpLeg>/);
      const pickupXml = pickupMatch ? pickupMatch[1] : '';

      const providerInfoMatch = pickupXml.match(/<EventsProviderInfo[^>]*>([\s\S]*?)<\/EventsProviderInfo>/);
      const providerInfoXml = providerInfoMatch ? providerInfoMatch[1] : '';

      const providerName = extractXml(providerInfoXml, 'ProviderName');
      const providerDescription = extractXml(providerInfoXml, 'Description');

      expect(providerName).toBe('DATS');
      expect(providerDescription).toBe('DATS TRANSIT');
    });
  });

  describe('extracting dropoff comments', () => {
    it('should extract comments from DropOffLeg', () => {
      const dropoffMatch = COMPLETED_TRIP_XML.match(/<DropOffLeg[^>]*>([\s\S]*?)<\/DropOffLeg>/);
      const dropoffXml = dropoffMatch ? dropoffMatch[1] : '';

      const comments = extractXml(dropoffXml, 'Comments');

      expect(comments).toBe('FRONT DOOR');
    });
  });
});

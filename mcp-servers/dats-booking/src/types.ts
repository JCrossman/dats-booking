/**
 * Type definitions for DATS Booking MCP Server
 */

// ============= ERROR TYPES =============

export enum ErrorCategory {
  AUTH_FAILURE = 'auth_failure',
  SESSION_EXPIRED = 'session_expired',
  BOOKING_CONFLICT = 'booking_conflict',
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  RATE_LIMITED = 'rate_limited',
  SYSTEM_ERROR = 'system_error',
  CREDENTIALS_NOT_FOUND = 'credentials_not_found',
  BUSINESS_RULE_VIOLATION = 'business_rule_violation',
}

export interface ToolError {
  category: ErrorCategory;
  message: string;
  recoverable: boolean;
  retryAfterMs?: number;
}

// ============= CREDENTIAL TYPES =============

export interface DATSCredentials {
  clientId: string;
  passcode: string;
}

export interface EncryptedCredentials {
  iv: string;
  authTag: string;
  data: string;
  createdAt: string;
}

// ============= BOOKING TYPES =============

export type MobilityDevice = 'wheelchair' | 'scooter' | 'walker' | 'none';

export type PassengerType = 'escort' | 'pca' | 'guest';

export interface AdditionalPassenger {
  type: PassengerType;
  count?: number;
}

export interface BookTripInput {
  pickupDate: string;
  pickupTime: string;
  pickupAddress: string;
  destinationAddress: string;
  mobilityDevice?: MobilityDevice;
  companion?: boolean;
  returnTrip?: boolean;
  // Additional options
  pickupPhone?: string;
  dropoffPhone?: string;
  pickupComments?: string;
  dropoffComments?: string;
  additionalPassenger?: AdditionalPassenger;
  purpose?: 'work' | 'education' | 'program' | 'medical' | 'dialysis' | 'personal' | 'shopping' | 'refused';
}

export interface PickupWindow {
  start: string;
  end: string;
}

export interface BookTripOutput {
  success: boolean;
  confirmationNumber?: string;
  bookingId?: string;
  pickupWindow?: PickupWindow;
  error?: ToolError;
}

// ============= TRIP TYPES =============

// DATS trip status codes (from DATS website)
export type TripStatusCode = 'S' | 'U' | 'NS' | 'A' | 'CA' | 'Pn' | 'Pf' | 'NM' | 'R';

export interface TripStatusInfo {
  code: TripStatusCode;
  label: string;
  description: string;
  isActive: boolean; // Show in default trip list (vs historical/completed)
}

export const TRIP_STATUSES: Record<TripStatusCode, TripStatusInfo> = {
  S: { code: 'S', label: 'Scheduled', description: 'Trip booked and scheduled successfully', isActive: true },
  U: { code: 'U', label: 'Unscheduled', description: 'Trip booked but not scheduled yet', isActive: true },
  NS: { code: 'NS', label: 'No Show', description: 'You did not show up at the scheduled pickup time', isActive: false },
  A: { code: 'A', label: 'Arrived', description: 'Vehicle has arrived at the pickup location', isActive: true },
  CA: { code: 'CA', label: 'Cancelled', description: 'Trip has been cancelled', isActive: false },
  Pn: { code: 'Pn', label: 'Pending', description: 'Trip needs to be created from your recurring template', isActive: true },
  Pf: { code: 'Pf', label: 'Performed', description: 'Trip has been completed', isActive: false },
  NM: { code: 'NM', label: 'Missed Trip', description: 'Vehicle arrived late and did not transport you', isActive: false },
  R: { code: 'R', label: 'Refused', description: 'You refused the proposed booking solution', isActive: false },
};

// Keep old type for backwards compatibility
export type TripStatus = TripStatusCode;

export interface TripPassenger {
  type: 'escort' | 'pca' | 'guest';
  count: number;
}

export interface Trip {
  confirmationNumber: string;
  bookingId: string;
  date: string;
  pickupWindow: PickupWindow;
  pickupAddress: string;
  destinationAddress: string;
  status: TripStatusCode;
  statusLabel?: string; // Human-readable label (e.g., "Scheduled")
  statusDescription?: string; // Full description for context
  estimatedPickupTime?: string;
  estimatedDropoffTime?: string;
  // Additional trip details
  spaceType?: string;
  mobilityDevice?: string;
  additionalPassengers?: TripPassenger[];
  pickupPhone?: string;
  dropoffPhone?: string;
  pickupComments?: string;
  dropoffComments?: string;
  fare?: string;
  // Provider information
  providerName?: string; // Service provider (e.g., "PRESTIGE", "DATS")
  providerDescription?: string; // Provider description
}

export interface GetTripsOutput {
  success: boolean;
  trips: Trip[];
  error?: ToolError;
}

// ============= CANCELLATION TYPES =============

export interface CancelTripOutput {
  success: boolean;
  message: string;
  error?: ToolError;
}

// ============= TRACKING TYPES =============

export interface VehicleInfo {
  vehicleNumber: string;
  make: string;
  model: string;
  description: string;
  driverName: string;
  driverBadgeNum: string;
  driverPhone?: string;
  location: {
    lat: number;
    lon: number;
  };
  lastUpdate: string; // Time of last GPS update
}

export interface EventTrackingInfo {
  estimatedTime: string; // Formatted time (e.g., "2:51 PM")
  eta: string; // Formatted ETA
  location: {
    lat: number;
    lon: number;
  };
  address: string;
  actualArriveTime?: string;
  actualDepartTime?: string;
  isImminent: boolean; // True if this is the next event
  status: 'scheduled' | 'arrived' | 'departed' | 'completed';
}

export interface TrackTripOutput {
  success: boolean;
  bookingId: string;
  confirmationNumber?: string;
  pickup: EventTrackingInfo;
  dropoff: EventTrackingInfo;
  vehicle?: VehicleInfo;
  provider?: string;
  runName?: string;
  lastChecked: string;
  error?: ToolError;
}

// ============= AUDIT LOGGING TYPES =============

export interface AuditLogEntry {
  action: string; // Action type (e.g., 'session_accessed', 'trip_booked')
  result: 'success' | 'failure'; // Operation result
  sessionIdHash?: string; // Hashed session ID (no raw IDs)
  errorCode?: string; // Error code if failure
  privacyPolicyVersion?: string; // For consent tracking
  timestamp?: string; // ISO 8601 timestamp (auto-added by logger)
}

// ============= LOCATION TYPES =============

export interface SavedLocation {
  addressMode: 'R' | 'LL'; // R = Registered, LL = Lat/Lon
  addrType: 'CH' | 'CM' | 'AD' | 'LO'; // Client Home, Client Mailing, Address, Location
  addrDescr: string; // "Client Home", "Client Mailing", etc.
  addrName?: string; // Named location (e.g., "McNally High School")
  addrNumber?: number; // Registered address ID
  legId?: number; // Frequent address ID
  streetNo: string;
  onStreet: string;
  unit?: string;
  city: string;
  state: string;
  zipCode: string;
  lon: number; // Microdegrees (divide by 1000000 for actual coordinates)
  lat: number; // Microdegrees (divide by 1000000 for actual coordinates)
  source: 'Both' | 'Registered' | 'Frequent';
  comments?: string; // Pickup instructions
  phone?: string;
  atStreet?: string;
}

export interface FrequentTripLeg {
  addressMode: string;
  addrName?: string;
  streetNo: string;
  onStreet: string;
  unit?: string;
  city: string;
  state: string;
  zipCode: string;
  lon: number;
  lat: number;
  extra?: string;
}

export interface FrequentTrip {
  bookingId: string;
  useCount: number;
  mobilityAids: string;
  pickup: FrequentTripLeg;
  dropoff: FrequentTripLeg;
}

// ============= AVAILABILITY TYPES =============

export interface AvailableDate {
  date: string; // YYYYMMDD
  dayOfWeek: number; // 1=Sunday, 7=Saturday
  rawDate: string;
}

export interface BookingDaysWindow {
  maxDaysAdvance: number;
  minDaysAdvance: number;
  sameDayAllowed: boolean;
  availableDates: AvailableDate[];
  extraDayAdded?: string;
}

export interface TimeSlot {
  time: number; // Pickup time (seconds since midnight)
  lastBookingTime: number; // Latest dropoff time (seconds since midnight)
  index: number;
  previousDate?: number;
}

export interface BookingTimesWindow {
  date: string; // YYYYMMDD
  currentTime: number; // Seconds since midnight
  firstBookingTime: number; // Seconds since midnight
  lastBookingTime: number; // Seconds since midnight
  timeInterval: number; // Seconds between slots (e.g., 600 = 10 min)
  threshold: number;
  timeSlots: TimeSlot[];
}

// ============= BOOKING OPTIONS TYPES =============

export interface PassengerTypeInfo {
  abbreviation: string;
  description: string;
  defaultSpaceType: string;
  fareTypeId?: number;
  reqdAsAddPass?: number;
}

export interface SpaceTypeInfo {
  abbreviation: string;
  description: string;
}

export interface FareTypeInfo {
  fareType: number;
  abbreviation: string;
  description: string;
}

export interface BookingPurpose {
  bookingPurposeId: number;
  abbreviation: string;
  description: string;
  code: string;
}

export interface DefaultBooking {
  passengerTypes: PassengerTypeInfo[];
  spaceTypes: SpaceTypeInfo[];
  fareTypes: FareTypeInfo[];
  purposes: BookingPurpose[];
  defaultPassBooking?: {
    clientId: string;
    bookingType: string;
    companionMode: string;
    // ... other fields
  };
}

// ============= AUDIT TYPES =============

export type AuditAction =
  | 'credential_stored'
  | 'credential_accessed'
  | 'booking_created'
  | 'booking_cancelled'
  | 'trips_retrieved'
  | 'login_attempt'
  | 'login_success'
  | 'login_failure';

// Duplicate AuditLogEntry removed - see line 199-206

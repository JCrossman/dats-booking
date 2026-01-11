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

export type TripStatus = 'confirmed' | 'pending' | 'cancelled';

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
  status: TripStatus;
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

export interface AuditLogEntry {
  timestamp: string;
  action: AuditAction;
  result: 'success' | 'failure';
  errorCode?: string;
}

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

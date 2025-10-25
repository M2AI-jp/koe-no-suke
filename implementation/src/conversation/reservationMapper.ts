import type { Reservation } from '../google/sheets';

export interface RawReservationData {
  date?: string;
  time?: string;
  party_size?: number;
  customer_name?: string;
  contact_number?: string;
  special_request?: string;
}

export interface MappingResult {
  success: boolean;
  reservation?: Reservation;
  missingFields?: string[];
}

export function mapToReservation(raw: RawReservationData, callerNumber: string): MappingResult {
  const missingFields: string[] = [];

  if (!raw.date) missingFields.push('date');
  if (!raw.time) missingFields.push('time');
  if (!raw.party_size) missingFields.push('party_size');
  if (!raw.customer_name) missingFields.push('customer_name');
  if (!raw.contact_number) missingFields.push('contact_number');

  if (missingFields.length > 0) {
    return { success: false, missingFields };
  }

  const reservation: Reservation = {
    timestamp_iso: new Date().toISOString(),
    caller_number: callerNumber,
    reservation_date: raw.date!,
    reservation_time: raw.time!,
    party_size: raw.party_size!,
    customer_name: raw.customer_name!,
    contact_number: raw.contact_number!,
    special_request: raw.special_request,
    status: 'accepted',
  };

  return { success: true, reservation };
}

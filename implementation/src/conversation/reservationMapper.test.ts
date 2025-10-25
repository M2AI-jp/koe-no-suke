import { describe, expect, it, vi } from 'vitest';
import { mapToReservation } from './reservationMapper';

describe('mapToReservation', () => {
  it('全フィールドが揃っている場合は成功', () => {
    const fixedDate = '2025-01-01T00:00:00.000Z';
    const dateSpy = vi.spyOn(global, 'Date').mockImplementation(
      () =>
        ({
          toISOString: () => fixedDate,
        } as unknown as Date)
    );

    const result = mapToReservation(
      {
        date: '2025-01-25',
        time: '18:00',
        party_size: 4,
        customer_name: '田中',
        contact_number: '+819012345678',
        special_request: '窓際希望',
      },
      '+819012345678'
    );

    expect(result.success).toBe(true);
    expect(result.reservation?.customer_name).toBe('田中');
    expect(result.reservation?.timestamp_iso).toBe(fixedDate);

    dateSpy.mockRestore();
  });

  it('必須フィールドが欠けている場合は失敗', () => {
    const result = mapToReservation(
      {
        date: '2025-01-25',
        party_size: 4,
        customer_name: '田中',
        contact_number: '+819012345678',
      },
      '+819012345678'
    );

    expect(result.success).toBe(false);
    expect(result.missingFields).toContain('time');
  });
});

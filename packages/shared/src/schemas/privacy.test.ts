import { describe, expect, it } from 'vitest';

import {
  dataExportPayloadSchema,
  eraseUserSchema,
  orgSettingsUpdateSchema,
  retentionSettingsSchema,
} from './privacy';

describe('retentionSettingsSchema', () => {
  it('accepts a valid partial record (absent keys = no auto-deletion)', () => {
    const parsed = retentionSettingsSchema.parse({ audit_log: 365, photo: 0 });
    expect(parsed).toEqual({ audit_log: 365, photo: 0 });
  });

  it('accepts an empty record', () => {
    expect(retentionSettingsSchema.parse({})).toEqual({});
  });

  it('accepts every declared category', () => {
    const full = {
      audit_log: 365,
      notification: 30,
      photo: 1825,
      document: 2555,
      completed_project: 3650,
      leave_request: 1095,
    };
    expect(retentionSettingsSchema.parse(full)).toEqual(full);
  });

  it('rejects a negative retention value', () => {
    expect(() => retentionSettingsSchema.parse({ audit_log: -1 })).toThrow();
  });

  it('rejects a non-integer retention value', () => {
    expect(() => retentionSettingsSchema.parse({ audit_log: 1.5 })).toThrow();
  });

  it('rejects an unknown category key', () => {
    expect(() => retentionSettingsSchema.parse({ payroll: 365 })).toThrow();
    expect(() => retentionSettingsSchema.parse({ spi: 1 })).toThrow();
  });
});

describe('orgSettingsUpdateSchema', () => {
  it('accepts a full update', () => {
    const input = {
      dpoName: 'Jane Dela Cruz',
      dpoContact: 'dpo@example.com',
      retentionSettings: { audit_log: 365 },
    };
    expect(orgSettingsUpdateSchema.parse(input)).toEqual(input);
  });

  it('accepts an empty object (no fields changed)', () => {
    expect(orgSettingsUpdateSchema.parse({})).toEqual({});
  });

  it('accepts explicit null to clear a field', () => {
    const parsed = orgSettingsUpdateSchema.parse({ dpoName: null, dpoContact: null });
    expect(parsed.dpoName).toBeNull();
    expect(parsed.dpoContact).toBeNull();
  });

  it('rejects an unknown retention category nested inside the update', () => {
    expect(() =>
      orgSettingsUpdateSchema.parse({ retentionSettings: { payroll: 30 } }),
    ).toThrow();
  });

  it('rejects an overlong dpoName', () => {
    expect(() => orgSettingsUpdateSchema.parse({ dpoName: 'a'.repeat(201) })).toThrow();
  });
});

describe('dataExportRequestSchema / eraseUserSchema', () => {
  it('erase requires confirm to be the literal true', () => {
    expect(() => eraseUserSchema.parse({ userId: 'u1', confirm: false })).toThrow();
    expect(() => eraseUserSchema.parse({ userId: 'u1' })).toThrow();
    expect(eraseUserSchema.parse({ userId: 'u1', confirm: true })).toEqual({
      userId: 'u1',
      confirm: true,
    });
  });

  it('erase requires a non-empty userId', () => {
    expect(() => eraseUserSchema.parse({ userId: '', confirm: true })).toThrow();
  });
});

describe('dataExportPayloadSchema', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');

  const minimal = {
    exportedAt: now,
    profile: {
      id: 'u1',
      name: 'Jane Dela Cruz',
      email: 'jane@example.com',
      isActive: true,
      roleName: 'field_staff',
      createdAt: now,
    },
  };

  it('round-trips a minimal payload, defaulting every array to []', () => {
    const parsed = dataExportPayloadSchema.parse(minimal);
    expect(parsed.tasks).toEqual([]);
    expect(parsed.documents).toEqual([]);
    expect(parsed.photos).toEqual([]);
    expect(parsed.leaveRequests).toEqual([]);
    expect(parsed.leaveBalances).toEqual([]);
    expect(parsed.notifications).toEqual([]);
    expect(parsed.auditLogs).toEqual([]);
    expect(parsed.profile.email).toBe('jane@example.com');
  });

  it('never carries a passwordHash field on the profile', () => {
    const parsed = dataExportPayloadSchema.parse(minimal);
    expect('passwordHash' in parsed.profile).toBe(false);
  });

  it('round-trips a full payload with every array populated', () => {
    const full = {
      ...minimal,
      tasks: [{ id: 't1', title: 'Pour footing', projectId: 'p1', status: 'done', createdAt: now }],
      documents: [
        { id: 'd1', name: 'invoice.pdf', storageKey: 'docs/d1', category: 'invoice', createdAt: now },
      ],
      photos: [{ id: 'ph1', storageKey: 'photos/ph1', taskId: 't1', capturedAt: now }],
      leaveRequests: [
        {
          id: 'lr1',
          leaveTypeId: 'lt1',
          startDate: now,
          endDate: now,
          status: 'approved',
          createdAt: now,
        },
      ],
      leaveBalances: [
        { leaveTypeId: 'lt1', year: 2026, entitled: 15, used: 3, remaining: 12 },
      ],
      notifications: [{ id: 'n1', type: 'task_assigned', isRead: false, createdAt: now }],
      auditLogs: [{ id: 'a1', action: 'login', targetType: 'user', timestamp: now }],
    };
    const parsed = dataExportPayloadSchema.parse(full);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.documents).toHaveLength(1);
    expect(parsed.photos).toHaveLength(1);
    expect(parsed.leaveRequests).toHaveLength(1);
    expect(parsed.leaveBalances).toHaveLength(1);
    expect(parsed.notifications).toHaveLength(1);
    expect(parsed.auditLogs).toHaveLength(1);
  });

  it('rejects a payload missing the profile', () => {
    expect(() => dataExportPayloadSchema.parse({ exportedAt: now })).toThrow();
  });

  it('rejects an invalid profile email', () => {
    expect(() =>
      dataExportPayloadSchema.parse({
        ...minimal,
        profile: { ...minimal.profile, email: 'not-an-email' },
      }),
    ).toThrow();
  });
});

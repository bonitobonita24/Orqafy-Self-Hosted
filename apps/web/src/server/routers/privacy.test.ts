// Right-to-access/portability export (DPA W4): self vs admin-on-behalf-of
// authorization, NOT_FOUND on unknown id, no passwordHash leak, SPI-metadata
// gate parity with documents.ts, and the audit-trail write.
import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';

const { privacyRouter } = await import('./privacy');

type UserRow = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  role: { name: string };
};

const SELF_USER: UserRow = {
  id: 'u1',
  name: 'Self User',
  email: 'self@orqafy.test',
  passwordHash: 'should-never-leave-the-db',
  phone: null,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  role: { name: 'field_staff' },
};

const OTHER_USER: UserRow = {
  ...SELF_USER,
  id: 'u2',
  name: 'Other User',
  email: 'other@orqafy.test',
};

/** Applies a Prisma `select` to a row so the test sees exactly what is returned. */
function pick<T extends Record<string, unknown>>(row: T, select?: Record<string, unknown>): T {
  if (select === undefined) return row;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(select)) {
    if (key === 'role' && select.role) {
      out.role = row.role;
      continue;
    }
    out[key] = row[key as keyof T];
  }
  return out as T;
}

function caller(opts: {
  callerId?: string;
  permissions?: Permission[];
  users?: UserRow[];
  docs?: Array<Record<string, unknown>>;
}) {
  const callerId = opts.callerId ?? 'u1';
  const users = opts.users ?? [SELF_USER, OTHER_USER];
  const docs = opts.docs ?? [];
  const auditRows: Array<Record<string, unknown>> = [];

  const empty = () => Promise.resolve([]);

  const prisma = {
    user: {
      findUnique: ({ where, select }: { where: { id: string }; select?: Record<string, unknown> }) => {
        const row = users.find((u) => u.id === where.id);
        return Promise.resolve(row === undefined ? null : pick(row, select));
      },
    },
    task: { findMany: empty },
    document: {
      findMany: ({ where }: { where: { uploadedBy: string; isSPI?: boolean } }) =>
        Promise.resolve(
          docs.filter(
            (d) =>
              d.uploadedBy === where.uploadedBy &&
              (where.isSPI === undefined || d.isSPI === where.isSPI),
          ),
        ),
    },
    photo: { findMany: empty },
    leaveRequest: { findMany: empty },
    leaveBalance: { findMany: empty },
    notification: { findMany: empty },
    auditLog: {
      findMany: empty,
      create: ({ data }: { data: Record<string, unknown> }) => {
        auditRows.push(data);
        return Promise.resolve({ id: 'audit-1', ...data });
      },
    },
  };

  const ctx = {
    prisma: prisma as unknown as TRPCContext['prisma'],
    session: { user: { id: callerId }, expires: '2099-01-01T00:00:00.000Z' } as Session,
    userId: callerId,
    permissions: new Set<Permission>(opts.permissions ?? []),
  } satisfies TRPCContext;

  return { c: createCallerFactory(privacyRouter)(ctx), auditRows };
}

describe('privacy.exportData', () => {
  it('self export without export_data succeeds', async () => {
    const { c } = caller({ callerId: 'u1', permissions: [] });
    const result = await c.exportData({});
    expect(result.profile.id).toBe('u1');
    expect(result.profile.email).toBe('self@orqafy.test');
  });

  it('admin export of another user with export_data succeeds', async () => {
    const { c } = caller({ callerId: 'u1', permissions: ['export_data'] });
    const result = await c.exportData({ userId: 'u2' });
    expect(result.profile.id).toBe('u2');
  });

  it('non-admin exporting another user is FORBIDDEN', async () => {
    const { c } = caller({ callerId: 'u1', permissions: [] });
    await expect(c.exportData({ userId: 'u2' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('unknown id returns NOT_FOUND', async () => {
    const { c } = caller({ callerId: 'u1', permissions: ['export_data'] });
    await expect(c.exportData({ userId: 'ghost' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('payload never carries passwordHash', async () => {
    const { c } = caller({ callerId: 'u1', permissions: [] });
    const result = await c.exportData({});
    expect(result.profile).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('should-never-leave-the-db');
  });

  it('excludes SPI document metadata for an admin lacking view_finances', async () => {
    const { c } = caller({
      callerId: 'u1',
      permissions: ['export_data'],
      docs: [
        {
          id: 'd1',
          name: 'payroll.pdf',
          storageKey: 'documents/x/payroll.pdf',
          category: 'other',
          createdAt: new Date(),
          uploadedBy: 'u2',
          isSPI: true,
        },
        {
          id: 'd2',
          name: 'contract.pdf',
          storageKey: 'documents/y/contract.pdf',
          category: 'other',
          createdAt: new Date(),
          uploadedBy: 'u2',
          isSPI: false,
        },
      ],
    });
    const result = await c.exportData({ userId: 'u2' });
    expect(result.documents.map((d) => d.id)).toEqual(['d2']);
  });

  it('includes SPI document metadata for an admin holding view_finances', async () => {
    const { c } = caller({
      callerId: 'u1',
      permissions: ['export_data', 'view_finances'],
      docs: [
        {
          id: 'd1',
          name: 'payroll.pdf',
          storageKey: 'documents/x/payroll.pdf',
          category: 'other',
          createdAt: new Date(),
          uploadedBy: 'u2',
          isSPI: true,
        },
      ],
    });
    const result = await c.exportData({ userId: 'u2' });
    expect(result.documents.map((d) => d.id)).toEqual(['d1']);
  });

  it('includes own SPI documents on self export regardless of permissions', async () => {
    const { c } = caller({
      callerId: 'u1',
      permissions: [],
      docs: [
        {
          id: 'd1',
          name: 'payroll.pdf',
          storageKey: 'documents/x/payroll.pdf',
          category: 'other',
          createdAt: new Date(),
          uploadedBy: 'u1',
          isSPI: true,
        },
      ],
    });
    const result = await c.exportData({});
    expect(result.documents.map((d) => d.id)).toEqual(['d1']);
  });

  it('writes an audit row with byAdmin flag set correctly', async () => {
    const { c, auditRows } = caller({ callerId: 'u1', permissions: ['export_data'] });
    await c.exportData({ userId: 'u2' });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      userId: 'u1',
      action: 'data_subject.export',
      targetType: 'user',
      targetId: 'u2',
      metadata: { byAdmin: true },
    });
  });

  it('writes an audit row with byAdmin false on self export', async () => {
    const { c, auditRows } = caller({ callerId: 'u1', permissions: [] });
    await c.exportData({});
    expect(auditRows[0]).toMatchObject({ metadata: { byAdmin: false } });
  });
});

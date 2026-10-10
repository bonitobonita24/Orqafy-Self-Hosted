// DPA org-settings router (W3): permission gating, zod validation, audit
// write, and the no-org-row NOT_FOUND path (never auto-create the row).
import { describe, expect, it } from 'vitest';
import type { Session } from 'next-auth';
import type { Permission } from '@orqafy/shared';
import { createCallerFactory } from '../trpc';
import type { TRPCContext } from '../context';

const { orgRouter } = await import('./org');

type OrgRow = {
  id: string;
  name: string;
  dpoName: string | null;
  dpoContact: string | null;
  retentionSettings: unknown;
  timezone: string;
};

function caller(opts: { org?: OrgRow | null; permissions?: Permission[] } = {}) {
  const org: OrgRow | null =
    opts.org === undefined
      ? {
          id: 'org1',
          name: 'Acme',
          dpoName: null,
          dpoContact: null,
          retentionSettings: null,
          timezone: 'UTC',
        }
      : opts.org;

  const auditRows: Array<Record<string, unknown>> = [];
  let updatedWith: Record<string, unknown> | undefined;
  let findFirstArgs: unknown;

  const prisma = {
    organization: {
      findFirst: (args: unknown) => {
        findFirstArgs = args;
        return Promise.resolve(org);
      },
      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updatedWith = data;
        return Promise.resolve({ ...org, id: where.id, ...data });
      },
    },
    auditLog: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        auditRows.push(data);
        return Promise.resolve({ id: 'a1', ...data });
      },
    },
  };

  const ctx = {
    prisma: prisma as unknown as TRPCContext['prisma'],
    session: { user: { id: 'u1' }, expires: '2099-01-01T00:00:00.000Z' } as Session,
    userId: 'u1',
    permissions: new Set<Permission>(opts.permissions ?? ['configure_server']),
  } satisfies TRPCContext;

  return {
    c: createCallerFactory(orgRouter)(ctx),
    auditRows,
    updatedWith: () => updatedWith,
    findFirstArgs: () => findFirstArgs,
  };
}

describe('org.getSettings', () => {
  it('rejects without configure_server', async () => {
    const { c } = caller({ permissions: [] });
    await expect(c.getSettings()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('returns NOT_FOUND when no Organization row exists', async () => {
    const { c } = caller({ org: null });
    await expect(c.getSettings()).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns the settings fields for an existing row', async () => {
    const { c } = caller({
      org: {
        id: 'org1',
        name: 'Acme',
        dpoName: 'Jane DPO',
        dpoContact: 'dpo@acme.test',
        retentionSettings: { audit_log: 30 },
        timezone: 'Asia/Manila',
      },
    });
    const result = await c.getSettings();
    expect(result).toMatchObject({
      name: 'Acme',
      dpoName: 'Jane DPO',
      dpoContact: 'dpo@acme.test',
      retentionSettings: { audit_log: 30 },
      timezone: 'Asia/Manila',
    });
  });

  // Regression: a bare `findFirst()` with no `orderBy` gives Postgres no
  // ordering guarantee, so a getSettings read and an updateSettings write
  // could silently resolve to DIFFERENT Organization rows if more than one
  // ever existed (the root cause of the "settings don't save" bug — see
  // packages/db/src/organization.ts + migration enforce_single_organization_row).
  it('reads the Organization row via a deterministic orderBy (immune to row ordering)', async () => {
    const { c, findFirstArgs } = caller();
    await c.getSettings();
    expect(findFirstArgs()).toMatchObject({ orderBy: { createdAt: 'asc' } });
  });

  it('returns null for retentionSettings when stored JSON fails validation', async () => {
    const { c } = caller({
      org: {
        id: 'org1',
        name: 'Acme',
        dpoName: null,
        dpoContact: null,
        retentionSettings: { audit_log: -5 }, // invalid: negative days
        timezone: 'UTC',
      },
    });
    const result = await c.getSettings();
    expect(result.retentionSettings).toBeNull();
  });
});

describe('org.updateSettings', () => {
  it('rejects without configure_server', async () => {
    const { c } = caller({ permissions: [] });
    await expect(c.updateSettings({ dpoName: 'Jane' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects negative retention days (zod)', async () => {
    const { c } = caller();
    await expect(
      c.updateSettings({ retentionSettings: { audit_log: -1 } }),
    ).rejects.toThrow();
  });

  it('returns NOT_FOUND when no Organization row exists and does not create one', async () => {
    const { c } = caller({ org: null });
    await expect(c.updateSettings({ dpoName: 'Jane' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('reads the Organization row via a deterministic orderBy before updating it', async () => {
    const { c, findFirstArgs } = caller();
    await c.updateSettings({ dpoName: 'Jane' });
    expect(findFirstArgs()).toMatchObject({ orderBy: { createdAt: 'asc' } });
  });

  it('updates only provided keys and writes an audit row', async () => {
    const { c, auditRows, updatedWith } = caller();
    await c.updateSettings({ dpoName: 'Jane DPO' });

    expect(updatedWith()).toEqual({ dpoName: 'Jane DPO' });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]).toMatchObject({
      userId: 'u1',
      action: 'org.settings.update',
      targetType: 'organization',
      targetId: 'org1',
      metadata: { changedKeys: ['dpoName'] },
    });
  });

  it('allows explicitly clearing a field with null', async () => {
    const { c, updatedWith } = caller({
      org: {
        id: 'org1',
        name: 'Acme',
        dpoName: 'Jane DPO',
        dpoContact: 'dpo@acme.test',
        retentionSettings: null,
        timezone: 'UTC',
      },
    });
    await c.updateSettings({ dpoName: null });
    expect(updatedWith()).toEqual({ dpoName: null });
  });
});

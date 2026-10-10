import { describe, expect, it } from 'vitest';
import { writeAudit } from './audit';

function makePrisma() {
  const rows: Array<Record<string, unknown>> = [];
  const prisma = {
    auditLog: {
      create: ({ data }: { data: Record<string, unknown> }) => {
        rows.push(data);
        return Promise.resolve({ id: `a${rows.length}`, ...data });
      },
    },
  };
  return { prisma, rows };
}

describe('writeAudit', () => {
  it('writes userId/action/targetType/targetId/metadata', async () => {
    const { prisma, rows } = makePrisma();
    await writeAudit(prisma as never, {
      userId: 'u1',
      action: 'org.settings.update',
      targetType: 'organization',
      targetId: 'org1',
      metadata: { changedKeys: ['dpoName'] },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: 'u1',
      action: 'org.settings.update',
      targetType: 'organization',
      targetId: 'org1',
      metadata: { changedKeys: ['dpoName'] },
    });
  });

  it('omits targetId/ip/metadata when not provided (no explicit undefined keys)', async () => {
    const { prisma, rows } = makePrisma();
    await writeAudit(prisma as never, {
      userId: 'u1',
      action: 'org.settings.update',
      targetType: 'organization',
    });
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (row === undefined) throw new Error('expected a row');
    expect('targetId' in row).toBe(false);
    expect('ip' in row).toBe(false);
    expect('metadata' in row).toBe(false);
  });

  it('includes ip when provided', async () => {
    const { prisma, rows } = makePrisma();
    await writeAudit(prisma as never, {
      userId: 'u1',
      action: 'org.settings.update',
      targetType: 'organization',
      ip: '203.0.113.7',
    });
    expect(rows[0]).toMatchObject({ ip: '203.0.113.7' });
  });
});

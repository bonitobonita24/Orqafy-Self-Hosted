/**
 * @orqafy/db seed — app-local roles + an interactive-first-run posture.
 *
 * ORQAFY OVERRIDE (D-5 / R-4): this is a single-company self-hosted install, so
 * there is NO framework tenant_superadmin / tenant_manager seed, NO Powerbyte
 * universal credentials, and NO hardcoded Powerbyte emails. Real installs create
 * their first admin via INTERACTIVE FIRST-RUN setup.
 *
 * The seed always provisions the app's OWN role model (system PermissionGroups),
 * the organisation singleton, and a starter set of leave types — all idempotent.
 *
 * A LOCAL-DEV admin is created ONLY when DEV_ADMIN_EMAIL + DEV_ADMIN_PASSWORD are
 * present in the environment (D-25 dev convenience; values live in the gitignored
 * CREDENTIALS.md, exported by the operator/dev compose). The password is
 * bcrypt-hashed at seed time — never stored in plaintext in code. When those vars
 * are absent the seed skips the admin entirely (the interactive-first-run path).
 */
import { PrismaClient, Permission, SystemRole } from '@prisma/client';
import {
  SYSTEM_ROLE_PERMISSIONS,
  SYSTEM_ROLE_LABEL,
  SYSTEM_ROLE_ORDER,
} from '@orqafy/shared';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Role→permission grants come from the ONE canonical source (@orqafy/shared),
// the SAME module the web first-run (setup.ts) consumes — ORQ-27 ends the
// seed↔first-run drift. The shared values are string-typed; they are bridged to
// the Prisma enum types at the upsert call (identical string values).

/** Starter leave categories (D-21). defaultDaysPerYear are sensible defaults the
 *  operator can edit; nothing here requires health detail (SPI minimisation). */
const LEAVE_TYPES: ReadonlyArray<{
  id: string;
  name: string;
  defaultDaysPerYear: number;
  isPaid: boolean;
}> = [
  { id: 'lt_vacation', name: 'Vacation', defaultDaysPerYear: 15, isPaid: true },
  { id: 'lt_sick', name: 'Sick', defaultDaysPerYear: 15, isPaid: true },
  { id: 'lt_emergency', name: 'Emergency', defaultDaysPerYear: 5, isPaid: true },
  { id: 'lt_unpaid', name: 'Unpaid', defaultDaysPerYear: 0, isPaid: false },
];

async function seedOrganization(): Promise<void> {
  await prisma.organization.upsert({
    where: { id: 'org_default' },
    update: {},
    create: { id: 'org_default', name: 'My Firm', timezone: 'UTC' },
  });
}

async function seedSystemRoles(): Promise<void> {
  for (const role of SYSTEM_ROLE_ORDER) {
    const systemKey = role;
    const name = SYSTEM_ROLE_LABEL[role];
    const permissions = SYSTEM_ROLE_PERMISSIONS[role] as Permission[];
    await prisma.permissionGroup.upsert({
      where: { systemKey },
      update: { name, permissions, isSystem: true },
      create: {
        name,
        permissions,
        isSystem: true,
        systemKey,
      },
    });
  }
}

async function seedLeaveTypes(): Promise<void> {
  for (const lt of LEAVE_TYPES) {
    await prisma.leaveType.upsert({
      where: { id: lt.id },
      update: { name: lt.name, defaultDaysPerYear: lt.defaultDaysPerYear, isPaid: lt.isPaid },
      create: lt,
    });
  }
}

async function seedDevAdmin(): Promise<void> {
  const email = process.env.DEV_ADMIN_EMAIL;
  const password = process.env.DEV_ADMIN_PASSWORD;

  if (email === undefined || email === '' || password === undefined || password === '') {
    console.log(
      '· No DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD in env — skipping dev admin ' +
        '(real installs create the first admin via interactive first-run).',
    );
    return;
  }

  const ownerRole = await prisma.permissionGroup.findUniqueOrThrow({
    where: { systemKey: SystemRole.owner_admin },
  });

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, roleId: ownerRole.id, isActive: true },
    create: {
      name: 'Local Dev Admin',
      email,
      passwordHash,
      roleId: ownerRole.id,
      isActive: true,
    },
  });

  console.log(
    `· Seeded LOCAL-DEV admin <${email}> with the owner_admin role (dev convenience only).`,
  );
}

async function main(): Promise<void> {
  await seedOrganization();
  await seedSystemRoles();
  await seedLeaveTypes();
  await seedDevAdmin();
  console.log('✅ Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

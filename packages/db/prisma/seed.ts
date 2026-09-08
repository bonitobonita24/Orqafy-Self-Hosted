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
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** Base permission sets for the predefined roles (D-17). Elevated capabilities
 *  such as approve_leave / view_finances are deliberately NOT hardwired here —
 *  they are granted per user or via custom groups. */
const SYSTEM_ROLES: ReadonlyArray<{
  key: SystemRole;
  name: string;
  permissions: Permission[];
}> = [
  {
    key: SystemRole.owner_admin,
    name: 'Owner / Admin',
    permissions: [
      Permission.manage_users,
      Permission.configure_server,
      Permission.create_project,
      Permission.view_finances,
      Permission.manage_finances,
      Permission.approve_leave,
      Permission.manage_files,
      Permission.view_all_projects,
      Permission.export_data,
      Permission.view_audit_log,
    ],
  },
  {
    key: SystemRole.project_manager,
    name: 'Project Manager',
    permissions: [Permission.create_project, Permission.manage_files],
  },
  {
    key: SystemRole.field_staff,
    name: 'Field / Site Staff',
    permissions: [],
  },
  {
    key: SystemRole.accountant,
    name: 'Accountant',
    permissions: [Permission.view_finances, Permission.manage_finances, Permission.export_data],
  },
  {
    key: SystemRole.client,
    name: 'Client',
    permissions: [],
  },
];

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
  for (const role of SYSTEM_ROLES) {
    await prisma.permissionGroup.upsert({
      where: { systemKey: role.key },
      update: { name: role.name, permissions: role.permissions, isSystem: true },
      create: {
        name: role.name,
        permissions: role.permissions,
        isSystem: true,
        systemKey: role.key,
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

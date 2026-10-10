// Org-level DPA settings (D-20 / Rule 33, `.ai_prompt/privacy.md`) — DPO
// contact + retention policy for the single Organization row. Gated behind
// `configure_server`. Never creates an Organization row — that is owned by
// the setup flow (routers/setup.ts); a missing row is NOT_FOUND here.
import { TRPCError } from '@trpc/server';
import { Prisma, getOrganization } from '@orqafy/db';
import { orgSettingsUpdateSchema, retentionSettingsSchema } from '@orqafy/shared';
import { router, permissionProcedure } from '../trpc';
import { writeAudit } from '../audit';

const configureServer = () => permissionProcedure('configure_server');

export const orgRouter = router({
  getSettings: configureServer().query(async ({ ctx }) => {
    const org = await getOrganization(ctx.prisma);
    if (org === null) throw new TRPCError({ code: 'NOT_FOUND' });

    // Stored JSON may predate a schema change / be hand-edited — never throw
    // on a read; surface `null` for that one field instead.
    const parsedRetention = retentionSettingsSchema.safeParse(org.retentionSettings);

    return {
      name: org.name,
      dpoName: org.dpoName,
      dpoContact: org.dpoContact,
      retentionSettings: parsedRetention.success ? parsedRetention.data : null,
      timezone: org.timezone,
    };
  }),

  updateSettings: configureServer()
    .input(orgSettingsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await getOrganization(ctx.prisma);
      if (org === null) throw new TRPCError({ code: 'NOT_FOUND' });

      // `.nullish()` input fields: `undefined` = not provided (omit from the
      // update), `null` = explicitly clear the field. Built up explicitly
      // (rather than via a generic omit-undefined spread) because the Json
      // `retentionSettings` column needs `Prisma.JsonNull`, not plain `null`,
      // to clear it under `exactOptionalPropertyTypes`.
      const data: Prisma.OrganizationUpdateInput = {};
      const changedKeys: string[] = [];
      if (input.dpoName !== undefined) {
        data.dpoName = input.dpoName;
        changedKeys.push('dpoName');
      }
      if (input.dpoContact !== undefined) {
        data.dpoContact = input.dpoContact;
        changedKeys.push('dpoContact');
      }
      if (input.retentionSettings !== undefined) {
        data.retentionSettings =
          input.retentionSettings === null ? Prisma.JsonNull : input.retentionSettings;
        changedKeys.push('retentionSettings');
      }

      const updated = await ctx.prisma.organization.update({
        where: { id: org.id },
        data,
      });

      await writeAudit(ctx.prisma, {
        userId: ctx.userId,
        action: 'org.settings.update',
        targetType: 'organization',
        targetId: org.id,
        metadata: { changedKeys },
      });

      return updated;
    }),
});

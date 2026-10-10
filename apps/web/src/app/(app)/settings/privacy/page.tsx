'use client';

// Settings → Privacy (DPA W7, Rule 33 / `.ai_prompt/privacy.md`). Org-level DPO
// contact + per-category retention days, gated on `configure_server` (mirrors
// the Users & Roles pages — `org.getSettings` doubles as the permission probe,
// so a FORBIDDEN there hides the form while still rendering the page shell).
// No export/erase affordances here — those are the separate Data Subject
// Requests surface; this page is DPO contact + the retention POLICY only.
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import {
  privacySettingsFormSchema,
  RETENTION_CATEGORIES,
  type PrivacySettingsFormValues,
} from '@/components/forms/schema';

const BLANK_RETENTION: PrivacySettingsFormValues['retention'] = {
  audit_log: '',
  notification: '',
  photo: '',
  document: '',
  completed_project: '',
  leave_request: '',
};

const BLANK_DEFAULTS: PrivacySettingsFormValues = {
  dpoName: '',
  dpoContact: '',
  retention: BLANK_RETENTION,
};

/** number|null|undefined (stored day count) → the '' | 'N' string the input shows. */
function daysToField(value: number | null | undefined): string {
  return value === null || value === undefined || value <= 0 ? '' : String(value);
}

export default function PrivacySettingsPage() {
  const utils = trpc.useUtils();
  const settings = trpc.org.getSettings.useQuery(undefined, { retry: false });
  const update = trpc.org.updateSettings.useMutation();

  const forbidden = settings.error?.data?.code === 'FORBIDDEN';
  const notFound = settings.error?.data?.code === 'NOT_FOUND';

  const form = useForm<PrivacySettingsFormValues>({
    resolver: zodResolver(privacySettingsFormSchema),
    defaultValues: BLANK_DEFAULTS,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  // Populate the form once `settings.data` arrives (RHF's static defaultValues
  // only apply on first mount — the query resolves after that).
  useEffect(() => {
    if (settings.data === undefined) return;
    const retention = settings.data.retentionSettings;
    reset({
      dpoName: settings.data.dpoName ?? '',
      dpoContact: settings.data.dpoContact ?? '',
      retention: {
        audit_log: daysToField(retention?.audit_log),
        notification: daysToField(retention?.notification),
        photo: daysToField(retention?.photo),
        document: daysToField(retention?.document),
        completed_project: daysToField(retention?.completed_project),
        leave_request: daysToField(retention?.leave_request),
      },
    });
  }, [settings.data, reset]);

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const saveBannerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    return () => {
      if (saveBannerTimeout.current !== null) clearTimeout(saveBannerTimeout.current);
    };
  }, []);

  async function onSubmit(values: PrivacySettingsFormValues) {
    const retentionSettings: Record<string, number> = {};
    for (const { key } of RETENTION_CATEGORIES) {
      const raw = values.retention[key];
      if (raw !== '') retentionSettings[key] = Number.parseInt(raw, 10);
    }

    await update.mutateAsync({
      dpoName: values.dpoName === '' ? null : values.dpoName,
      dpoContact: values.dpoContact === '' ? null : values.dpoContact,
      retentionSettings,
    });
    await utils.org.getSettings.invalidate();

    setSavedAt(Date.now());
    if (saveBannerTimeout.current !== null) clearTimeout(saveBannerTimeout.current);
    saveBannerTimeout.current = setTimeout(() => setSavedAt(null), 4000);
    // Focus the confirmation so assistive tech announces the save immediately.
    saveStatusRef.current?.focus();
  }

  function onInvalid() {
    // Move focus to the first field with an error so keyboard/AT users land
    // exactly where the fix is needed.
    const firstErrorField = Object.keys(form.formState.errors)[0];
    if (firstErrorField === 'dpoName' || firstErrorField === 'dpoContact') {
      document.getElementById(`privacy-${firstErrorField}`)?.focus();
      return;
    }
    const firstRetentionError = Object.keys(form.formState.errors.retention ?? {})[0];
    if (firstRetentionError !== undefined) {
      document.getElementById(`privacy-retention-${firstRetentionError}`)?.focus();
    }
  }

  if (settings.isPending) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted-foreground">
          Data Protection Officer contact and how long each category of data is kept
          (PH Data Privacy Act, RA 10173).
        </p>
      </div>

      {forbidden ? (
        <p className="text-sm text-destructive">
          You do not have permission to manage privacy settings.
        </p>
      ) : notFound ? (
        <p className="text-sm text-muted-foreground">
          No organization is configured yet. Privacy settings become available once setup is
          complete.
        </p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(onSubmit, onInvalid)(e)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Data Protection Officer</CardTitle>
              <CardDescription>
                Shown to data subjects as the contact for privacy requests and concerns.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormItem>
                <FormLabel htmlFor="privacy-dpoName">DPO name</FormLabel>
                <Input
                  id="privacy-dpoName"
                  autoComplete="off"
                  aria-invalid={errors.dpoName !== undefined}
                  aria-describedby={errors.dpoName !== undefined ? 'privacy-dpoName-error' : undefined}
                  {...register('dpoName')}
                />
                {errors.dpoName ? (
                  <FormMessage id="privacy-dpoName-error">{errors.dpoName.message}</FormMessage>
                ) : null}
              </FormItem>
              <FormItem>
                <FormLabel htmlFor="privacy-dpoContact">DPO contact</FormLabel>
                <Input
                  id="privacy-dpoContact"
                  autoComplete="off"
                  placeholder="email or phone"
                  aria-invalid={errors.dpoContact !== undefined}
                  aria-describedby={
                    errors.dpoContact !== undefined ? 'privacy-dpoContact-error' : undefined
                  }
                  {...register('dpoContact')}
                />
                {errors.dpoContact ? (
                  <FormMessage id="privacy-dpoContact-error">
                    {errors.dpoContact.message}
                  </FormMessage>
                ) : null}
              </FormItem>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Data retention</CardTitle>
              <CardDescription>
                Days to keep each category before automatic deletion. 0 or blank means never
                deleted automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {RETENTION_CATEGORIES.map(({ key, label }) => {
                  const fieldError = errors.retention?.[key];
                  const fieldId = `privacy-retention-${key}`;
                  const errorId = `${fieldId}-error`;
                  return (
                    <FormItem key={key}>
                      <FormLabel htmlFor={fieldId}>{label}</FormLabel>
                      <Input
                        id={fieldId}
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        placeholder="Never"
                        aria-invalid={fieldError !== undefined}
                        aria-describedby={fieldError !== undefined ? errorId : undefined}
                        {...register(`retention.${key}`)}
                      />
                      {fieldError ? <FormMessage id={errorId}>{fieldError.message}</FormMessage> : null}
                    </FormItem>
                  );
                })}
              </div>
              <FormDescription>
                Sensitive personal information and payroll documents are never auto-deleted by
                this policy. The retention job currently runs in report-only (dry-run) mode — it
                reports what it would delete without deleting anything yet.
              </FormDescription>
            </CardContent>
          </Card>

          {update.error ? (
            <p role="alert" className="text-sm text-destructive">
              {update.error.message || 'Something went wrong. Please try again.'}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
            <p
              ref={saveStatusRef}
              tabIndex={-1}
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {savedAt !== null ? 'Saved.' : ''}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

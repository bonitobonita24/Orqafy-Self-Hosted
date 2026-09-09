'use client';

// Create / edit a Document (D-13). CREATE mode uploads bytes to /api/media
// FIRST (server-proxied StorageAdapter — no browser-direct presigned PUT), then
// commits the metadata row via `documents.create`. EDIT mode is metadata-only
// (bytes are immutable; re-upload/revisions are a later chunk). Bound to
// `documentFormSchema` via react-hook-form + zodResolver, mirroring the shipped
// client/project form dialogs. Mobile Ready (DESIGN §6): single-column form.
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { documentCategoryEnum, type DocumentCategory } from '@orqafy/shared';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Dropzone,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';
import { documentFormSchema, type DocumentFormValues, blankToUndef } from './schema';

// Human labels for the 9 document categories (documentCategoryEnum). Keyed by
// the canonical enum value so the two never drift.
const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  invoice: 'Invoice',
  po: 'PO',
  expense: 'Expense',
  receipt: 'Receipt',
  payroll: 'Payroll',
  drawing: 'Drawing',
  permit: 'Permit',
  photo: 'Photo',
  other: 'Other',
};
const DOCUMENT_CATEGORIES = documentCategoryEnum.options;

/** Human label for a document category. Accepts a plain string (list rows type
 * `category` as string) and falls back to the raw key. */
export function documentCategoryLabel(category: string): string {
  return DOCUMENT_CATEGORY_LABELS[category as DocumentCategory] ?? category;
}

// The subset of a documents.list row this dialog reads (edit mode + prefill).
interface DocumentLike {
  id: string;
  name: string;
  category: string;
  projectId: string | null;
  clientId: string | null;
  isSPI: boolean;
}

// Shape of the /api/media upload response.
interface UploadResult {
  storageKey: string;
  size: number;
  mimeType: string;
  name: string;
}

function toDefaults(document?: DocumentLike): DocumentFormValues {
  return {
    name: document?.name ?? '',
    category: (document?.category as DocumentCategory) ?? 'other',
    isSPI: document?.isSPI ?? false,
    projectId: document?.projectId ?? '',
    clientId: document?.clientId ?? '',
  };
}

export function DocumentFormDialog({
  document,
  trigger,
}: {
  document?: DocumentLike;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const isEdit = document !== undefined;
  const utils = trpc.useUtils();

  const projects = trpc.projects.list.useQuery(undefined, { enabled: open });
  const clients = trpc.clients.list.useQuery(undefined, { enabled: open });

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: toDefaults(document),
  });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  // The project/client option lists load async (gated on `open`), so on first
  // render in edit mode react-hook-form applies the saved projectId/clientId
  // before its <option> exists in the DOM — the browser then falls back to
  // "None" and RHF never re-applies. Re-sync the two selects once both lists
  // resolve, so an existing filing is preserved (not silently unset) on save.
  useEffect(() => {
    if (open && isEdit && projects.data !== undefined && clients.data !== undefined) {
      setValue('projectId', document.projectId ?? '');
      setValue('clientId', document.clientId ?? '');
    }
    // Deps are deliberately the stable open/data references (not `document`/
    // `setValue`) so this re-syncs only when the dialog opens or the option
    // lists resolve — never on every render, which would clobber user edits.
  }, [open, isEdit, projects.data, clients.data]);

  const create = trpc.documents.create.useMutation();
  const update = trpc.documents.update.useMutation();
  const mutationError = create.error ?? update.error;

  function onFiles(files: File[]) {
    const picked = files[0];
    if (picked === undefined) return;
    setFile(picked);
    setUploadError(null);
    // Prefill the display name from the filename (full name — extension kept).
    setValue('name', picked.name, { shouldValidate: true });
  }

  async function onSubmit(values: DocumentFormValues) {
    const metadata = {
      name: values.name,
      category: values.category,
      isSPI: values.isSPI,
      projectId: blankToUndef(values.projectId),
      clientId: blankToUndef(values.clientId),
    };

    if (isEdit) {
      await update.mutateAsync({ id: document.id, ...metadata });
    } else {
      if (file === null) {
        setUploadError('Choose a file to upload.');
        return;
      }
      setUploading(true);
      let upload: UploadResult;
      try {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/media', { method: 'POST', body });
        if (!res.ok) {
          const detail = (await res.json().catch(() => null)) as { error?: string } | null;
          setUploadError(detail?.error ?? `Upload failed (${res.status}).`);
          return;
        }
        upload = (await res.json()) as UploadResult;
      } catch {
        setUploadError('Upload failed. Please try again.');
        return;
      } finally {
        setUploading(false);
      }

      await create.mutateAsync({
        ...metadata,
        storageKey: upload.storageKey,
        size: upload.size,
        mimeType: upload.mimeType,
      });
    }

    await Promise.all([
      utils.documents.list.invalidate(),
      utils.documents.unsortedCount.invalidate(),
    ]);
    setOpen(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(toDefaults(document));
    setFile(null);
    setUploadError(null);
    create.reset();
    update.reset();
  }

  const busy = isSubmitting || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit document' : 'Upload document'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this document’s filing details. The file itself stays unchanged.'
              : 'Add a file and its filing details.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
          {isEdit ? null : (
            <FormItem>
              <FormLabel>File</FormLabel>
              <Dropzone
                multiple={false}
                onFiles={onFiles}
                label={file ? file.name : 'Drag a file here or click to browse'}
              />
              {uploadError ? <FormMessage>{uploadError}</FormMessage> : null}
            </FormItem>
          )}

          <FormItem>
            <FormLabel htmlFor="document-name">Name</FormLabel>
            <Input id="document-name" {...register('name')} />
            {errors.name ? <FormMessage>{errors.name.message}</FormMessage> : null}
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="document-category">Category</FormLabel>
            <Select id="document-category" {...register('category')}>
              {DOCUMENT_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {DOCUMENT_CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
            {errors.category ? <FormMessage>{errors.category.message}</FormMessage> : null}
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="document-project">Project</FormLabel>
            <Select id="document-project" {...register('projectId')}>
              <option value="">None</option>
              {projects.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </FormItem>

          <FormItem>
            <FormLabel htmlFor="document-client">Client</FormLabel>
            <Select id="document-client" {...register('clientId')}>
              <option value="">None</option>
              {clients.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormItem>

          <FormItem>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox {...register('isSPI')} />
              Sensitive / finance-restricted
            </label>
          </FormItem>

          {mutationError ? (
            <p className="text-sm text-destructive">
              {mutationError.message || 'Something went wrong. Please try again.'}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {uploading
                ? 'Uploading…'
                : isSubmitting
                  ? 'Saving…'
                  : isEdit
                    ? 'Save changes'
                    : 'Upload document'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

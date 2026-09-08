// Kibo UI Dropzone wrapper (DESIGN §4 — file dropzone themed to Orqafy tokens).
// STUB: typed props + a themed drop target. TODO(part-5): drop in the Kibo UI
// dropzone registry component (MIT) and wire uploads to @orqafy/storage
// presigned URLs. No AdminCN / paid-slice code (D-26).
import { UploadCloud } from 'lucide-react';
import { useCallback, type ChangeEvent, type DragEvent } from 'react';

import { cn } from '../../lib/utils';

export interface DropzoneProps {
  /** Called with the selected/dropped files. */
  onFiles?: (files: File[]) => void;
  /** `accept` attribute for the fallback file input. */
  accept?: string;
  multiple?: boolean;
  label?: string;
  className?: string;
}

export function Dropzone({
  onFiles,
  accept,
  multiple = true,
  label = 'Drag files here or click to browse',
  className,
}: DropzoneProps) {
  const emit = useCallback(
    (list: FileList | null) => {
      if (list === null || onFiles === undefined) {
        return;
      }
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLLabelElement>) => {
      event.preventDefault();
      emit(event.dataTransfer.files);
    },
    [emit],
  );

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      emit(event.target.files);
    },
    [emit],
  );

  return (
    <label
      data-slot="dropzone"
      onDrop={onDrop}
      onDragOver={(event) => event.preventDefault()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted/20 p-8 text-center transition-colors hover:bg-muted/40',
        className,
      )}
    >
      <UploadCloud className="size-6 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <input
        type="file"
        className="sr-only"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
      />
    </label>
  );
}

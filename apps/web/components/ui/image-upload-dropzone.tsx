'use client';

import type { ChangeEvent } from 'react';

interface ImageUploadDropzoneProps {
  inputId: string;
  title: string;
  actionText: string;
  description?: string;
  helperText?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function ImageUploadDropzone({
  inputId,
  title,
  actionText,
  description,
  helperText,
  accept = 'image/*',
  multiple = false,
  disabled = false,
  onChange
}: ImageUploadDropzoneProps) {
  return (
    <label
      htmlFor={inputId}
      className={`block rounded-xl border border-dashed px-4 py-5 transition ${
        disabled
          ? 'cursor-not-allowed border-neutral-200 bg-neutral-100'
          : 'cursor-pointer border-neutral-300 bg-neutral-50 hover:border-neutral-400 hover:bg-white'
      }`}
    >
      <input
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <span className="inline-flex rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
        {actionText}
      </span>
      <p className="mt-3 text-sm font-medium text-neutral-800">{title}</p>
      {description ? <p className="mt-1 text-xs text-neutral-500">{description}</p> : null}
      {helperText ? <p className="mt-1 text-xs text-neutral-500">{helperText}</p> : null}
    </label>
  );
}

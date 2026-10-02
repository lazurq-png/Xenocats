'use client';

import { TrashIcon } from '@heroicons/react/20/solid';
import { unstable_rethrow } from 'next/navigation';
import { useId, useRef, useState, useTransition } from 'react';
import { deleteInvoice, deleteInvoiceAndReturn } from '@/app/lib/actions';

/**
 * The trash button, and the dialog that asks before deleting. A native modal
 * <dialog>: the page behind it is inert, Esc cancels, and closing it puts focus
 * back on the button that opened it. Tab and Shift+Tab also stay inside it.
 */
export function DeleteInvoice({
  id,
  label,
  fromDetailPage = false,
}: {
  id: string;
  /** What is being deleted, e.g. "invoice for Evil Rabbit, $666.00". */
  label: string;
  /** On the invoice's own page: once deleted, go to the list (the page is gone). */
  fromDetailPage?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setError(null);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const confirm = () =>
    startTransition(async () => {
      try {
        // From the detail page the action itself redirects to the list.
        await (fromDetailPage ? deleteInvoiceAndReturn : deleteInvoice)(id);
      } catch (error) {
        // The detail page's redirect arrives here as a thrown error: let Next
        // follow it rather than report a delete that succeeded as a failure.
        unstable_rethrow(error);
        setError('The invoice could not be deleted. Please try again.');
        return;
      }
      close();
      // The row, its button and this dialog are gone: give focus a place to land.
      document.getElementById('search')?.focus();
    });

  // While deleting, the dialog stays open, so a failure can still be shown.
  const onCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
    if (pending) event.preventDefault();
  };

  // Keep Tab and Shift+Tab on the dialog's own buttons.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Tab') return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
    );
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-red-400 hover:text-red-400"
      >
        <span className="sr-only">Delete {label}</span>
        <TrashIcon className="w-5" />
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={onKeyDown}
        onCancel={onCancel}
        data-testid="delete-invoice-dialog"
        className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-6 text-left text-white backdrop:bg-void/80"
      >
        <h2 id={titleId} className="font-display text-lg font-semibold text-cream">
          Delete this invoice?
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-aura">
          The {label} will be deleted. This cannot be undone.
        </p>
        <div aria-live="polite">
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          {/* The safe choice has the focus when the dialog opens. */}
          <button
            type="button"
            autoFocus
            onClick={close}
            disabled={pending}
            className="flex h-10 items-center rounded-xl border border-line px-4 text-sm font-medium text-aura transition-colors hover:bg-void hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="flex h-10 items-center rounded-xl bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
          >
            {pending ? 'Deleting…' : 'Delete invoice'}
          </button>
        </div>
      </dialog>
    </>
  );
}

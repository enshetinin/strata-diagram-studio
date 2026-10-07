import { type ReactNode, useEffect, useRef } from 'react';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
  wide?: boolean;
}

/** Native modal <dialog>: focus trapping, Escape and inert background for free. */
export function Dialog({ open, title, onClose, children, actions, wide = false }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' dialog--wide' : ''}`}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open ? (
        <>
          <h2 id="dialog-title" className="dialog__title">
            {title}
          </h2>
          <div className="dialog__body">{children}</div>
          <div className="dialog__actions">{actions}</div>
        </>
      ) : null}
    </dialog>
  );
}

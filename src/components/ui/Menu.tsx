import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  hint?: string;
  onSelect: () => void;
}

/**
 * Menu button with arrow-key navigation and Escape to close. `compact`
 * renders an icon-only trigger (label as accessible name and tooltip) whose
 * list opens towards the right.
 */
export function Menu({ label, icon, items, compact = false }: { label: string; icon: ReactNode; items: MenuItem[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const entries = [...(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = entries.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      setOpen(false);
      button.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      entries[(index + 1) % entries.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      entries[(index - 1 + entries.length) % entries.length]?.focus();
    }
  };

  return (
    <div className="menu" ref={root} onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        className={compact ? 'icon-button icon-button--small' : 'button'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={compact ? label : undefined}
        title={compact ? label : undefined}
        onClick={() => setOpen(!open)}
      >
        {icon}
        {compact ? null : <span>{label}</span>}
      </button>
      {open ? (
        <div className={`menu__list${compact ? ' menu__list--start' : ''}`} role="menu" id={id} aria-label={label}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu__item"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              <span>{item.label}</span>
              {item.hint ? <span className="menu__hint">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

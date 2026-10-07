import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

export interface MenuItem {
  label: string;
  hint?: string;
  icon?: ReactNode;
  onSelect: () => void;
}

/**
 * Menu button with arrow-key navigation and Escape to close. `compact`
 * renders an icon-only trigger (label as accessible name and tooltip);
 * `align="start"` opens the list towards the right of the trigger.
 */
export function Menu({
  label,
  icon,
  items,
  compact = false,
  align = 'end',
  className = 'button',
}: {
  label: string;
  icon: ReactNode;
  items: MenuItem[];
  compact?: boolean;
  align?: 'start' | 'end';
  /** Trigger class for labelled menus. */
  className?: string;
}) {
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
        className={compact ? 'icon-button icon-button--small' : className}
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
        <div
          className={`menu__list${align === 'start' ? ' menu__list--start' : ''}`}
          role="menu"
          id={id}
          aria-label={label}
        >
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
              <span className="menu__label">
                {item.icon}
                {item.label}
              </span>
              {item.hint ? <span className="menu__hint">{item.hint}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  icon: LucideIcon;
  /** Renders as a toggle with aria-pressed. */
  pressed?: boolean;
  /** Shows the label next to the icon. */
  showLabel?: boolean;
}

/** Icon button whose accessible name is always the visible or tooltip label. */
export function IconButton({ label, icon: Icon, pressed, showLabel = false, className = '', ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-button${showLabel ? ' icon-button--labelled' : ''} ${className}`}
      aria-label={showLabel ? undefined : label}
      title={label}
      {...(pressed !== undefined ? { 'aria-pressed': pressed } : {})}
      {...rest}
    >
      <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}

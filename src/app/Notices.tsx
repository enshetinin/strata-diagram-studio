import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useUiStore } from '../state/uiStore';

const LIFETIME_MS = 6_000;
/** Notices that offer an action stay long enough to use it. */
const ACTION_LIFETIME_MS = 12_000;

export function Notices() {
  const notices = useUiStore((state) => state.notices);
  const dismiss = useUiStore((state) => state.dismiss);
  useEffect(() => {
    if (notices.length === 0) return;
    const oldest = notices[0];
    const timer = setTimeout(() => oldest && dismiss(oldest.id), oldest?.action ? ACTION_LIFETIME_MS : LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [notices, dismiss]);
  return (
    <div className="notices" role="status" aria-live="polite">
      {notices.map((notice) => (
        <p key={notice.id} className={`notice notice--${notice.tone}`}>
          <span>{notice.text}</span>
          {notice.action ? (
            <button
              type="button"
              className="link-button notice__action"
              onClick={() => {
                notice.action?.run();
                dismiss(notice.id);
              }}
            >
              {notice.action.label}
            </button>
          ) : null}
          <button type="button" className="notice__close" aria-label="Cerrar aviso" onClick={() => dismiss(notice.id)}>
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      ))}
    </div>
  );
}

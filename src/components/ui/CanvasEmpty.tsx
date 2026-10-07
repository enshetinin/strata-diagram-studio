/** Empty-diagram guidance laid over a canvas; only the action takes pointer events. */
export function CanvasEmpty({ title, text, action }: { title: string; text: string; action: { label: string; onClick: () => void } }) {
  return (
    <div className="canvas-empty" role="note">
      <p className="eyebrow">Diagrama vacío</p>
      <h2>{title}</h2>
      <p>{text}</p>
      <button type="button" className="button button--primary" onClick={action.onClick}>
        {action.label}
        <span className="button__arrow" aria-hidden="true">
          →
        </span>
      </button>
    </div>
  );
}

import { Component, lazy, Suspense, type ReactNode } from 'react';
import { FluidLines } from '../components/ui/FluidLines';
import { useUiStore } from '../state/uiStore';
import { ExportPngDialog } from './ExportPngDialog';
import { GenerationPreviewDialog } from './GenerationPreviewDialog';
import { GroupDeleteDialog } from './GroupDeleteDialog';
import { ImportErrorDialog } from './ImportErrorDialog';
import { Notices } from './Notices';
import { LeftPanel, RightPanel } from './SidePanels';
import { TopBar } from './TopBar';
import { useClipboard } from './useClipboard';
import { useShortcuts } from './useShortcuts';

const Viewer3D = lazy(() => import('../features/viewer3d/Viewer3D'));
const Editor2D = lazy(() => import('../features/editor2d/Editor2D'));

class ViewBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="viewer-state" role="alert">
        <FluidLines />
        <p className="eyebrow">Error de vista</p>
        <h2>La vista no pudo mostrarse</h2>
        <p>{this.state.error.message}. El documento sigue intacto; cambia de vista o recarga.</p>
      </div>
    );
  }
}

function Loading({ label }: { label: string }) {
  return (
    <div className="viewer-state viewer-state--loading" role="status">
      <FluidLines />
      <p className="eyebrow">{label}</p>
    </div>
  );
}

export function App() {
  const mode = useUiStore((state) => state.mode);
  const leftOpen = useUiStore((state) => state.leftOpen);
  const rightOpen = useUiStore((state) => state.rightOpen);
  const presenting = useUiStore((state) => state.presenting);
  useShortcuts();
  useClipboard();

  const showLeft = leftOpen && !presenting;
  const showRight = rightOpen && !presenting;

  return (
    <div className="app" data-left={showLeft} data-right={showRight} data-presenting={presenting}>
      <a className="skip-link" href="#stage">
        Saltar al lienzo
      </a>
      {!presenting ? <TopBar /> : null}
      {showLeft ? <LeftPanel /> : null}
      <main id="stage" className="stage" aria-label={mode === '3d' ? 'Vista 3D' : 'Editor 2D'} data-mode={mode}>
        <ViewBoundary resetKey={mode}>
          <Suspense fallback={<Loading label={mode === '3d' ? 'Cargando escena 3D…' : 'Cargando editor 2D…'} />}>{mode === '3d' ? <Viewer3D /> : <Editor2D />}</Suspense>
        </ViewBoundary>
      </main>
      {showRight ? <RightPanel /> : null}
      <Notices />
      <GroupDeleteDialog />
      <ImportErrorDialog />
      <GenerationPreviewDialog />
      <ExportPngDialog />
    </div>
  );
}

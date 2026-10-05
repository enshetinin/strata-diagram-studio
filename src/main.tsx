import '@fontsource/figtree/300.css';
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/editor2d.css';
import './styles/viewer.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { bootstrap } from './app/bootstrap';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Load the document (URL, autosave or default) before the first render.
bootstrap();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

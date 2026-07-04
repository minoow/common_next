import React from 'react';
import { createRoot } from 'react-dom/client';
import { setupWorker } from 'msw/browser';
import { App } from './App';
import { startMockServer } from '../../shared/mock/browser';
import { handlers } from './mockApi';
import './styles.css';

async function bootstrap() {
  await startMockServer(setupWorker(...handlers));

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();

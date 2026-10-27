import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/dm-sans';
import '@fontsource/dm-mono/400.css';
import './styles.css';
createRoot(document.getElementById('root')!).render(<App />);

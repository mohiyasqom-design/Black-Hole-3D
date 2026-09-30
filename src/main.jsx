import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.jsx';
import './ui/styles.css';

// No StrictMode: the WebGL engine is a long-lived imperative object and
// should be created exactly once.
createRoot(document.getElementById('root')).render(<App />);

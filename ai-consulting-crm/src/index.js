import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Your main application component
import './index.css'; // Import your global CSS for Tailwind

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

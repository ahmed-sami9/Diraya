import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './context/AuthContext.tsx';
import App from './App.tsx';
import GoogleProvider from './context/GoogleProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </GoogleProvider>
  </StrictMode>
);

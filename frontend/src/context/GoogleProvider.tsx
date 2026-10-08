import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactNode } from 'react';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!clientId) {
  throw new Error('VITE_GOOGLE_CLIENT_ID is missing.');
}

type GoogleProviderProps = {
  children: ReactNode;
};

export default function GoogleProvider({ children }: GoogleProviderProps) {
  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
}

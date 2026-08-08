import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { AuthProvider } from '@/context/AuthContext';
import { getInitialUser } from '@/lib/auth-server';

export const metadata: Metadata = {
  title: {
    default: 'Avertra Blog',
    template: '%s | Avertra Blog',
  },
  description: 'A full-stack blogging platform',
};

async function AuthedApp({ children }: { children: React.ReactNode }) {
  const initialUser = await getInitialUser();

  return (
    <AuthProvider initialUser={initialUser}>
      <Navbar />
      {children}
    </AuthProvider>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <Suspense fallback={null}>
          <AuthedApp>{children}</AuthedApp>
        </Suspense>
      </body>
    </html>
  );
}

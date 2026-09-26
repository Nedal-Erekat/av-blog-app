import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { WebMcpTools } from '@/components/WebMcpTools';
import { AuthProvider } from '@/context/AuthContext';
import { BlogActionsProvider } from '@/context/BlogActionsContext';
import { getOptionalUser } from '@/lib/dal';

export const metadata: Metadata = {
  title: {
    default: 'Avertra Blog',
    template: '%s | Avertra Blog',
  },
  description: 'A full-stack blogging platform',
};

async function AuthedApp({ children }: { children: React.ReactNode }) {
  const initialUser = await getOptionalUser();

  return (
    <AuthProvider initialUser={initialUser}>
      <BlogActionsProvider>
        <WebMcpTools />
        <Navbar />
        {children}
      </BlogActionsProvider>
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

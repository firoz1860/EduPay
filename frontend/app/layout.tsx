import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'EduPay — Fee Collection & Reconciliation Platform',
  description: 'Production-ready fee collection, payment processing, and reconciliation platform for educational institutions.',
  openGraph: {
    title: 'EduPay — Fee Collection & Reconciliation Platform',
    description: 'Production-ready fee collection, payment processing, and reconciliation platform for educational institutions.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

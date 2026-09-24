import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { RealtimeProvider } from '@/providers/realtime-provider';
import { AIConfigProvider } from '@/providers/ai-config-provider';
import { AiSetupModal } from '@/components/ai/ai-setup-modal';
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
        <QueryProvider>
          <AuthProvider>
            <RealtimeProvider>
              <AIConfigProvider>
                {children}
                <AiSetupModal />
                <Toaster />
              </AIConfigProvider>
            </RealtimeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

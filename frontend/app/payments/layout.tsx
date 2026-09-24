'use client';

import { AppShell } from '@/components/layout/app-shell';

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

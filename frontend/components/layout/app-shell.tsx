'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useAIConfig } from '@/providers/ai-config-provider';
import { SidebarNav } from './sidebar-nav';
import { MobileNav } from './mobile-nav';
import { UserMenu } from './user-menu';
import { GraduationCap, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const AI_ROLES = ['ACCOUNTANT', 'FINANCE_MANAGER', 'ADMIN', 'AUDITOR'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { ready, dismissed, openSetup } = useAIConfig();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // After login, prompt AI setup once for AI-capable roles that haven't configured
  // a provider this session and haven't chosen to continue without AI.
  useEffect(() => {
    if (!loading && user && !ready && !dismissed && AI_ROLES.includes(user.role)) {
      openSetup();
    }
  }, [loading, user, ready, dismissed, openSetup]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">EduPay</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">
            Fee Collection &amp; Reconciliation
          </p>
          <p className="text-xs text-muted-foreground">v1.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <MobileNav />
            <div className="lg:hidden">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <GraduationCap className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold">EduPay</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
            </Button>
            <UserMenu />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  Building2,
  FileText,
  CreditCard,
  RefreshCw,
  Receipt,
  BookOpen,
  Brain,
  BarChart3,
  Settings,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Students', href: '/students', icon: GraduationCap, roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'AUDITOR'] },
  { label: 'Departments', href: '/departments', icon: Building2, roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER'] },
  { label: 'Fee Structures', href: '/fees', icon: BookOpen, roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE_MANAGER', 'AUDITOR'] },
  { label: 'Invoices', href: '/invoices', icon: FileText },
  { label: 'Payments', href: '/payments', icon: CreditCard },
  { label: 'Reconciliation', href: '/reconciliation', icon: RefreshCw, roles: ['ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AUDITOR'] },
  { label: 'Refunds', href: '/refunds', icon: Receipt, roles: ['ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AUDITOR'] },
  { label: 'Reports', href: '/reports', icon: BarChart3, roles: ['ADMIN', 'FINANCE_MANAGER', 'AUDITOR'] },
  { label: 'AI Insights', href: '/ai-insights', icon: Brain, roles: ['ADMIN', 'FINANCE_MANAGER', 'ACCOUNTANT', 'AUDITOR'] },
  { label: 'Audit Logs', href: '/audit-logs', icon: Shield, roles: ['ADMIN', 'AUDITOR'] },
  { label: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN'] },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role))
  );

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

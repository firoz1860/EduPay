'use client';

import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, ApiError } from '@/lib/api';
import { ROLE_LABELS, ROLE_COLORS, DEMO_CREDENTIALS } from '@/lib/constants';
import { useAuth } from '@/providers/auth-provider';
import { useQuery } from '@tanstack/react-query';
import type { AuthUser } from '@/types';
import { Users, Shield, KeyRound, Mail, IdCard } from 'lucide-react';

interface SettingsUser {
  id: string;
  email: string;
  fullName: string;
  role: AuthUser['role'];
  isActive: boolean;
}

export default function SettingsPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');

  const { data: users, isLoading: loadingUsers, isError, error } = useQuery({
    queryKey: ['users', 'settings'],
    queryFn: async () => (await api.get<SettingsUser[]>('/users', { pageSize: 100 })).data,
    enabled: isAdmin,
  });

  const initials = user?.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="System configuration and user management" />

      {/* Current user */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <IdCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Your Account</CardTitle>
              <CardDescription>Signed in as</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{user.fullName}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
          ) : (
            <Skeleton className="h-12 w-64" />
          )}
        </CardContent>
      </Card>

      {/* User Management (ADMIN only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">User Management</CardTitle>
                <CardDescription>System users and their roles</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <Skeleton className="h-48 w-full" />
            ) : isError ? (
              <p className="text-sm text-rose-600">
                {error instanceof ApiError ? error.message : 'Failed to load users.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(users || []).map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.fullName}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role]}`}>
                          {ROLE_LABELS[u.role]}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!users || users.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Demo Credentials */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Demo Credentials</CardTitle>
              <CardDescription>Sign in as any role to explore the platform</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_CREDENTIALS.map((cred) => (
              <div key={cred.email} className="rounded-lg border p-3">
                <p className="font-medium">{cred.role}</p>
                <p className="font-mono text-xs text-muted-foreground">{cred.email}</p>
                <p className="font-mono text-xs text-muted-foreground">{cred.password}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-base">System Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-medium">EduPay v1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Database</span>
            <span className="font-medium">PostgreSQL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">API</span>
            <span className="font-medium">Express + Prisma</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">AI Provider</span>
            <span className="font-medium">Deterministic (backend-verified)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Architecture</span>
            <span className="font-medium">Modular Monolith</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

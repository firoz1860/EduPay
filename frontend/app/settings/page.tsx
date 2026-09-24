'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/constants';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, Shield, Building2, CreditCard } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface DeptRow {
  id: string;
  name: string;
  code: string;
}

interface FeeHeadRow {
  id: string;
  name: string;
  code: string;
  is_optional: boolean;
}

export default function SettingsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [feeHeads, setFeeHeads] = useState<FeeHeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [
        { data: userData },
        { data: deptData },
        { data: feeHeadData },
      ] = await Promise.all([
        supabase.from('users').select('id, email, full_name, role, is_active').order('role', { ascending: true }),
        supabase.from('departments').select('id, name, code').order('name'),
        supabase.from('fee_heads').select('id, name, code, is_optional').order('name'),
      ]);
      setUsers((userData || []) as UserRow[]);
      setDepts((deptData || []) as DeptRow[]);
      setFeeHeads((feeHeadData || []) as FeeHeadRow[]);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Settings" description="System configuration and user management" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="System configuration and user management" />

      {/* Users */}
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
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_COLORS[u.role as keyof typeof ROLE_COLORS]}`}>
                      {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Departments */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Departments</CardTitle>
              <CardDescription>Academic departments</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {depts.map((d) => (
              <div key={d.id} className="rounded-lg border p-3">
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.code}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fee Heads */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Fee Heads</CardTitle>
              <CardDescription>Types of fees charged to students</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {feeHeads.map((fh) => (
              <div key={fh.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{fh.name}</p>
                  {fh.is_optional && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Optional</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{fh.code}</p>
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
            <span className="font-medium">PostgreSQL (Supabase)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment Provider</span>
            <span className="font-medium">Stripe (Test Mode)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">AI Provider</span>
            <span className="font-medium">Built-in (Deterministic)</span>
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

'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/constants';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BookOpen } from 'lucide-react';

interface FeeStructureWithRelations {
  id: string;
  name: string;
  academic_year: string;
  semester: number;
  total_amount: number;
  status: string;
  department: { name: string } | null;
  course: { name: string } | null;
  items: { fee_head_id: string; amount: number; discount_amount: number; fee_head: { name: string } | null }[];
}

export default function FeesPage() {
  const [structures, setStructures] = useState<FeeStructureWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFees() {
      const { data } = await supabase
        .from('fee_structures')
        .select(`
          id, name, academic_year, semester, total_amount, status,
          department:departments(name),
          course:courses(name),
          items:fee_structure_items(fee_head_id, amount, discount_amount, fee_head:fee_heads(name))
        `)
        .order('created_at', { ascending: false });
      setStructures((data || []) as unknown as FeeStructureWithRelations[]);
      setLoading(false);
    }
    fetchFees();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fee Structures" description="Manage fee structures and fee heads" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Fee Structures" description="Manage fee structures and fee heads" />

      <div className="space-y-4">
        {structures.map((fs) => (
          <Card key={fs.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{fs.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {fs.department?.name || 'All departments'} • {fs.course?.name || 'All courses'} • {fs.academic_year} • Sem {fs.semester}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{formatCurrency(Number(fs.total_amount))}</p>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    {fs.status}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fee Head</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fs.items?.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.fee_head?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(item.amount))}</TableCell>
                      <TableCell className="text-right text-emerald-600">
                        {Number(item.discount_amount) > 0 ? `-${formatCurrency(Number(item.discount_amount))}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(Number(item.amount) - Number(item.discount_amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

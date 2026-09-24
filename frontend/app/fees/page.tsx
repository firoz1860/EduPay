'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/constants';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { FeeStructure } from '@/types';
import { BookOpen } from 'lucide-react';

export default function FeesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fee-structures'],
    queryFn: () => api.get<FeeStructure[]>('/fee-structures', { pageSize: 100 }),
  });

  const structures = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fee Structures" description="Manage fee structures and fee heads" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fee Structures" description="Manage fee structures and fee heads" />
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Failed to load fee structures. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Fee Structures" description="Manage fee structures and fee heads" />

      {structures.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">No fee structures found</div>
      ) : (
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
                        {fs.department?.name || 'All departments'} • {fs.course?.name || 'All courses'} • {fs.academicYear} • Sem {fs.semester}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(Number(fs.totalAmount))}</p>
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
                    {fs.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.feeHead?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(item.amount))}</TableCell>
                        <TableCell className="text-right text-emerald-600">
                          {Number(item.discountAmount) > 0 ? (
                            <>
                              -{formatCurrency(Number(item.discountAmount))}
                              {item.discountLabel && (
                                <span className="ml-1 text-xs text-muted-foreground">({item.discountLabel})</span>
                              )}
                            </>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(item.amount) - Number(item.discountAmount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

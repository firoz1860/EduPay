'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/lib/supabase';
import { STUDENT_STATUS_COLORS, STUDENT_STATUS_LABELS, formatCurrency } from '@/lib/constants';
import type { Student } from '@/types';
import { Search, ChevronRight } from 'lucide-react';

export default function StudentsPage() {
  const [students, setStudents] = useState<(Student & {
    department: { name: string } | null;
    course: { name: string } | null;
  })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchStudents() {
      const { data } = await supabase
        .from('students')
        .select(`
          *,
          department:departments(name),
          course:courses(name)
        `)
        .order('created_at', { ascending: false });
      setStudents((data || []) as unknown as typeof students);
      setLoading(false);
    }
    fetchStudents();
  }, []);

  const filtered = students.filter((s) =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.roll_number.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Students" description="Manage student records" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="Manage student records" />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, roll number, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Roll Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Semester</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((student) => (
              <TableRow key={student.id}>
                <TableCell className="font-mono text-sm">{student.roll_number}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{student.full_name}</p>
                    <p className="text-xs text-muted-foreground">{student.email}</p>
                  </div>
                </TableCell>
                <TableCell>{student.department?.name || '-'}</TableCell>
                <TableCell>{student.course?.name || '-'}</TableCell>
                <TableCell>Sem {student.semester}</TableCell>
                <TableCell>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STUDENT_STATUS_COLORS[student.status]}`}>
                    {STUDENT_STATUS_LABELS[student.status]}
                  </span>
                </TableCell>
                <TableCell>
                  <Link href={`/students/${student.id}`}>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {filtered.map((student) => (
          <Link key={student.id} href={`/students/${student.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{student.full_name}</p>
                    <p className="text-xs text-muted-foreground">{student.roll_number}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STUDENT_STATUS_COLORS[student.status]}`}>
                    {STUDENT_STATUS_LABELS[student.status]}
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span>{student.department?.name || '-'}</span>
                  <span>Sem {student.semester}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-12 text-center text-sm text-muted-foreground">No students found</div>
      )}
    </div>
  );
}

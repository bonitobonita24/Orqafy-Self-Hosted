'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@orqafy/ui';
import { trpc } from '@/trpc/react';

// Keyed by Prisma-native ProjectStatus values (`on_hold`).
const STATUS_TONE: Record<string, string> = {
  planning: 'text-muted-foreground',
  active: 'text-primary',
  on_hold: 'text-warning',
  completed: 'text-success',
  cancelled: 'text-destructive',
};

export default function ProjectsPage() {
  const projects = trpc.projects.list.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">All projects across your clients.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tasks</TableHead>
                <TableHead className="text-right">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.data?.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                      {project.name}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {project.code}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project.client.name}</TableCell>
                  <TableCell>
                    <span className={STATUS_TONE[project.status] ?? 'text-muted-foreground'}>
                      {project.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{project._count.tasks}</TableCell>
                  <TableCell className="text-right font-mono">{project.progressPct}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {projects.data?.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No projects yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

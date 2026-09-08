'use client';

// Clients admin (DESIGN §6: Mobile Ready). List + create/edit via the form
// dialogs, wired to the clients.* tRPC procedures.
import { Plus, Pencil } from 'lucide-react';
import {
  Button,
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
import { ClientFormDialog } from '@/components/forms/client-form';

export default function ClientsPage() {
  const clients = trpc.clients.list.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">The organisations you run projects for.</p>
        </div>
        <ClientFormDialog
          trigger={
            <Button>
              <Plus /> New client
            </Button>
          }
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Projects</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.data?.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {client.contactPerson ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.email ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono">{client._count.projects}</TableCell>
                  <TableCell className="text-right">
                    <ClientFormDialog
                      client={client}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Edit ${client.name}`}>
                          <Pencil />
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {clients.data?.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No clients yet. Add your first client to start a project.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

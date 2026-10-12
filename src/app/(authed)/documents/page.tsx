import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, FilePlus } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { canManageDocuments } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  { code: 'CONSTITUTION', label: 'Constitution' },
  { code: 'MEETING_MINUTES', label: 'Meeting Minutes' },
  { code: 'AUDIT_REPORT', label: 'Audit Reports' },
  { code: 'LAND_DEED', label: 'Land Deeds' },
  { code: 'BUSINESS_CONTRACT', label: 'Business Contracts' },
  { code: 'ANNUAL_REPORT', label: 'Annual Reports' },
  { code: 'POLICY', label: 'Policies' },
  { code: 'OTHER', label: 'Other' },
];

export default async function DocumentsPage() {
  const user = await requireUser();
  const role = user.role;

  const docs = await prisma.document.findMany({
    where: role === 'MEMBER' ? { accessLevel: { in: ['PUBLIC', 'MEMBER'] } } : {},
    orderBy: { createdAt: 'desc' },
  });

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    docs: docs.filter((d) => d.category === c.code),
  })).filter((g) => g.docs.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">Constitution, minutes, reports, and agreements</p>
        </div>
        {canManageDocuments(role) && (
          <Button asChild>
            <Link href="/documents/upload"><FilePlus className="h-4 w-4 mr-1" /> Upload</Link>
          </Button>
        )}
      </div>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground mt-2">No documents available.</p>
          </CardContent>
        </Card>
      ) : (
        grouped.map((g) => (
          <Card key={g.code}>
            <CardHeader>
              <CardTitle className="text-base">{g.label}</CardTitle>
              <CardDescription>{g.docs.length} document{g.docs.length === 1 ? '' : 's'}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {g.docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-muted">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(d.createdAt)} · {(d.fileSize / 1024).toFixed(0)} KB
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline">{d.accessLevel}</Badge>
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noopener"
                        className="text-sm text-navy-700 hover:underline"
                      >
                        Open
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

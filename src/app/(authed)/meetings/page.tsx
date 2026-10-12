import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { canPostMinutes } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function MeetingsPage() {
  const user = await requireUser();

  const upcoming = await prisma.meeting.findMany({
    where: { scheduledAt: { gte: new Date() }, status: 'SCHEDULED' },
    orderBy: { scheduledAt: 'asc' },
  });

  const past = await prisma.meeting.findMany({
    where: { OR: [{ scheduledAt: { lt: new Date() } }, { status: 'COMPLETED' }] },
    orderBy: { scheduledAt: 'desc' },
    take: 20,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Meetings</h1>
          <p className="text-sm text-muted-foreground mt-1">Monthly meetings, AGM, and special sessions</p>
        </div>
        {canPostMinutes(user.role) && (
          <Button asChild>
            <Link href="/meetings/new"><Plus className="h-4 w-4 mr-1" /> Schedule meeting</Link>
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming meetings scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((m) => (
                <li key={m.id} className="flex items-start gap-3 p-3 border rounded-md">
                  <Calendar className="h-5 w-5 mt-0.5 text-navy-700" />
                  <div className="flex-1">
                    <div className="font-semibold">{m.title}</div>
                    <div className="text-sm text-muted-foreground">{formatDate(m.scheduledAt)} · {m.venue}</div>
                    {m.agenda && (
                      <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{m.agenda}</div>
                    )}
                  </div>
                  <Badge variant="outline">{m.type}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Past meetings</CardTitle>
          <CardDescription>Minutes and recorded outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past meetings.</p>
          ) : (
            <ul className="space-y-3">
              {past.map((m) => (
                <li key={m.id} className="flex items-start gap-3 p-3 border rounded-md">
                  <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-semibold">{m.title}</div>
                    <div className="text-sm text-muted-foreground">{formatDate(m.scheduledAt)} · {m.venue}</div>
                    {m.minutes && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.minutes}</div>
                    )}
                  </div>
                  <Badge variant={m.status === 'COMPLETED' ? 'success' : 'secondary'}>{m.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

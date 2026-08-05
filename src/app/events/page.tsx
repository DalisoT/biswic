import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency, toNumber } from '@/lib/utils';
import { Calendar, Heart } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const user = await requireUser();

  const now = new Date();
  const upcomingEvents = await prisma.event.findMany({
    where: { startAt: { gte: now } },
    orderBy: { startAt: 'asc' },
  });
  const pastEvents = await prisma.event.findMany({
    where: { startAt: { lt: now } },
    orderBy: { startAt: 'desc' },
    take: 10,
  });
  const charityProjects = await prisma.charityProject.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Events & Charity</h1>
        <p className="text-sm text-muted-foreground mt-1">Meetings, social events, and community projects</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upcoming events</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="p-3 border rounded-md">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 mt-0.5 text-gold-600" />
                    <div className="flex-1">
                      <div className="font-semibold">{e.title}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(e.startAt)} · {e.venue}</div>
                      <p className="text-xs text-muted-foreground mt-1">{e.description}</p>
                    </div>
                    <Badge variant="gold">{e.type}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Past events</CardTitle>
        </CardHeader>
        <CardContent>
          {pastEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No past events.</p>
          ) : (
            <ul className="space-y-3">
              {pastEvents.map((e) => (
                <li key={e.id} className="p-3 border rounded-md">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-semibold">{e.title}</div>
                      <div className="text-sm text-muted-foreground">{formatDate(e.startAt)} · {e.venue}</div>
                      {e.report && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.report}</p>
                      )}
                    </div>
                    <Badge variant="secondary">{e.type}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Charity projects
          </CardTitle>
        </CardHeader>
        <CardContent>
          {charityProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No charity projects yet.</p>
          ) : (
            <ul className="space-y-3">
              {charityProjects.map((c) => (
                <li key={c.id} className="p-3 border rounded-md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold">{c.name}</div>
                      <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                      {c.beneficiaries && (
                        <div className="text-xs text-muted-foreground mt-1">Beneficiaries: {c.beneficiaries}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant={c.status === 'COMPLETED' ? 'success' : c.status === 'ACTIVE' ? 'warning' : 'outline'}>
                        {c.status}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(toNumber(c.spent))} / {formatCurrency(toNumber(c.budget))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

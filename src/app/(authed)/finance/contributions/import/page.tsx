import { requireUser } from '@/lib/auth/require-user';
import { redirect } from 'next/navigation';
import { canRecordContributions } from '@/lib/permissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';
import { PayrollImportForm } from '@/components/finance/payroll-import-form';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function ImportContributionsPage() {
  const user = await requireUser();
  if (!canRecordContributions(user.role)) {
    redirect('/dashboard');
  }

  const now = new Date();
  const defaultDate = now.toISOString().slice(0, 10);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link href="/finance/contributions">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to contributions
          </Link>
        </Button>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <Upload className="h-6 w-6" />
          Import payroll schedule
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste the monthly pay office schedule. One service number per line. Default amount is {config.currency}{config.monthlyContributionPerMember}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paste CSV</CardTitle>
          <CardDescription>
            Format: <code className="text-xs">service_number</code> per line, or{' '}
            <code className="text-xs">service_number,amount</code>. Lines starting with{' '}
            <code className="text-xs">#</code> are treated as comments. Service numbers are matched
            case-insensitively. Members who already paid that month are skipped automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PayrollImportForm
            defaultMonth={now.getMonth() + 1}
            defaultYear={now.getFullYear()}
            defaultDate={defaultDate}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Example
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono">
{`# July 2026 payroll deduction schedule
106147
105152
106302,100
106759
104797
# Total: 43 members x K100 = K4,300`}
          </pre>
          <p className="text-xs text-muted-foreground mt-2">
            Once you click Import, the system records each contribution in its own short
            transaction (so a network blip only loses one row, not the whole batch). Bucket
            balances are updated automatically. Skipped (already paid) and unknown service
            numbers are reported back.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

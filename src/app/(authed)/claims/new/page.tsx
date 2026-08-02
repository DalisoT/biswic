import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SubmitClaimForm } from '@/components/claims/submit-claim-form';
import { config } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';

export default function NewClaimPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Submit a welfare claim</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Funeral ({formatCurrency(config.welfareCaps.funeral.amountPerEvent)} per event) or Medical ({formatCurrency(config.welfareCaps.medical.amountPerEvent)} per event) claims are reviewed by the FW and Chairperson.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Claim details</CardTitle>
          <CardDescription>All fields required unless marked optional</CardDescription>
        </CardHeader>
        <CardContent>
          <SubmitClaimForm />
        </CardContent>
      </Card>
    </div>
  );
}

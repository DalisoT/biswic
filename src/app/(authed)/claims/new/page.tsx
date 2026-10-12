import { SubmitClaimForm } from '@/components/claims/submit-claim-form';

export default function NewClaimPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Submit a welfare claim</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welfare claims are reviewed by the FW and Chairperson.
        </p>
      </div>

      <SubmitClaimForm />
    </div>
  );
}


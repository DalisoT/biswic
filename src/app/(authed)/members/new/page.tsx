import { requireUser } from '@/lib/auth/require-user';
import { canManageMembers } from '@/lib/permissions';
import { isFoundingLockActive } from '@/lib/config';
import { NewMemberForm } from '@/components/members/new-member-form';
import { Card, CardContent } from '@/components/ui/card';
import { Lock } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function NewMemberPage() {
  const user = await requireUser();
  if (!canManageMembers(user.role)) {
    return (
      <div className="text-center py-12">
        <p>Only the Chairperson or Secretary may add new members.</p>
      </div>
    );
  }

  // The action layer also enforces this, but we can short-circuit here so
  // the form isn't even rendered. The constitution requires the Cooperative
  // to be formally registered before new members may be admitted (Art. 2.2).
  if (isFoundingLockActive()) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-800 font-semibold">
              <Lock className="h-5 w-5" />
              Founding lock is active
            </div>
            <p className="text-sm text-amber-700">
              Constitution Art. 2.2: <em>"No additional members may be admitted before the Cooperative's
              formal registration as a Cooperative."</em>
            </p>
            <p className="text-sm text-amber-700">
              After the Cooperative is registered with the relevant Zambian authority, the Secretary
              or Chair should set the env var <code className="text-xs">FOUNDING_LOCK_RELEASED=true</code> in
              Vercel (and in <code className="text-xs">src/lib/config.ts</code> default) and redeploy. The
              Add Member flow will then unlock.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-heading">Add new member</h1>
        <p className="text-sm text-muted-foreground mt-1">
          The new member receives a Supabase password-reset email at the address
          you provide. They sign in with their service number and the password
          they set via the link.
        </p>
      </div>
      <NewMemberForm />
    </div>
  );
}

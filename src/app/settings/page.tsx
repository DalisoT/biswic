import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatPhone } from '@/lib/utils';
import { roleLabel } from '@/lib/permissions';
import { config } from '@/lib/config';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const currentUser = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
  });

  if (!user) return null;

  const nextOfKin = user.nextOfKin ? JSON.parse(user.nextOfKin) : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold font-heading">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Profile and account preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your basic information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Service Number</div>
              <div className="col-span-2 font-medium">{user.serviceNumber}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Full Name</div>
              <div className="col-span-2 font-medium">{user.fullName}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Role</div>
              <div className="col-span-2"><Badge variant="secondary">{roleLabel(user.role)}</Badge></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Rank</div>
              <div className="col-span-2">{user.rank ?? '—'}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Unit</div>
              <div className="col-span-2">{user.unit ?? '—'}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Phone</div>
              <div className="col-span-2">{formatPhone(user.phone)}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Email</div>
              <div className="col-span-2">{user.email ?? '—'}</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">NRC</div>
              <div className="col-span-2">{user.nationalRegistrationNumber ?? <span className="text-amber-700">Not set — required by Constitution Art. 2.6</span>}</div>
            </div>
            {user.isFoundingMember && (
              <div className="grid grid-cols-3 gap-2">
                <div className="text-muted-foreground">Founding member</div>
                <div className="col-span-2">
                  <Badge variant="success">Yes</Badge>
                  {user.foundingSignedAt && (
                    <span className="text-xs text-muted-foreground ml-2">
                      Signed {formatDate(user.foundingSignedAt)}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <div className="text-muted-foreground">Member since</div>
              <div className="col-span-2">{formatDate(user.joinedAt)}</div>
            </div>
            {nextOfKin && (
              <div className="border-t pt-3 mt-3">
                <div className="font-medium mb-2">Next of kin</div>
                <div className="text-xs text-muted-foreground">
                  {nextOfKin.name} ({nextOfKin.relationship}) · {formatPhone(nextOfKin.phone ?? '')}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Update profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm initial={{
            fullName: user.fullName,
            phone: user.phone,
            email: user.email ?? '',
            rank: user.rank ?? '',
            unit: user.unit ?? '',
            nationalRegistrationNumber: user.nationalRegistrationNumber ?? '',
            nextOfKin,
          }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>Send yourself a reset link to set a new password</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm serviceNumber={user.serviceNumber} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{config.cooperativeName}</p>
          <p className="mt-1">BISWIC Member Platform v1.0</p>
        </CardContent>
      </Card>
    </div>
  );
}

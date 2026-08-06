import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/forgot-password');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src="/icons/icon-192.png"
            alt="BISWIC - Brothers in Service Welfare, Land & Investment Cooperative"
            width={64}
            height={64}
            className="inline-block w-16 h-16 rounded-lg mb-4 object-contain bg-white/5"
          />
          <h1 className="text-2xl font-bold text-white font-heading">Set a new password</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <CardDescription>Minimum 8 characters.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm />
          </CardContent>
        </Card>

        <div className="mt-6 flex items-center gap-2 text-navy-200 text-xs justify-center">
          <Shield className="h-3 w-3" />
          <span>Secure · encrypted · audited</span>
        </div>
      </div>
    </div>
  );
}

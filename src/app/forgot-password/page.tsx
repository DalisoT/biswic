'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { requestPasswordResetAction } from '@/server/actions/auth';

export default function ForgotPasswordPage() {
  const [serviceNumber, setServiceNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('serviceNumber', serviceNumber);
      const res = await requestPasswordResetAction(fd);
      if (res?.error) {
        setError(res.error);
      } else if (res?.success) {
        setSuccess(res.success);
        setServiceNumber('');
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-white text-navy-700 font-bold text-2xl mb-4">
            B
          </div>
          <h1 className="text-2xl font-bold text-white font-heading">Reset Password</h1>
          <p className="text-navy-200 text-sm mt-1">Enter your service number and we&apos;ll email you a reset link</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Forgot your password?</CardTitle>
            <CardDescription>
              We&apos;ll send a password-reset link to the email on file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serviceNumber">Service Number</Label>
                <Input
                  id="serviceNumber"
                  type="text"
                  placeholder="MEMBER-001"
                  value={serviceNumber}
                  onChange={(e) => setServiceNumber(e.target.value)}
                  autoCapitalize="characters"
                  autoComplete="username"
                  required
                  disabled={pending}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-md text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Sending…' : 'Send reset link'}
              </Button>

              <div className="text-xs text-muted-foreground text-center">
                <Link href="/login" className="hover:underline">Back to sign in</Link>
              </div>
            </form>
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

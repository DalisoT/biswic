'use client';

import { Suspense, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Shield } from 'lucide-react';
import { config } from '@/lib/config';
import { signInAction } from '@/server/actions/auth';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageShell />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageShell() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-700 via-navy-800 to-navy-900 flex items-center justify-center p-4">
      <div className="text-white text-sm">Loading…</div>
    </div>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';

  const [serviceNumber, setServiceNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('serviceNumber', serviceNumber);
      fd.set('password', password);
      const res = await signInAction(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    });
  };

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
          <h1 className="text-2xl font-bold text-white font-heading">{config.cooperativeShortName}</h1>
          <p className="text-navy-200 text-sm mt-1">{config.cooperativeName}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your service number and password</CardDescription>
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
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign In'}
              </Button>

              <div className="text-xs text-muted-foreground text-center">
                <a href="/forgot-password" className="hover:underline">Forgot password?</a>
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

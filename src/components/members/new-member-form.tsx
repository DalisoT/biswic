'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createMemberAction } from '@/server/actions/members';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function NewMemberForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createMemberAction(fd);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else if (res?.success) {
        setMsg({ ok: true, text: 'Member created. A password-reset email has been sent to them.' });
        setTimeout(() => router.push('/members'), 1500);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identity</CardTitle>
          <CardDescription>Constitution Art. 2.6 - membership register fields</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="serviceNumber">Service Number <span className="text-destructive">*</span></Label>
              <Input
                id="serviceNumber"
                name="serviceNumber"
                placeholder="e.g. 105644 or NEW-001"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fullName">Full Name <span className="text-destructive">*</span></Label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="e.g. Sgt. John Banda"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="phone">Phone <span className="text-destructive">*</span></Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+260971234567"
                pattern="^\+260[0-9]{9}$"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input id="email" name="email" type="email" placeholder="member@biswic.coop" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nrc">NRC</Label>
              <Input id="nrc" name="nrc" placeholder="e.g. 123456/78/9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="rank">Rank</Label>
              <Input id="rank" name="rank" placeholder="e.g. SGT" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" name="unit" placeholder="e.g. Alpha Coy" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next of kin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next of kin</CardTitle>
          <CardDescription>Constitution Art. 2.6 (and Art. 10.3 for plot inheritance)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="nextOfKinName">Name</Label>
              <Input id="nextOfKinName" name="nextOfKinName" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nextOfKinRelationship">Relationship</Label>
              <Input id="nextOfKinRelationship" name="nextOfKinRelationship" placeholder="spouse, parent, child" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nextOfKinPhone">Phone</Label>
              <Input id="nextOfKinPhone" name="nextOfKinPhone" type="tel" placeholder="+260..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposer / seconder (Constitution Art. 2.3) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application</CardTitle>
          <CardDescription>Constitution Art. 2.3 - a candidate shall be proposed by one existing member and seconded by another</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="proposerServiceNumber">Proposed by (service #)</Label>
              <Input id="proposerServiceNumber" name="proposerServiceNumber" placeholder="e.g. CHAIR-001" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="seconderServiceNumber">Seconded by (service #)</Label>
              <Input id="seconderServiceNumber" name="seconderServiceNumber" placeholder="e.g. FW-001" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Optional at the MVP level - captured in the audit log for now. The full proposer / seconder / GM vote flow is in Phase 2 (elections).
          </p>
        </CardContent>
      </Card>

      {msg && (
        <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button asChild variant="ghost">
          <Link href="/members"><ArrowLeft className="h-4 w-4 mr-1" /> Back to roster</Link>
        </Button>
        <Button type="submit" disabled={pending} className="ml-auto">
          {pending ? 'Creating…' : 'Create member + send welcome email'}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { updateProfileAction } from '@/server/actions/profile';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ProfileFormProps {
  initial: {
    fullName: string;
    phone: string;
    email: string;
    rank: string;
    unit: string;
    nationalRegistrationNumber: string;
    nextOfKin: { name: string; relationship: string; phone: string } | null;
  };
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await updateProfileAction(fd);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else if (res?.success) setMsg({ ok: true, text: 'Profile updated.' });
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" name="fullName" defaultValue={initial.fullName} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={initial.phone} required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={initial.email} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rank">Rank</Label>
          <Input id="rank" name="rank" defaultValue={initial.rank} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" name="unit" defaultValue={initial.unit} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="nationalRegistrationNumber">
            National Registration Number (NRC)
            <span className="text-xs text-muted-foreground ml-1">Constitution Art. 2.6</span>
          </Label>
          <Input
            id="nationalRegistrationNumber"
            name="nationalRegistrationNumber"
            defaultValue={initial.nationalRegistrationNumber}
            placeholder="e.g. 123456/78/9"
          />
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="text-sm font-medium mb-2">Next of kin</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nextOfKinName">Name</Label>
            <Input id="nextOfKinName" name="nextOfKinName" defaultValue={initial.nextOfKin?.name} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nextOfKinRelationship">Relationship</Label>
            <Input id="nextOfKinRelationship" name="nextOfKinRelationship" defaultValue={initial.nextOfKin?.relationship} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nextOfKinPhone">Phone</Label>
            <Input id="nextOfKinPhone" name="nextOfKinPhone" defaultValue={initial.nextOfKin?.phone} />
          </div>
        </div>
      </div>

      {msg && (
        <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}

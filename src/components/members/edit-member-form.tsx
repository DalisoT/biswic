'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { updateMemberAction } from '@/server/actions/members';
import { ALL_ROLES, roleLabel, type Role } from '@/lib/permissions';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface NextOfKin {
  name?: string;
  relationship?: string;
  phone?: string;
}

interface Member {
  id: string;
  serviceNumber: string;
  fullName: string;
  email: string | null;
  phone: string;
  nrc: string | null;
  rank: string | null;
  unit: string | null;
  role: string;
  isActive: boolean;
  isFoundingMember: boolean;
  nextOfKin: NextOfKin | null;
  /** The leaving month as "YYYY-MM", or null when the member has not left. */
  leftAtValue: string | null;
}

interface Props {
  member: Member;
  isSelf: boolean;
  isPlaceholder: boolean;
}

export function EditMemberForm({ member, isSelf, isPlaceholder }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isActive, setIsActive] = useState(member.isActive);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await updateMemberAction(fd);
      if (res?.error) {
        setMsg({ ok: false, text: res.error });
      } else if (res?.success) {
        const extra = res.roleChanged
          ? ' Role change logged for GM ratification per Constitution Art. 6.4.'
          : '';
        setMsg({ ok: true, text: `Member updated successfully.${extra}` });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input type="hidden" name="memberId" value={member.id} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="serviceNumber">Service number (read-only)</Label>
          <Input id="serviceNumber" value={member.serviceNumber} disabled className="font-mono bg-muted" />
          <p className="text-[10px] text-muted-foreground">
            Real military IDs are immutable. Replace by re-creating the user, not by editing.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fullName">Full name *</Label>
          <Input id="fullName" name="fullName" defaultValue={member.fullName} required maxLength={120} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={member.email ?? ''} />
          <p className="text-[10px] text-muted-foreground">
            Optional. Leave blank to keep the current email.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="phone">Phone (+260XXXXXXXXX) *</Label>
          <Input id="phone" name="phone" defaultValue={member.phone} required pattern="\+260\d{9}" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="nrc">NRC</Label>
          <Input id="nrc" name="nrc" defaultValue={member.nrc ?? ''} placeholder="e.g. 123456/78/9" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rank">Rank</Label>
          <Input id="rank" name="rank" defaultValue={member.rank ?? ''} placeholder="e.g. SGT" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" name="unit" defaultValue={member.unit ?? ''} placeholder="e.g. HQ" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="role">Role *</Label>
          <select
            id="role"
            name="role"
            defaultValue={member.role}
            disabled={isSelf}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
            required
          >
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
                {member.role === r ? ' (current)' : ''}
              </option>
            ))}
          </select>
          {isSelf ? (
            <p className="text-[10px] text-muted-foreground">
              You can&apos;t change your own role. Ask another officer.
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Role changes are logged &mdash; must be ratified at the next GM (Constitution Art. 6.4).
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Status</Label>
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSelf}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm">
              Active (uncheck to deactivate)
            </label>
          </div>
          {isSelf ? (
            <p className="text-[10px] text-muted-foreground">You can&apos;t deactivate yourself.</p>
          ) : (
            <p className="text-[10px] text-muted-foreground">
              Deactivated users can&apos;t sign in. Use instead of deleting to keep the audit trail.
            </p>
          )}
        </div>
      </div>

      {!isSelf && (
        <div className="space-y-1 border-t pt-4 md:border-t-0 md:pt-0">
          <Label htmlFor="leftAtMonth">Month the member left</Label>
          <Input
            id="leftAtMonth"
            name="leftAtMonth"
            type="month"
            defaultValue={member.leftAtValue ?? ''}
            aria-describedby="leftAtMonthHelp"
          />
          <p id="leftAtMonthHelp" className="text-[10px] text-muted-foreground">
            Contributions are due <strong>up to and including</strong> the month they
            left. Leave this blank while the member is still active, or the leaving
            month is cleared.
          </p>
          {!isActive && !member.leftAtValue && member.isActive && (
            <p className="text-[10px] text-amber-700">
              No leaving month recorded &mdash; deactivating this member will record
              this month as the leaving month.
            </p>
          )}
          {!isActive && !member.leftAtValue && !member.isActive && (
            <p className="text-[10px] text-amber-700">
              No leaving month recorded &mdash; enter the month this member left so
              the contributions report stops billing them.
            </p>
          )}
        </div>
      )}

      <div className="border-t pt-4 space-y-3">
        <h3 className="text-sm font-semibold">Next of kin</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label htmlFor="nextOfKinName">Name</Label>
            <Input id="nextOfKinName" name="nextOfKinName" defaultValue={member.nextOfKin?.name ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nextOfKinRelationship">Relationship</Label>
            <Input
              id="nextOfKinRelationship"
              name="nextOfKinRelationship"
              defaultValue={member.nextOfKin?.relationship ?? ''}
              placeholder="e.g. spouse"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nextOfKinPhone">Phone</Label>
            <Input
              id="nextOfKinPhone"
              name="nextOfKinPhone"
              defaultValue={member.nextOfKin?.phone ?? ''}
              placeholder="+260XXXXXXXXX"
            />
          </div>
        </div>
      </div>

      {msg && (
        <div
          className={`flex items-start gap-2 p-3 rounded-md text-sm ${
            msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="outline" asChild>
          <a href="/members">Cancel</a>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving&hellip;
            </>
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </form>
  );
}

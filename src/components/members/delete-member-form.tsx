'use client';

/**
 * Delete Member Form -- "Redacted Deletion" (Danger Zone)
 * ----------------------------------------------------------------------------
 * The most destructive action in the system. Permanently redacts the member's
 * PII (name, phone, email, service number, NRC, next-of-kin, signature URL)
 * while preserving the financial record (contributions, claims, audit log).
 *
 * Why "redacted deletion" instead of hard delete:
 *   - The User row has FKs from Contribution, WelfareClaim, SoftLoan,
 *     AuditLog, Notification, etc. Hard delete would fail on those FKs.
 *   - Audit / tax law requires financial records to be retained for years.
 *     Hard delete would put the cooperative out of compliance.
 *   - The Supabase auth.users row IS hard-deleted, so the redacted member
 *     can never sign in again.
 *
 * Authorization: isAdmin only (enforced in the server action).
 *
 * Confirmation: the operator must type the member's CURRENT service number
 * exactly. This is harder to mistype than "type DELETE" and impossible to
 * guess at scale.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { deleteMemberAction } from '@/server/actions/members';
import { AlertTriangle, CheckCircle2, AlertCircle, Loader2, Trash2, X, ShieldAlert } from 'lucide-react';

interface Props {
  member: {
    id: string;
    serviceNumber: string;
    fullName: string;
    isActive: boolean;
  };
  isSelf: boolean;
  isAdmin: boolean;
}

export function DeleteMemberForm({ member, isSelf, isAdmin }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirmSvc, setConfirmSvc] = useState('');
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Guards
  if (isSelf) {
    return (
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <span>You cannot delete your own account. Ask another admin.</span>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Only the platform owner (<code>isAdmin</code>) can permanently remove a member.
          The Chairperson or Secretary can <strong>deactivate</strong> this member using the
          toggle above, which is reversible.
        </span>
      </div>
    );
  }
  if (!member.isActive) {
    return (
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>This member is already inactive. Deactivation is sufficient -- no need to delete.</span>
      </div>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const fd = new FormData(e.currentTarget);
      const res = await deleteMemberAction(fd);
      if (res.error) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setMsg({ ok: true, text: 'Member removed. Redirecting...' });
      // Brief delay so the user sees the success message before navigation.
      setTimeout(() => router.push('/members'), 800);
    });
  }

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="destructive"
        onClick={() => setExpanded(true)}
        className="gap-2"
      >
        <Trash2 className="h-4 w-4" />
        Permanently delete this member
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="memberId" value={member.id} />

      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 space-y-2">
        <div className="font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          This action redacts the member's PII and cannot be undone.
        </div>
        <p>What will happen:</p>
        <ul className="list-disc pl-5 space-y-1 text-xs">
          <li>Their <strong>name, phone, email, service number, NRC, and next-of-kin</strong> are overwritten with redaction markers.</li>
          <li>Their <strong>Supabase login is deleted</strong> -- they cannot sign in again.</li>
          <li>Their <strong>financial records are kept</strong> (contributions, welfare claims, audit log entries) because tax/audit law requires them to be retained. The User row stays in the database with a redacted name and a service number of <code>DELETED-xxxxxxxx</code>.</li>
          <li>An <strong>audit log entry</strong> is written with the original PII in the <code>beforeValue</code> field. This is the only place the original data is preserved.</li>
        </ul>
        <p className="pt-1">If you just want to prevent this member from logging in, use the <strong>Active</strong> toggle above instead. It is reversible.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmServiceNumber">
          Type the member's service number (<code>{member.serviceNumber}</code>) to confirm
        </Label>
        <Input
          id="confirmServiceNumber"
          name="confirmServiceNumber"
          value={confirmSvc}
          onChange={(e) => setConfirmSvc(e.target.value)}
          placeholder={member.serviceNumber}
          autoComplete="off"
          autoFocus
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason (optional, recorded in audit log)</Label>
        <Textarea
          id="reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Resigned from the cooperative on 2026-08-31. Final contributions reconciled."
          rows={2}
          maxLength={500}
        />
      </div>

      {msg && (
        <div
          className={`rounded-md p-3 text-sm flex items-start gap-2 ${
            msg.ok
              ? 'bg-green-50 border border-green-300 text-green-900'
              : 'bg-red-50 border border-red-300 text-red-900'
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

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="destructive"
          disabled={pending || confirmSvc.trim().toUpperCase() !== member.serviceNumber.trim().toUpperCase()}
          className="gap-2"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          {pending ? 'Removing...' : 'Permanently delete'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => { setExpanded(false); setMsg(null); setConfirmSvc(''); setReason(''); }}
          disabled={pending}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The "Permanently delete" button stays disabled until the service number confirmation matches.
      </p>
    </form>
  );
}

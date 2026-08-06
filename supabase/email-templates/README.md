# Supabase email templates

This directory holds the HTML templates for Supabase Auth emails
(password reset, magic link, confirm signup, etc.).

## How Supabase email templates work

Supabase doesn't read these files at runtime — they're **only stored
in the Supabase dashboard** under **Authentication → Email Templates**.

The flow:
1. You edit the HTML in your preferred editor (e.g. VS Code)
2. You open the Supabase dashboard, click the email template, paste
   the HTML, hit Save
3. Next time Supabase sends that email, it uses your version

## Pasting the reset-password template

1. Open <https://supabase.com/dashboard/project/ecazhcauszvmcttmpalu/auth/templates>
2. Find the **"Reset password"** template card
3. Click it → opens the template editor
4. **Subject line**: `Set your BISWIC password` (or keep the default)
5. **Body**: paste the entire HTML from `reset-password.html`
   (the file is already a single self-contained HTML body — no
   `<html>` or `<head>` wrappers needed, Supabase provides those)
6. Hit **Save**

> Variables Supabase supports in these templates (Go template syntax):
> - `{{ .ConfirmationURL }}` — the link the user clicks to set their password
> - `{{ .Email }}` — the recipient's email address
> - `{{ .SiteURL }}` — your configured Site URL
> - `{{ .RedirectTo }}` — where the link sends the user after reset

## Optional: customize the "Confirm signup" / "Welcome" template

If you want to send a proper welcome email (not just a recovery-link
email) to new members, you'd also configure the **Confirm signup**
template. Today the BISWIC onboarding flow uses the reset-password
flow for new members (`createMemberAction` calls
`admin.auth.admin.generateLink({ type: 'recovery' })`), so the
reset-password template is the only one strictly needed.

## Customizing the sender name + email

Set the **Sender name** and **Sender email** at
<https://supabase.com/dashboard/project/ecazhcauszvmcttmpalu/settings/auth>
under "SMTP Settings" once you wire up Resend / SendGrid / SES.

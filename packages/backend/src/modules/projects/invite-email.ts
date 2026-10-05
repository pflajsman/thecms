import { EmailService } from '../../services/email.service';
import { ProjectRole } from '../../models/project-member.model';

export type InviteLanguage = 'en' | 'cs';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ROLE_NAMES: Record<InviteLanguage, Record<ProjectRole, string>> = {
  en: { OWNER: 'Owner', ADMIN: 'Admin', EDITOR: 'Editor', VIEWER: 'Viewer' },
  cs: { OWNER: 'vlastník', ADMIN: 'správce', EDITOR: 'editor', VIEWER: 'čtenář' },
};

const TEXT = {
  en: {
    subject: (project: string) => `You are invited to ${project} in TheCMS`,
    body: (inviter: string, project: string, role: string) => `${inviter} invited you to the project ${project} as ${role}.`,
    action: 'Accept the invitation',
    note: 'Sign in with Google or your email. The link works once and expires in 7 days.',
  },
  cs: {
    subject: (project: string) => `Pozvánka do projektu ${project} v TheCMS`,
    body: (inviter: string, project: string, role: string) => `${inviter} vás pozval(a) do projektu ${project} jako ${role}.`,
    action: 'Přijmout pozvánku',
    note: 'Přihlaste se přes Google nebo e-mail. Odkaz funguje jednou a platí 7 dní.',
  },
};

/** Sends the invitation link; returns false when email is not configured or sending fails (the link can still be copied). */
export async function sendInviteEmail(input: {
  to: string;
  projectName: string;
  inviterName: string;
  role: ProjectRole;
  url: string;
  language: InviteLanguage;
}): Promise<boolean> {
  if (!EmailService.isReady()) return false;
  const t = TEXT[input.language];
  const role = ROLE_NAMES[input.language][input.role];
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <p>${escapeHtml(t.body(input.inviterName, input.projectName, role))}</p>
      <p><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">${escapeHtml(t.action)}</a></p>
      <p style="color:#666;font-size:12px;">${escapeHtml(t.note)}</p>
    </div>`;
  try {
    await EmailService.send({ to: input.to, subject: t.subject(input.projectName), html });
    return true;
  } catch (error) {
    console.error('Invitation email failed:', (error as Error).message);
    return false;
  }
}

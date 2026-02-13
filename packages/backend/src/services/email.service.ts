import sgMail from '@sendgrid/mail';

/**
 * Email Service
 * Sends email notifications via SendGrid
 */
export class EmailService {
  private static initialized = false;

  /**
   * Initialize SendGrid with API key
   */
  static initialize(): void {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  SENDGRID_API_KEY not set — email notifications disabled');
      return;
    }
    sgMail.setApiKey(apiKey);
    EmailService.initialized = true;
    console.log('✅ Email service initialized (SendGrid)');
  }

  /**
   * Send a form submission notification email
   */
  static async sendFormNotification(options: {
    to: string;
    formName: string;
    fields: { label: string; value: string }[];
  }): Promise<void> {
    if (!EmailService.initialized) {
      console.warn('Email service not initialized — skipping notification');
      return;
    }

    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@thecms.app';

    const rows = options.fields
      .map(
        (f) =>
          `<tr><td style="padding:8px 12px;border:1px solid #e0e0e0;font-weight:600;">${escapeHtml(f.label)}</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${escapeHtml(f.value)}</td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#333;">New submission: ${escapeHtml(options.formName)}</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px;border:1px solid #e0e0e0;text-align:left;">Field</th>
              <th style="padding:8px 12px;border:1px solid #e0e0e0;text-align:left;">Value</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#888;font-size:12px;margin-top:24px;">Sent by TheCMS</p>
      </div>
    `;

    await sgMail.send({
      to: options.to,
      from: fromEmail,
      subject: `New form submission: ${options.formName}`,
      html,
    });
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

import QRCode from 'qrcode';
import { OrderModel, type IOrder } from '../../models/order.model';
import type { IShopSettings } from '../../models/shop-settings.model';
import { DownloadGrantModel } from '../../models/download-grant.model';
import { EmailService } from '../../services/email.service';
import { SettingsService } from './settings.service';
import { providers } from './payments';
import { emailText, type EmailKey } from './email-strings';

export type NotifyKind = 'confirmation' | 'paid' | 'shipped' | 'cancelled' | 'downloads';

interface RenderExtra {
  downloads?: { name: string; url: string }[];
}

export interface RenderedEmail {
  subject: string;
  html: string;
  attachments: { name: string; content: string }[];
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function money(minor: number, currency: string, settings: IShopSettings, language: string): string {
  const decimals = settings.currencies.find((c) => c.code === currency)?.decimals ?? 2;
  return new Intl.NumberFormat(language, { style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(minor / 10 ** decimals);
}

function linesTable(order: IOrder, settings: IShopSettings, language: string): string {
  const t = (key: EmailKey, vars?: Record<string, string | number>) => escapeHtml(emailText(language, key, vars));
  const m = (minor: number) => escapeHtml(money(minor, order.currency, settings, language));
  const cell = 'padding:6px 8px;border-bottom:1px solid #e5e5e5;';
  const rows = order.lines
    .map((l) => {
      const options = l.optionLabels.map((o) => `${o.option}: ${o.value}`).join(' / ');
      return `<tr><td style="${cell}">${escapeHtml(l.name)}${options ? `<br><span style="color:#666;font-size:12px;">${escapeHtml(options)}</span>` : ''}</td><td style="${cell}text-align:right;">${l.quantity}</td><td style="${cell}text-align:right;">${m(l.lineTotal)}</td></tr>`;
    })
    .join('');
  const extra = [
    order.shipping ? `<tr><td style="${cell}" colspan="2">${t('shipping')}: ${escapeHtml(order.shipping.name)}</td><td style="${cell}text-align:right;">${m(order.totals.shipping)}</td></tr>` : '',
    order.totals.paymentFee ? `<tr><td style="${cell}" colspan="2">${t('paymentFee')}</td><td style="${cell}text-align:right;">${m(order.totals.paymentFee)}</td></tr>` : '',
    `<tr><td style="${cell}font-weight:600;" colspan="2">${t('total')}</td><td style="${cell}text-align:right;font-weight:600;">${m(order.totals.total)}</td></tr>`,
  ].join('');
  const vat = order.totals.vat
    .map((v) => `<p style="margin:2px 0;color:#666;font-size:12px;">${t('vatIncluded', { rate: new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(v.rate / 100), amount: money(v.amount, order.currency, settings, language) })}</p>`)
    .join('');
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr><th style="${cell}text-align:left;">${t('item')}</th><th style="${cell}text-align:right;">${t('quantity')}</th><th style="${cell}text-align:right;">${t('price')}</th></tr></thead><tbody>${rows}${extra}</tbody></table>${vat}`;
}

function wrap(body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">${body}</div>`;
}

export async function renderEmail(order: IOrder, kind: NotifyKind | 'new-order', settings: IShopSettings, extra: RenderExtra): Promise<RenderedEmail> {
  const language = kind === 'new-order' ? 'en' : order.language;
  const t = (key: EmailKey, vars?: Record<string, string | number>) => escapeHtml(emailText(language, key, vars));
  const vars = { number: order.number };
  const attachments: RenderedEmail['attachments'] = [];
  let subject: string;
  let body: string;

  switch (kind) {
    case 'confirmation': {
      subject = emailText(language, 'confirmationSubject', vars);
      let payment = '';
      const instructions = providers[order.payment.method].instructions(order, settings);
      if (order.payment.method === 'BANK_TRANSFER' && instructions) {
        const row = (key: EmailKey, value?: string) => (value ? `<tr><td style="padding:4px 8px;color:#666;">${t(key)}</td><td style="padding:4px 8px;font-weight:600;">${escapeHtml(value)}</td></tr>` : '');
        payment = `<h3>${t('payByTransfer')}</h3><table>${row('holder', instructions.holder)}${row('account', instructions.accountNumber)}${row('iban', instructions.iban)}${row('bic', instructions.bic)}${row('amount', money(instructions.amount, order.currency, settings, language))}${row('reference', instructions.reference)}</table>`;
        if (instructions.qr) {
          payment += `<p>${t('scanQr')}</p>`;
          const png = await QRCode.toBuffer(instructions.qr, { type: 'png', width: 240, margin: 2 });
          attachments.push({ name: emailText(language, 'qrFile', vars), content: png.toString('base64') });
        }
      } else if (order.payment.method === 'CASH_ON_DELIVERY') {
        payment = `<p>${t('cashOnDelivery')}</p>`;
      }
      body = `<p>${t('thanks', vars)}</p>${linesTable(order, settings, language)}${payment}`;
      break;
    }
    case 'paid':
    case 'downloads': {
      subject = emailText(language, kind === 'paid' ? 'paidSubject' : 'downloadsSubject', vars);
      const links = (extra.downloads ?? [])
        .map((d) => `<p><a href="${escapeHtml(d.url)}">${t('download', { name: d.name })}</a></p>`)
        .join('');
      const limits = links ? `<p style="color:#666;font-size:12px;">${t('downloadLimit', { days: settings.downloadDays, limit: settings.downloadLimit })}</p>` : '';
      body = `<p>${t(kind === 'paid' ? 'paidText' : 'downloadsText', vars)}</p>${links}${limits}`;
      break;
    }
    case 'shipped': {
      subject = emailText(language, 'shippedSubject', vars);
      const tracking = order.tracking?.url || order.tracking?.number;
      body = `<p>${t('shippedText', vars)}</p>${tracking ? `<p>${t('tracking', { tracking })}</p>` : ''}${linesTable(order, settings, language)}`;
      break;
    }
    case 'cancelled': {
      subject = emailText(language, 'cancelledSubject', vars);
      body = `<p>${t('cancelledText', vars)}</p>`;
      break;
    }
    case 'new-order': {
      subject = emailText(language, 'newOrderSubject', vars);
      const address = (a?: IOrder['billingAddress']) =>
        a ? escapeHtml([a.name, a.company, a.street, `${a.postalCode} ${a.city}`, a.country, a.vatId].filter(Boolean).join(', ')) : '';
      body = `<p>${escapeHtml(order.customer.name)} &lt;${escapeHtml(order.customer.email)}&gt;${order.customer.phone ? `, ${escapeHtml(order.customer.phone)}` : ''}</p><p>${address(order.billingAddress)}</p>${order.shippingAddress ? `<p>${t('shipping')}: ${address(order.shippingAddress)}</p>` : ''}${order.note ? `<p>${escapeHtml(order.note)}</p>` : ''}${linesTable(order, settings, language)}`;
      break;
    }
  }
  return { subject, html: wrap(body), attachments };
}

async function record(order: IOrder, type: 'email-sent' | 'email-failed', detail: string): Promise<void> {
  await OrderModel.updateOne({ _id: order._id }, { $push: { history: { at: new Date(), type, detail } } });
}

async function sendOne(order: IOrder, kind: NotifyKind | 'new-order', to: string, settings: IShopSettings, extra: RenderExtra): Promise<void> {
  try {
    if (!EmailService.isReady()) throw new Error('email is not configured');
    const email = await renderEmail(order, kind, settings, extra);
    await EmailService.send({ to, ...email });
    await record(order, 'email-sent', kind);
  } catch (error) {
    await record(order, 'email-failed', `${kind}: ${(error as Error).message}`);
  }
}

async function downloadLinks(order: IOrder): Promise<{ name: string; url: string }[]> {
  const base = (process.env.PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');
  const grants = await DownloadGrantModel.find({ orderId: order._id, expiresAt: { $gt: new Date() } }).lean();
  return grants.map((g) => ({ name: order.lines[g.lineIndex]?.name ?? '', url: `${base}/public/shop/downloads/${g.token}` }));
}

/** Send the customer's email for this event (and the shop's new-order email); never throws. */
export async function notify(order: IOrder, kind: NotifyKind): Promise<void> {
  try {
    const settings = await SettingsService.get();
    const extra: RenderExtra = kind === 'paid' || kind === 'downloads' ? { downloads: await downloadLinks(order) } : {};
    await sendOne(order, kind, order.customer.email, settings, extra);
    if (kind === 'confirmation' && settings.shopEmail) await sendOne(order, 'new-order', settings.shopEmail, settings, {});
  } catch (error) {
    console.error('Order email failed:', error);
  }
}

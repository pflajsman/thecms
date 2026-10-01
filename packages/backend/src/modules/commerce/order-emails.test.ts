jest.mock('../../services/webhook.service', () => ({ WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('../../services/email.service', () => ({ EmailService: { isReady: jest.fn(() => true), send: jest.fn().mockResolvedValue(undefined) } }));

import { useTestDb } from '../../test/db';
import { EmailService } from '../../services/email.service';
import { OrderModel } from '../../models/order.model';
import { seedShop, placeTestOrder } from './test-shop';
import { notify, renderEmail } from './order-emails';
import { SettingsService } from './settings.service';

useTestDb();

it('sends a Czech confirmation with lines, totals, payment instructions and the QR code attached', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { language: 'cs' });
  const email = await renderEmail(order, 'confirmation', await SettingsService.get(), {});
  expect(email.subject).toBe(`Objednávka ${order.number}`);
  expect(email.html).toContain('Cyklistické tričko');
  expect(email.html).toContain('490,00');
  expect(email.html).toContain(order.number);
  expect(email.html).toContain('CZ6508000000192000145399');
  expect(email.attachments).toEqual([{ name: `platba-${order.number}.png`, content: expect.any(String) }]);
});

it('notifies the shop of a new order and records sent emails', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  await notify(order, 'confirmation');
  const sent = jest.mocked(EmailService.send).mock.calls.map((c) => c[0].to);
  expect(sent).toEqual(['jana@example.test', 'shop@example.test']);
  const saved = await OrderModel.findById(order._id).lean();
  expect(saved?.history.filter((h) => h.type === 'email-sent').map((h) => h.detail)).toEqual(['confirmation', 'new-order']);
});

it('records a failed email and does not throw', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  jest.mocked(EmailService.send).mockRejectedValueOnce(new Error('Request failed with status code 401'));
  await expect(notify(order, 'shipped')).resolves.toBeUndefined();
  const saved = await OrderModel.findById(order._id).lean();
  expect(saved?.history.find((h) => h.type === 'email-failed')?.detail).toBe('shipped: Request failed with status code 401');
});

it('records "not configured" when Brevo is off', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop);
  jest.mocked(EmailService.isReady).mockReturnValueOnce(false);
  await notify(order, 'cancelled');
  const saved = await OrderModel.findById(order._id).lean();
  expect(saved?.history.find((h) => h.type === 'email-failed')?.detail).toBe('cancelled: email is not configured');
});

it('includes download links in the paid email for digital lines', async () => {
  const shop = await seedShop();
  const order = await placeTestOrder(shop, { digital: true });
  const email = await renderEmail(order, 'paid', await SettingsService.get(), { downloads: [{ name: 'Průvodce Šumavou', url: 'https://api.test/public/shop/downloads/abc' }] });
  expect(email.html).toContain('https://api.test/public/shop/downloads/abc');
});

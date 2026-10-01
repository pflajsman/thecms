import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** The bank's payment QR code (SPD) drawn in the browser; nothing when it cannot be drawn. */
export function PaymentQr({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { margin: 2, width: 240 })
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) setSrc(null);
      });
    return () => {
      live = false;
    };
  }, [text]);
  if (!src) return null;
  return <img className="payment-qr" src={src} width={240} height={240} alt="QR kód pro platbu" />;
}

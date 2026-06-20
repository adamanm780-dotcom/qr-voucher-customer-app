// Erzeugt QR-Codes lokal (eigener Endpoint, KEIN externer Dienst).
// Vorteil: kein Fremd-Ausfallrisiko mehr und kein Datenabfluss der Karten-URL an Dritte.
//   /api/qr?data=<text/url>&size=240
import QRCode from 'qrcode';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host}`);
    const data = url.searchParams.get('data');
    if (!data) return res.status(400).json({ error: 'data fehlt' });
    const size = Math.min(1024, Math.max(80, parseInt(url.searchParams.get('size') || '240', 10) || 240));
    const buf = await QRCode.toBuffer(data, { type: 'png', width: size, margin: 1, errorCorrectionLevel: 'M' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).send(buf);
  } catch (e) {
    console.error('qr error:', e && (e.stack || e.message || e));
    return res.status(500).json({ error: 'QR-Erzeugung fehlgeschlagen' });
  }
}

import QRCode from 'qrcode';

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Code parameter required' });
  }

  try {
    // Generate QR code that points to the pass endpoint
    const passUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/pass?code=${encodeURIComponent(code)}`;

    const qrCodeDataUrl = await QRCode.toDataURL(passUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
      success: true,
      code: code,
      qrUrl: qrCodeDataUrl,
      passUrl: passUrl
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Failed to generate QR code', details: error.message });
  }
}

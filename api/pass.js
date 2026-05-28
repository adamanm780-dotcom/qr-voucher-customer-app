import { createReadStream, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

const PASS_TYPE_ID = 'pass.com.lila.gutschein';
const TEAM_ID = '4X4Z2XA87V';

// Mock vouchers (in production, diese würden aus einer DB kommen)
const vouchers = {
  'ABC123': {
    code: 'ABC123',
    businessName: 'Lila Wiesbaden',
    offer: '20% Rabatt auf alle Getränke',
    value: '€20',
    expiryDate: '2024-12-31'
  },
  'XYZ789': {
    code: 'XYZ789',
    businessName: 'Matcha Café',
    offer: 'Kostenloser Matcha Latte',
    value: 'Gratis',
    expiryDate: '2024-12-31'
  }
};

function generatePassJson(voucher) {
  return {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    teamIdentifier: TEAM_ID,
    serialNumber: uuid(),
    webServiceURL: 'https://example.com',
    authenticationToken: crypto.randomBytes(8).toString('hex'),
    description: voucher.offer,
    logoText: voucher.businessName,
    barcode: {
      format: 'PKBarcodeFormatQR',
      message: voucher.code,
      messageEncoding: 'utf-8'
    },
    storeCard: {
      headerFields: [
        {
          key: 'business',
          label: 'Business',
          value: voucher.businessName
        }
      ],
      primaryFields: [
        {
          key: 'offer',
          label: 'Offer',
          value: voucher.offer
        },
        {
          key: 'value',
          label: 'Value',
          value: voucher.value
        }
      ],
      auxiliaryFields: [
        {
          key: 'validUntil',
          label: 'Valid Until',
          value: voucher.expiryDate
        }
      ]
    }
  };
}

function generateManifest(files) {
  const manifest = {};
  for (const [filename, content] of Object.entries(files)) {
    const hash = crypto.createHash('sha1');
    if (typeof content === 'string') {
      hash.update(content);
    } else {
      hash.update(JSON.stringify(content));
    }
    manifest[filename] = hash.digest('hex');
  }
  return manifest;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Voucher code required' });
  }

  const voucher = vouchers[code];
  if (!voucher) {
    return res.status(404).json({ error: 'Voucher not found' });
  }

  try {
    // Generate pass.json
    const passJson = generatePassJson(voucher);

    // Create files for .pkpass
    const files = {
      'pass.json': JSON.stringify(passJson, null, 2),
      'manifest.json': generateManifest({
        'pass.json': passJson
      })
    };

    // For demo: create a simple manifest signature
    // In production: this would be signed with the private key
    files['signature'] = 'mock-signature-for-demo';

    // Create .pkpass (ZIP archive)
    const fileName = `voucher-${code}-${Date.now()}.pkpass`;
    const filePath = join('/tmp', fileName);

    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add files to archive
      for (const [filename, content] of Object.entries(files)) {
        if (typeof content === 'string') {
          archive.append(content, { name: filename });
        } else {
          archive.append(JSON.stringify(content), { name: filename });
        }
      }

      output.on('close', () => {
        // Send the file
        res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const stream = require('fs').createReadStream(filePath);
        stream.pipe(res);

        // Clean up after sending
        stream.on('end', () => {
          try {
            require('fs').unlinkSync(filePath);
          } catch (e) {
            console.error('Failed to cleanup temp file:', e);
          }
        });
      });

      archive.finalize();
    });
  } catch (error) {
    console.error('Error generating pass:', error);
    return res.status(500).json({ error: 'Failed to generate pass', details: error.message });
  }
}

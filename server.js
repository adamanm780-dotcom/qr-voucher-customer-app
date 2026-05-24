// Simple mock server for local testing
// Run with: node server.js

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const mockVouchers = {
    'ABC123': {
        code: 'ABC123',
        businessName: 'Lila Wiesbaden',
        offer: '20% Rabatt auf alle Getränke'
    },
    'XYZ789': {
        code: 'XYZ789',
        businessName: 'Matcha Café',
        offer: 'Kostenloser Matcha Latte'
    },
    'TEST001': {
        code: 'TEST001',
        businessName: 'Test Business',
        offer: '10€ Gutschein'
    }
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Mock API endpoint
    if (pathname === '/api/pass' && req.method === 'GET') {
        const code = query.code;

        if (!code) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Code parameter required'
            }));
            return;
        }

        const voucher = mockVouchers[code];

        if (!voucher) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Invalid voucher code'
            }));
            return;
        }

        // In production, this would be a signed .pkpass file
        // For testing, we return a mock response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            passUrl: 'data:application/octet-stream;base64,UEsDBBQABgAIAAAAIQCh...', // Mock base64
            voucher: voucher
        }));
        return;
    }

    // Serve static files
    let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.css': 'text/css',
            '.json': 'application/json'
        }[ext] || 'text/plain';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Mock server running at http://localhost:${PORT}`);
    console.log(`📱 Test with code: ABC123, XYZ789, or TEST001`);
});

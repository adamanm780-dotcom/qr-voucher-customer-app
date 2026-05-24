import { createReadStream, existsSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default function handler(req, res) {
    let filePath = resolve(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);

    if (!existsSync(filePath)) {
        filePath = resolve(__dirname, 'public', 'index.html');
    }

    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };

    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    const contentType = mimeTypes[ext] || 'text/plain';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    createReadStream(filePath).pipe(res);
}

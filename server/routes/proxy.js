const express = require('express');
const router = express.Router();

// Simple streaming proxy for public OneDrive / SharePoint (and similar) links
// Usage: GET /api/proxy?url=<encoded_url>
// This forwards Range requests to the remote host to support seeking.
router.get('/proxy', (req, res) => {
    const target = req.query.url;
    if (!target) return res.status(400).json({ error: 'Missing url parameter' });
    let targetUrl;
    try {
        targetUrl = new URL(decodeURIComponent(target));
    } catch (err) {
        return res.status(400).json({ error: 'Invalid url' });
    }

    // Allow only certain hosts to be proxied for safety
    const allowedHosts = [
        'onedrive.live.com',
        '1drv.ms',
        'sharepoint.com',
        'public.blob.core.windows.net',
        'cdn.sharepointonline.com'
    ];
    const host = targetUrl.hostname.toLowerCase();
    const hostAllowed = allowedHosts.some(h => host.endsWith(h));
    if (!hostAllowed) return res.status(403).json({ error: 'Host not allowed' });

    const httpLib = targetUrl.protocol === 'https:' ? require('https') : require('http');

    const options = {
        method: 'GET',
        headers: {}
    };

    // Forward Range header if present to support seeking
    if (req.headers.range) options.headers.Range = req.headers.range;

    const proxyReq = httpLib.request(targetUrl, options, (proxyRes) => {
        // Copy status and selected headers
        res.statusCode = proxyRes.statusCode || 200;
        const headersToCopy = ['content-type', 'content-length', 'accept-ranges', 'content-range', 'cache-control', 'last-modified'];
        headersToCopy.forEach(h => {
            if (proxyRes.headers[h]) res.setHeader(h, proxyRes.headers[h]);
        });
        // Stream the response
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy request error:', err.message);
        if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch remote resource' });
    });

    proxyReq.end();
});

module.exports = router;

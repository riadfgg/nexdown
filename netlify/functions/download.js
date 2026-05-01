const { execFile } = require('child_process');
const path = require('path');

const YTDLP = path.join(process.cwd(), 'bin', 'yt-dlp');

function run(args) {
    return new Promise((resolve, reject) => {
        execFile(YTDLP, args, { maxBuffer: 10 * 1024 * 1024, timeout: 9000 }, (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout.trim());
        });
    });
}

exports.handler = async (event) => {
    try {
        const params = event.queryStringParameters || {};
        const { url, format, type } = params;

        if (!url) {
            return { statusCode: 400, body: 'URL is required' };
        }

        // Determine format argument
        let formatArg = format || (type === 'audio' ? 'bestaudio' : 'best');

        // Get the direct download URL from yt-dlp
        const directUrl = await run([
            url,
            '-f', formatArg,
            '--get-url',
            '--no-warnings',
            '--no-playlist'
        ]);

        // yt-dlp might return multiple URLs (video + audio separately)
        // Take the first line
        const finalUrl = directUrl.split('\n')[0];

        if (!finalUrl || !finalUrl.startsWith('http')) {
            throw new Error('Could not resolve download URL');
        }

        // Redirect the browser directly to the source
        return {
            statusCode: 302,
            headers: {
                Location: finalUrl,
                'Cache-Control': 'no-cache, no-store',
            },
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.message || 'Download failed' }),
        };
    }
};

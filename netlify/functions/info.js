const { execFile } = require('child_process');
const path = require('path');

const YTDLP = path.join(process.cwd(), 'bin', 'yt-dlp');

function run(args) {
    return new Promise((resolve, reject) => {
        execFile(YTDLP, args, { maxBuffer: 50 * 1024 * 1024, timeout: 9000 }, (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout);
        });
    });
}

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const { url } = JSON.parse(event.body);
        if (!url) throw new Error('URL is required');

        const raw = await run([url, '--dump-json', '--no-warnings', '--no-playlist']);
        const info = JSON.parse(raw);

        const formats = info.formats
            .filter(f => f.vcodec !== 'none' || f.acodec !== 'none')
            .map(f => ({
                format_id: f.format_id,
                ext: f.ext,
                resolution: f.resolution || (f.width ? `${f.width}x${f.height}` : 'audio only'),
                vcodec: f.vcodec,
                acodec: f.acodec,
                filesize: f.filesize || f.filesize_approx,
                format_note: f.format_note,
            }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                id: info.id,
                title: info.title,
                thumbnail: info.thumbnail,
                duration: info.duration,
                formats,
                extractor: info.extractor,
            }),
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: err.message || 'Failed to fetch video info' }),
        };
    }
};

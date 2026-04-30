const YTDlpWrap = require('yt-dlp-wrap').default;
const path = require('path');
const fs = require('fs');

// Path to downloaded yt-dlp binary (it downloads automatically if needed, or we use system)
// For robustness, initialize a new instance. By default, it expects yt-dlp in PATH or locally.
// Let's use yt-dlp-wrap to download the binary if it doesn't exist.
let ytDlpWrap;

async function initYTDlp() {
    try {
        const isWin = process.platform === 'win32';
        const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
        const binPath = path.join(__dirname, binName);
        if (!fs.existsSync(binPath)) {
            console.log('Downloading yt-dlp binary...');
            let githubReleasesData = await YTDlpWrap.getGithubReleases(1, 5);
            await YTDlpWrap.downloadFromGithub(binPath, githubReleasesData[0].tag_name, process.platform);
            // Make executable on Linux
            if (!isWin) fs.chmodSync(binPath, 0o755);
        }
        ytDlpWrap = new YTDlpWrap(binPath);
        console.log('yt-dlp wrapper initialized successfully.');
    } catch (error) {
        console.error('Failed to init yt-dlp:', error);
        ytDlpWrap = new YTDlpWrap();
    }
}

// Call init on load
initYTDlp();

exports.getVideoInfo = async (url) => {
    // Return detailed info, format selection
    const rawData = await ytDlpWrap.execPromise([url, '--dump-json']);
    const info = JSON.parse(rawData);

    // Process the formats into a simplified list for the frontend
    const formats = info.formats
        .filter(f => f.vcodec !== 'none' || f.acodec !== 'none') // Ensure it's not totally empty
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
        id: info.id,
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        formats: formats,
        extractor: info.extractor
    };
};

exports.downloadVideo = async (url, formatId, type, res) => {
    const os = require('os');
    const fs = require('fs');
    const ffmpegStatic = require('ffmpeg-static');
    const sessionId = Date.now();
    const ext = type === 'audio' ? 'mp3' : 'mp4';
    const tempFilePath = path.join(os.tmpdir(), `NexDown-${sessionId}.${ext}`);

    // Get the video title first for a proper filename
    let videoTitle = 'download';
    try {
        const titleRaw = await ytDlpWrap.execPromise([url, '--print', '%(title)s', '--no-download']);
        videoTitle = titleRaw.trim().replace(/[<>:"/\\|?*]/g, '').substring(0, 200) || 'download';
    } catch (e) { /* fallback to generic name */ }

    let fId = formatId || 'best';
    let args = [];

    if (type === 'audio') {
        args = [
            url,
            '-f', 'bestaudio',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--ffmpeg-location', ffmpegStatic,
            '-o', tempFilePath
        ];
    } else {
        if (fId !== 'best') {
            fId = `${fId}+bestaudio[ext=m4a]/bestaudio/${fId}`;
        }
        args = [
            url,
            '-f', fId,
            '--merge-output-format', 'mp4',
            '--ffmpeg-location', ffmpegStatic,
            '-o', tempFilePath
        ];
    }

    try {
        await ytDlpWrap.execPromise(args);

        const safeFileName = `${videoTitle}.${ext}`;

        res.download(tempFilePath, safeFileName, (err) => {
            if (err) console.error("Error sending file:", err);
            fs.unlink(tempFilePath, () => { });
        });
    } catch (error) {
        console.error('yt-dlp execution error:', error);
        if (!res.headersSent) res.status(500).send('Failed to process download.');
    }
};

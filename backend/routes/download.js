const express = require('express');
const router = express.Router();
const ytdlp = require('../utils/ytdlp');

router.post('/info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const info = await ytdlp.getVideoInfo(url);
        res.json(info);
    } catch (error) {
        console.error('Error fetching info:', error);
        res.status(500).json({ error: 'Failed to fetch video info', details: error.message });
    }
});

router.get('/download', async (req, res) => {
    try {
        const { url, format, type } = req.query;
        if (!url) return res.status(400).send('URL is required');

        await ytdlp.downloadVideo(url, format, type, res);
    } catch (error) {
        console.error('Error downloading:', error);
        res.status(500).send('Failed to download video');
    }
});

module.exports = router;

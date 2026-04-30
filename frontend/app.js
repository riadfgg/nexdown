document.addEventListener('DOMContentLoaded', () => {
    // ---- DOM Elements ----
    const urlInput = document.getElementById('urlInput');
    const fetchBtn = document.getElementById('fetchBtn');
    const loader = document.getElementById('loader');
    const videoInfoCard = document.getElementById('videoInfoCard');
    const progressSection = document.getElementById('progressSection');
    const videoThumb = document.getElementById('videoThumb');
    const videoTitle = document.getElementById('videoTitle');
    const videoDuration = document.getElementById('videoDuration');
    const qualityList = document.getElementById('qualityList');
    const downloadBtn = document.getElementById('downloadBtn');
    const tabVideo = document.getElementById('tabVideo');
    const tabAudio = document.getElementById('tabAudio');

    let currentVideoData = null;
    let selectedFormatId = null;
    let currentType = 'video';
    let videoFormats = [];
    let audioFormats = [];

    // ---- Helpers ----
    function formatTime(sec) {
        if (!sec) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function formatSize(bytes) {
        if (!bytes) return '';
        const mb = bytes / (1024 * 1024);
        if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
        return `${mb.toFixed(1)} MB`;
    }

    function showToast(msg, isError = false) {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toastMsg');
        const toastIcon = document.getElementById('toastIcon');
        toastMsg.textContent = msg;
        toast.classList.toggle('error', isError);
        toastIcon.className = isError
            ? 'fa-solid fa-circle-exclamation'
            : 'fa-solid fa-check-circle';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    // ---- Render Quality List ----
    function renderQuality(type) {
        currentType = type;
        qualityList.innerHTML = '';
        selectedFormatId = null;
        downloadBtn.disabled = true;

        const formats = type === 'video' ? videoFormats : audioFormats;

        if (formats.length === 0) {
            qualityList.innerHTML = '<p style="color:var(--text-dim);font-size:13px;text-align:center;padding:16px 0;">No formats available</p>';
            return;
        }

        formats.forEach((f, idx) => {
            const item = document.createElement('div');
            item.className = 'quality-item';
            item.dataset.formatId = f.format_id;

            const resolution = f.resolution === 'audio only'
                ? `Audio — ${f.ext.toUpperCase()}`
                : `${f.resolution} — ${f.ext.toUpperCase()}`;

            const sizeText = f.filesize ? formatSize(f.filesize) : '';
            const hasAV = (f.vcodec !== 'none' && f.acodec !== 'none');

            item.innerHTML = `
                <div class="qi-left">
                    <div class="qi-radio"></div>
                    <span class="qi-label">${resolution}${hasAV ? ' <span style="color:var(--purple-light);font-size:11px;">(V+A)</span>' : ''}</span>
                </div>
                ${sizeText ? `<span class="qi-size">${sizeText}</span>` : ''}
            `;

            item.addEventListener('click', () => {
                // Deselect all
                qualityList.querySelectorAll('.quality-item').forEach(el => el.classList.remove('selected'));
                // Select this one
                item.classList.add('selected');
                selectedFormatId = f.format_id;
                downloadBtn.disabled = false;
            });

            qualityList.appendChild(item);

            // Auto-select the first one
            if (idx === 0) {
                item.classList.add('selected');
                selectedFormatId = f.format_id;
                downloadBtn.disabled = false;
            }
        });
    }

    // ---- Tab Switching ----
    tabVideo.addEventListener('click', () => {
        tabVideo.classList.add('active');
        tabAudio.classList.remove('active');
        renderQuality('video');
    });

    tabAudio.addEventListener('click', () => {
        tabAudio.classList.add('active');
        tabVideo.classList.remove('active');
        renderQuality('audio');
    });

    // ---- Fetch Video Info ----
    fetchBtn.addEventListener('click', fetchVideoInfo);
    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') fetchVideoInfo();
    });

    function fetchVideoInfo() {
        const url = urlInput.value.trim();
        if (!url) return showToast('Please paste a video URL first', true);

        loader.classList.remove('hidden');
        videoInfoCard.classList.add('hidden');
        progressSection.classList.add('hidden');

        fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        })
            .then(res => res.json())
            .then(data => {
                loader.classList.add('hidden');
                if (data.error) throw new Error(data.error);

                currentVideoData = data;
                videoTitle.textContent = data.title;
                videoThumb.src = data.thumbnail;
                videoDuration.textContent = formatTime(data.duration);

                // Separate formats
                videoFormats = data.formats.filter(f => f.vcodec !== 'none');
                audioFormats = data.formats.filter(f => f.vcodec === 'none' && f.acodec !== 'none');

                // Reset to video tab
                tabVideo.classList.add('active');
                tabAudio.classList.remove('active');
                renderQuality('video');

                videoInfoCard.classList.remove('hidden');
            })
            .catch(err => {
                loader.classList.add('hidden');
                showToast(err.message || 'Failed to fetch video info', true);
            });
    }

    // ---- Download ----
    downloadBtn.addEventListener('click', () => {
        if (!currentVideoData || !selectedFormatId) {
            showToast('Please select a format first', true);
            return;
        }

        const url = urlInput.value.trim();

        // Show progress
        videoInfoCard.classList.add('hidden');
        progressSection.classList.remove('hidden');

        const bar = document.getElementById('progressBar');
        const text = document.getElementById('progressText');

        let progress = 0;
        const sim = setInterval(() => {
            progress += Math.random() * 8;
            if (progress >= 90) progress = 90;
            bar.style.width = progress + '%';
            text.textContent = `Processing... ${Math.floor(progress)}%`;
        }, 600);

        // Trigger actual download via hidden link
        const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&format=${selectedFormatId}&type=${currentType}`;

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = '';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        // Wait a bit and then clean up UI
        setTimeout(() => {
            document.body.removeChild(a);
            clearInterval(sim);
            bar.style.width = '100%';
            text.textContent = 'Download started! Check your browser downloads.';
            showToast('Download started!');

            setTimeout(() => {
                progressSection.classList.add('hidden');
                videoInfoCard.classList.remove('hidden');
            }, 4000);
        }, 2500);
    });

    // ---- Ctrl+V shortcut ----
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'v' && document.activeElement !== urlInput) {
            urlInput.focus();
        }
    });
});

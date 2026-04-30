const express = require('express');
const cors = require('cors');
const path = require('path');
const downloadRoutes = require('./routes/download');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api', downloadRoutes);

// Catch-all to serve index.html for SPA
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

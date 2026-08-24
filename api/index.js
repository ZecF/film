const express = require('express');
const axios = require('axios');
const { getHome, search, getDetail } = require('./lk21');

const app = express();

// Rute API Scraper Utama
app.get('/api', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { action, query, url } = req.query;

    try {
        if (action === 'home') {
            const data = await getHome();
            return res.json({ status: 200, data });
        }
        if (action === 'search') {
            if (!query) return res.status(400).json({ error: 'Query kosong' });
            const data = await search(query);
            return res.json({ status: 200, data });
        }
        if (action === 'detail') {
            if (!url) return res.status(400).json({ error: 'URL kosong' });
            const data = await getDetail(url);
            return res.json({ status: 200, data });
        }
        return res.status(404).json({ error: 'Aksi tidak ditemukan' });
    } catch (error) {
        return res.status(500).json({ status: 500, error: error.message });
    }
});

// === RUTE PROXY ZYNFEX (MENEMBUS BLOKIR STREAMING) ===
app.use('/api/proxy', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL tujuan wajib diisi!');

    try {
        const customHeaders = {
            'User-Agent': req.query.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        };
        if (req.query.referer) customHeaders['Referer'] = req.query.referer;

        const response = await axios({
            method: 'GET',
            url: targetUrl,
            responseType: 'stream',
            headers: customHeaders,
            timeout: 15000
        });
        
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        response.data.pipe(res);
    } catch (error) {
        console.error('[Proxy Error]:', error.message);
        res.status(500).send('Gagal mengambil stream');
    }
});

module.exports = app;

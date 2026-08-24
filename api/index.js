const { getHome, search, getDetail } = require('./lk21');

module.exports = async function(req, res) {
  // Mengizinkan akses dari web agar tidak kena blokir CORS browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  const { action, query, url } = req.query;

  try {
    if (action === 'home') {
      const data = await getHome();
      return res.status(200).json({ status: 200, data });
    }
    
    if (action === 'search') {
      if (!query) return res.status(400).json({ error: 'Query kosong' });
      const data = await search(query);
      return res.status(200).json({ status: 200, data });
    }
    
    if (action === 'detail') {
      if (!url) return res.status(400).json({ error: 'URL kosong' });
      const data = await getDetail(url);
      return res.status(200).json({ status: 200, data });
    }

    return res.status(404).json({ error: 'Aksi tidak ditemukan. Gunakan action=home/search/detail' });
  } catch (error) {
    console.error("Scraper Error:", error);
    // Mengirimkan pesan error spesifik jika LK21 menolak koneksi Vercel
    return res.status(500).json({ status: 500, error: error.message });
  }
};

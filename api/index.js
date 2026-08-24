const { getHome, search, getDetail } = require('./lk21');

export default async function handler(req, res) {
  // Mengizinkan akses CORS agar web tidak diblokir
  res.setHeader('Access-Control-Allow-Origin', '*');
  
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
    console.error(error);
    return res.status(500).json({ status: 500, error: error.message });
  }
}


const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://tv12.lk21official.cc';

// Fungsi helper untuk mengambil HTML LK21 via Proxy agar Vercel tidak diblokir 403
async function fetchViaProxy(url) {
  const proxyUrls = [
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];

  for (let pUrl of proxyUrls) {
    try {
      const res = await axios.get(pUrl, { timeout: 8000 });
      if (res.data) return res.data;
    } catch (err) {
      continue;
    }
  }
  throw new Error("Gagal mengambil data dari LK21 (Diblokir Cloudflare/Timeout).");
}

async function getHome() {
  try {
    const htmlData = await fetchViaProxy(BASE_URL);
    const $ = cheerio.load(htmlData);
    const results = [];

    $('article').each((_, el) => {
      const $el = $(el);

      let kategori = $el.find('meta[itemprop="genre"]').attr('content') || '';
      if (!kategori) {
        const genres = [];
        $el.find('.genre a, [itemprop="genre"]').each((_, g) => genres.push($(g).text().trim()));
        kategori = genres.join(', ');
      }

      let url = $el.find('a[itemprop="url"]').attr('href') || $el.find('a').attr('href') || '';
      if (url && !url.startsWith('http')) {
        url = BASE_URL + (url.startsWith('/') ? '' : '/') + url;
      }

      let judul = $el.find('.poster-title, [itemprop="name"]').text().trim() ||
                  $el.find('a').attr('title') ||
                  $el.find('img').attr('alt') || '';
      judul = judul.replace(/^Nonton (movie|film) /i, '').replace(/ streaming gratis$/i, '').trim();

      let thumbnail = $el.find('img').attr('src') ||
                      $el.find('img').attr('data-src') ||
                      $el.find('source').attr('srcset') || '';
      if (thumbnail.includes(' ')) {
        thumbnail = thumbnail.split(' ')[0];
      }

      let star = $el.find('[itemprop="ratingValue"]').text().trim() ||
                 $el.find('.rating').text().trim() || 'N/A';
      star = star.replace(/[^0-9.]/g, '') || 'N/A';

      let durasi = $el.find('.duration, [itemprop="duration"]').text().trim() || 'N/A';

      if (judul && url) {
        results.push({ judul, thumbnail, url, star, durasi, kategori });
      }
    });

    return results;
  } catch (error) {
    throw new Error(`Failed to fetch home page: ${error.message}`);
  }
}

async function search(query) {
  if (!query || typeof query !== 'string') {
    throw new Error('Search query must be a valid string');
  }

  try {
    const searchPageUrl = `${BASE_URL}/search?s=${encodeURIComponent(query)}`;
    const pageHtml = await fetchViaProxy(searchPageUrl);
    const $ = cheerio.load(pageHtml);
    
    const searchApiBase = $('body').attr('data-search_url') || 'https://gudangvape.com/';
    const thumbnailApiBase = $('body').attr('data-thumbnail_url') || 'https://poster.assetsy.de/wp-content/uploads/';

    const apiEndpoint = `${searchApiBase}search.php?s=${encodeURIComponent(query)}&page=1`;
    
    // Ambil data JSON pencarian melalui proxy juga
    const apiDataHtml = await fetchViaProxy(apiEndpoint);
    let apiResData;
    try {
      apiResData = typeof apiDataHtml === 'string' ? JSON.parse(apiDataHtml) : apiDataHtml;
    } catch(e) {
      apiResData = {};
    }
    
    const rawItems = apiResData && (apiResData.data || apiResData.items) ? (apiResData.data || apiResData.items) : [];

    const results = rawItems.map(item => {
      let thumbnail = item.poster || '';
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${thumbnailApiBase}${thumbnail}`;
      }

      const itemUrl = `${BASE_URL}/${item.slug}`;
      const judul = item.title || '';
      const kategori = item.type || 'movie';
      const star = item.rating ? String(item.rating) : 'N/A';

      return { thumbnail, url: itemUrl, judul, kategori, star };
    });

    return results;
  } catch (error) {
    throw new Error(`Failed to perform search: ${error.message}`);
  }
}

async function getDetail(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    throw new Error('Target URL/slug must be a valid string');
  }

  let fullUrl = targetUrl.trim();
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = `${BASE_URL}/${fullUrl.replace(/^\//, '')}`;
  }

  try {
    const resHtml = await fetchViaProxy(fullUrl);
    const $ = cheerio.load(resHtml);

    let judul = $('h1').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    judul = judul.replace(/^Nonton (movie|film) /i, '').trim();

    let deskripsi = $('.blockquote').text().trim() ||
                    $('div[itemprop="description"]').text().trim() ||
                    $('.synopsis').text().trim() ||
                    $('meta[name="description"]').attr('content') || '';
    deskripsi = deskripsi.replace(/^Beri rating film ini:\s*Rating kamu:\s*Ubah\s*/i, '').trim();

    const streamUrls = [];

    $('iframe').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('googletagmanager') && !src.includes('facebook') && !src.includes('analytics')) {
        let serverName = $(el).attr('title') || $(el).attr('name') || 'Main Player';
        serverName = serverName.replace(/^Media player /i, '').trim() || 'Main Player';
        if (!streamUrls.some(s => s.url === src)) {
          streamUrls.push({ server: serverName, url: src });
        }
      }
    });

    $('ul li a, select option, div a, #load-player option, .player-options a').each((_, el) => {
      const href = $(el).attr('href') || $(el).attr('value') || $(el).attr('data-url') || $(el).attr('data-src');
      let serverText = $(el).text().trim() || $(el).attr('title') || 'Stream';
      
      if (href && href !== '#' && !href.startsWith('javascript:')) {
        if (href.includes('iframe') || href.includes('player') || href.includes('videonode') || href.includes('stream') || href.includes('embed') || href.includes('vidsrc')) {
          serverText = serverText.replace(/^GANTI PLAYER\s*/i, '').trim();
          if (!streamUrls.some(s => s.url === href)) {
            streamUrls.push({ server: serverText, url: href });
          }
        }
      }
    });

    return {
      judul,
      url: fullUrl,
      deskripsi,
      url_stream: streamUrls
    };
  } catch (error) {
    throw new Error(`Failed to fetch movie detail: ${error.message}`);
  }
}

module.exports = {
  getHome,
  search,
  getDetail
};

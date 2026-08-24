/**
 * Judul : LK21 Scraper CLI & CommonJS Module
 * Base Url: https://tv12.lk21official.cc
 * Author : t.me/Velzyguy
 */

const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://tv12.lk21official.cc';

const client = axios.create({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  },
  timeout: 15000
});

async function getHome() {
  try {
    const response = await client.get(BASE_URL);
    const $ = cheerio.load(response.data);
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
        results.push({
          judul,
          thumbnail,
          url,
          star,
          durasi,
          kategori
        });
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
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': BASE_URL,
      'Referer': searchPageUrl
    };

    const pageRes = await axios.get(searchPageUrl, { headers, timeout: 15000 });
    const $ = cheerio.load(pageRes.data);
    
    const searchApiBase = $('body').attr('data-search_url') || 'https://gudangvape.com/';
    const thumbnailApiBase = $('body').attr('data-thumbnail_url') || 'https://poster.assetsy.de/wp-content/uploads/';

    const apiEndpoint = `${searchApiBase}search.php?s=${encodeURIComponent(query)}&page=1`;
    const apiRes = await axios.get(apiEndpoint, { headers, timeout: 15000 });
    
    const rawItems = apiRes.data && (apiRes.data.data || apiRes.data.items) ? (apiRes.data.data || apiRes.data.items) : [];

    const results = rawItems.map(item => {
      let thumbnail = item.poster || '';
      if (thumbnail && !thumbnail.startsWith('http')) {
        thumbnail = `${thumbnailApiBase}${thumbnail}`;
      }

      const itemUrl = `${BASE_URL}/${item.slug}`;
      const judul = item.title || '';
      const kategori = item.type || 'movie';
      const star = item.rating ? String(item.rating) : 'N/A';

      return {
        thumbnail,
        url: itemUrl,
        judul,
        kategori,
        star
      };
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
    const res = await client.get(fullUrl);
    const $ = cheerio.load(res.data);

    let judul = $('h1').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    judul = judul.replace(/^Nonton (movie|film) /i, '').trim();

    let deskripsi = $('.blockquote').text().trim() ||
                    $('div[itemprop="description"]').text().trim() ||
                    $('.synopsis').text().trim() ||
                    $('meta[name="description"]').attr('content') || '';
    deskripsi = deskripsi.replace(/^Beri rating film ini:\s*Rating kamu:\s*Ubah\s*/i, '').trim();

    const streamUrls = [];

    iframes
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

    // Extract from server selection buttons/links
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

// Module Exports for CJS
module.exports = {
  getHome,
  search,
  getDetail
};

// CLI Command Runner
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Penggunaan Command LK21 Scraper:
  node lk21.js --home
    Menampilkan data result lengkap halaman utama (thumbnail, url, star, durasi, judul, kategori)

  node lk21.js --search <query>
    Mencari film/series berdasarkan kata kunci (thumbnail, url, judul, kategori, star)

  node lk21.js <url_atau_slug>
    Menampilkan detail film/series (judul, url, deskripsi, url stream)
    Contoh: node lk21.js https://tv12.lk21official.cc/spider-man-brand-new-day-2026
`);
    process.exit(0);
  }

  async function main() {
    const firstArg = args[0];

    if (firstArg === '--home' || firstArg === '-home') {
      const data = await getHome();
      console.log(JSON.stringify(data, null, 2));
    } else if (firstArg === '--search' || firstArg === '-s') {
      const query = args.slice(1).join(' ');
      if (!query) {
        console.error('Error: Masukkan kata kunci pencarian! Contoh: node lk21.js --search siderman');
        process.exit(1);
      }
      const data = await search(query);
      console.log(JSON.stringify(data, null, 2));
    } else {
      // Detail view command
      const target = firstArg.startsWith('--') ? args[1] : firstArg;
      if (!target) {
        console.error('Error: Masukkan URL atau slug film! Contoh: node lk21.js https://tv12.lk21official.cc/spider-man-brand-new-day-2026');
        process.exit(1);
      }
      const data = await getDetail(target);
      console.log(JSON.stringify(data, null, 2));
    }
  }

  main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
      }

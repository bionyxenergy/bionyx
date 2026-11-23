// BioNyx exercise-GIF proxy.
// Keeps your RapidAPI key server-side. Set these in Netlify:
//   Site settings -> Environment variables
//     EXERCISEDB_KEY   = your RapidAPI key
//     EXERCISEDB_HOST  = the x-rapidapi-host from your RapidAPI console's "Headers" tab
//                        (e.g. edb-with-gifs-and-images-by-ascendapi.p.rapidapi.com)
const KEY  = process.env.EXERCISEDB_KEY;
const HOST = process.env.EXERCISEDB_HOST;

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=604800' // cache a week at the edge/browser
  };
  const name = ((event.queryStringParameters || {}).name || '').trim();
  if (!name) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'name query param required' }) };
  if (!KEY || !HOST) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'EXERCISEDB_KEY / EXERCISEDB_HOST not set in Netlify env' }) };

  const h = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };
  const pick = (o) => o ? (o['360p'] || o['480p'] || o['720p'] || Object.values(o)[0]) : null;

  try {
    // 1) fuzzy-search the exercise by name
    const sRes = await fetch(`https://${HOST}/api/v1/exercises/search?search=${encodeURIComponent(name)}&threshold=0.3`, { headers: h });
    if (!sRes.ok) return { statusCode: sRes.status, headers: cors, body: JSON.stringify({ error: 'search failed', status: sRes.status }) };
    const sJson = await sRes.json();
    const list = Array.isArray(sJson) ? sJson : (sJson.data || sJson.exercises || sJson.results || []);
    if (!list.length) return { statusCode: 200, headers: cors, body: JSON.stringify({ gif: null, image: null, name: null }) };

    const top = list[0];
    const id  = top.exerciseId || top.id;
    let gif = null, image = top.imageUrl || null;

    // 2) fetch the single exercise for its GIF url(s)
    if (id) {
      const dRes = await fetch(`https://${HOST}/api/v1/exercises/${encodeURIComponent(id)}`, { headers: h });
      if (dRes.ok) {
        const d  = await dRes.json();
        const ex = d.data || d;
        gif   = pick(ex.gifUrls)   || ex.gifUrl   || gif;
        image = pick(ex.imageUrls) || ex.imageUrl || image;
      }
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ gif, image, name: top.name || null, query: name }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};

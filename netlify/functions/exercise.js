// BioNyx exercise-media proxy (debug build).
// Env vars in Netlify: EXERCISEDB_KEY, EXERCISEDB_HOST
const KEY  = process.env.EXERCISEDB_KEY;
const HOST = process.env.EXERCISEDB_HOST;

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=604800' };
  const q = event.queryStringParameters || {};
  const name = (q.name || '').trim();
  const debug = q.debug === '1';
  if (!name) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'name query param required' }) };
  if (!KEY || !HOST) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'EXERCISEDB_KEY / EXERCISEDB_HOST not set in Netlify env' }) };

  const h = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };
  const pick = (o) => (o && typeof o === 'object') ? (o['360p'] || o['480p'] || o['720p'] || Object.values(o)[0]) : (typeof o === 'string' ? o : null);
  const gifOf = (ex) => pick(ex.gifUrls) || ex.gifUrl || ex.gif || pick(ex.videoUrls) || ex.videoUrl || ex.video || ex.animationUrl || null;
  const imgOf = (ex) => pick(ex.imageUrls) || ex.imageUrl || ex.image || null;

  try {
    const sRes = await fetch(`https://${HOST}/api/v1/exercises/search?search=${encodeURIComponent(name)}&threshold=0.3`, { headers: h });
    const sTxt = await sRes.text(); let sJson; try { sJson = JSON.parse(sTxt); } catch (e) { sJson = sTxt; }
    const list = Array.isArray(sJson) ? sJson : ((sJson && (sJson.data || sJson.exercises || sJson.results)) || []);
    if (!list.length) return { statusCode: 200, headers: cors, body: JSON.stringify({ gif: null, image: null, name: null, _searchStatus: sRes.status, _debug: debug ? sJson : undefined }) };

    const top = list[0];
    const id  = top.exerciseId || top.id || top._id || top.uuid;
    let gif = gifOf(top), image = imgOf(top), rawDetail = null, detailStatus = null;

    if (id) {
      const dRes = await fetch(`https://${HOST}/api/v1/exercises/${encodeURIComponent(id)}`, { headers: h });
      detailStatus = dRes.status;
      const dTxt = await dRes.text(); let dJson; try { dJson = JSON.parse(dTxt); } catch (e) { dJson = dTxt; }
      const ex = (dJson && (dJson.data || dJson)) || {};
      rawDetail = ex;
      gif = gifOf(ex) || gif;
      image = imgOf(ex) || image;
    }

    const out = { gif, image, name: top.name || null, query: name };
    if (debug) { out._id = id; out._searchKeys = Object.keys(top); out._searchItem = top; out._detailStatus = detailStatus; out._detailKeys = rawDetail ? Object.keys(rawDetail) : null; out._detail = rawDetail; }
    return { statusCode: 200, headers: cors, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};

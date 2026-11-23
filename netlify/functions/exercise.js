// BioNyx exercise-media proxy.
// Netlify env vars: EXERCISEDB_KEY, EXERCISEDB_HOST
// Returns an animated MP4 demo + still image + target/secondary muscles + cues,
// so the app can show a real exercise demo in place of the muscle diagram.
const KEY  = process.env.EXERCISEDB_KEY;
const HOST = process.env.EXERCISEDB_HOST;

exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=604800' };
  const q = event.queryStringParameters || {};
  const name = (q.name || '').trim();
  if (!name) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'name query param required' }) };
  if (!KEY || !HOST) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'EXERCISEDB_KEY / EXERCISEDB_HOST not set in Netlify env' }) };

  const equip = (q.equip || '').trim();
  const h = { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST };
  const imgOf = (ex) => (ex.imageUrls && (ex.imageUrls['720p'] || ex.imageUrls['480p'] || ex.imageUrls['360p'] || Object.values(ex.imageUrls)[0])) || ex.imageUrl || null;
  const vidOf = (ex) => ex.videoUrl || (ex.videoUrls && (ex.videoUrls['720p'] || ex.videoUrls['480p'] || ex.videoUrls['360p'] || Object.values(ex.videoUrls)[0])) || null;
  const empty = { name: null, video: null, image: null, target: [], secondary: [], equipment: [], bodyParts: [], instructions: [], query: name };
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

  // Score a search result by how well its name overlaps the query, plus an equipment-match bonus.
  const score = (item) => {
    const qn = norm(name), qw = qn.split(' ').filter((w) => w.length > 2);
    const xn = norm(item.name), xw = xn.split(' ');
    let s = qw.filter((w) => xw.includes(w)).length;
    if (xn === qn) s += 6; else if (xn.includes(qn)) s += 3;
    if (equip) { const eq = norm(equip).split('/')[0]; const ie = norm(Array.isArray(item.equipments) ? item.equipments.join(' ') : (item.equipment || '')); if (eq && ie.includes(eq.trim())) s += 2; }
    return s;
  };

  try {
    const sRes = await fetch(`https://${HOST}/api/v1/exercises/search?search=${encodeURIComponent(name)}&threshold=0.3`, { headers: h });
    const sJson = await sRes.json().catch(() => null);
    const list = Array.isArray(sJson) ? sJson : ((sJson && (sJson.data || sJson.exercises || sJson.results)) || []);
    if (!list.length) return { statusCode: 200, headers: cors, body: JSON.stringify(empty) };

    const top = list.slice().sort((a, b) => score(b) - score(a))[0];
    const id  = top.exerciseId || top.id || top._id;
    let ex = top;
    if (id) {
      const dRes = await fetch(`https://${HOST}/api/v1/exercises/${encodeURIComponent(id)}`, { headers: h });
      const dJson = await dRes.json().catch(() => null);
      ex = (dJson && (dJson.data || dJson)) || top;
    }

    const out = {
      name: ex.name || top.name || null,
      video: vidOf(ex),
      image: imgOf(ex) || imgOf(top),
      target: ex.targetMuscles || [],
      secondary: ex.secondaryMuscles || [],
      equipment: ex.equipments || ex.equipment || [],
      bodyParts: ex.bodyParts || [],
      instructions: ex.instructions || [],
      query: name
    };
    return { statusCode: 200, headers: cors, body: JSON.stringify(out) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: String((e && e.message) || e) }) };
  }
};

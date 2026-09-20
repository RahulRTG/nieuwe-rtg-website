'use strict';

const { netwerkGrens, normaliseerUrl } = require('../local-ai')._intern;
const MAX_OPNAME_BYTES = 60 * 1024 * 1024;
const OPNAME_SOORTEN = [
  'audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg',
  'video/webm', 'video/mp4', 'video/quicktime'
];

/* Een bewaarde Salon-opname vraagt tijdcodes terug. De videobytes staan al in
   de mediastore; deze laag bewaart geen tweede kopie. */
module.exports = ({ beschikbaar }) => async function transcribeerOpname(bytes,
  { soort, taal, duurS, env, fetchImpl } = {}) {
  const e = env || process.env;
  const stand = beschikbaar(e);
  if (!stand.beschikbaar) return { status: 503, error: stand.reden, ingericht: false };
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (!buf.length) return { status: 400, error: 'Er kwam geen opname mee.' };
  if (buf.length > MAX_OPNAME_BYTES) return { status: 413, error: 'Deze opname is groter dan 60 MB.' };
  const type = OPNAME_SOORTEN.includes(String(soort || '')) ? String(soort) : 'video/webm';
  const basis = normaliseerUrl(String(e.LOCAL_AI_URL || e.LOCAL_AI_BASE_URL || ''),
    String(e.LOCAL_AI_LAN_TOESTAAN || '') === '1');
  const ext = type === 'video/quicktime' ? 'mov' : (type.split('/')[1] || 'webm');
  const form = new FormData();
  form.append('model', stand.model);
  form.append('file', new Blob([buf], { type }), 'opname.' + ext);
  if (taal) form.append('language', String(taal).slice(0, 8));
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  let antwoord;
  try {
    antwoord = await (fetchImpl || fetch)(basis + '/v1/audio/transcriptions', { method: 'POST', body: form });
  } catch (err) {
    return { status: 502, error: 'De lokale modelserver antwoordde niet (' + (err && err.message) + ').' };
  }
  if (!antwoord || !antwoord.ok) return { status: 502,
    error: 'De lokale modelserver gaf een fout terug (' + ((antwoord && antwoord.status) || '?') + ').' };
  let rauw = '';
  try { rauw = String(await antwoord.text() || ''); } catch (err) {}
  let data = null;
  try { data = JSON.parse(rauw); } catch (err) {}
  const tekst = String((data && data.text) || (!data ? rauw : '') || '')
    .replace(/\s+/g, ' ').trim().slice(0, 24000);
  const segmenten = Array.isArray(data && data.segments) ? data.segments.map(s => ({
    van: Number(s.start), tot: Number(s.end), tekst: String(s.text || '').trim()
  })) : [];
  const schoonCues = require('./ondertitels').schoonCues;
  let ondertitels = schoonCues(segmenten, duurS) || [];
  let precies = ondertitels.length > 0;
  /* Sommige lokale OpenAI-compatibele servers geven geen tijdcodes. Verdeel
     dan de zinnen over de gemelde duur en laat de maker ze voor plaatsing zien. */
  if (!ondertitels.length && tekst) {
    const delen = tekst.match(/.{1,110}(?:\s+|$)/g) || [tekst];
    const duur = Math.max(1, Math.min(6 * 3600, Number(duurS) || delen.length * 4));
    ondertitels = schoonCues(delen.slice(0, 200).map((t, i, alle) => ({
      van: i * duur / alle.length, tot: (i + 1) * duur / alle.length, tekst: t.trim()
    })), duur) || [];
    precies = false;
  }
  return { ok: true, tekst, ondertitels, precies, stil: !tekst };
};

module.exports.MAX_OPNAME_BYTES = MAX_OPNAME_BYTES;
module.exports.OPNAME_SOORTEN = OPNAME_SOORTEN;

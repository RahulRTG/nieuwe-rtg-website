/* ============================================================================
   SPRAAK NAAR TEKST -- lokaal, of helemaal niet.

   WAT HIER WORDT OPGELOST. TOEGANKELIJK.md en `scripts/check.js` regel 49 zeggen
   het onverbloemd: tien live vormen in dit huis hebben geen weg naar tekst, en
   zolang die er niet is kan wie doof is niet meedoen aan een gesprek hier. De
   meeleesbaan (shared/meelezen.js) verplaatste die afhankelijkheid van "kan niet
   meedoen" naar "kan meedoen als de anderen meetypen". Deze module is de
   ontbrekende helft: tekst die vanzelf ontstaat.

   WAAROM DIT NIET DE WEB SPEECH API IS. Die stuurt het geluid van het gesprek
   naar een server van de browserleverancier. Dit huis draait op codenamen met de
   echte namen in een aparte kluis; het gesprek van twee leden naar buiten sturen
   om er tekst van te maken is precies wat dat ontwerp voorkomt. Er is geen
   instelling die dat goedmaakt, dus die weg bestaat hier niet.

   WAT HET WEL IS. Een OpenAI-compatibel transcriptie-eindpunt op de EIGEN
   modelserver (LOCAL_AI_URL). De netwerkgrens komt uit ./../local-ai.js en wordt
   hier niet nagebouwd: loopback altijd, eigen netwerk alleen met
   LOCAL_AI_LAN_TOESTAAN=1, publieke host nooit. Eén grens, één plek.

   DRIE DINGEN DIE HIER NIET GEBEUREN, en de code weigert ze:
     - GEEN UITWIJK NAAR BUITEN. `kern/ai.js` heeft een uitwijkketen omdat een
       tekstantwoord bij de derde aanbieder net zo goed is. Geluid is dat niet:
       dat is de stem van een lid. Ontbreekt het lokale model, dan is het antwoord
       "dit kan hier niet" en nooit een andere aanbieder.
     - GEEN EXTRA GELUIDSKOPIE. Live fragmenten worden niet bewaard. Bij een
       al opgeslagen Salon-video bewaart de Salon alleen de teruggegeven
       tijdregels naast het origineel; deze laag schrijft zelf niets weg.
     - GEEN STIL "HET WERKT". Is er geen model, dan zegt `beschikbaar()` dat met
       de reden. Een ondertitelknop die niets doet is erger dan geen knop: hij
       laat iemand aan een gesprek beginnen in de veronderstelling dat hij het
       kan volgen.
   ========================================================================== */
'use strict';

const { netwerkGrens, normaliseerUrl } = require('../local-ai')._intern;

/* Een fragment is een paar seconden spraak. De grens staat hier en niet op de
   route: wie hem daar zet, moet hem bij een tweede ingang opnieuw bedenken. */
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_OPNAME_BYTES = 60 * 1024 * 1024;
const SOORTEN = ['audio/webm', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/mpeg'];
const OPNAME_SOORTEN = SOORTEN.concat(['video/webm', 'video/mp4', 'video/quicktime']);

/* Welk model. Apart van LOCAL_AI_MODEL, om dezelfde reden als de andere drie in
   ./../local-ai.js: een tekstmodel kan geen geluid horen, en een zwaar model
   wakker maken voor drie seconden spraak is verspilling. Leeg = deze
   voorziening bestaat hier niet, en dat wordt gezegd. */
const modelNaam = (env) => String((env || process.env).LOCAL_AI_MODEL_SPRAAK || '').trim();

function beschikbaar(env) {
  const e = env || process.env;
  const model = modelNaam(e);
  const url = String(e.LOCAL_AI_URL || e.LOCAL_AI_BASE_URL || '').trim();
  if (!url) {
    return { beschikbaar: false, reden: 'Er is geen lokale modelserver ingericht (LOCAL_AI_URL). ' +
      'Automatisch ondertitelen kan alleen lokaal: het geluid van een gesprek gaat dit huis niet uit.' };
  }
  if (!model) {
    return { beschikbaar: false, reden: 'Er is geen spraakmodel gekozen (LOCAL_AI_MODEL_SPRAAK). ' +
      'Een tekstmodel kan geen geluid horen, dus dat wordt hier niet stilzwijgend voor gebruikt.' };
  }
  try {
    normaliseerUrl(url, String(e.LOCAL_AI_LAN_TOESTAAN || '') === '1');
  } catch (err) {
    return { beschikbaar: false, reden: 'De lokale modelserver komt niet door de netwerkgrens: ' + err.message };
  }
  return { beschikbaar: true, model };
}

/* Het transcriberen zelf. Geeft { ok, tekst } of { error } -- nooit een halve
   uitkomst, en nooit een lege string die op stilte lijkt terwijl er iets misging.

   `fetch` en `FormData` zijn ingebouwd sinds Node 18; er komt geen pakket bij
   (keuringsregel: nul dependencies). */
async function transcribeer(bytes, { soort, taal, env, fetchImpl } = {}) {
  const e = env || process.env;
  const st = beschikbaar(e);
  if (!st.beschikbaar) return { status: 503, error: st.reden, ingericht: false };

  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (!buf.length) return { status: 400, error: 'Er kwam geen geluid mee.' };
  if (buf.length > MAX_BYTES) {
    return { status: 413, error: 'Dit fragment is te groot. Ondertitelen gaat per paar seconden, ' +
      'niet per opname -- een lange opname is trouwens ook geen LIVE ondertiteling meer.' };
  }
  const type = SOORTEN.includes(String(soort || '')) ? String(soort) : 'audio/webm';

  const basis = normaliseerUrl(String(e.LOCAL_AI_URL || e.LOCAL_AI_BASE_URL || ''),
    String(e.LOCAL_AI_LAN_TOESTAAN || '') === '1');
  const form = new FormData();
  form.append('model', st.model);
  form.append('file', new Blob([buf], { type }), 'fragment.' + (type.split('/')[1] || 'webm'));
  if (taal) form.append('language', String(taal).slice(0, 8));
  /* Alleen de tekst. Tijdcodes en waarschijnlijkheden hebben wij hier niet
     nodig, en wat je niet vraagt komt ook niet terug om per ongeluk bewaard te
     worden. */
  form.append('response_format', 'text');

  const doe = fetchImpl || fetch;
  let r;
  try {
    r = await doe(basis + '/v1/audio/transcriptions', { method: 'POST', body: form });
  } catch (err) {
    return { status: 502, error: 'De lokale modelserver antwoordde niet (' + (err && err.message) + ').' };
  }
  if (!r || !r.ok) {
    return { status: 502, error: 'De lokale modelserver gaf een fout terug (' + ((r && r.status) || '?') + ').' };
  }
  let tekst = '';
  try { tekst = String(await r.text() || ''); } catch (err) { tekst = ''; }
  /* Sommige servers geven JSON terug ook als je tekst vraagt. Dat is geen fout
     van de aanroeper, dus wij lezen allebei in plaats van te klagen. */
  if (tekst.trim().startsWith('{')) {
    try { tekst = String(JSON.parse(tekst).text || ''); } catch (err) {}
  }
  return { ok: true, tekst: tekst.replace(/\s+/g, ' ').trim().slice(0, 400) };
}

/* Een BEWAARDE opname is niet hetzelfde als de live fragmenten hierboven.
   De Salon vraagt daarom tijdcodes terug. De videobytes staan daar al in de
   eigen mediastore; deze functie bewaart geen extra kopie en gebruikt nog
   steeds uitsluitend de lokale modelserver. */
async function transcribeerOpname(bytes, { soort, taal, duurS, env, fetchImpl } = {}) {
  const e = env || process.env;
  const st = beschikbaar(e);
  if (!st.beschikbaar) return { status: 503, error: st.reden, ingericht: false };
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (!buf.length) return { status: 400, error: 'Er kwam geen opname mee.' };
  if (buf.length > MAX_OPNAME_BYTES) return { status: 413, error: 'Deze opname is groter dan 60 MB.' };
  const type = OPNAME_SOORTEN.includes(String(soort || '')) ? String(soort) : 'video/webm';
  const basis = normaliseerUrl(String(e.LOCAL_AI_URL || e.LOCAL_AI_BASE_URL || ''),
    String(e.LOCAL_AI_LAN_TOESTAAN || '') === '1');
  const ext = type === 'video/quicktime' ? 'mov' : (type.split('/')[1] || 'webm');
  const form = new FormData();
  form.append('model', st.model);
  form.append('file', new Blob([buf], { type }), 'opname.' + ext);
  if (taal) form.append('language', String(taal).slice(0, 8));
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  let r;
  try { r = await (fetchImpl || fetch)(basis + '/v1/audio/transcriptions', { method: 'POST', body: form }); }
  catch (err) { return { status: 502, error: 'De lokale modelserver antwoordde niet (' + (err && err.message) + ').' }; }
  if (!r || !r.ok) return { status: 502, error: 'De lokale modelserver gaf een fout terug (' + ((r && r.status) || '?') + ').' };
  let rauw = '';
  try { rauw = String(await r.text() || ''); } catch (err) {}
  let data = null;
  try { data = JSON.parse(rauw); } catch (err) {}
  const tekst = String((data && data.text) || (!data ? rauw : '') || '').replace(/\s+/g, ' ').trim().slice(0, 24000);
  const segmenten = Array.isArray(data && data.segments) ? data.segments.map(s => ({
    van: Number(s.start), tot: Number(s.end), tekst: String(s.text || '').trim()
  })) : [];
  const schoonCues = require('./ondertitels').schoonCues;
  let ondertitels = schoonCues(segmenten, duurS) || [];
  let precies = ondertitels.length > 0;
  /* Niet elke lokale OpenAI-compatibele server geeft tijdcodes terug. In dat
     geval verdelen we de zinnen over de gemelde speelduur. De maker ziet en
     kan die regels vóór plaatsing aanpassen; we noemen dit daarom niet exact. */
  if (!ondertitels.length && tekst) {
    const delen = tekst.match(/.{1,110}(?:\s+|$)/g) || [tekst];
    const duur = Math.max(1, Math.min(6 * 3600, Number(duurS) || delen.length * 4));
    ondertitels = schoonCues(delen.slice(0, 200).map((t, i, a) => ({
      van: i * duur / a.length, tot: (i + 1) * duur / a.length, tekst: t.trim()
    })), duur) || [];
    precies = false;
  }
  return { ok: true, tekst, ondertitels, precies, stil: !tekst };
}

module.exports = { beschikbaar, transcribeer, transcribeerOpname, modelNaam,
  MAX_BYTES, MAX_OPNAME_BYTES, SOORTEN, OPNAME_SOORTEN };

#!/usr/bin/env node
/* Readiness-proef voor de lokale OpenAI-compatibele modelserver. Er wordt geen
   gebruikersdata gelezen: alleen een vaste controlevraag gaat naar de
   ingestelde LOCAL_AI_URL.

   ELK INGESTELD MODEL APART, en dat is de hele reden dat dit meer is dan een
   ping. Deze proef stuurde een vraag met max_tokens 32, en modelVoor() in
   server/local-ai.js kiest bij <= 200 het KORTE model. Stond LOCAL_AI_MODEL
   verkeerd (een typefout, een model dat de server niet geladen heeft), dan
   slaagde deze check gewoon -- terwijl elk normaal verzoek daarna stilletjes
   naar de betaalde uitwijk viel. Precies het soort storing dat je pas op de
   factuur ziet.

   Daarom wordt nu elk DISTINCT ingesteld model afzonderlijk aangesproken, met
   een verzoek dat gegarandeerd naar dat model routeert. Het vision-model doet
   alleen mee als het is ingesteld; ontbreekt het, dan claimt de laag ook geen
   beeld en valt er niets te proeven. */
'use strict';

const fs = require('fs');
const path = require('path');
const envPad = process.env.RTG_ENV_FILE || path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPad)) require('./docker/start').laadBestand(envPad, process.env);
const LocalAI = require('../server/local-ai');

/* Een piepklein doorzichtig PNG (1x1), zodat de vision-proef een echt beeld
   meestuurt zonder ergens een bestand voor nodig te hebben. */
const PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/* Per rol een verzoek dat GEGARANDEERD naar dat model gaat -- zie modelVoor()
   in server/local-ai.js: beeld wint, dan tools, dan max_tokens <= 200. */
function proeven(client) {
  const uit = [];
  const m = client.modellen;
  const basis = { system: 'Dit is een technische readiness-proef. Antwoord kort.',
    messages: [{ role: 'user', content: 'Antwoord exact met: RTG lokaal gereed' }] };
  uit.push({ rol: 'kort', model: m.kort, params: Object.assign({ max_tokens: 32 }, basis) });
  if (m.tekst !== m.kort) uit.push({ rol: 'tekst', model: m.tekst, params: Object.assign({ max_tokens: 400 }, basis) });
  if (client.mogelijkheden.hulpmiddelen && m.tools !== m.kort && m.tools !== m.tekst) {
    uit.push({ rol: 'tools', model: m.tools, params: Object.assign({ max_tokens: 400,
      tools: [{ name: 'niets', description: 'doet niets', input_schema: { type: 'object', properties: {} } }] }, basis) });
  }
  if (m.vision) {
    uit.push({ rol: 'beeld', model: m.vision, params: { max_tokens: 64,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PIXEL } },
        { type: 'text', text: 'Antwoord exact met: RTG lokaal gereed' }] }] } });
  }
  return uit;
}

/* HET VENSTER, GEMETEN IN PLAATS VAN AANGENOMEN. Een server die te weinig
   venster heeft, antwoordt gewoon -- hij kapt alleen stil het begin af. Deze
   proef stuurt een lange tekst met een codewoord VOORAAN en vraagt het terug,
   en legt de telling van de server naast de schatting van RTG. Twee uitkomsten
   die elkaar controleren: telt de server duidelijk minder dan er ging, of komt
   het codewoord niet terug, dan is er afgekapt. Zonder verklaard venster
   (LOCAL_AI_CONTEXT) is er niets om tegen te meten, en dat staat er dan. */
async function vensterProef(client) {
  const v = client.venster;
  if (v.herkomst !== 'verklaard')
    return { ok: null, stand: 'niet vast te stellen', reden: 'LOCAL_AI_CONTEXT ontbreekt; RTG neemt ' + v.tokens + ' aan en dwingt niets af.' };
  const { schatTokens } = require('../server/kern/ai/contextpakket');
  const code = 'KOMPAS-' + Math.floor(Math.random() * 9e5 + 1e5);
  const zin = 'Dit is opvultekst voor de vensterproef van RTG en hij betekent verder niets. ';
  const vraag = '\nWat was het codewoord aan het begin? Antwoord alleen met het codewoord.';
  const kop = 'Het codewoord is ' + code + '. Onthoud het.\n';
  const doel = Math.floor((v.tokens - 64) * 0.8);
  let opvul = '';
  while (schatTokens(kop + opvul + zin + vraag) < doel) opvul += zin;
  const tekst = kop + opvul + vraag;
  const begin = Date.now();
  try {
    /* max_tokens klein en boven 200 niet: dan gaat hij naar het KORTE model,
       en dat is het model met het kleinste venster als ze verschillen. */
    const r = await client.messages.create({ max_tokens: 48, messages: [{ role: 'user', content: tekst }] });
    const antwoord = (r.content || []).map(x => x.text || '').join('').trim();
    const u = r.usage || {};
    const geteld = (Number(u.input_tokens) || 0) + (Number(u.cache_read_input_tokens) || 0);
    const geschat = schatTokens(tekst);
    const terug = antwoord.includes(code);
    const verhouding = geteld ? Math.round(geschat / geteld * 100) / 100 : null;
    /* De schatting van RTG is bewust te hoog (tekens/3); telt de server meer
       dan RTG schat, dan past er minder dan RTG denkt en kan dat afkappen. */
    const onderschat = geteld > geschat;
    return { ok: terug && !onderschat, stand: terug ? (onderschat ? 'schatting te krap' : 'past') : 'afgekapt vermoed',
      verklaard: v.tokens, geschat, geteld: geteld || null, schattingPerGeteld: verhouding, codewoordTerug: terug,
      latencyMs: Date.now() - begin,
      uitleg: terug ? (onderschat ? 'De server telt meer tokens dan RTG schat: verlaag TEKENS_PER_TOKEN in server/kern/ai/contextpakket.js.' : null)
        : 'Het codewoord aan het begin kwam niet terug: de server kapt vermoedelijk af. Zet OLLAMA_CONTEXT_LENGTH en num_ctx gelijk aan LOCAL_AI_CONTEXT.' };
  } catch (e) {
    return { ok: false, stand: 'storing', verklaard: v.tokens, fout: e.message };
  }
}

async function hoofd() {
  let client;
  try {
    client = new LocalAI({
      timeout: Number(process.env.LOCAL_AI_CHECK_TIMEOUT_MS) || Number(process.env.LOCAL_AI_TIMEOUT_MS) || 120000,
      /* De poort (gelijktijdigheid en onderbreker) hoort hier niet mee te doen:
         een readiness-proef moet de stand MELDEN, niet zelf een klep dichtgooien
         voor het echte verkeer. */
      gelijktijdig: 1, wachtMs: 0, storingsgrens: 1e9
    });
  } catch (e) {
    console.error(JSON.stringify({ ok: false, fase: 'configuratie', fout: e.message }, null, 2));
    process.exitCode = 1;
    return;
  }

  const lijst = proeven(client);
  const uitslag = [];
  let alles = true;
  for (const p of lijst) {
    const begin = Date.now();
    try {
      const r = await client.messages.create(p.params);
      const antwoord = (r.content || []).map(x => x.text || '').join('').trim();
      /* Een tools-proef mag zonder tekst antwoorden (hij mag het gereedschap
         pakken); voor de andere rollen is stilte wel een storing. */
      if (!antwoord && p.rol !== 'tools') {
        throw new Error('De modelserver antwoordde zonder zichtbare tekst. Controleer reasoning-instellingen en modelcompatibiliteit.');
      }
      uitslag.push({ rol: p.rol, model: p.model, ok: true, latencyMs: Date.now() - begin,
        antwoord: antwoord.slice(0, 120) });
    } catch (e) {
      alles = false;
      uitslag.push({ rol: p.rol, model: p.model, ok: false, latencyMs: Date.now() - begin, fout: e.message });
    }
  }

  const venster = await vensterProef(client);
  if (venster.ok === false) alles = false;

  const verslag = { ok: alles, provider: client.naam, lokaal: true, verwerking: client.verwerking,
    modellen: client.modellen, mogelijkheden: client.mogelijkheden, proeven: uitslag, venster };
  if (alles) console.log(JSON.stringify(verslag, null, 2));
  else { console.error(JSON.stringify(verslag, null, 2)); process.exitCode = 1; }
}

hoofd();

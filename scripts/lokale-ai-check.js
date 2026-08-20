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

  const verslag = { ok: alles, provider: client.naam, lokaal: true, verwerking: client.verwerking,
    modellen: client.modellen, mogelijkheden: client.mogelijkheden, proeven: uitslag };
  if (alles) console.log(JSON.stringify(verslag, null, 2));
  else { console.error(JSON.stringify(verslag, null, 2)); process.exitCode = 1; }
}

hoofd();

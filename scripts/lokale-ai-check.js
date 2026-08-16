#!/usr/bin/env node
/* Kleine readiness-proef voor de lokale OpenAI-compatibele modelserver. Er
   wordt geen gebruikersdata gelezen: alleen een vaste controlevraag gaat naar
   de ingestelde LOCAL_AI_URL. */
'use strict';

const fs = require('fs');
const path = require('path');
const envPad = process.env.RTG_ENV_FILE || path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPad)) require('./docker/start').laadBestand(envPad, process.env);
const LocalAI = require('../server/local-ai');

async function hoofd() {
  let client;
  try { client = new LocalAI({ timeout: Number(process.env.LOCAL_AI_CHECK_TIMEOUT_MS) ||
    Number(process.env.LOCAL_AI_TIMEOUT_MS) || 120000 }); }
  catch (e) {
    console.error(JSON.stringify({ ok: false, fase: 'configuratie', fout: e.message }, null, 2));
    process.exitCode = 1;
    return;
  }
  try {
    const begin = Date.now();
    const r = await client.messages.create({ model: 'lokaal', max_tokens: 32,
      system: 'Dit is een technische readiness-proef. Antwoord kort.',
      messages: [{ role: 'user', content: 'Antwoord exact met: RTG lokaal gereed' }] });
    const antwoord = (r.content || []).map(x => x.text || '').join('').trim();
    if (!antwoord) throw new Error('De modelserver antwoordde zonder zichtbare tekst. Controleer reasoning-instellingen en modelcompatibiliteit.');
    console.log(JSON.stringify({ ok: true, provider: client.naam, lokaal: true,
      modellen: client.modellen, mogelijkheden: client.mogelijkheden,
      latencyMs: Date.now() - begin, antwoord: antwoord.slice(0, 120) }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ ok: false, fase: 'verbinding', provider: 'local', fout: e.message }, null, 2));
    process.exitCode = 1;
  }
}

hoofd();

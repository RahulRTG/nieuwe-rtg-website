#!/usr/bin/env node
/* ============================================================================
   WAT KRIJGT HET LOKALE MODEL TE ZIEN -- voor en na de contextsamensteller.

   Een eigen modelserver kapt stil af wat niet in zijn venster past, vanaf het
   begin. Deze meting bouwt de ECHTE prompts van Rahul (de ledenchat uit
   kern/ai/prompt.js, en de stuurlus met RAHUL_LEAD en de huisregels) voor een
   handvol herkenbare situaties, en zegt per venster:

     zonder  hoeveel tokens het verzoek nodig heeft, en hoeveel daarvan de
             server bij dit venster stil van het begin zou afkappen;
     met     wat de samensteller ervan maakt: past het, hoeveel is ingekort of
             weggelaten, of weigert hij met CONTEXT_PAST_NIET.

   WAT HIJ NIET MEET. Tokens worden GESCHAT (tekens gedeeld door drie, graad
   `vermoed`); de echte telling komt van de server zelf, via
   `npm run ai:lokaal:check` en het luik op de meter. En hij zegt niets over
   hoe GOED het antwoord wordt -- dat is `npm run railvergelijk`, en dat vraagt
   een draaiend model. Dit meet alleen of het model zijn regels nog krijgt.

   Draai:  node scripts/contextmeting.js           (tabel)
           node scripts/contextmeting.js --json
   ========================================================================== */
'use strict';
const { stelContextSamen, schatTokens, schatVerzoek } = require('../server/kern/ai/contextpakket');
const { chatPakket } = require('../server/kern/ai/chatpakket');
const { lusPakket } = require('../server/kern/stuur/luspakket');
const { LUS_REGELS } = require('../server/kern/stuur/lusregels');
const { TOOLS } = require('../server/kern/stuur/gereedschap');
const rahul = require('../server/kern/rahul');

const VENSTERS = [4096, 8192, 12288];
const AI_TONE = { rtg: 'Register: ingetogen "old money", rustig en zeker. Je tutoyeert het lid (je/jij-vorm).' };
const { aiSystemPrompt } = require('../server/kern/ai/prompt')({
  db: { data: {} }, AI_TONE, naamEn: (l) => l,
  PERSONAS: { rtg: { codename: 'Amberen Vos', since: 'Maart 2026' } },
  dagContext: () => ({ zin: 'Het is dinsdagmiddag in september, 17 graden en droog.' }),
  stemmingVoor: () => '', geloofRegel: () => '',
  ledenInhoudVan: () => ({
    trip: { dest: 'Ibiza', dates: '18-24 juli', days: 12, items: [{ title: 'Hotel', label: 'bevestigd' }, { title: 'Vlucht', label: 'in aanvraag' }] },
    invoices: [{ status: 'open', desc: 'Hotel Ibiza', netto: 1840, bijdrage: 60 }, { status: 'open', desc: 'Vlucht', netto: 412, bijdrage: 12 }]
  })
});

/* Een gewoon gesprek: korte vragen van het lid, antwoorden van rond de 120
   woorden (de lengte die de prompt zelf vraagt). */
function gesprek(beurten, laatste) {
  const c = [];
  for (let i = 0; i < beurten; i++) c.push(i % 2
    ? { from: 'rahul', text: 'Antwoord van Rahul. '.repeat(38) }
    : { from: 'member', text: 'Een vraag van het lid over de reis, iets langer dan een zin. '.repeat(3) });
  c.push({ from: 'member', text: laatste || 'Wat moet ik nog regelen voor vrijdag?' });
  return c;
}

function lus(stappen) {
  const m = [{ role: 'user', content: 'Zet de tandarts vrijdag om 14:00 in mijn agenda en stuur mijn partner een bericht.' }];
  for (let i = 0; i < stappen; i++) {
    m.push({ role: 'assistant', content: [{ type: 'tool_use', id: 't' + i, name: i ? 'doe' : 'kaart', input: { pad: '/api/agenda/toevoegen' } }] });
    m.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't' + i, content: JSON.stringify({ ok: true, lijst: 'x'.repeat(5800) }).slice(0, 6000) }] });
  }
  return m;
}
const LUSSYSTEEM = rahul.RAHUL_LEAD + 'Je helpt een RTG-lid (codenaam Amberen Vos, pas: rtg) in de leden-app. \n' + LUS_REGELS;

/* De boardroom met de registerblik: drie blikken met ECHTE uitkomsten uit de
   registers van deze boom, zoals de lus ze terugstuurt. */
const { REGISTERBLIK_TOOLS, kijk } = require('../server/kern/registerblik/gereedschap');
const BLIKSYSTEEM = rahul.RAHUL_LEAD + 'je denkt mee met de RTG-boardroom. ' + require('../server/kern/registerblik/lus').REGELS;
function blik() {
  const m = [{ role: 'user', content: 'Waarom staat RTG nog niet productieklaar?' }];
  [['vraagProductiestandOp', {}], ['vraagBewijsOp', {}], ['inspecteerRoute', { pad: '/api/bank/pas/betaal' }]].forEach(([naam, invoer], i) => {
    m.push({ role: 'assistant', content: [{ type: 'tool_use', id: 'b' + i, name: naam, input: invoer }] });
    m.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 'b' + i, content: JSON.stringify(kijk(naam, invoer)).slice(0, 4000) }] });
  });
  return m;
}

const SITUATIES = [
  { naam: 'chat, eerste vraag', maak: (v) => chatPakket({ delen: aiSystemPrompt('rtg', 'nl', 'demo', true), convo: gesprek(0), venster: v, antwoord: 1024, toon: AI_TONE }), antwoord: 1024 },
  { naam: 'chat, na 12 beurten', maak: (v) => chatPakket({ delen: aiSystemPrompt('rtg', 'nl', 'demo', true), convo: gesprek(12), venster: v, antwoord: 1024, toon: AI_TONE }), antwoord: 1024 },
  { naam: 'chat, vraag over Rahul', maak: (v) => chatPakket({ delen: aiSystemPrompt('rtg', 'nl', 'demo', true), convo: gesprek(4, 'Waar kom je eigenlijk vandaan?'), venster: v, antwoord: 1024, toon: AI_TONE }), antwoord: 1024 },
  { naam: 'stuurlus, eerste beurt', maak: (v) => lusPakket({ systeem: LUSSYSTEEM, messages: lus(0), tools: TOOLS, venster: v, antwoord: 1400 }), antwoord: 1400, tools: true },
  { naam: 'stuurlus, na 4 stappen', maak: (v) => lusPakket({ systeem: LUSSYSTEEM, messages: lus(4), tools: TOOLS, venster: v, antwoord: 1400 }), antwoord: 1400, tools: true },
  { naam: 'boardroom, na 3 blikken', maak: (v) => lusPakket({ systeem: BLIKSYSTEEM, messages: blik(), tools: REGISTERBLIK_TOOLS, venster: v, antwoord: 900 }), antwoord: 900, tools: REGISTERBLIK_TOOLS }
];

function meet() {
  return SITUATIES.map((s) => {
    const heel = s.maak(null);
    const gereed = s.tools === true ? TOOLS : (s.tools || null);
    const nodig = schatVerzoek({ system: heel.system, messages: heel.messages, tools: gereed, max_tokens: s.antwoord });
    const perVenster = VENSTERS.map((v) => {
      const p = s.maak(v);
      const afgekapt = Math.max(0, nodig - v);
      return { venster: v, zonder: afgekapt ? 'kapt ~' + afgekapt + ' van het begin af' : 'past',
        met: p.ok ? 'past (' + (p.verantwoording.gebruikt + s.antwoord + schatTokens(gereed)) + ')' : p.code,
        ingekort: p.ok ? p.verantwoording.ingekort.length : null,
        weggelaten: p.ok ? p.verantwoording.weggelaten.filter(w => w.id !== 'voorloper').length : null,
        bovenPlafond: p.verantwoording && p.verantwoording.perSoort
          ? Object.keys(p.verantwoording.perSoort).filter(k => p.verantwoording.perSoort[k].boven) : [] };
    });
    return { situatie: s.naam, nodigZonder: nodig, perVenster };
  });
}

const uit = { graad: 'vermoed', schatting: 'tekens gedeeld door 3', situaties: meet() };
if (process.argv.includes('--json')) console.log(JSON.stringify(uit, null, 2));
else {
  console.log('Contextmeting (tokens GESCHAT, graad vermoed)\n');
  for (const s of uit.situaties) {
    console.log(s.situatie + ' -- zonder samensteller nodig: ~' + s.nodigZonder);
    for (const v of s.perVenster) {
      console.log('  ' + String(v.venster).padStart(5) + '  zonder: ' + v.zonder.padEnd(28) + ' met: ' + String(v.met).padEnd(20) +
        (v.ingekort != null ? ' ingekort ' + v.ingekort + ', weggelaten ' + v.weggelaten : '') +
        (v.bovenPlafond.length ? '  (verplicht boven plafond: ' + v.bovenPlafond.join(', ') + ')' : ''));
    }
  }
}

module.exports = { meet, stelContextSamen };

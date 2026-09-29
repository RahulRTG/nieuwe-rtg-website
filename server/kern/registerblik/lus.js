/* DE REGISTERBLIK ALS LUS -- Rahul zoekt het op in plaats van het te weten.

   "Waarom staat RTG nog niet productieklaar?" is geen vraag die een klein model
   uit zijn hoofd kan beantwoorden. Hier krijgt het zes gereedschappen die
   RTG's eigen registers en documenten lezen (./gereedschap.js), en verder niets: geen `doe`,
   geen `kaart`, geen `plan`. Lezen en uitleggen mag zelfstandig; wijzigen en
   uitvoeren lopen elders, langs mandaat, beleid en een mens.

   Elke beurt gaat door de contextsamensteller (../stuur/luspakket.js), zodat
   een lange zoektocht nooit stil het begin -- de regels -- laat afkappen. Het
   antwoord komt terug met de registers die zijn geraadpleegd en hun leeftijd,
   zodat het scherm kan laten zien waar een bewering vandaan komt, en met de
   staving (../stuur/staving.js): welke getallen, routes en registers uit het antwoord
   ook echt in de opgezochte uitkomsten staan, en met welke graad.

   Loopt het stappenbudget op zonder antwoord, dan zegt de lus dat, met wat hij
   wel heeft bekeken -- geen verzonnen conclusie. */
'use strict';
const rahul = require('../rahul');
const { REGISTERBLIK_TOOLS, kijk } = require('./gereedschap');
const { lusPakket } = require('../stuur/luspakket');
const { vensterVan } = require('../ai/contextpakket');
const { staaf, voetnoot } = require('../stuur/staving');

const STAPPEN = 5;
const ANTWOORD = 900;

const REGELS = 'Je hebt de registerblik: zes gereedschappen die RTG\'s eigen registers en documenten LEZEN. Wat je over de staat van RTG ' +
  'zegt, komt uit een gereedschap en nergens anders; noem bij elke bewering het register en hoe oud de meting is. ' +
  'Wat een document zegt (zoekKennis) is een bewering: toets het aan een register voordat je het als stand van zaken brengt. ' +
  'Staat er "niet vast te stellen" of is een meting vervallen, zeg dat dan hardop -- dat is een antwoord en geen gat om te vullen. ' +
  'Tel geen losse registers op tot een oordeel over productie: de productiestand geef je door zoals hij er staat. ' +
  'Je kunt niets wijzigen of uitvoeren, en je belooft ook niet dat iets geregeld wordt.';

function kan(anthropic) {
  return !!anthropic && (typeof anthropic.kan !== 'function' || anthropic.kan({ tools: REGISTERBLIK_TOOLS }));
}

/* `rol` is de rest van de systeemprompt: waar deze Rahul zit (de boardroom). */
async function registerblikVraag({ anthropic, rol, vraag }) {
  if (!kan(anthropic)) return null;
  const systeem = rahul.RAHUL_LEAD + (rol || '') + ' ' + REGELS;
  const messages = [{ role: 'user', content: String(vraag || '').slice(0, 600) }];
  const geraadpleegd = [];
  const uitkomsten = [];
  for (let s = 0; s < STAPPEN; s++) {
    const pak = lusPakket({ systeem, messages, tools: REGISTERBLIK_TOOLS, venster: vensterVan(anthropic), antwoord: ANTWOORD });
    if (!pak.ok) return { tekst: null, geraadpleegd, stand: pak.code, reden: pak.uitleg };
    const resp = await anthropic.messages.create({ model: 'claude-sonnet-5', max_tokens: ANTWOORD,
      system: pak.system, tools: REGISTERBLIK_TOOLS, messages: pak.messages });
    const wil = (resp.content || []).filter(c => c.type === 'tool_use');
    if (!wil.length || resp.stop_reason !== 'tool_use') {
      const tekst = (resp.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
      return { tekst: tekst || null, geraadpleegd, stand: tekst ? 'beantwoord' : 'leeg',
        ...(tekst ? { staving: staaf(tekst, uitkomsten) } : {}) };
    }
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: wil.map((t) => {
      const uit = kijk(t.name, t.input);
      geraadpleegd.push({ gereedschap: t.name, invoer: t.input || {} });
      uitkomsten.push({ gereedschap: t.name, invoer: t.input || {}, uit });
      return { type: 'tool_result', tool_use_id: t.id, content: JSON.stringify(uit).slice(0, 4000) };
    }) });
  }
  return { tekst: null, geraadpleegd, stand: 'budget-op',
    reden: 'binnen ' + STAPPEN + ' stappen kwam er geen antwoord; hierboven staat wat er is bekeken' };
}

module.exports = { registerblikVraag, voetnoot, REGELS, STAPPEN };

/* DE DETERMINISTISCHE INTERPRETATIERAIL -- een corpus, en verder niets.

   WAT DIT WEL IS. Een vervanger voor precies één ding: de laag die menselijke
   taal omzet in tool-aanroepen. Hij levert wat `anthropic.messages.create()`
   levert -- `{ content, stop_reason }` met `tool_use`-blokken -- en niets
   anders. Alles daaronder blijft de echte machine: `lusstap.voerUit` roept bij
   `kaart` de echte resolver aan, bij `plan` de echte compileer() en voorspel(),
   en bij `doe` de echte twijfelpoort, herkomstpoort en stuurRoep.

   WAT DIT NADRUKKELIJK NIET IS, en dit is de hele reden dat het bestand zo dom
   mag zijn: geen tweede resolver. Bouw je hier begrip in -- synoniemen, een
   datumparser, een intentieclassificatie -- dan toets je straks die laag in
   plaats van RTG, en is een groene proef waardeloos. MAGNAATLAB.md:
   *een simulatie-adapter vervangt de rail, nooit de poort.*
   `test/stuurrail.test.js` houdt dat vast op de BRON: zodra dit bestand
   resolver, plan, gevolg, plafond, mandaat of beleid importeert, zakt hij.

   HOE HIJ KIEST. De laatste gebruikersvraag wordt genormaliseerd (kleine
   letters, leestekens weg, spaties samengetrokken) en letterlijk opgezocht.
   Meer niet. Staat hij er niet in, dan is het antwoord NIET_HERKEND -- een
   tekstbeurt, geen tool-aanroep, en dus geen enkel effect. RADEN IS HIER DE
   FOUT DIE HET INSTRUMENT WAARDELOOS MAAKT: een rail die "parijs vrijdagg"
   toch maar als "parijs vrijdag" leest, verbergt precies het gat dat een
   echte rail straks moet dichten.

   HOE HIJ WEET WELKE BEURT HET IS. Zonder eigen toestand, want twee gesprekken
   tegelijk zouden elkaars teller overschrijven. Het aantal `assistant`-beurten
   dat al in `messages` staat IS de stapindex -- lus.js duwt elke beurt er zelf
   in. Loopt het corpus af, dan volgt de afsluitende tekstbeurt.

   DE STAPPEN DRAGEN DE BESTAANDE VORM en geen nieuwe. `kaart` neemt
   `{ alles }`, `doe` neemt `{ pad, body, zeker, begrepen }`, en `plan` neemt
   `{ doel, stappen:[{ id, capability, invoer, afhankelijkVan, uitkomst }] }`
   -- overgenomen uit ./gereedschap.js en ./plan.js, niet verzonnen. */
'use strict';

/* Vier bronnen, EEN corpus. ./rail-corpus-zinnen.js draagt wat een ZIN
   oplevert, ./rail-corpus-context.js wat dezelfde zin MET een scherm eronder
   oplevert (de VERWIJZING: "die andere"), ./rail-corpus-samenhang.js wat een
   korte vervolgzin krijgt van wat er openstaat ("liever later"), en
   ./rail-corpus-goudenplak.js de twee zinnen die de keten tot het EIND
   uitvoeren -- die tweede kan pas bestaan sinds de gesaneerde context onder de
   vraag meereist (./menscontext.js). Ze worden hier samengevoegd en niet in
   elkaar geschoven: een sleutel die in allebei staat, is een botsing en geen
   voorrangsregel, en test/menscontext.test.js laat de bouw daarop zakken. */
const ZINNEN = Object.assign({}, require('./rail-corpus-zinnen'),
  require('./rail-corpus-context'), require('./rail-corpus-samenhang'),
  require('./rail-corpus-goudenplak'));

/* Normaliseren is met opzet het domste wat werkt. Elke regel die hier bij komt
   is begrip, en begrip hoort in de echte rail. */
function normaliseer(tekst) {
  return String(tekst || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* De laatste beurt van de gebruiker. Een tool_result telt niet als vraag: dat
   is de machine die terugpraat, en die hoort het corpus niet te verschuiven. */
function laatsteVraag(messages) {
  const rij = Array.isArray(messages) ? messages : [];
  for (let i = rij.length - 1; i >= 0; i--) {
    const m = rij[i];
    if (!m || m.role !== 'user') continue;
    if (typeof m.content === 'string') return m.content;
    if (!Array.isArray(m.content)) continue;
    const tekst = m.content.filter(c => c && c.type === 'text').map(c => c.text).join(' ').trim();
    if (tekst) return tekst;
  }
  return '';
}

function aantalBeurten(messages) {
  return (Array.isArray(messages) ? messages : []).filter(m => m && m.role === 'assistant').length;
}

/* Een tekstantwoord in de vorm die lus.js verwacht: geen tool_use, dus de lus
   stopt en geeft deze tekst terug. */
function tekstbeurt(tekst) {
  return { content: [{ type: 'text', text: String(tekst || '') }], stop_reason: 'end_turn' };
}

/* Een beurt met tool-aanroepen. De id's zijn afgeleid van de stapindex en niet
   willekeurig: dezelfde vraag geeft in elke run dezelfde id's, ook op een
   andere machine, en dat is wat een bewijsmerk bruikbaar maakt. */
function toolbeurt(tools, stapIndex) {
  return {
    content: tools.map((t, i) => ({
      type: 'tool_use', id: 'det_' + stapIndex + '_' + i,
      name: t.name, input: t.input || {}
    })),
    stop_reason: 'tool_use'
  };
}

const NIET_HERKEND =
  'NIET_HERKEND. Deze zin staat niet in het corpus van de deterministische rail, ' +
  'en de rail raadt niet. Zet hem in server/kern/stuur/rail-corpus-zinnen.js of ' +
  'draai met een echte modelrail.';

/* De rail. `corpus` is injecteerbaar zodat een toets zijn eigen zinnen kan
   meegeven zonder het productiecorpus te veranderen. */
function maakCorpusRail(opties) {
  const corpus = (opties && opties.corpus) || ZINNEN;
  const gezien = [];

  async function create(verzoek) {
    const messages = (verzoek && verzoek.messages) || [];
    const vraag = normaliseer(laatsteVraag(messages));
    const regel = Object.prototype.hasOwnProperty.call(corpus, vraag) ? corpus[vraag] : null;
    gezien.push({ vraag, herkend: !!regel });

    if (!regel) return tekstbeurt(NIET_HERKEND);

    const stappen = Array.isArray(regel.stappen) ? regel.stappen : [];
    const index = aantalBeurten(messages);
    const stap = stappen[index];

    /* Corpus op: afsluiten met de projectie die de regel zelf draagt. Staat die
       er niet, dan zegt de rail dat -- hij verzint geen slotzin. */
    if (!stap) return tekstbeurt(regel.projectie ||
      'Het corpus voor deze zin heeft geen afsluitende tekst; vul `projectie` aan.');

    if (stap.tekst) return tekstbeurt(stap.tekst);
    if (Array.isArray(stap.tools) && stap.tools.length) return toolbeurt(stap.tools, index);
    return tekstbeurt(regel.projectie || '');
  }

  return {
    /* Dezelfde vorm als de modelclient, zodat lus.js geen letter verandert. */
    messages: { create },
    aanbieders: ['deterministisch'],
    /* Voor een proef: wat is er langsgekomen en werd het herkend. Een teller,
       geen journaal -- er gaat geen vraagtekst naar een register. */
    gezien: () => gezien.slice(),
    kentZin: (zin) => Object.prototype.hasOwnProperty.call(corpus, normaliseer(zin)),
    zinnen: () => Object.keys(corpus)
  };
}

module.exports = { maakCorpusRail, normaliseer, NIET_HERKEND };

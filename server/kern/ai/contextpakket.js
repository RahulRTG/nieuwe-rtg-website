/* DE CONTEXTSAMENSTELLER -- wat een model met een klein venster te zien krijgt.

   WAAROM DIT BESTAAT. Een eigen modelserver heeft een contextvenster (Ollama
   staat standaard op 4096 tokens) en kapt STIL af wat er niet in past, vanaf
   het BEGIN -- en daar staan juist de grondwet, de veiligheidsgrenzen en wie
   Rahul is. Het model antwoordt dan gewoon, alleen zonder zijn regels, en dat
   leest als "de lokale AI is dom". Deze laag zorgt dat er nooit iets stil
   verdwijnt: wat niet past wordt eerst ingekort, dan weggelaten, en elke keuze
   staat in de verantwoording. Past zelfs het verplichte deel niet, dan komt er
   CONTEXT_PAST_NIET met de tekorten erbij, en geen afgekapt verzoek.

   BLOKKEN EN HUN EIGENSCHAPPEN. Een aanroeper geeft blokken met een soort
   (grondwet, identiteit, opdracht, gereedschap, feiten, gesprek, werk), een
   bron, een bewijsgraad, een prioriteit, verplicht, een vervaldatum, en of het
   blok mag worden samengevat of mag vervallen. Een blok is tekst voor de
   systeemprompt OF een reeks berichten voor het gesprek.

   PLAFONDS, GEEN QUOTA. De verdeling hieronder zegt hoeveel een soort HOOGUIT
   mag innemen; wat een soort niet nodig heeft, wordt niet kunstmatig gevuld.
   Verplichte blokken gaan altijd mee, ook boven hun plafond -- dat staat dan
   als `boven` in de verantwoording, want een grondwet die niet past is een
   bevinding en geen reden om hem in te korten.

   WAT DIT NIET IS. Geen tokenizer: `schatTokens` telt tekens, dus een
   SCHATTING (graad `vermoed`), bewust te hoog -- te laag schatten laat de
   server stil afkappen. server/local-ai.js legt de telling van de server
   ernaast. En geen relevantiemodel: welke feiten ertoe doen bepaalt de
   aanroeper; deze laag verdeelt alleen de ruimte. */
'use strict';

const TEKENS_PER_TOKEN = 3;

/* De richtplafonds als deel van het venster. Bij 12.288 tokens is dat
   ongeveer: grondwet 1.230, identiteit 510, opdracht 510, gereedschap 1.230,
   feiten 3.070, gesprek 1.540, werk 1.020 -- en de rest (ruim een kwart) blijft
   over voor redeneren en antwoord. */
const CONTEXTPLAFONDS = Object.freeze({
  grondwet: 0.10, identiteit: 0.042, opdracht: 0.042, gereedschap: 0.10,
  feiten: 0.25, gesprek: 0.125, werk: 0.083
});

/* De volgorde waarin een te vol pakket wordt ontlast: eerst oud gesprek, dan
   werk, dan feiten met een lage prioriteit. Grondwet en opdracht staan er niet
   in -- ook niet als ze per ongeluk niet verplicht zijn gemarkeerd. */
const ONTLASTVOLGORDE = ['gesprek', 'werk', 'feiten', 'identiteit', 'gereedschap'];

function schatTokens(x) {
  if (x == null || x === '') return 0;
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return Math.ceil(s.length / TEKENS_PER_TOKEN);
}

/* Wat een heel verzoek zou innemen: invoer plus de ruimte voor het antwoord. */
function schatVerzoek(params) {
  const p = params || {};
  return schatTokens(p.system) + schatTokens(p.messages) + schatTokens(p.tools) +
    (Number(p.max_tokens) || 0);
}

function normaal(b, i) {
  if (!b || !Object.prototype.hasOwnProperty.call(CONTEXTPLAFONDS, b.soort))
    throw new Error('contextblok ' + ((b && b.id) || i) + ': onbekende soort ' + (b && b.soort));
  const berichten = Array.isArray(b.berichten) ? b.berichten : null;
  const inhoud = berichten || String(b.tekst == null ? '' : b.tekst);
  const verplicht = !!b.verplicht;
  return {
    i, id: b.id || ('blok' + i), soort: b.soort, inhoud, berichten: !!berichten,
    kort: b.kort == null ? null : b.kort, bron: b.bron || null,
    graad: /^(onbekend|vermoed|gemeten|bewezen)$/.test(b.graad || '') ? b.graad : 'onbekend',
    prioriteit: Number(b.prioriteit) || 0, verplicht, vervalt: b.vervalt || null,
    magSamenvatten: !verplicht && !!b.magSamenvatten && b.kort != null,
    magVervallen: !verplicht && b.magVervallen !== false,
    tokens: schatTokens(inhoud), stand: 'heel'
  };
}

const gewicht = (b) => b.stand === 'weg' ? 0 : b.stand === 'kort' ? schatTokens(b.kort) : b.tokens;

/* Het venster van de krapste aanbieder in de keten die er een VERKLAARD heeft.
   Een aangenomen venster stuurt niets: dan telt server/local-ai.js alleen mee
   (schaduw) -- je dwingt niet af wat nooit heeft meegelopen. */
function vensterVan(client) {
  const info = (client && client.providerInfo) || [];
  const v = info.map(p => p && p.venster).filter(x => x && x.herkomst === 'verklaard' && x.tokens > 0);
  return v.length ? Math.min(...v.map(x => x.tokens)) : null;
}

function stelContextSamen(opts) {
  const o = opts || {};
  const blokken = (o.blokken || []).map(normaal);
  const antwoord = Number(o.antwoord) || 0;
  const gereedschap = schatTokens(o.gereedschap);
  const nu = o.nu != null ? o.nu : Date.now();
  const verantwoording = { venster: o.venster || null, antwoord, gereedschap,
    schatting: 'vermoed: tekens gedeeld door ' + TEKENS_PER_TOKEN, ingekort: [], weggelaten: [], perSoort: {} };
  const weg = (b, reden) => { b.stand = 'weg'; verantwoording.weggelaten.push({ id: b.id, soort: b.soort, tokens: b.tokens, reden }); };
  const kort = (b, reden) => { b.stand = 'kort'; verantwoording.ingekort.push({ id: b.id, soort: b.soort, van: b.tokens, naar: schatTokens(b.kort), reden }); };

  if (o.venster) {
    const beschikbaar = o.venster - antwoord - gereedschap;
    verantwoording.beschikbaar = beschikbaar;
    const gezien = new Set();
    for (const b of blokken) {
      /* Dubbele KENNIS gaat weg, het jongste exemplaar; een gesprek mag zichzelf
         herhalen -- twee keer "ja" is twee antwoorden. */
      const sleutel = b.soort + '|' + b.inhoud;
      if (!b.berichten && gezien.has(sleutel) && b.magVervallen) weg(b, 'dubbel');
      gezien.add(sleutel);
      if (b.stand === 'heel' && b.vervalt && Date.parse(b.vervalt) < nu && b.magVervallen) weg(b, 'verlopen');
    }
    /* Per soort: verplicht eerst, dan de rest op prioriteit (bij gelijke
       prioriteit het jongste blok eerst), tot het plafond. */
    for (const soort of Object.keys(CONTEXTPLAFONDS)) {
      const plafond = Math.floor(o.venster * CONTEXTPLAFONDS[soort]);
      const eigen = blokken.filter(b => b.soort === soort && b.stand !== 'weg');
      let gebruikt = (soort === 'gereedschap' ? gereedschap : 0) +
        eigen.filter(b => b.verplicht).reduce((s, b) => s + b.tokens, 0);
      const vrij = eigen.filter(b => !b.verplicht).sort((a, b) => b.prioriteit - a.prioriteit || b.i - a.i);
      /* Een gesprek krijgt geen gaten: is een beurt weggevallen, dan ook alles
         wat ouder is -- anders praat het model tegen een half gesprek. */
      let gat = false;
      for (const b of vrij) {
        if (gat && b.magVervallen) { weg(b, 'plafond'); continue; }
        if (gebruikt + b.tokens <= plafond) { gebruikt += b.tokens; continue; }
        if (b.magSamenvatten && gebruikt + schatTokens(b.kort) <= plafond) { kort(b, 'plafond'); gebruikt += gewicht(b); continue; }
        if (b.magVervallen) { weg(b, 'plafond'); gat = soort === 'gesprek'; continue; }
        /* mag niet weg: dan in elk geval zo kort als het mag */
        if (b.magSamenvatten) kort(b, 'plafond');
        gebruikt += gewicht(b);
      }
      verantwoording.perSoort[soort] = { plafond, gebruikt, boven: gebruikt > plafond };
    }
    /* Past het geheel nog niet: ontlasten in vaste volgorde, eerst inkorten,
       dan weglaten, het oudste en minst belangrijke eerst. */
    const totaal = () => blokken.reduce((s, b) => s + gewicht(b), 0);
    const kandidaten = blokken.filter(b => !b.verplicht && b.stand !== 'weg' && ONTLASTVOLGORDE.includes(b.soort))
      .sort((a, b) => ONTLASTVOLGORDE.indexOf(a.soort) - ONTLASTVOLGORDE.indexOf(b.soort) || a.prioriteit - b.prioriteit || a.i - b.i);
    for (const b of kandidaten) { if (totaal() <= beschikbaar) break; if (b.stand === 'heel' && b.magSamenvatten) kort(b, 'venster'); }
    for (const b of kandidaten) { if (totaal() <= beschikbaar) break; if (b.magVervallen) weg(b, 'venster'); }
    verantwoording.gebruikt = totaal();
    if (verantwoording.gebruikt > beschikbaar) {
      return { ok: false, code: 'CONTEXT_PAST_NIET', tekort: verantwoording.gebruikt - beschikbaar, verantwoording,
        uitleg: 'Het verplichte deel van de context (' + verantwoording.gebruikt + ' tokens, geschat) past niet in de ' +
          beschikbaar + ' die het venster van ' + o.venster + ' overlaat. Er is niets afgekapt; vergroot het venster (LOCAL_AI_CONTEXT) of verklein het verplichte deel.' };
    }
  }

  const system = [];
  let messages = [];
  for (const b of blokken) {
    if (b.stand === 'weg') continue;
    const inhoud = b.stand === 'kort' ? b.kort : b.inhoud;
    if (b.berichten) messages = messages.concat(inhoud); else if (inhoud) system.push(inhoud);
  }
  /* Een gesprek begint bij de mens; wat na het weglaten vooraan een antwoord
     van het model is, gaat ook weg -- en dat staat erbij. */
  while (messages.length && messages[0].role !== 'user') {
    messages.shift();
    verantwoording.weggelaten.push({ id: 'voorloper', soort: 'gesprek', tokens: 0, reden: 'begint niet bij de mens' });
  }
  return { ok: true, system: system.join('\n'), messages, verantwoording };
}

module.exports = { stelContextSamen, schatTokens, schatVerzoek, vensterVan, CONTEXTPLAFONDS, TEKENS_PER_TOKEN };

/* RTG Vonk, deelbestand "wensen": DE VOORKEURSTAAL.

   WAT DIT OPLOST. Vonk matchte op geslacht, leeftijd, afstand en gedeelde
   interesses. Dat vindt mensen die in de buurt wonen, niet mensen die bij elkaar
   passen. Wat ontbrak is niet betere AI maar een taal waarin een lid kan zeggen
   wat er werkelijk toe doet -- en vooral: wat er ECHT toe doet tegenover wat leuk
   meegenomen is (ONTMOETEN.md par. 3.1).

   DRIE GEWICHTEN, EN ALLEEN HET EERSTE FILTERT

     verplicht   een uitgesproken tegenstelling haalt de kandidaat weg
     sterk       weegt zwaar in de volgorde; een botsing staat als open punt
     mee         weegt licht; een overeenkomst staat als plus

   WAAROM "VERPLICHT" ALLEEN OP EEN UITGESPROKEN TEGENSTELLING FILTERT, EN NIET
   OP EEN LEEG VELD. Dit is de beslissing waar deze module om draait, dus hij
   staat hier en niet in een commit-bericht.

   Een harde eis betekent "hier wijk ik niet van af". De verleiding is om dan ook
   iedereen weg te filteren van wie we het antwoord niet weten. Dat is om twee
   redenen fout. Het botst met de eerlijkheidseis (ONTMOETEN.md par. 3.7): wie
   net begint heeft nog niets ingevuld en zou onvindbaar zijn -- precies het
   voordeel voor gevestigde profielen dat we nergens anders toelaten. En het is
   niet wat een harde eis bedoelt: "ik wil kinderen" botst met "ik wil geen
   kinderen", niet met "daar heb ik nog niets over gezegd".

   Een onbekend antwoord is dus een OPEN PUNT: de kandidaat blijft staan, en het
   lid ziet bij de reden dat dit nog niet duidelijk is. Zo doet de harde eis zijn
   werk (twee stellige tegenpolen zien elkaar niet) zonder een tweede, verborgen
   strafregel voor nieuwe leden te worden.

   TWEE DINGEN DIE NOOIT DOOR ELKAAR MOGEN LOPEN

     kenmerken   wie ik ben. Zichtbaar volgens ./zicht, per as instelbaar.
     wensen      wat ik van een ander vraag. NOOIT zichtbaar voor een ander,
                 op geen enkel niveau, voor niemand.

   Zonder die scheiding verandert een profiel in een sollicitatieformulier: wie
   zegt "mijn partner moet mijn geloof delen" hoeft dat niet aan iedereen te
   vertellen. `wensen` verlaat deze module daarom alleen richting het lid zelf.

   DE REDEN LEKT GEEN WAARDEN. Staat een as op "pas na een match", dan mag de
   uitleg wel zeggen DAT u hierin overeenkomt, maar niet WAT het antwoord is.
   Anders was de zichtbaarheidskeuze een knop die niets doet -- LAT.md regel 8:
   een controle op vorm is geen controle.

   GEEN CIJFER. `weegt()` bepaalt alleen de VOLGORDE binnen de dagselectie en
   verlaat deze module niet. Er komt geen percentage, geen match-score en geen
   oordeel over een mens op het scherm: LIFE.md par. 4.4, en ONTMOETEN.md par.
   4.4 herhaalt hem voor deze app.

   EEN AS TOEVOEGEN IS EEN REGEL IN `ASSEN` (./assen.js). Geen tweede lijst, geen
   aanpassing in de selectie, geen aanpassing in het scherm -- LAT.md regel 4:
   nooit twee plekken die dezelfde waarheid vasthouden. */

const { GEWICHTEN, ZICHT, ASSEN } = require('./assen');

const AS = Object.fromEntries(ASSEN.map(a => [a.id, a]));
const magWaarde = (asId, v) => !!(AS[asId] && AS[asId].opties.some(o => o[0] === v));
const labelVan = (asId, v) => { const o = AS[asId] && AS[asId].opties.find(x => x[0] === v); return o ? o[1] : v; };

/* ---- schoonmaken: alles wat binnenkomt gaat langs de tabel ---- */

// wie ik ben. Een lege string wist de as; een onbekende waarde wordt genegeerd.
function zetKenmerken(oud, data) {
  const uit = { ...(oud || {}) };
  if (!data || typeof data !== 'object') return uit;
  for (const as of ASSEN) {
    if (!(as.id in data)) continue;
    const v = data[as.id];
    if (v === '' || v === null) { delete uit[as.id]; continue; }
    if (magWaarde(as.id, v)) uit[as.id] = v;
  }
  return uit;
}

/* wat ik van een ander vraag: per as een verzameling aanvaardbare waarden plus
   een gewicht. Een lege verzameling wist de wens -- anders kon een lid een eis
   nooit meer kwijtraken, en een eis die je niet kunt intrekken is geen eis maar
   een val. */
function zetWensen(oud, data) {
  const uit = { ...(oud || {}) };
  if (!data || typeof data !== 'object') return uit;
  for (const as of ASSEN) {
    if (!(as.id in data)) continue;
    const w = data[as.id];
    if (w === '' || w === null) { delete uit[as.id]; continue; }
    const in_ = (Array.isArray(w.in) ? w.in : [w.in]).filter(v => magWaarde(as.id, v));
    if (!in_.length) { delete uit[as.id]; continue; }
    uit[as.id] = { in: in_, gewicht: GEWICHTEN.includes(w.gewicht) ? w.gewicht : 'mee' };
  }
  return uit;
}

// per as: wie mag deze waarde zien. Onbekende niveaus vallen terug op de tabel.
function zetZicht(oud, data) {
  const uit = { ...(oud || {}) };
  if (!data || typeof data !== 'object') return uit;
  for (const as of ASSEN) {
    if (!(as.id in data)) continue;
    if (ZICHT.includes(data[as.id])) uit[as.id] = data[as.id];
  }
  return uit;
}
const zichtVan = (p, asId) => (p.zicht && p.zicht[asId]) || AS[asId].standaardZicht;

/* ---- de harde eis ---- */

/* Botst een verplichte eis van `ik` met een UITGESPROKEN waarde van `ander`?
   Alleen dan; een onbekende waarde is een open punt (zie de kop). */
function botst(ik, ander) {
  const w = ik.wensen || {}, k = ander.kenmerken || {};
  for (const asId of Object.keys(w)) {
    if (w[asId].gewicht !== 'verplicht') continue;
    const heeft = k[asId];
    if (heeft == null) continue;              // niet gezegd is niet botsen
    if (!w[asId].in.includes(heeft)) return true;
  }
  return false;
}

/* ---- de volgorde. Blijft binnen deze module; zie de kop. ---- */
const PUNT = { verplicht: 6, sterk: 3, mee: 1 };
function weegt(ik, ander) {
  const w = ik.wensen || {}, k = ander.kenmerken || {};
  let som = 0;
  for (const asId of Object.keys(w)) {
    const heeft = k[asId];
    if (heeft == null) continue;
    const punt = PUNT[w[asId].gewicht] || 0;
    som += w[asId].in.includes(heeft) ? punt : -punt;
  }
  return som;
}

/* ---- de uitleg: waarom ziet u deze persoon ----

   `ja` zijn de overeenkomsten, `open` de botsingen en de nog onbekende punten.
   Een as die op 'match' of 'engine' staat, levert wel een regel maar zonder de
   waarde erin -- anders zou de zichtbaarheidskeuze via de uitleg alsnog lekken. */
function reden(ik, ander) {
  const w = ik.wensen || {}, k = ander.kenmerken || {};
  const ja = [], open = [];
  for (const as of ASSEN) {
    const wens = w[as.id];
    if (!wens) continue;
    const heeft = k[as.id];
    const toonWaarde = zichtVan(ander, as.id) === 'kandidaten';
    if (heeft == null) { open.push(as.label.toLowerCase() + ': nog niet ingevuld'); continue; }
    const past = wens.in.includes(heeft);
    const tekst = toonWaarde ? as.label.toLowerCase() + ': ' + labelVan(as.id, heeft).toLowerCase()
      : as.label.toLowerCase() + ': ' + (past ? 'komt overeen' : 'verschilt');
    (past ? ja : open).push(tekst);
  }
  return { ja, open };
}

/* ---- wat een ander van mijn kenmerken mag zien ----
   `niveau` is 'kandidaten' (de dagselectie) of 'match' (na een wederzijdse like).
   'engine' komt hier per definitie nooit uit. */
function toonKenmerken(p, niveau) {
  const k = p.kenmerken || {}, uit = {};
  for (const as of ASSEN) {
    if (k[as.id] == null) continue;
    const z = zichtVan(p, as.id);
    if (z === 'engine') continue;
    if (z === 'match' && niveau !== 'match') continue;
    uit[as.id] = { waarde: k[as.id], label: labelVan(as.id, k[as.id]), as: as.label };
  }
  return uit;
}

// de tabel zoals het scherm hem nodig heeft: opties, gewichten, zichtniveaus
const tabel = () => ({
  assen: ASSEN.map(a => ({ id: a.id, label: a.label, standaardZicht: a.standaardZicht,
    opties: a.opties.map(([v, l]) => ({ v, label: l })) })),
  gewichten: GEWICHTEN, zicht: ZICHT
});

module.exports = { ASSEN, GEWICHTEN, ZICHT, zetKenmerken, zetWensen, zetZicht, zichtVan,
  botst, weegt, reden, toonKenmerken, tabel };

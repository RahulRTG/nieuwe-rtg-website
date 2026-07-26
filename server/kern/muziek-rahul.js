/* RTG Studio (deelmodule): Rahul zet iets neer.

   DE AI ZET NEER, JIJ BENT DE MAKER. Wat hier uitkomt is een VOORSTEL: gewone
   stappen en noten, in hetzelfde formaat als wat je zelf tekent. Je ziet het in
   je raster staan, je haalt de helft weg, je schuift de rest op -- en dan is het
   van jou. Er komt nooit een kant-en-klaar audiobestand uit, want dan zou je
   niets meer kunnen veranderen en zou de maker de machine zijn.

   DAAROM ZIT DE MUZIEKKENNIS IN DEZE MODULE EN NIET IN DE PROMPT. Toonladders,
   akkoordreeksen en drumfiguren staan hier als gewone tabellen. Gevolg: de
   studio doet het net zo goed zonder AI-sleutel, en als Claude er wél is, mag
   hij alleen KIEZEN en VARIEREN binnen wat hier staat -- zijn antwoord gaat
   langs dezelfde keuring als een mens. Een AI die zelf noten mag verzinnen die
   het instrument niet kan spelen, levert stilte op en een raadsel erbij.

   Wat hier NIET komt: "maak het populairder", "dit scoort beter". Er is geen
   publiek om voor te optimaliseren en we gaan er ook geen verzinnen. */
const I = require('./muziek-instrumenten');

// Toonladders als halve tonen vanaf de grondtoon.
const LADDERS = {
  mineur:  [0, 2, 3, 5, 7, 8, 10],
  majeur:  [0, 2, 4, 5, 7, 9, 11],
  dorisch: [0, 2, 3, 5, 7, 9, 10]
};

/* De stijlen. Elke stijl is een handvol beslissingen die samen een gevoel
   maken: hoe snel, welke ladder, waar de trap valt, en hoe druk het is. */
const STIJLEN = {
  house:   { naam: 'house', bpm: 122, ladder: 'mineur', grond: 45, trap: [0, 4, 8, 12],
    klap: [4, 12], hoed: [2, 6, 10, 14], reeks: [0, 5, 3, 4], basOctaaf: -12, pad: 'snaar', top: 'pluk' },
  lounge:  { naam: 'lounge', bpm: 84, ladder: 'dorisch', grond: 50, trap: [0, 8],
    klap: [], hoed: [4, 12], reeks: [0, 3, 5, 4], basOctaaf: -12, pad: 'toets', top: 'pluk' },
  hiphop:  { naam: 'hiphop', bpm: 88, ladder: 'mineur', grond: 43, trap: [0, 6, 10],
    klap: [4, 12], hoed: [0, 2, 4, 6, 8, 10, 12, 14], reeks: [0, 5, 0, 3], basOctaaf: -12, pad: 'toets', top: null },
  ambient: { naam: 'ambient', bpm: 62, ladder: 'majeur', grond: 48, trap: [],
    klap: [], hoed: [], reeks: [0, 4, 5, 3], basOctaaf: -12, pad: 'snaar', top: 'lead' },
  club:    { naam: 'club', bpm: 128, ladder: 'mineur', grond: 45, trap: [0, 4, 8, 12],
    klap: [4, 12], hoed: [2, 6, 10, 14], reeks: [0, 6, 5, 4], basOctaaf: -12, pad: 'snaar', top: 'lead' }
};
const STIJLNAMEN = Object.keys(STIJLEN);

// Uit de vraag halen wat erin staat: een stijl en eventueel een tempo.
const WOORDEN = {
  house: ['house', 'deep', 'garage'],
  lounge: ['lounge', 'chill', 'rustig', 'zacht', 'warm', 'diner', 'zonsondergang'],
  hiphop: ['hiphop', 'hip hop', 'beat', 'boom bap', 'rap', 'trap'],
  ambient: ['ambient', 'sfeer', 'traag', 'langzaam', 'slapen', 'focus', 'studeren'],
  club: ['club', 'techno', 'hard', 'snel', 'dansen', 'nacht']
};
function leesVraag(vraag) {
  const v = String(vraag || '').toLowerCase();
  let stijl = 'house';
  for (const s of STIJLNAMEN) if ((WOORDEN[s] || []).some(w => v.includes(w))) { stijl = s; break; }
  /* Het tempo alleen lezen als het er ook echt als tempo staat: met een eenheid
     erbij, of anders een los getal dat een tempo KAN zijn. Zonder die tweede
     eis kaapt "4 maten" of een jaartal het tempo. */
  const metEenheid = (v.match(/\b(\d{2,3})\s*(?:bpm|slagen|tempo)/) || [])[1];
  const los = (v.match(/\b(\d{2,3})\b/g) || []).map(Number).find(n => n >= I.BPM_MIN && n <= I.BPM_MAX);
  const bpm = metEenheid ? Number(metEenheid) : (los != null ? los : null);
  const mineur = /mineur|mineurs|droevig|donker|melancholi/.test(v);
  const majeur = /majeur|vrolijk|blij|licht|zonnig/.test(v);
  return { stijl, bpm: bpm ? Number(bpm) : null, ladder: mineur ? 'mineur' : majeur ? 'majeur' : null };
}

/* Het voorstel bouwen. Geen willekeur waar het ertoe doet: de trap staat waar
   hij hoort, de bas volgt de akkoordreeks. Wel wat variatie in de bovenstem,
   want een reeks die precies herhaalt klinkt als een oefening. */
function bouw(stijl, maten, ladderNaam, zaad) {
  const s = STIJLEN[stijl] || STIJLEN.house;
  const ladder = LADDERS[ladderNaam || s.ladder] || LADDERS.mineur;
  const stappen = I.stappenVoor(maten);
  const rnd = zaadRnd(zaad);
  const kanalen = [];
  const perMaat = I.STAPPEN_PER_MAAT;

  const herhaal = (basis) => {
    const uit = [];
    for (let m = 0; m < maten; m++) for (const p of basis) uit.push(m * perMaat + p);
    return uit.filter(p => p < stappen);
  };
  if (s.trap.length) kanalen.push({ instrument: 'kick', stappen: herhaal(s.trap) });
  if (s.klap.length) kanalen.push({ instrument: 'snare', stappen: herhaal(s.klap) });
  if (s.hoed.length) kanalen.push({ instrument: 'hihat', stappen: herhaal(s.hoed) });

  // De akkoordreeks: één akkoord per maat, en de bas pakt de grondtoon.
  const bas = [], pad = [], top = [];
  for (let m = 0; m < maten; m++) {
    const graad = s.reeks[m % s.reeks.length];
    const grond = s.grond + ladder[graad % ladder.length] + (graad >= ladder.length ? 12 : 0);
    const start = m * perMaat;
    bas.push({ stap: start, toon: grond + s.basOctaaf, lengte: 6 });
    bas.push({ stap: start + 8, toon: grond + s.basOctaaf, lengte: 6 });
    // een drieklank uit de ladder: grondtoon, terts, kwint
    for (const trede of [0, 2, 4]) {
      pad.push({ stap: start, toon: grond + ladder[(graad + trede) % ladder.length] +
        (graad + trede >= ladder.length ? 12 : 0), lengte: perMaat });
    }
    if (s.top) {
      for (let i = 0; i < 4; i++) {
        if (rnd() < 0.55) continue;
        const trede = Math.floor(rnd() * ladder.length);
        top.push({ stap: start + i * 4 + (rnd() < 0.4 ? 2 : 0), toon: grond + 12 + ladder[trede], lengte: 2 });
      }
    }
  }
  kanalen.push({ instrument: 'bas', noten: bas });
  kanalen.push({ instrument: s.pad, noten: pad, volume: 0.5 });
  if (s.top && top.length) kanalen.push({ instrument: s.top, noten: top, volume: 0.45 });
  return kanalen;
}
function zaadRnd(zaad) {
  let t = (zaad >>> 0) || 1;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}

module.exports = ({ schoonTrack }) => {
  /* Een voorstel op basis van wat iemand vroeg. Werkt zonder AI-sleutel; dat is
     de bedoeling, niet de terugval. */
  function voorstel(vraag, opties) {
    const o = opties || {};
    const gelezen = leesVraag(vraag);
    const stijl = STIJLEN[gelezen.stijl];
    const maten = Math.max(1, Math.min(I.MAX_MATEN, Number(o.maten) || 2));
    const bpm = Math.max(I.BPM_MIN, Math.min(I.BPM_MAX, gelezen.bpm || stijl.bpm));
    const kanalen = bouw(gelezen.stijl, maten, gelezen.ladder, Number(o.zaad) || Date.now());
    // Langs dezelfde poort als handwerk: wat niet kan, valt weg.
    const net = schoonTrack({ maten, bpm, kanalen: [] }, { maten, bpm, kanalen });
    return { stijl: gelezen.stijl, bpm: net.bpm, maten: net.maten, kanalen: net.kanalen,
      uitleg: zin(gelezen.stijl, net.bpm, net.maten) };
  }

  const zin = (stijl, bpm, maten) =>
    'Een ' + stijl + '-figuur van ' + maten + ' ' + (maten === 1 ? 'maat' : 'maten') + ' op ' + bpm + ' slagen. ' +
    'Zet hem in uw raster en haal eruit wat u niet wilt; het is een begin, geen stuk.';

  /* Wat Claude terugstuurt gaat langs dezelfde keuring. Een AI die een
     instrument noemt dat niet bestaat of een noot buiten het bereik zet, krijgt
     die er gewoon uitgehaald -- de client hoort dan niets vreemds, en de maker
     krijgt geen raadsel. Lukt er helemaal niets van, dan valt hij terug op het
     voorstel uit de tabellen hierboven; dat is altijd muziek. */
  function keurAntwoord(ruw, terugval, opties) {
    let d = null;
    try { d = typeof ruw === 'string' ? JSON.parse(ruw) : ruw; } catch (e) { d = null; }
    if (!d || !Array.isArray(d.kanalen) || !d.kanalen.length) return terugval;
    const maten = Math.max(1, Math.min(I.MAX_MATEN, Number(d.maten) || terugval.maten));
    const bpm = Math.max(I.BPM_MIN, Math.min(I.BPM_MAX, Number(d.bpm) || terugval.bpm));
    const bruikbaar = d.kanalen.filter(k => k && I.bestaat(k.instrument));
    if (!bruikbaar.length) return terugval;
    const net = schoonTrack({ maten, bpm, kanalen: [] }, { maten, bpm, kanalen: bruikbaar });
    // een voorstel zonder enige noot of stap is geen voorstel
    const leeg = net.kanalen.every(k => !(k.stappen || []).length && !(k.noten || []).length);
    if (leeg) return terugval;
    return { stijl: (opties && opties.stijl) || 'eigen', bpm: net.bpm, maten: net.maten,
      kanalen: net.kanalen, uitleg: String(d.uitleg || terugval.uitleg).slice(0, 300) };
  }

  return { voorstel, keurAntwoord, STIJLEN, STIJLNAMEN, LADDERS };
};

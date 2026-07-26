/* RTG Klankwerk (deelmodule): de muziekkennis.

   DE MUZIEKKENNIS STAAT IN EEN MODULE EN NIET IN EEN PROMPT. Toonladders,
   akkoordreeksen en drumfiguren zijn hier gewone tabellen. Dat heeft twee
   gevolgen die allebei het punt zijn:

   - de studio doet het NET ZO GOED ZONDER AI-SLEUTEL. Wat hier staat is geen
     terugval maar de gewone werking; Claude erbij maakt het gevarieerder, niet
     muzikaler;
   - als Claude er wél is, mag hij alleen KIEZEN en VARIEREN binnen wat hier
     staat. Een AI die zelf noten mag verzinnen die het instrument niet kan
     spelen, levert stilte op en een raadsel erbij.

   Rahul zelf (het voorstel, de keuring van wat Claude terugstuurt) staat in
   muziek-rahul.js; de liedvorm en de zang in muziek-lied.js. Dit bestand weet
   alleen wat muziek is, niet wie erom vroeg. */
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

/* Het slagwerk uit de intro en het slot halen. Een lied dat op volle kracht
   begint heeft geen opening, en een dat abrupt stopt heeft geen einde. Dit is
   een van de weinige dingen die een beginner nooit zelf bedenkt en die je in
   één regel code kunt geven. */
function stiltes(kanalen, secties) {
  const stil = secties.filter(s => s.zang === false).map(s => [s.van * I.STAPPEN_PER_MAAT, s.tot * I.STAPPEN_PER_MAAT]);
  if (!stil.length) return;
  const binnen = (p) => stil.some(r => p >= r[0] && p < r[1]);
  for (const k of kanalen) {
    if (k.instrument === 'kick' || k.instrument === 'snare') k.stappen = (k.stappen || []).filter(p => !binnen(p));
  }
}


module.exports = { LADDERS, STIJLEN, STIJLNAMEN, leesVraag, bouw, zaadRnd, stiltes };

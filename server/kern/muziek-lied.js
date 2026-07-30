/* RTG Klankwerk (deelmodule): van een lus een LIED maken.

   Een figuur van twee maten is knap, maar het is geen lied. Wat een lied maakt
   is VORM (intro, couplet, refrein) en een STEM die iets zegt. Dit bestand doet
   die twee dingen, en verder niets -- de klank zit in muziek-instrumenten.js,
   de begeleiding in muziek-rahul.js.

   WAAROM DIT ER IS. De vraag was: mensen moeten hier echte liedjes kunnen maken
   zonder er eerst voor te studeren. Het moeilijke aan een lied is niet de noten
   tekenen; het is weten dat een refrein hoger ligt dan een couplet, dat een zin
   ademruimte nodig heeft, en dat een lettergreep op de tel moet vallen. Dat is
   kennis, geen talent -- dus zetten we die kennis hier neer en niet in de prompt
   van een AI, precies zoals bij de begeleiding.

   WAT WE NIET DOEN: de woorden voor u verzinnen en dan doen alsof ze van u zijn.
   Typt u een zin, dan legt Rahul die op de melodie. Typt u niets, dan komen er
   open klinkers ("aah", "ooh") onder de noten -- eerlijk hoorbaar een neuriede
   lijn waar u zelf nog woorden in moet zetten. Een AI die uw refrein schrijft
   zou van u een luisteraar maken van uw eigen lied.

   En: geen "dit refrein scoort beter". Er is niets om voor te optimaliseren. */
const I = require('./muziek-instrumenten');

/* De vorm. Een deel duurt een vast aantal maten; samen vullen ze het stuk.
   Deze verhoudingen zijn niet willekeurig: een intro van vier maten voor een
   lied van zestien is een kwart wachten, en een refrein korter dan het couplet
   voelt als een belofte die niet ingelost wordt. */
const DELEN = [
  { naam: 'Intro', maten: 2, zang: false },
  { naam: 'Couplet', maten: 4, zang: 'laag' },
  { naam: 'Refrein', maten: 4, zang: 'hoog' },
  { naam: 'Couplet', maten: 4, zang: 'laag' },
  { naam: 'Refrein', maten: 4, zang: 'hoog' },
  { naam: 'Brug', maten: 2, zang: 'laag' },
  { naam: 'Refrein', maten: 4, zang: 'hoog' },
  { naam: 'Slot', maten: 2, zang: false }
];

/* De vorm inpassen in het aantal maten dat er is. Past een deel er niet meer
   helemaal in, dan houdt het op -- een half refrein is erger dan geen. */
function vorm(maten) {
  const uit = [];
  let op = 0;
  for (const d of DELEN) {
    if (op + d.maten > maten) continue;
    uit.push({ naam: d.naam, van: op, tot: op + d.maten, zang: d.zang });
    op += d.maten;
  }
  if (!uit.length) uit.push({ naam: 'Deel', van: 0, tot: maten, zang: 'laag' });
  return uit.slice(0, I.MAX_SECTIES);
}

/* ---- lettergrepen ----

   Een vuistregel, geen woordenboek: klinkergroepen zoeken, en de medeklinkers
   ertussen verdelen (één gaat mee naar voren, van twee blijft er één achter).
   Dat klopt voor het meeste Nederlands en Engels en zit er soms naast. Daarom
   staat elke lettergreep in de studio in een eigen invoerveld: wat hier misgaat,
   verbetert u met één klik. Een verkeerd afgebroken woord is een ongemak; een
   AI die uw tekst herschrijft zou erger zijn. */
const KLINKERS = 'aeiouyáéíóúäëïöü';
const TWEEKLANK = ['aa', 'ee', 'oo', 'uu', 'ie', 'oe', 'eu', 'ij', 'ui', 'ou', 'au', 'ei', 'oi', 'ea', 'ai'];

function klinkerGroepen(w) {
  const groepen = [];
  for (let i = 0; i < w.length; i++) {
    if (KLINKERS.indexOf(w[i]) < 0) continue;
    const twee = w.slice(i, i + 2);
    const lang = TWEEKLANK.includes(twee);
    groepen.push({ van: i, tot: i + (lang ? 2 : 1) });
    i += lang ? 1 : 0;
  }
  return groepen;
}

function lettergrepen(woord) {
  const w = String(woord || '').toLowerCase().replace(/[^a-zà-ÿ']/g, '');
  if (w.length < 3) return w ? [w] : [];
  const g = klinkerGroepen(w);
  if (g.length < 2) return [w];
  const knip = [];
  for (let i = 0; i < g.length - 1; i++) {
    const tussen = g[i + 1].van - g[i].tot;      // medeklinkers tussen twee klinkers
    if (tussen <= 0) knip.push(g[i].tot);        // klinkers tegen elkaar: er tussenin
    else if (tussen === 1) knip.push(g[i].tot);  // één medeklinker gaat mee naar voren
    else knip.push(g[i].tot + 1);                // van twee blijft er één achter
  }
  const uit = [];
  let vorige = 0;
  for (const k of knip) { if (k > vorige && k < w.length) { uit.push(w.slice(vorige, k)); vorige = k; } }
  uit.push(w.slice(vorige));
  return uit.filter(Boolean).map(s => s.slice(0, I.TEKST_MAX));
}

// Een hele regel: woord voor woord, in volgorde. Meer dan dit hoeft het niet te
// zijn -- de studio toont elke lettergreep los en u schuift ze waar u wilt.
const opsplitsen = (tekst) => String(tekst || '').split(/\s+/).filter(Boolean)
  .reduce((r, w) => r.concat(lettergrepen(w)), []).slice(0, I.MAX_NOTEN);

/* ---- de zanglijn ----

   Hoe een zingbare regel eruitziet, in vier regels muziekkennis:
   1. hij begint op de tel, niet ertussen;
   2. hij loopt in stapjes door de ladder, met hooguit af en toe een sprong --
      een stem die van octaaf naar octaaf springt is geen stem maar een synth;
   3. hij eindigt op de grondtoon of de kwint, anders blijft de zin openstaan;
   4. hij ademt: aan het eind van elke twee maten is er stilte.
   Het refrein ligt een terts hoger dan het couplet en herhaalt zijn eerste
   figuur. Dat is het enige echte "hit-trucje" hier, en het is eeuwenoud. */
function regel(opties) {
  const o = opties || {};
  const ladder = o.ladder, grond = o.grond, rnd = o.rnd;
  const hoog = o.hoog;
  const perMaat = I.STAPPEN_PER_MAAT;
  const start = o.van * perMaat;
  const maten = o.tot - o.van;
  const basis = grond + 12 + (hoog ? ladder[2] : 0);   // de stem zit boven de akkoorden
  // Een trede is een stap in de ladder; die kan onder nul zakken. Het octaaf
  // moet dan MEE naar beneden, anders klinkt een stap omlaag ineens omhoog.
  const toonVan = (t) => basis + ladder[((t % ladder.length) + ladder.length) % ladder.length] +
    12 * Math.floor(t / ladder.length);
  const noten = [];
  let trede = hoog ? 4 : 0;
  let motief = null;
  for (let m = 0; m < maten; m++) {
    // vier lettergreep-plekken per maat, op de tel; de derde valt vaak weg
    const plekken = [0, 4, 8, 12].filter((p, i) => i !== 2 || rnd() > 0.45);
    const zin = [];
    for (const p of plekken) {
      zin.push({ stap: start + m * perMaat + p, toon: toonVan(trede), lengte: 3 });
      trede += rnd() < 0.68 ? (rnd() < 0.5 ? 1 : -1) : (rnd() < 0.5 ? 2 : -2);
      if (trede > 7) trede = 5;
      if (trede < -2) trede = 0;
    }
    // het refrein herhaalt zijn eerste maat; dat is wat je onthoudt
    if (hoog && m === 0) motief = zin.map(n => n.toon);
    else if (hoog && m === 2 && motief) {
      zin.forEach((n, i) => { if (motief[i] != null) n.toon = motief[i]; });
    }
    // ademen: de laatste lettergreep van elke twee maten valt weg en de noot
    // ervoor krijgt die ruimte erbij, zodat de zin uitademt in plaats van door
    // te lopen. Zonder deze regel zingt een stem non-stop, en dat kan niemand.
    if (m % 2 === 1 && zin.length > 1) { zin.pop(); zin[zin.length - 1].lengte = 6; }
    noten.push.apply(noten, zin);
  }
  // een zin sluit af op de grondtoon, anders blijft hij hangen
  if (noten.length) { noten[noten.length - 1].toon = basis; noten[noten.length - 1].lengte = 8; }
  return noten;
}

/* De hele zangpartij: één noot per lettergreep, over de zingende delen heen.
   Zijn er meer noten dan lettergrepen, dan krijgt de rest een open klinker --
   zo hoort u meteen hoeveel woorden er nog missen in plaats van dat de melodie
   stiekem korter wordt. */
function zang(opties) {
  const o = opties || {};
  const stukken = (o.secties || []).filter(s => s.zang);
  if (!stukken.length) return null;
  const grepen = opsplitsen(o.tekst);
  const open = ['aah', 'ooh', 'oh', 'aah'];
  let i = 0;
  const noten = [];
  for (const s of stukken) {
    const rij = regel({ ladder: o.ladder, grond: o.grond, rnd: o.rnd,
      hoog: s.zang === 'hoog', van: s.van, tot: s.tot });
    for (const n of rij) {
      n.tekst = grepen.length ? (grepen[i % grepen.length] || open[i % open.length]) : open[i % open.length];
      i++;
      noten.push(n);
    }
  }
  return noten.sort((a, b) => a.stap - b.stap || a.toon - b.toon).slice(0, I.MAX_NOTEN);
}

/* Het koor: alleen op het refrein, alleen open klinkers, en een octaaf lager
   meegezongen. Een koor dat de tekst meezingt maakt de tekst juist onverstaanbaar
   -- dit is hoe het op een plaat ook gaat. */
function koor(opties) {
  const o = opties || {};
  const hoogte = (o.secties || []).filter(s => s.zang === 'hoog');
  if (!hoogte.length) return null;
  const noten = [];
  for (const s of hoogte) {
    for (let m = s.van; m < s.tot; m++) {
      for (const trede of [0, 2, 4]) {
        noten.push({ stap: m * I.STAPPEN_PER_MAAT, lengte: I.STAPPEN_PER_MAAT,
          toon: o.grond + 12 + o.ladder[trede % o.ladder.length], tekst: 'ooh' });
      }
    }
  }
  return noten.slice(0, I.MAX_NOTEN);
}

module.exports = { vorm, zang, koor, lettergrepen, opsplitsen, DELEN };

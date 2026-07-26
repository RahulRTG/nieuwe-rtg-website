/* RTG Klankwerk (deelmodule): Rahul zet iets neer.

   DE AI ZET NEER, JIJ BENT DE MAKER. Wat hier uitkomt is een VOORSTEL: gewone
   stappen en noten, in hetzelfde formaat als wat je zelf tekent. Je ziet het in
   je raster staan, je haalt de helft weg, je schuift de rest op -- en dan is het
   van jou. Er komt nooit een kant-en-klaar audiobestand uit, want dan zou je
   niets meer kunnen veranderen en zou de maker de machine zijn.

   De muzikale kennis waarmee hij dat doet staat NIET hier en niet in een
   prompt, maar in muziek-stijlen.js (ladders, stijlen, figuren) en
   muziek-lied.js (vorm en zang). Dit bestand doet één ding: van een vraag een
   voorstel maken, en wat Claude terugstuurt langs dezelfde keuring halen als
   handwerk.

   Wat hier NIET komt: "maak het populairder", "dit scoort beter". Er is geen
   publiek om voor te optimaliseren en we gaan er ook geen verzinnen. */
const I = require('./muziek-instrumenten');
const LIED = require('./muziek-lied');
const { LADDERS, STIJLEN, STIJLNAMEN, leesVraag, bouw, zaadRnd, stiltes } = require('./muziek-stijlen');

module.exports = ({ schoonTrack }) => {
  /* Een voorstel op basis van wat iemand vroeg. Werkt zonder AI-sleutel; dat is
     de bedoeling, niet de terugval.

     Twee smaken. Zonder `lied` komt er een FIGUUR: een lus van een paar maten
     om mee te beginnen. Met `lied` komt er een LIED: een vorm met coupletten en
     refreinen, een zanglijn erop, en een koor op het refrein. Dat tweede is de
     "zonder al te moeilijk doen"-weg -- maar het blijft een voorstel dat u zelf
     plaatst, en elke noot is daarna gewoon te verschuiven. */
  function voorstel(vraag, opties) {
    const o = opties || {};
    const gelezen = leesVraag(vraag);
    const stijl = STIJLEN[gelezen.stijl];
    const lied = !!o.lied;
    const maten = Math.max(1, Math.min(I.MAX_MATEN, Number(o.maten) || (lied ? 26 : 2)));
    const bpm = Math.max(I.BPM_MIN, Math.min(I.BPM_MAX, gelezen.bpm || stijl.bpm));
    const zaad = Number(o.zaad) || Date.now();
    const kanalen = bouw(gelezen.stijl, maten, gelezen.ladder, zaad);
    let secties = [];
    if (lied) {
      secties = LIED.vorm(maten);
      const ladder = LADDERS[gelezen.ladder || stijl.ladder] || LADDERS.mineur;
      // een eigen toevalsdraad voor de stem: anders volgt de melodie exact de
      // grillen van de bovenstem en zingt hij zichzelf achterna
      const rnd = zaadRnd((zaad ^ 0x5EED) >>> 0);
      const zangNoten = LIED.zang({ secties, ladder, grond: stijl.grond, rnd, tekst: o.tekst });
      const koorNoten = LIED.koor({ secties, ladder, grond: stijl.grond });
      stiltes(kanalen, secties);
      if (zangNoten) kanalen.push({ instrument: 'zang', noten: zangNoten, volume: 0.9 });
      if (koorNoten) kanalen.push({ instrument: 'koor', noten: koorNoten, volume: 0.32 });
    }
    // Langs dezelfde poort als handwerk: wat niet kan, valt weg.
    const net = schoonTrack({ maten, bpm, kanalen: [], secties: [] }, { maten, bpm, kanalen, secties });
    return { stijl: gelezen.stijl, bpm: net.bpm, maten: net.maten, kanalen: net.kanalen,
      secties: net.secties, lied,
      uitleg: lied ? liedZin(gelezen.stijl, net.bpm, net.secties, o.tekst) : zin(gelezen.stijl, net.bpm, net.maten) };
  }

  const zin = (stijl, bpm, maten) =>
    'Een ' + stijl + '-figuur van ' + maten + ' ' + (maten === 1 ? 'maat' : 'maten') + ' op ' + bpm + ' slagen. ' +
    'Zet hem in uw raster en haal eruit wat u niet wilt; het is een begin, geen stuk.';

  const liedZin = (stijl, bpm, secties, tekst) =>
    'Een ' + stijl + '-lied op ' + bpm + ' slagen, in ' + secties.length + ' delen: ' +
    secties.map(s => s.naam.toLowerCase()).join(', ') + '. ' +
    (String(tekst || '').trim()
      ? 'Uw zin staat lettergreep voor lettergreep onder de zangnoten; klopt een afbreking niet, dan typt u die zelf over.'
      : 'Er staat nog geen tekst onder: de stem zingt open klinkers, zodat u hoort waar uw woorden moeten komen.');

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

/* RTG School golf 3, de vervolg-motor: examentraining en het niveau-advies
   voor VO, mbo, hbo en wo. Twee eerlijkheidsregels dragen dit deel:
   1. EXAMENTRAINING traint zoals een examen voelt: tien vragen dwars door
      de fase, GEEN goed/fout halverwege -- de volledige terugblik komt aan
      het eind, met per vraag het juiste antwoord om van te leren.
   2. Het NIVEAU-ADVIES is en blijft een advies: over echte overgangen en
      examens beslissen mensen en de officiele instellingen, nooit wij. */
const toeval = require('../lib/toeval');   // keuzes op toeval: herhaalbaar met RTG_ZAAD
const { DOELEN, PER_FASE } = require('./leerstof');
const { opgave } = require('./leerstof-gen');
const { FASEN } = require('./onderwijs-ladder');

const EXAMEN_VRAGEN = 10;

function maakVervolg({ db, save, onderwijs }) {
  const nu = () => new Date().toISOString();
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
  const faseNaam = id => { const f = FASEN.find(x => x.id === id); return f ? f.naam : id; };

  function bak(naam) {
    if (!db.data[naam] || typeof db.data[naam] !== 'object') db.data[naam] = {};
    return db.data[naam];
  }

  /* ---------- examentraining: tien vragen, terugblik pas aan het eind ---------- */
  function examenStart(key, d) {
    const fase = String(d && d.fase || '').trim();
    const ids = PER_FASE[fase];
    if (!ids || !ids.length) return { status: 400, error: 'Voor deze fase is er (nog) geen examentraining. Kies een fase uit het voortgezet of vervolgonderwijs.' };
    const vragen = [];
    for (let i = 0; i < EXAMEN_VRAGEN; i++) {
      const id = toeval.kies(ids);
      const o = opgave(DOELEN[id].gen);
      vragen.push({ doel: id, v: o.v, a: o.a, opties: o.opties || null, antwoord: null });
    }
    bak('examenSessies')['lid:' + key] = { fase, vragen, ix: 0, at: nu() };
    save();
    const v = vragen[0];
    return { ok: true, fase, faseNaam: faseNaam(fase), totaal: EXAMEN_VRAGEN, nr: 1, vraag: v.v, opties: v.opties };
  }

  function examenAntwoord(key, d) {
    const s = bak('examenSessies')['lid:' + key];
    if (!s) return { status: 400, error: 'Begin eerst een examentraining.' };
    const vraag = s.vragen[s.ix];
    vraag.antwoord = String(d && d.antwoord || '').slice(0, 120);
    s.ix += 1;
    // zoals bij een echt examen: halverwege geen goed/fout, alleen de volgende vraag
    if (s.ix < s.vragen.length) {
      const v = s.vragen[s.ix];
      save();
      return { ok: true, nr: s.ix + 1, totaal: s.vragen.length, vraag: v.v, opties: v.opties };
    }
    const terugblik = s.vragen.map(x => ({ doel: x.doel, vraag: x.v, jouwAntwoord: x.antwoord, juisteAntwoord: x.a, goed: norm(x.antwoord) === norm(x.a) }));
    const goed = terugblik.filter(x => x.goed).length;
    const indicatie = Math.round((1 + 9 * goed / s.vragen.length) * 10) / 10;
    const hist = bak('examenHistorie');
    hist['lid:' + key] = hist['lid:' + key] || [];
    hist['lid:' + key].unshift({ fase: s.fase, goed, totaal: s.vragen.length, indicatie, at: nu() });
    hist['lid:' + key] = hist['lid:' + key].slice(0, 20);
    delete bak('examenSessies')['lid:' + key];
    save();
    return { ok: true, klaar: true, fase: s.fase, goed, totaal: s.vragen.length, terugblik,
      cijferIndicatie: indicatie,
      advies: 'Dit is een oefenuitslag en een advies, geen echt cijfer: kijk de terugblik na en oefen de doelen waar het misging. Echte examens lopen via de officiele instellingen.' };
  }

  /* ---------- het niveau-advies: kijkt, telt en adviseert -- meer niet ---------- */
  function advies(key) {
    const pas = onderwijs.mijn(key);
    if (!pas.fase) return { ok: true, advies: 'Schrijf je eerst in op de ladder (kies je fase); dan kan het advies met je meekijken.', eerlijk: pas.eerlijk };
    const fase = pas.fase.id;
    const ids = PER_FASE[fase] || [];
    const behaald = ids.filter(id => (pas.doelen || {})[id]).length;
    const examens = (bak('examenHistorie')['lid:' + key] || []).filter(e => e.fase === fase).slice(0, 5);
    const gem = examens.length ? Math.round(examens.reduce((n, e) => n + e.indicatie, 0) / examens.length * 10) / 10 : null;
    let tekst;
    if (!ids.length) tekst = 'Voor ' + pas.fase.naam + ' oefen je vooral in de praktijk; het paspoort groeit met elk behaald doel.';
    else if (behaald >= Math.ceil(ids.length * 0.8) && (gem == null || gem >= 6.5)) tekst = 'Je ligt goed op koers voor ' + pas.fase.naam + ': de meeste leerdoelen zijn binnen. Bespreek met je school of mentor of de volgende stap in beeld komt.';
    else if (behaald >= Math.ceil(ids.length * 0.4)) tekst = 'Je bent onderweg in ' + pas.fase.naam + ': een deel van de leerdoelen is binnen. Oefen gericht verder; de examentraining laat zien waar je staat.';
    else tekst = 'Je staat aan het begin van ' + pas.fase.naam + '. Begin bij de leerdoelen van je vakken en bouw rustig op; elke oefensessie telt.';
    return { ok: true, fase: pas.fase, doelenBehaald: behaald, doelenTotaal: ids.length,
      examens: examens.map(e => ({ indicatie: e.indicatie, at: e.at })), examenGemiddelde: gem,
      advies: tekst + ' Dit is een advies, geen besluit: over overgaan, toelating en echte examens beslissen mensen en de officiele instellingen.',
      eerlijk: pas.eerlijk };
  }

  return { examenStart, examenAntwoord, advies };
}

module.exports = { maakVervolg };

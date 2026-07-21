/* RTG Verzorging: drie persoonlijke-dienstengenres op een kern.
   De beauty-salon en barbier (stoelen, behandelingen met duur, agenda
   zonder dubbele stoelen en een walk-in wachtrij; nadrukkelijk
   niet-medisch), petcare (pension met hokken, uitlaatrondes, trimsalon
   en dieetnotities; bij medische zorgen verwijzen we altijd naar de
   dierenarts) en de kinderopvang met nanny-service (groepen met
   capaciteit, ophalen alleen door de aangemelde ouder, nanny-aanvragen
   die een mens bevestigt en dagverslagjes met alleen voornamen).
   Opslag in db.data.beauty[code], db.data.petcare[code], db.data.opvang[code]. */

const MAX_LIJST = 200;
const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const vandaag = () => nu().slice(0, 10);
  const id = p => p + crypto.randomBytes(3).toString('hex');
  const cap = (lijst, max) => { if (lijst.length > max) lijst.length = max; };
  const bak = (naam, maker) => (code) => {
    if (!db.data[naam]) db.data[naam] = {};
    if (!db.data[naam][code]) { db.data[naam][code] = maker(); save(); }
    return db.data[naam][code];
  };
  const plusMin = (tijd, minuten) => {
    const t = Number(tijd.slice(0, 2)) * 60 + Number(tijd.slice(3)) + minuten;
    return String(Math.floor(t / 60) % 24).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };

  /* ---- de beauty-salon en barbier (niet-medisch) ---- */
  function demoSalon() {
    return {
      naam: 'Velvet & Blade',
      stoelen: [
        { id: 's1', naam: 'Barbier 1', soort: 'barbier' },
        { id: 's2', naam: 'Barbier 2', soort: 'barbier' },
        { id: 's3', naam: 'Salon (knip & kleur)', soort: 'kapper' },
        { id: 's4', naam: 'Nagelstudio', soort: 'nagels' }
      ],
      behandelingen: [
        { id: 'b1', naam: 'Klassieke fade', soort: 'barbier', duurMin: 30, prijs: 32 },
        { id: 'b2', naam: 'Scheren met heet doek', soort: 'barbier', duurMin: 30, prijs: 28 },
        { id: 'b3', naam: 'Knippen & stylen', soort: 'kapper', duurMin: 45, prijs: 55 },
        { id: 'b4', naam: 'Kleuren, heel', soort: 'kapper', duurMin: 90, prijs: 120 },
        { id: 'b5', naam: 'Manicure', soort: 'nagels', duurMin: 45, prijs: 40 }
      ],
      afspraken: [], wachtrij: [], teller: 0
    };
  }
  const salonVan = bak('beauty', demoSalon);

  function beautyOverzicht(code) {
    const s = salonVan(code);
    const d = vandaag();
    const vandaagAf = s.afspraken.filter(a => a.datum === d && a.status !== 'weg');
    return {
      naam: s.naam, stoelen: s.stoelen, behandelingen: s.behandelingen,
      afspraken: s.afspraken.filter(a => a.datum >= d && a.status !== 'weg').slice(0, 40),
      wachtrij: s.wachtrij.slice(0, 20),
      kpi: {
        afsprakenVandaag: vandaagAf.length,
        wachtenden: s.wachtrij.filter(w => w.status === 'wacht').length,
        inDeStoel: s.wachtrij.filter(w => w.status === 'in de stoel').length,
        omzetVandaag: Math.round(vandaagAf.filter(a => a.status === 'klaar').reduce((t, a) => t + a.prijs, 0) * 100) / 100
      }
    };
  }
  function beautyBoek(code, b) {
    const s = salonVan(code);
    const beh = s.behandelingen.find(x => x.id === String(b.behandelingId || ''));
    const stoel = s.stoelen.find(x => x.id === String(b.stoelId || ''));
    if (!beh || !stoel) return { status: 404, error: 'Kies een behandeling en een stoel.' };
    if (beh.soort !== stoel.soort) return { status: 400, error: beh.naam + ' hoort niet bij ' + stoel.naam + '.' };
    const naam = schoon(b.naam, 60);
    const datum = String(b.datum || '').slice(0, 10), van = String(b.tijd || '');
    if (!naam) return { status: 400, error: 'Op welke naam staat de afspraak?' };
    if (!DATUM.test(datum) || !TIJD.test(van)) return { status: 400, error: 'Kies een datum en tijd.' };
    const tot = plusMin(van, beh.duurMin);
    const botst = s.afspraken.find(a => a.stoelId === stoel.id && a.datum === datum && a.status !== 'weg' && van < a.tot && tot > a.van);
    if (botst) return { status: 409, error: stoel.naam + ' is dan bezet (' + botst.van + ' tot ' + botst.tot + ').' };
    const a = { id: id('a'), naam, behandeling: beh.naam, stoelId: stoel.id, stoel: stoel.naam,
      datum, van, tot, prijs: beh.prijs, status: 'gepland', gemaakt: nu() };
    s.afspraken.unshift(a); cap(s.afspraken, MAX_LIJST); save();
    return { ok: true, afspraak: a };
  }
  function beautyStatus(code, aId, statusWens) {
    const s = salonVan(code);
    const a = s.afspraken.find(x => x.id === String(aId || ''));
    if (!a) return { status: 404, error: 'Afspraak niet gevonden.' };
    if (!['klaar', 'weg'].includes(statusWens)) return { status: 400, error: 'Kies klaar of weg.' };
    a.status = statusWens; save();
    return { ok: true, afspraak: a };
  }
  function walkIn(code, b) {
    const s = salonVan(code);
    const beh = s.behandelingen.find(x => x.id === String(b.behandelingId || ''));
    const naam = schoon(b.naam, 60);
    if (!beh) return { status: 404, error: 'Kies een behandeling.' };
    if (!naam) return { status: 400, error: 'Wie loopt er binnen?' };
    s.teller += 1;
    const w = { id: id('w'), nr: s.teller, naam, behandeling: beh.naam, prijs: beh.prijs, status: 'wacht', gemeld: nu() };
    s.wachtrij.push(w); cap(s.wachtrij, 50); save();
    return { ok: true, wachtend: w };
  }
  function walkStatus(code, wId, statusWens) {
    const s = salonVan(code);
    const w = s.wachtrij.find(x => x.id === String(wId || ''));
    if (!w) return { status: 404, error: 'Deze walk-in staat niet in de rij.' };
    if (statusWens === 'in de stoel') w.status = 'in de stoel';
    else if (statusWens === 'klaar') s.wachtrij = s.wachtrij.filter(x => x.id !== w.id);
    else return { status: 400, error: 'Kies in de stoel of klaar.' };
    save(); return { ok: true, wachtend: w };
  }

  /* ---- petcare: pension, uitlaatrondes en de trimsalon ---- */
  const HOKKEN = 8, MAX_RONDE = 6;
  function demoPension() {
    const over3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    return {
      naam: 'Amics Petcare', hokken: HOKKEN,
      gasten: [
        { id: 'd1', dier: 'hond', naam: 'Bruno', baasje: 'Fam. Vermeer', hok: 1, dieet: 'Twee keer per dag, graanvrij.', tot: over3, notities: [], sinds: vandaag() },
        { id: 'd2', dier: 'kat', naam: 'Mimi', baasje: 'Amira Sol', hok: 2, dieet: '', tot: over3, notities: [], sinds: vandaag() }
      ],
      rondes: [{ id: 'r1', tijd: '09:00', honden: ['Bruno'], status: 'gepland' }],
      trim: []
    };
  }
  const pensionVan = bak('petcare', demoPension);

  function petOverzicht(code) {
    const p = pensionVan(code);
    return {
      naam: p.naam, hokken: p.hokken, gasten: p.gasten, rondes: p.rondes.slice(0, 20),
      trim: p.trim.filter(t => t.status !== 'klaar').slice(0, 20),
      verwijzing: 'Bij medische zorgen verwijzen we altijd naar de dierenarts; wij behandelen niet zelf.',
      kpi: {
        gasten: p.gasten.length, hokkenVrij: p.hokken - p.gasten.length,
        rondesVandaag: p.rondes.filter(r => r.status === 'gepland').length,
        trimOpen: p.trim.filter(t => t.status !== 'klaar').length
      }
    };
  }
  function petCheckIn(code, b) {
    const p = pensionVan(code);
    if (p.gasten.length >= p.hokken) return { status: 409, error: 'Het pension zit vol; alle ' + p.hokken + ' hokken zijn bezet.' };
    const naam = schoon(b.naam, 40), baasje = schoon(b.baasje, 60);
    const dier = ['hond', 'kat', 'anders'].includes(b.dier) ? b.dier : 'hond';
    if (!naam || !baasje) return { status: 400, error: 'Hoe heet het dier, en van wie is het?' };
    const bezet = new Set(p.gasten.map(g => g.hok));
    let hok = 1; while (bezet.has(hok)) hok += 1;
    const g = { id: id('d'), dier, naam, baasje, hok, dieet: schoon(b.dieet, 120), tot: String(b.tot || '').slice(0, 10), notities: [], sinds: vandaag() };
    p.gasten.push(g); save();
    return { ok: true, gast: g };
  }
  function petCheckUit(code, gId) {
    const p = pensionVan(code);
    const voor = p.gasten.length;
    p.gasten = p.gasten.filter(g => g.id !== String(gId || ''));
    if (p.gasten.length === voor) return { status: 404, error: 'Deze gast logeert hier niet.' };
    save(); return { ok: true };
  }
  function petNotitie(code, gId, tekst) {
    const p = pensionVan(code);
    const g = p.gasten.find(x => x.id === String(gId || ''));
    if (!g) return { status: 404, error: 'Deze gast logeert hier niet.' };
    const t = schoon(tekst, 160);
    if (!t) return { status: 400, error: 'Schrijf een korte notitie.' };
    g.notities.unshift({ tekst: t, om: nu() }); cap(g.notities, 20); save();
    return { ok: true, gast: g };
  }
  function rondeMaak(code, tijd) {
    const p = pensionVan(code);
    if (!TIJD.test(String(tijd || ''))) return { status: 400, error: 'Kies een starttijd voor de ronde.' };
    const r = { id: id('r'), tijd: String(tijd), honden: [], status: 'gepland' };
    p.rondes.unshift(r); cap(p.rondes, 40); save();
    return { ok: true, ronde: r };
  }
  function rondeHond(code, rId, naam) {
    const p = pensionVan(code);
    const r = p.rondes.find(x => x.id === String(rId || ''));
    if (!r) return { status: 404, error: 'Ronde niet gevonden.' };
    const n = schoon(naam, 40);
    if (!n) return { status: 400, error: 'Welke hond loopt mee?' };
    if (r.status !== 'gepland') return { status: 409, error: 'Deze ronde is al gelopen.' };
    if (r.honden.length >= MAX_RONDE) return { status: 409, error: 'Een ronde is maximaal ' + MAX_RONDE + ' honden.' };
    if (r.honden.includes(n)) return { status: 409, error: n + ' loopt al mee.' };
    r.honden.push(n); save();
    return { ok: true, ronde: r };
  }
  function rondeKlaar(code, rId) {
    const p = pensionVan(code);
    const r = p.rondes.find(x => x.id === String(rId || ''));
    if (!r) return { status: 404, error: 'Ronde niet gevonden.' };
    r.status = 'gelopen'; save();
    return { ok: true, ronde: r };
  }
  function trimBoek(code, b) {
    const p = pensionVan(code);
    const naam = schoon(b.naam, 40), baasje = schoon(b.baasje, 60);
    const datum = String(b.datum || '').slice(0, 10), tijd = String(b.tijd || '');
    if (!naam || !baasje) return { status: 400, error: 'Welk dier komt er, en van wie is het?' };
    if (!DATUM.test(datum) || !TIJD.test(tijd)) return { status: 400, error: 'Kies een datum en tijd.' };
    const bezet = p.trim.find(t => t.datum === datum && t.tijd === tijd && t.status !== 'klaar');
    if (bezet) return { status: 409, error: 'De trimtafel is dan bezet (' + bezet.naam + ').' };
    const t = { id: id('t'), naam, baasje, datum, tijd, wens: schoon(b.wens, 120), status: 'gepland', gemaakt: nu() };
    p.trim.unshift(t); cap(p.trim, MAX_LIJST); save();
    return { ok: true, afspraak: t };
  }
  function trimKlaar(code, tId) {
    const p = pensionVan(code);
    const t = p.trim.find(x => x.id === String(tId || ''));
    if (!t) return { status: 404, error: 'Afspraak niet gevonden.' };
    t.status = 'klaar'; save();
    return { ok: true, afspraak: t };
  }

  /* ---- kinderopvang en de nanny-service ----
     Privacy by design: alleen voornamen op de lijsten, ophalen kan
     uitsluitend door de ouder die het kind ook heeft aangemeld, en een
     nanny-aanvraag wordt altijd door een mens bevestigd. */
  function demoOpvang() {
    return {
      naam: 'Nido Kinderopvang & Nanny',
      groepen: [
        { id: 'g1', naam: 'Vlinders (0 tot 2)', capaciteit: 9, aanwezig: [] },
        { id: 'g2', naam: 'Ontdekkers (2 tot 4)', capaciteit: 12, aanwezig: [] }
      ],
      nannies: [
        { id: 'n1', naam: 'Sofia', gescreend: true },
        { id: 'n2', naam: 'Mees', gescreend: true }
      ],
      nannyBoekingen: [], verslagen: []
    };
  }
  const opvangVan = bak('opvang', demoOpvang);

  function opvangOverzicht(code) {
    const o = opvangVan(code);
    return {
      naam: o.naam, groepen: o.groepen, nannies: o.nannies,
      nannyBoekingen: o.nannyBoekingen.slice(0, 20), verslagen: o.verslagen.slice(0, 20),
      regel: 'Ophalen kan alleen door de ouder die het kind heeft aangemeld; een nanny-aanvraag bevestigt altijd een mens.',
      kpi: {
        aanwezig: o.groepen.reduce((s, g) => s + g.aanwezig.length, 0),
        plekkenVrij: o.groepen.reduce((s, g) => s + Math.max(0, g.capaciteit - g.aanwezig.length), 0),
        nannyOpen: o.nannyBoekingen.filter(b => b.status === 'aangevraagd').length,
        verslagenVandaag: o.verslagen.filter(v => v.om.slice(0, 10) === vandaag()).length
      }
    };
  }
  function kindMeld(code, b) {
    const o = opvangVan(code);
    const g = o.groepen.find(x => x.id === String(b.groepId || ''));
    if (!g) return { status: 404, error: 'Deze groep bestaat niet.' };
    const voornaam = schoon(b.voornaam, 30), ouder = schoon(b.ouder, 60);
    if (!voornaam || !ouder) return { status: 400, error: 'De voornaam van het kind en de naam van de ouder horen erbij.' };
    if (g.aanwezig.length >= g.capaciteit) return { status: 409, error: g.naam + ' zit vol.' };
    if (g.aanwezig.find(k => k.voornaam.toLowerCase() === voornaam.toLowerCase())) return { status: 409, error: voornaam + ' is al aangemeld.' };
    const k = { id: id('k'), voornaam, ouder, sinds: nu() };
    g.aanwezig.push(k); save();
    return { ok: true, kind: { id: k.id, voornaam: k.voornaam }, groep: g.naam };
  }
  function kindOphaal(code, b) {
    const o = opvangVan(code);
    const g = o.groepen.find(x => x.id === String(b.groepId || ''));
    if (!g) return { status: 404, error: 'Deze groep bestaat niet.' };
    const k = g.aanwezig.find(x => x.id === String(b.kindId || ''));
    if (!k) return { status: 404, error: 'Dit kind staat niet op de lijst.' };
    const ouder = schoon(b.ouder, 60);
    if (!ouder || ouder.toLowerCase() !== k.ouder.toLowerCase()) {
      return { status: 403, error: 'Ophalen kan alleen door de ouder die het kind heeft aangemeld.' };
    }
    g.aanwezig = g.aanwezig.filter(x => x.id !== k.id); save();
    return { ok: true, opgehaald: k.voornaam };
  }
  function nannyVraag(code, b) {
    const o = opvangVan(code);
    const datum = String(b.datum || '').slice(0, 10), van = String(b.van || ''), tot = String(b.tot || '');
    const gezin = schoon(b.gezin, 60), wens = schoon(b.wens, 160);
    if (!gezin) return { status: 400, error: 'Voor welk gezin is de nanny?' };
    if (!DATUM.test(datum) || !TIJD.test(van) || !TIJD.test(tot) || tot <= van) return { status: 400, error: 'Kies een datum en een geldig tijdvak.' };
    const a = { id: id('b'), gezin, datum, van, tot, wens, nanny: null, status: 'aangevraagd', gemaakt: nu() };
    o.nannyBoekingen.unshift(a); cap(o.nannyBoekingen, MAX_LIJST); save();
    return { ok: true, aanvraag: a };
  }
  function nannyZet(code, b) {
    const o = opvangVan(code);
    const a = o.nannyBoekingen.find(x => x.id === String(b.id || ''));
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (b.status === 'bevestigd') {
      const n = o.nannies.find(x => x.id === String(b.nannyId || ''));
      if (!n) return { status: 404, error: 'Kies een van onze gescreende nanny\'s.' };
      const botst = o.nannyBoekingen.find(x => x.id !== a.id && x.nanny === n.naam && x.status === 'bevestigd' && x.datum === a.datum && a.van < x.tot && a.tot > x.van);
      if (botst) return { status: 409, error: n.naam + ' is dan al bij ' + botst.gezin + '.' };
      a.nanny = n.naam; a.status = 'bevestigd';
    } else if (b.status === 'afgerond') a.status = 'afgerond';
    else return { status: 400, error: 'Kies bevestigd of afgerond.' };
    save(); return { ok: true, aanvraag: a };
  }
  function verslagMaak(code, b) {
    const o = opvangVan(code);
    const voornaam = schoon(b.voornaam, 30), tekst = schoon(b.tekst, 240);
    if (!voornaam || !tekst) return { status: 400, error: 'Voor wie is het verslagje, en wat is er beleefd?' };
    const v = { id: id('v'), voornaam, tekst, om: nu() };
    o.verslagen.unshift(v); cap(o.verslagen, MAX_LIJST); save();
    return { ok: true, verslag: v };
  }

  return {
    beauty: { overzicht: beautyOverzicht, boek: beautyBoek, afspraakStatus: beautyStatus, walkIn, walkStatus },
    petcare: { overzicht: petOverzicht, checkIn: petCheckIn, checkUit: petCheckUit, notitie: petNotitie,
      rondeMaak, rondeHond, rondeKlaar, trimBoek, trimKlaar },
    opvang: { overzicht: opvangOverzicht, kindMeld, kindOphaal, nannyVraag, nannyZet, verslagMaak }
  };
};

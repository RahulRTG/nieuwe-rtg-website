/* Sportclub, deelbestand "zakelijk": de trainingskampen (de club vraagt aan,
   een MENS bij RTG bevestigt), de sponsorpakketten (zakelijke leden tonen
   interesse en de club beslist), de momenten voor de socials, de financien
   op een bord (tickets + sponsors + kantine uit de kassa + kampkosten), de
   het publieke sportbord voor de ene Sport-app. De cockpit met signalen en de
   AI-clubmanager staan in ./cockpit.js: die kijken en adviseren, en dat is een
   ander soort werk dan hier. Krijgt de gedeelde ctx van ./index.js. */
module.exports = (ctx) => {
  const { db, save, anthropic, schoon, id, nu, vandaag, club, clubs, seed, vindWedstrijd, crypto, KAMP_KETEN } = ctx;

  /* ---------- trainingskampen: de club vraagt, een mens bij RTG bevestigt ---------- */
  function kampVraag(code, data) {
    data = data || {};
    const bestemming = schoon(data.bestemming, 60);
    if (bestemming.length < 2) return { status: 400, error: 'Waar wil het team heen?' };
    const c = club(code);
    const t = c.teams.find(x => x.id === String(data.teamId || '')) || c.teams[0];
    const k = { id: id('km'), code: 'TK-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      team: t ? t.naam : 'Selectie', bestemming, periode: schoon(data.periode, 60) || 'nader te bepalen',
      personen: Math.max(1, Math.min(60, Math.round(Number(data.personen) || 20))),
      status: 'aangevraagd', verblijf: null, kostenCenten: 0, at: nu() };
    c.kampen.unshift(k);
    save();
    return { ok: true, kamp: k };
  }
  function kampen(code) { seed(); return { ok: true, keten: KAMP_KETEN, kampen: club(code).kampen.slice(0, 30) }; }
  function kampBeslis(actor, code, kid, akkoord, data) {
    data = data || {};
    const k = club(code).kampen.find(x => x.id === String(kid || ''));
    if (!k) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (k.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al ' + k.status + '.' };
    if (!akkoord) { k.status = 'afgewezen'; save(); return { ok: true, kamp: k }; }
    k.status = 'bevestigd';
    k.verblijf = schoon(data.verblijf, 80) || 'RTG-partnerhotel';
    k.kostenCenten = Math.max(0, Math.min(100000000, Math.round(Number(data.kostenCenten) || 0)));
    k.door = actor || 'RTG reisdesk';
    save();
    return { ok: true, kamp: k };
  }

  /* ---------- sponsors: de club plaatst, zakelijke leden tonen interesse ---------- */
  function sponsors(code) { seed(); return { ok: true, sponsors: club(code).sponsors.slice(0, 30) }; }
  function sponsorMaak(code, data) {
    data = data || {};
    const pakket = schoon(data.pakket, 80);
    if (pakket.length < 3) return { status: 400, error: 'Omschrijf het sponsorpakket.' };
    const sp = { id: id('sp'), pakket, prijsCenten: Math.max(0, Math.min(1000000000, Math.round(Number(data.prijsCenten) || 0))),
      tekst: schoon(data.tekst, 300), status: 'open', interesse: [], at: nu() };
    club(code).sponsors.unshift(sp);
    save();
    return { ok: true, sponsor: sp };
  }
  function sponsorInteresse(code, sid, codenaam) {
    const sp = club(code).sponsors.find(x => x.id === String(sid || ''));
    if (!sp) return { status: 404, error: 'Pakket niet gevonden.' };
    if (sp.status !== 'open') return { status: 409, error: 'Dit pakket is ' + sp.status + '.' };
    const naam = schoon(codenaam, 60);
    if (sp.interesse.some(i => i.codenaam === naam)) return { status: 409, error: 'U staat al op de lijst; de club neemt contact op.' };
    sp.interesse.push({ codenaam: naam, at: nu() });
    save();
    return { ok: true, sponsor: { id: sp.id, pakket: sp.pakket, interesse: sp.interesse.length } };
  }
  function sponsorBeslis(code, sid, codenaam) {
    const sp = club(code).sponsors.find(x => x.id === String(sid || ''));
    if (!sp) return { status: 404, error: 'Pakket niet gevonden.' };
    if (sp.status !== 'open') return { status: 409, error: 'Dit pakket is al ' + sp.status + '.' };
    const kandidaat = sp.interesse.find(i => i.codenaam === schoon(codenaam, 60));
    if (!kandidaat) return { status: 404, error: 'Deze kandidaat staat niet op de lijst.' };
    sp.status = 'gesloten';
    sp.sponsor = kandidaat.codenaam;
    save();
    return { ok: true, sponsor: sp };
  }

  /* ---------- momenten: beelden van de club voor op de socials ---------- */
  function momentMaak(code, data) {
    data = data || {};
    const tekst = schoon(data.tekst, 300);
    if (tekst.length < 3) return { status: 400, error: 'Schrijf er iets bij.' };
    const m = { id: id('mo'), tekst, beeld: schoon(data.beeld, 8) || 'sport', door: schoon(data.door, 60) || 'De club', at: nu() };
    club(code).momenten.unshift(m);
    club(code).momenten = club(code).momenten.slice(0, 200);
    save();
    return { ok: true, moment: m };
  }
  function momenten(code) { seed(); return { ok: true, momenten: club(code).momenten.slice(0, 30) }; }

  /* ---------- de financien: alles op een bord ---------- */
  function financien(code) {
    seed();
    const c = club(code);
    const tickets = c.tickets.filter(t => t.status !== 'geannuleerd');
    const kantine = ((db.data.posSales || {})[code] || []).reduce((s, x) => s + Math.round((x.total || 0) * 100), 0);
    return { ok: true,
      ticketsVerkocht: tickets.reduce((s, t) => s + t.aantal, 0),
      ticketOmzetCenten: tickets.reduce((s, t) => s + t.prijsCenten, 0),
      sponsorsCenten: c.sponsors.filter(s2 => s2.status === 'gesloten').reduce((s, x) => s + x.prijsCenten, 0),
      kantineCenten: kantine,
      kampKostenCenten: c.kampen.filter(k => k.status === 'bevestigd').reduce((s, k) => s + k.kostenCenten, 0) };
  }

  /* De cockpit en de AI-clubmanager staan in ./cockpit.js. Dit bestand doet
     HANDELINGEN (aanvragen, plaatsen, optellen); die laag KIJKT en adviseert
     en heeft geen enkele weg naar opslaan -- een verbod in een prompt is geen
     grens, een module zonder schrijffunctie wel. */
  const { cockpit, sportAI } = require('./cockpit')({ club, seed, vandaag, schoon, anthropic, financien });

  /* ---------- het publieke sportbord: EEN app met alles ---------- */
  function bord() {
    seed();
    const uit = [];
    for (const s of clubs()) {
      const c = club(s.code);
      for (const w of c.wedstrijden.slice(0, 40)) {
        const t = c.teams.find(x => x.id === w.teamId);
        uit.push({ club: s.name, clubCode: s.code, team: t ? t.naam : '?', competitie: t ? t.competitie : '?',
          wedstrijdId: w.id, tegen: w.tegenstander, thuis: w.thuis, datum: w.datum, tijd: w.tijd,
          uitslag: w.uitslag ? w.uitslag.voor + ' - ' + w.uitslag.tegen : null });
      }
    }
    uit.sort((a, b) => (b.datum + b.tijd).localeCompare(a.datum + a.tijd));
    const eerste = clubs()[0];
    return { ok: true, wedstrijden: uit.slice(0, 60),
      clubs: clubs().map(s => ({ code: s.code, naam: s.name })),
      momenten: eerste ? club(eerste.code).momenten.slice(0, 10).map(m => ({ ...m, club: eerste.name })) : [] };
  }

  return { kampVraag, kampen, kampBeslis, sponsors, sponsorMaak, sponsorInteresse, sponsorBeslis,
    momentMaak, momenten, financien, cockpit, sportAI, bord };
};

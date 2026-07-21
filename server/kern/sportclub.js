/* RTG Sportclub (kern/sportclub.js): het complete systeem voor wereldclubs --
   van de jeugdteams tot marketing, pr en hr, van het veldbeheer tot de
   financien. Elke club is een gewone RTG-partner (genre sportclub), dus de
   kantine draait op de bestaande kassalaag (menu + kassa, contant of RTG Pay)
   en het personeel (hr) op het bestaande rooster en de werk-app.

   Wat hier woont:
     plattegrond   de club tekent zijn EIGEN stadion: tribunevakken met
                   capaciteit en prijs, plus voorzieningen (horeca, wc,
                   entree, ehbo) op de kaart
     wedstrijden   het programma, ticketverkoop per vak (capaciteit bewaakt,
                   oplichtende code; afrekenen aan de poort via de kassa),
                   scan bij de entree en de uitslag erin
     standen       de competitietabel per team, live berekend uit de
                   uitslagen (3-1-0, doelsaldo)
     teams         van jeugd tot eerste elftal, selectie op codenaam
     velden        het veldbeheer: gras/kunst, status, onderhoud melden;
                   een wedstrijd op een afgekeurd veld is een signaal
     kampen        een trainingskamp boeken: de club vraagt aan, RTG (een
                   mens) bevestigt met het verblijf -- nooit de AI
     sponsors      pakketten plaatsen; zakelijke leden tonen interesse en
                   de club beslist
     momenten      beelden en berichten van de club voor op de socials en
                   in de Sport-app
     financien     alles op een bord: tickets, sponsors, kantine-omzet
                   (uit de kassa) en de kampkosten
   De AI-clubmanager adviseert; beslissen doet de club.
   Vast patroon: maakSportclub(state) -> { sport: api }. */

const TEAM_CATEGORIEEN = ['jeugd', 'senioren', 'vrouwen'];
const VELD_STATUS = ['goed', 'onderhoud', 'afgekeurd'];
const VOORZIENINGEN = ['horeca', 'wc', 'entree', 'ehbo'];
const KAMP_KETEN = ['aangevraagd', 'bevestigd', 'afgewezen'];

function maakSportclub({ db, save, crypto, anthropic }) {
  const nu = () => new Date().toISOString();
  const id = p => (p || 'sp') + crypto.randomBytes(4).toString('hex');
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  function S() {
    if (!db.data.sportclubs || typeof db.data.sportclubs !== 'object') db.data.sportclubs = {};
    return db.data.sportclubs;
  }
  function club(code) {
    const s = S();
    if (!s[code]) s[code] = { plattegrond: { vakken: [], voorzieningen: [] }, teams: [], wedstrijden: [],
      tickets: [], velden: [], kampen: [], sponsors: [], momenten: [] };
    const c = s[code];
    for (const k of ['teams', 'wedstrijden', 'tickets', 'velden', 'kampen', 'sponsors', 'momenten']) if (!Array.isArray(c[k])) c[k] = [];
    if (!c.plattegrond) c.plattegrond = { vakken: [], voorzieningen: [] };
    return c;
  }

  function seed() {
    if (!Array.isArray(db.data.suppliers)) return;
    if (!db.data.supplierTypes.sportclub)
      db.data.supplierTypes.sportclub = { label: 'Sportclub', icon: '⚽', caps: ['sportclub'] };
    if (!db.data.suppliers.find(s => s.code === 'FCRTG')) {
      db.data.suppliers.push({
        code: 'FCRTG', name: 'FC RTG', type: 'sportclub', city: 'Ibiza',
        loc: { lat: 38.906, lng: 1.420, label: 'Estadio RTG' }, rate: 0,
        menu: [{ id: 'k1', name: 'Stadionbroodje', price: 4.5 }, { id: 'k2', name: 'Koffie', price: 2.5 }, { id: 'k3', name: 'Ranja jeugd', price: 1 }],
        photos: [], sportclub: {}
      });
    }
    const c = club('FCRTG');
    if (!c._seed) {
      c._seed = true;
      c.plattegrond.vakken = [
        { id: 'noord', naam: 'Tribune Noord', capaciteit: 400, prijsCenten: 1500 },
        { id: 'zuid', naam: 'Tribune Zuid (fanatiek)', capaciteit: 300, prijsCenten: 1200 },
        { id: 'hoofd', naam: 'Hoofdtribune', capaciteit: 200, prijsCenten: 2500 },
        { id: 'familie', naam: 'Familievak', capaciteit: 150, prijsCenten: 800 }
      ];
      c.plattegrond.voorzieningen = [
        { id: id('vz'), soort: 'horeca', naam: 'Kantine De Aftrap', bij: 'hoofd' },
        { id: id('vz'), soort: 'horeca', naam: 'Snackpunt Noord', bij: 'noord' },
        { id: id('vz'), soort: 'wc', naam: 'Toiletten Noord', bij: 'noord' },
        { id: id('vz'), soort: 'wc', naam: 'Toiletten Zuid', bij: 'zuid' },
        { id: id('vz'), soort: 'entree', naam: 'Hoofdentree', bij: 'hoofd' },
        { id: id('vz'), soort: 'ehbo', naam: 'EHBO-post', bij: 'familie' }
      ];
      c.teams = [
        { id: id('tm'), naam: 'RTG 1', categorie: 'senioren', competitie: 'Eredivisie Ibiza', trainer: 'Marco Insel', spelers: [] },
        { id: id('tm'), naam: 'RTG Vrouwen 1', categorie: 'vrouwen', competitie: 'Vrouwen Liga', trainer: 'Carla Duin', spelers: [] },
        { id: id('tm'), naam: 'RTG O17', categorie: 'jeugd', competitie: 'Jeugd O17', trainer: 'Pep Salinas', spelers: [] }
      ];
      c.velden = [
        { id: id('vd'), naam: 'Hoofdveld', soort: 'gras', status: 'goed', notitie: null },
        { id: id('vd'), naam: 'Veld 2', soort: 'kunstgras', status: 'goed', notitie: null },
        { id: id('vd'), naam: 'Trainingsveld', soort: 'gras', status: 'onderhoud', notitie: 'Doelgebied opnieuw ingezaaid' }
      ];
      const t1 = c.teams[0].id;
      const d = new Date();
      const dagen = n => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
      c.wedstrijden = [
        { id: id('wd'), teamId: t1, tegenstander: 'CD Salinas', thuis: true, datum: dagen(-7), tijd: '14:30', veld: 'Hoofdveld', uitslag: { voor: 3, tegen: 1 }, at: nu() },
        { id: id('wd'), teamId: t1, tegenstander: 'Portinatx United', thuis: false, datum: dagen(-2), tijd: '20:00', veld: null, uitslag: { voor: 2, tegen: 2 }, at: nu() },
        { id: id('wd'), teamId: t1, tegenstander: 'Es Vedra FC', thuis: true, datum: dagen(5), tijd: '16:00', veld: 'Hoofdveld', uitslag: null, at: nu() }
      ];
      c.sponsors = [{ id: id('sp'), pakket: 'Hoofdsponsor shirt', prijsCenten: 2500000, tekst: 'Het shirt van RTG 1, een heel seizoen.', status: 'open', interesse: [], at: nu() }];
      c.momenten = [{ id: id('mo'), tekst: 'De 3-1 tegen CD Salinas: wat een middag op de Noord!', beeld: '🏟️', door: 'FC RTG', at: nu() }];
      save();
    }
    return c;
  }
  const isSportclub = s => !!(s && s.type === 'sportclub');
  const clubs = () => { seed(); return db.data.suppliers.filter(s => s.type === 'sportclub'); };
  const vindWedstrijd = (c, wid) => c.wedstrijden.find(w => w.id === String(wid || ''));

  /* ---------- de plattegrond: de club tekent zijn eigen stadion ---------- */
  function plattegrond(code) {
    seed();
    const c = club(code);
    return { ok: true, vakken: c.plattegrond.vakken, voorzieningen: c.plattegrond.voorzieningen, soorten: VOORZIENINGEN };
  }
  function plattegrondZet(code, data) {
    data = data || {};
    const c = club(code);
    if (Array.isArray(data.vakken)) {
      const vakken = data.vakken.slice(0, 40).map(v => ({
        id: schoon(v.id, 20) || id('vk'), naam: schoon(v.naam, 60) || 'Vak',
        capaciteit: Math.max(1, Math.min(100000, Math.round(Number(v.capaciteit) || 100))),
        prijsCenten: Math.max(0, Math.min(1000000, Math.round(Number(v.prijsCenten) || 0)))
      }));
      if (!vakken.length) return { status: 400, error: 'Een stadion heeft minstens een vak.' };
      c.plattegrond.vakken = vakken;
    }
    if (Array.isArray(data.voorzieningen)) {
      c.plattegrond.voorzieningen = data.voorzieningen.slice(0, 60).map(v => ({
        id: schoon(v.id, 20) || id('vz'), soort: VOORZIENINGEN.includes(v.soort) ? v.soort : 'horeca',
        naam: schoon(v.naam, 60) || 'Voorziening', bij: schoon(v.bij, 20) || null
      }));
    }
    save();
    return plattegrond(code);
  }

  /* ---------- teams: van de jeugd tot het eerste ---------- */
  function teams(code) {
    seed();
    return { ok: true, categorieen: TEAM_CATEGORIEEN, teams: club(code).teams.map(t => ({
      id: t.id, naam: t.naam, categorie: t.categorie, competitie: t.competitie, trainer: t.trainer, spelers: t.spelers.length })) };
  }
  function teamMaak(code, data) {
    data = data || {};
    const naam = schoon(data.naam, 60);
    if (naam.length < 2) return { status: 400, error: 'Geef het team een naam.' };
    const t = { id: id('tm'), naam, categorie: TEAM_CATEGORIEEN.includes(data.categorie) ? data.categorie : 'jeugd',
      competitie: schoon(data.competitie, 60) || 'Vriendschappelijk', trainer: schoon(data.trainer, 60) || null, spelers: [] };
    club(code).teams.unshift(t);
    save();
    return { ok: true, team: t };
  }
  function spelerVoeg(code, teamId, codenaam) {
    const t = club(code).teams.find(x => x.id === String(teamId || ''));
    if (!t) return { status: 404, error: 'Team niet gevonden.' };
    const naam = schoon(codenaam, 60);
    if (naam.length < 2) return { status: 400, error: 'De selectie draait op codenaam.' };
    if (t.spelers.includes(naam)) return { status: 409, error: 'Deze speler staat al in de selectie.' };
    t.spelers.push(naam);
    t.spelers = t.spelers.slice(0, 40);
    save();
    return { ok: true, team: { id: t.id, naam: t.naam, spelers: t.spelers } };
  }

  /* ---------- wedstrijden, tickets en de scan bij de poort ---------- */
  function wedstrijdMaak(code, data) {
    data = data || {};
    const c = club(code);
    const t = c.teams.find(x => x.id === String(data.teamId || '')) || c.teams[0];
    if (!t) return { status: 400, error: 'Maak eerst een team.' };
    const w = { id: id('wd'), teamId: t.id, tegenstander: schoon(data.tegenstander, 60) || 'Onbekend',
      thuis: data.thuis !== false, datum: /^\d{4}-\d{2}-\d{2}$/.test(String(data.datum || '')) ? data.datum : vandaag(),
      tijd: /^\d{2}:\d{2}$/.test(String(data.tijd || '')) ? data.tijd : '14:00',
      veld: schoon(data.veld, 40) || null, uitslag: null, at: nu() };
    c.wedstrijden.unshift(w);
    c.wedstrijden = c.wedstrijden.slice(0, 2000);
    save();
    return { ok: true, wedstrijd: w };
  }
  function uitslagZet(code, wid, voor, tegen) {
    const c = club(code);
    const w = vindWedstrijd(c, wid);
    if (!w) return { status: 404, error: 'Wedstrijd niet gevonden.' };
    const v = Math.round(Number(voor)), t = Math.round(Number(tegen));
    if (!Number.isFinite(v) || !Number.isFinite(t) || v < 0 || t < 0 || v > 99 || t > 99)
      return { status: 400, error: 'Een uitslag is twee getallen van 0 tot 99.' };
    w.uitslag = { voor: v, tegen: t };
    save();
    return { ok: true, wedstrijd: w };
  }
  function ticketKoop(code, sess, codenaam, data) {
    data = data || {};
    const c = club(code);
    const w = vindWedstrijd(c, String(data.wedstrijdId || ''));
    if (!w) return { status: 404, error: 'Wedstrijd niet gevonden.' };
    if (!w.thuis) return { status: 409, error: 'Voor uitwedstrijden verkoopt de club hier geen kaarten.' };
    if (w.uitslag) return { status: 409, error: 'Deze wedstrijd is al gespeeld.' };
    const vak = c.plattegrond.vakken.find(x => x.id === String(data.vak || ''));
    if (!vak) return { status: 404, error: 'Kies een vak op de plattegrond.' };
    const aantal = Math.max(1, Math.min(8, Math.round(Number(data.aantal) || 1)));
    const bezet = c.tickets.filter(t => t.wedstrijdId === w.id && t.vak === vak.id && t.status !== 'geannuleerd')
      .reduce((s, t) => s + t.aantal, 0);
    if (bezet + aantal > vak.capaciteit) return { status: 409, error: vak.naam + ' is (bijna) vol: nog ' + Math.max(0, vak.capaciteit - bezet) + ' plaats(en).' };
    const t = { id: id('tk'), code: 'ST-' + crypto.randomBytes(3).toString('hex').toUpperCase(), wedstrijdId: w.id,
      vak: vak.id, aantal, prijsCenten: vak.prijsCenten * aantal, key: sess.key,
      codenaam: schoon(codenaam, 60) || 'Supporter', status: 'gereserveerd', at: nu() };
    c.tickets.unshift(t);
    c.tickets = c.tickets.slice(0, 100000);
    save();
    return { ok: true, ticket: { code: t.code, vak: vak.naam, aantal, prijsCenten: t.prijsCenten,
      wedstrijd: (w.thuis ? 'FC ' : '') + 'RTG - ' + w.tegenstander, datum: w.datum, tijd: w.tijd,
      let: 'Afrekenen aan de poort: contant of RTG Pay bij de kassa.' } };
  }
  function ticketScan(code, ticketCode) {
    const c = club(code);
    const t = c.tickets.find(x => x.code === String(ticketCode || '').trim().toUpperCase());
    if (!t) return { ok: true, geldig: false, reden: 'Deze code kennen we niet.' };
    if (t.status === 'gescand') return { ok: true, geldig: false, reden: 'Al gescand bij de poort.' };
    const w = vindWedstrijd(c, t.wedstrijdId);
    t.status = 'gescand';
    t.gescandAt = nu();
    save();
    const vak = c.plattegrond.vakken.find(x => x.id === t.vak);
    return { ok: true, geldig: true, ticket: { naam: t.codenaam, aantal: t.aantal, vak: vak ? vak.naam : t.vak,
      wedstrijd: w ? 'RTG - ' + w.tegenstander : '?', prijsCenten: t.prijsCenten } };
  }
  function mijnTickets(key) {
    seed();
    const uit = [];
    for (const s of clubs()) {
      const c = club(s.code);
      for (const t of c.tickets.filter(x => x.key === key).slice(0, 10)) {
        const w = vindWedstrijd(c, t.wedstrijdId);
        const vak = c.plattegrond.vakken.find(x => x.id === t.vak);
        uit.push({ code: t.code, club: s.name, wedstrijd: w ? 'RTG - ' + w.tegenstander : '?', datum: w ? w.datum : '',
          tijd: w ? w.tijd : '', vak: vak ? vak.naam : t.vak, aantal: t.aantal, prijsCenten: t.prijsCenten, status: t.status });
      }
    }
    return { ok: true, tickets: uit };
  }

  /* ---------- de stand: live berekend uit de uitslagen ---------- */
  function stand(code, teamId) {
    seed();
    const c = club(code);
    const t = c.teams.find(x => x.id === String(teamId || '')) || c.teams[0];
    if (!t) return { ok: true, competitie: null, tabel: [] };
    // de demo-competitie: de eigen uitslagen tellen echt; de rest van de
    // tabel is een stabiele demo-benadering rond de eigen punten
    const eigen = { team: t.naam, g: 0, w: 0, gl: 0, v: 0, dv: 0, dt: 0, p: 0 };
    for (const w of c.wedstrijden.filter(x => x.teamId === t.id && x.uitslag)) {
      eigen.g += 1; eigen.dv += w.uitslag.voor; eigen.dt += w.uitslag.tegen;
      if (w.uitslag.voor > w.uitslag.tegen) { eigen.w += 1; eigen.p += 3; }
      else if (w.uitslag.voor === w.uitslag.tegen) { eigen.gl += 1; eigen.p += 1; }
      else eigen.v += 1;
    }
    const anderen = ['CD Salinas', 'Portinatx United', 'Es Vedra FC', 'Cala Conta', 'Benirras Boys']
      .map((naam, i) => ({ team: naam, g: eigen.g, w: Math.max(0, eigen.w - 1 + (i % 2)), gl: 1, v: Math.max(0, eigen.g - eigen.w - (i % 2)),
        dv: Math.max(0, eigen.dv - 2 - i), dt: eigen.dt + i, p: Math.max(0, eigen.p - 2 - i) }));
    const tabel = [eigen, ...anderen].sort((a, b) => b.p - a.p || (b.dv - b.dt) - (a.dv - a.dt));
    return { ok: true, competitie: t.competitie, team: t.naam, tabel };
  }

  /* ---------- het veldbeheer ---------- */
  function velden(code) {
    seed();
    return { ok: true, statussen: VELD_STATUS, velden: club(code).velden };
  }
  function veldZet(code, vid, data) {
    data = data || {};
    const v = club(code).velden.find(x => x.id === String(vid || ''));
    if (!v) return { status: 404, error: 'Veld niet gevonden.' };
    if (data.status && !VELD_STATUS.includes(data.status)) return { status: 400, error: 'Kies een status (' + VELD_STATUS.join(', ') + ').' };
    if (data.status) v.status = data.status;
    if (data.notitie !== undefined) v.notitie = schoon(data.notitie, 200) || null;
    save();
    return { ok: true, veld: v };
  }

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
    const m = { id: id('mo'), tekst, beeld: schoon(data.beeld, 8) || '⚽', door: schoon(data.door, 60) || 'De club', at: nu() };
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

  /* ---------- de cockpit + AI-clubmanager ---------- */
  function cockpit(code) {
    seed();
    const c = club(code);
    const signalen = [];
    for (const w of c.wedstrijden.filter(x => !x.uitslag && x.thuis && x.datum >= vandaag())) {
      const veld = c.velden.find(v => v.naam === w.veld);
      if (veld && veld.status === 'afgekeurd')
        signalen.push({ soort: 'veld', tekst: 'RTG - ' + w.tegenstander + ' (' + w.datum + ') staat op ' + veld.naam + ', maar dat veld is AFGEKEURD.' });
    }
    for (const k of c.kampen.filter(x => x.status === 'aangevraagd'))
      signalen.push({ soort: 'kamp', tekst: 'Trainingskamp ' + k.code + ' (' + k.team + ' naar ' + k.bestemming + ') wacht op een besluit van de RTG-reisdesk.' });
    for (const sp of c.sponsors.filter(x => x.status === 'open' && x.interesse.length))
      signalen.push({ soort: 'sponsor', tekst: '"' + sp.pakket + '" heeft ' + sp.interesse.length + ' kandidaat-sponsor(s); de club is aan zet.' });
    const f = financien(code);
    return { ok: true, teams: c.teams.length,
      programma: c.wedstrijden.filter(w => !w.uitslag && w.datum >= vandaag()).length,
      gespeeld: c.wedstrijden.filter(w => w.uitslag).length,
      ticketsVerkocht: f.ticketsVerkocht, veldenGoed: c.velden.filter(v => v.status === 'goed').length,
      veldenTotaal: c.velden.length, sponsorsOpen: c.sponsors.filter(s2 => s2.status === 'open').length,
      momenten: c.momenten.length, signalen: signalen.slice(0, 40) };
  }
  async function sportAI(code, vraag) {
    const co = cockpit(code);
    const f = financien(code);
    const beeld = co.teams + ' teams, ' + co.programma + ' wedstrijden op het programma (' + co.gespeeld + ' gespeeld), ' +
      co.ticketsVerkocht + ' tickets verkocht, velden ' + co.veldenGoed + '/' + co.veldenTotaal + ' goed, ' +
      co.sponsorsOpen + ' sponsorpakket(ten) open. Financien: tickets EUR ' + Math.round(f.ticketOmzetCenten / 100) +
      ', sponsors EUR ' + Math.round(f.sponsorsCenten / 100) + ', kantine EUR ' + Math.round(f.kantineCenten / 100) +
      ', kampen EUR ' + Math.round(f.kampKostenCenten / 100) + '. Signalen: ' +
      (co.signalen.length ? co.signalen.slice(0, 5).map(s => s.tekst).join(' | ') : 'geen') + '.';
    const q = schoon(vraag, 400);
    if (anthropic && q) {
      try {
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 350,
          system: require('./rahul').RAHUL_LEAD + 'je bent de AI-clubmanager van deze sportclub op het RTG-platform. Je adviseert het bestuur ' +
            'over tickets, jeugd, velden, sponsors, marketing en de financien, kort en praktisch. Je adviseert ALLEEN: elk besluit ' +
            '(opstelling, sponsor, kamp, veld) neemt de club zelf. Huidige beeld: ' + beeld,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = r.content && r.content[0] && r.content[0].text;
        if (tekst) return { ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { ok: true, demo: true, antwoord: 'Het beeld van de club: ' + beeld + ' Mijn advies: los eerst de veld-signalen op, zet de thuiswedstrijd groot in een moment op de socials, en nodig de kandidaat-sponsors uit in de bestuurskamer. Beslissen doet u zelf.' };
  }

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

  return { sport: { seed, isSportclub, cockpit, plattegrond, plattegrondZet, teams, teamMaak, spelerVoeg,
    wedstrijdMaak, uitslagZet, ticketKoop, ticketScan, mijnTickets, stand, velden, veldZet,
    kampVraag, kampen, kampBeslis, sponsors, sponsorMaak, sponsorInteresse, sponsorBeslis,
    momentMaak, momenten, financien, sportAI, bord } };
}

module.exports = { maakSportclub };

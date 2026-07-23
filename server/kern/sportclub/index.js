/* RTG Sportclub (kern/sportclub): het complete systeem voor wereldclubs --
   van de jeugdteams tot marketing, pr en hr, van het veldbeheer tot de
   financien. Elke club is een gewone RTG-partner (genre sportclub), dus de
   kantine draait op de bestaande kassalaag en het personeel (hr) op het
   bestaande rooster en de werk-app.

   Dit is de spil: de clubstaat, de seed (FC RTG) en de gedeelde ctx voor de
   deelbestanden. Wat waar woont:
     ./stadion    de plattegrond (de club tekent zijn EIGEN stadion),
                  tickets per vak, de scan bij de poort en mijn tickets
     ./sportief   teams, wedstrijden, uitslagen, de stand en het veldbeheer
     ./zakelijk   kampen (RTG beslist), sponsors, momenten, financien,
                  cockpit, de AI-clubmanager en het publieke sportbord
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
      db.data.supplierTypes.sportclub = { label: 'Sportclub', icon: 'sport', caps: ['sportclub'] };
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

  // de gedeelde ctx voor de deelbestanden
  const ctx = { db, save, crypto, anthropic, nu, id, schoon, vandaag, club, clubs, seed, vindWedstrijd,
    TEAM_CATEGORIEEN, VELD_STATUS, VOORZIENINGEN, KAMP_KETEN };
  const api = { seed, isSportclub };
  Object.assign(api, require('./stadion')(ctx));
  Object.assign(api, require('./sportief')(ctx));
  Object.assign(api, require('./zakelijk')(ctx));
  return { sport: api };
}

module.exports = { maakSportclub };

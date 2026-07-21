/* De Reis-Bibliotheek: een miljoen reis-apps van over de hele wereld, van
   Londen tot Gaza. De meest nuttige, exclusieve en educatieve reisgidsen die
   in de winkel serieus geld kosten; voor betalende RTG-leden inbegrepen bij
   de pas. 250 bestemmingen x 40 gidssoorten x 20 edities x 5 jaargangen =
   exact 1.000.000.

   Op deze schaal bouwen we GEEN naamindex (een miljoen strings zou tientallen
   MB's RAM vreten): zoeken werkt op de bouwstenen: de zoekterm vindt
   bestemmingen en/of gidssoorten, en de treffers rollen daar procedureel uit.
   Elk nummer levert altijd dezelfde app; alleen installaties worden bewaard. */

const { BESTEMMINGEN } = require('./bestemmingen');

const SOORTEN = ['Stadsgids', 'Metrokaart', 'Wandelroutes', 'Museumgids', 'Foodgids', 'Taalgids', 'Geschiedenisgids', 'Architectuurgids',
  'Kunstgids', 'Natuurgids', 'Strandgids', 'Bergroutes', 'Fietsroutes', 'Fotospots', 'Avondgids', 'Marktengids',
  'Etiquettewijzer', 'Veiligheidswijzer', 'Valuta & fooien', 'OV-planner', 'Luchthavengids', 'Treingids', 'Roadtripplanner', 'Kids & gezin',
  'Toegankelijkheid', 'Duurzaam reizen', 'Pelgrimsroutes', 'Erfgoedgids', 'Festivalkalender', 'Weerwijzer', 'Inpakhulp', 'Reisapotheek',
  'Noodhulp & ambassade', 'Visumwijzer', 'Douanewijzer', 'Offline kaart', 'Audiotour', 'Dagtochten', 'Verborgen plekken', 'Streekkeuken'];
const EDITIES = ['Pro', 'Compleet', 'Premium', 'Insider', 'Deluxe', 'Compact', 'Offline', 'Audio', 'Familie', 'Solo',
  'Signature', 'Collector', 'Expeditie', 'Panorama', 'Meester', 'Grand', 'Royal', 'Atlas', 'Editie X', 'Nova'];
const JAREN = [2022, 2023, 2024, 2025, 2026];

const PER_BS = EDITIES.length * JAREN.length;                     // 100 per bestemming x soort
const PER_B = SOORTEN.length * PER_BS;                            // 4.000 per bestemming
const TOTAAL = BESTEMMINGEN.length * PER_B;                       // 1.000.000

function appVan(i) {
  if (!Number.isInteger(i) || i < 0 || i >= TOTAAL) return null;
  const b = Math.floor(i / PER_B);
  const s = Math.floor((i % PER_B) / PER_BS);
  const rest = i % PER_BS;
  const editie = EDITIES[rest % EDITIES.length];
  const jaar = JAREN[Math.floor(rest / EDITIES.length)];
  const waarde = 999 + ((i * 7919) % 140) * 100;                  // 9,99 .. 148,99: de dure gidsen
  return {
    id: 'reis-' + i, nr: i,
    naam: SOORTEN[s] + ' ' + BESTEMMINGEN[b] + ' ' + editie + ' ' + jaar,
    bestemming: BESTEMMINGEN[b], soort: SOORTEN[s], editie, jaar,
    winkelwaardeCenten: waarde, ledenprijsCenten: 0,
    sterren: (41 + ((i * 31) % 9)) / 10, versie: jaar + '.' + ((i * 13) % 10), grootteMB: 30 + ((i * 97) % 470),
    uitleg: SOORTEN[s] + ' voor ' + BESTEMMINGEN[b] + ' (' + jaar + '): nuttig, exclusief en educatief, offline te gebruiken. In de winkel EUR ' +
      (waarde / 100).toFixed(2).replace('.', ',') + '; voor RTG-leden inbegrepen bij de pas.'
  };
}

// de totale winkelwaarde: een keer optellen bij het opstarten, zonder iets te bewaren
let SOM_WAARDE = 0;
for (let i = 0; i < TOTAAL; i++) SOM_WAARDE += 999 + ((i * 7919) % 140) * 100;

const B_LC = BESTEMMINGEN.map(x => x.toLowerCase());
const S_LC = SOORTEN.map(x => x.toLowerCase());

function maakReisBieb({ db, save }) {
  const rij = (key) => {
    if (!db.data.reisInstallaties) db.data.reisInstallaties = {};
    if (!Array.isArray(db.data.reisInstallaties[key])) db.data.reisInstallaties[key] = [];
    return db.data.reisInstallaties[key];
  };

  function overzicht() {
    return { totaal: TOTAAL, totaleWinkelwaardeCenten: SOM_WAARDE,
      bestemmingen: BESTEMMINGEN, soorten: SOORTEN, perBestemming: PER_B };
  }

  /* Bladeren en zoeken op de bouwstenen: kies een bestemming en/of soort, of
     typ een zoekterm; die vindt bestemmingen en soorten (Londen, Gaza,
     metrokaart...). De treffers rollen procedureel uit de gekozen assen. */
  function catalogus({ bestemming, soort, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(42000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    let B = bestemming ? [BESTEMMINGEN.indexOf(String(bestemming))].filter(x => x >= 0) : null;
    let S = soort ? [SOORTEN.indexOf(String(soort))].filter(x => x >= 0) : null;
    if (q) {
      const qb = B_LC.map((x, ix) => x.includes(q) ? ix : -1).filter(x => x >= 0);
      const qs = S_LC.map((x, ix) => x.includes(q) ? ix : -1).filter(x => x >= 0);
      if (qb.length && !B) B = qb;
      else if (qs.length && !S) S = qs;
      else if (!qb.length && !qs.length) return { items: [], totaal: 0, pagina: 1, paginas: 1, hint: 'Zoek op een bestemming (bijv. Londen, Gaza) of een gidssoort (bijv. metrokaart).' };
    }
    const Bx = B || BESTEMMINGEN.map((_, ix) => ix);
    const Sx = S || SOORTEN.map((_, ix) => ix);
    const totaal = Bx.length * Sx.length * PER_BS;
    const pak = (k) => {
      const perB = Sx.length * PER_BS;
      const b = Bx[Math.floor(k / perB)];
      const s = Sx[Math.floor((k % perB) / PER_BS)];
      return b * PER_B + s * PER_BS + (k % PER_BS);
    };
    const start = (p - 1) * n;
    const items = [];
    for (let k = start; k < Math.min(start + n, totaal); k++) items.push(appVan(pak(k)));
    return { items, totaal, pagina: p, paginas: Math.max(1, Math.ceil(totaal / n)) };
  }

  function installeer(key, id) {
    const nr = Number(String(id || '').replace(/^reis-/, ''));
    const app = appVan(nr);
    if (!app) return { status: 404, error: 'Deze reis-app bestaat niet in de bibliotheek.' };
    const mijn = rij(key);
    if (mijn.includes(nr)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 500) return { status: 400, error: 'Het maximum van 500 reis-apps is bereikt; verwijder er eerst een.' };
    mijn.push(nr); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(key, id) {
    const nr = Number(String(id || '').replace(/^reis-/, ''));
    const mijn = rij(key);
    const ix = mijn.indexOf(nr);
    if (ix < 0) return { status: 404, error: 'Deze app staat niet bij uw reis-apps.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (key) => rij(key).map(appVan).filter(Boolean);

  return { reisbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, TOTAAL } };
}

module.exports = { maakReisBieb, TOTAAL };

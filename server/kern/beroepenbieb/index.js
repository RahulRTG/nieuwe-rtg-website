/* De Beroepen-Bibliotheek van de RTFoundation: twee werelden van elk precies
   EEN MILJOEN leer-apps, altijd gratis.
     - techniek: 100 technische en agrarische beroepen
     - zaken:    100 beroepen uit het bedrijfsleven
   Per wereld: 100 beroepen x 50 app-soorten x 20 edities x 10 niveaus =
   1.000.000. Zelfde RAM-discipline als de Reis-Bibliotheek: geen naamindex,
   zoeken werkt op de bouwstenen (beroep en soort) en elke app rolt
   deterministisch uit zijn nummer. Alleen installaties worden bewaard. */

const { TECHNIEK_BEROEPEN, TECHNIEK_SOORTEN, ZAKEN_BEROEPEN, ZAKEN_SOORTEN } = require('./data');

const EDITIES = ['Start', 'Basis', 'Plus', 'Compleet', 'Praktijk', 'Compact', 'Offline', 'Audio', 'Klas', 'Duo',
  'Pro', 'Expert', 'Master', 'Atelier', 'Werkplaats', 'Veld', 'Seizoen', 'Editie X', 'Nova', 'Goud'];
const NIVEAUS = ['Verkenner', 'Starter', 'Leerling', 'Gevorderd', 'Gezel', 'Specialist', 'Vakman', 'Expert', 'Meester', 'Grootmeester'];

const WERELDEN = {
  techniek: { label: 'Technisch & agrarisch', icon: '🛠️', beroepen: TECHNIEK_BEROEPEN, soorten: TECHNIEK_SOORTEN },
  zaken: { label: 'Bedrijfsleven', icon: '💼', beroepen: ZAKEN_BEROEPEN, soorten: ZAKEN_SOORTEN }
};
const PER_BS = EDITIES.length * NIVEAUS.length;            // 200 per beroep x soort
const PER_BEROEP = 50 * PER_BS;                            // 10.000 per beroep
const PER_WERELD = 100 * PER_BEROEP;                       // 1.000.000 per wereld

function appVan(wereld, i) {
  const w = WERELDEN[wereld];
  if (!w || !Number.isInteger(i) || i < 0 || i >= PER_WERELD) return null;
  const b = Math.floor(i / PER_BEROEP);
  const s = Math.floor((i % PER_BEROEP) / PER_BS);
  const rest = i % PER_BS;
  const editie = EDITIES[rest % EDITIES.length];
  const niveau = NIVEAUS[Math.floor(rest / EDITIES.length)];
  const waarde = 1499 + ((i * 7919) % 120) * 100;          // 14,99 .. 133,99: wat het in de winkel zou kosten
  return {
    id: wereld + '-' + i, nr: i, wereld, wereldLabel: w.label, icon: w.icon,
    naam: w.soorten[s] + ' ' + w.beroepen[b] + ' · ' + niveau + ' ' + editie,
    beroep: w.beroepen[b], soort: w.soorten[s], editie, niveau,
    winkelwaardeCenten: waarde, prijsCenten: 0,
    sterren: (41 + ((i * 31) % 9)) / 10, versie: (2 + (i % 6)) + '.' + ((i * 13) % 10), grootteMB: 25 + ((i * 97) % 400),
    uitleg: w.soorten[s] + ' voor het beroep ' + w.beroepen[b] + ', niveau ' + niveau + '. Leer een echt vak op jouw tempo; in de winkel EUR ' +
      (waarde / 100).toFixed(2).replace('.', ',') + ', via de RTFoundation altijd gratis. Geen aankopen, geen reclame, geen verslavende trucjes.'
  };
}

function maakBeroepenBieb({ db, save }) {
  const rij = (handle) => {
    if (!db.data.beroepenInstallaties) db.data.beroepenInstallaties = {};
    if (!Array.isArray(db.data.beroepenInstallaties[handle])) db.data.beroepenInstallaties[handle] = [];
    return db.data.beroepenInstallaties[handle];
  };

  function overzicht() {
    return {
      totaal: 2 * PER_WERELD, perWereld: PER_WERELD, perBeroep: PER_BEROEP, gratis: true,
      werelden: Object.entries(WERELDEN).map(([id, w]) => ({ id, label: w.label, icon: w.icon, aantal: PER_WERELD, beroepen: w.beroepen, soorten: w.soorten })),
      niveaus: NIVEAUS
    };
  }

  /* bladeren en zoeken op de bouwstenen: kies een beroep en/of soort, of typ
     een zoekterm (lasser, businessplan...); treffers rollen procedureel uit */
  function catalogus(wereld, { beroep, soort, zoek, pagina, per } = {}) {
    const w = WERELDEN[wereld];
    if (!w) return { status: 404, error: 'Kies een wereld: techniek of zaken.' };
    const p = Math.max(1, Math.min(42000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const B_LC = w.beroepen.map(x => x.toLowerCase());
    const S_LC = w.soorten.map(x => x.toLowerCase());
    let B = beroep ? [w.beroepen.indexOf(String(beroep))].filter(x => x >= 0) : null;
    let S = soort ? [w.soorten.indexOf(String(soort))].filter(x => x >= 0) : null;
    if (q) {
      const qb = B_LC.map((x, ix) => x.includes(q) ? ix : -1).filter(x => x >= 0);
      const qs = S_LC.map((x, ix) => x.includes(q) ? ix : -1).filter(x => x >= 0);
      if (qb.length && !B) B = qb;
      else if (qs.length && !S) S = qs;
      else if (!qb.length && !qs.length) return { items: [], totaal: 0, pagina: 1, paginas: 1, hint: 'Zoek op een beroep (bijv. lasser, ondernemer) of een app-soort (bijv. leerpad).' };
    }
    const Bx = B || w.beroepen.map((_, ix) => ix);
    const Sx = S || w.soorten.map((_, ix) => ix);
    const totaal = Bx.length * Sx.length * PER_BS;
    const pak = (k) => {
      const perB = Sx.length * PER_BS;
      const b = Bx[Math.floor(k / perB)];
      const s = Sx[Math.floor((k % perB) / PER_BS)];
      return b * PER_BEROEP + s * PER_BS + (k % PER_BS);
    };
    const start = (p - 1) * n;
    const items = [];
    for (let k = start; k < Math.min(start + n, totaal); k++) items.push(appVan(wereld, pak(k)));
    return { items, totaal, pagina: p, paginas: Math.max(1, Math.ceil(totaal / n)) };
  }

  const splits = (id) => { const m = String(id || '').match(/^(techniek|zaken)-(\d+)$/); return m ? [m[1], Number(m[2])] : [null, -1]; };

  function installeer(handle, id) {
    const [wereld, nr] = splits(id);
    const app = appVan(wereld, nr);
    if (!app) return { status: 404, error: 'Deze app bestaat niet in de Beroepen-Bibliotheek.' };
    const mijn = rij(handle);
    if (mijn.includes(app.id)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 500) return { status: 400, error: 'Het maximum van 500 beroeps-apps is bereikt; ruim eerst op.' };
    mijn.push(app.id); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(handle, id) {
    const mijn = rij(handle);
    const ix = mijn.indexOf(String(id || ''));
    if (ix < 0) return { status: 404, error: 'Deze app staat niet bij jouw beroeps-apps.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (handle) => rij(handle).map(id => { const [w, nr] = splits(id); return appVan(w, nr); }).filter(Boolean);

  return { beroepenbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, PER_WERELD } };
}

module.exports = { maakBeroepenBieb, PER_WERELD };

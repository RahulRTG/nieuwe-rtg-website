/* De Geloof & Wijsheid-Bibliotheek van de RTFoundation: een miljoen boeken en
   apps over alle religies, spirituele stromingen en levensbeschouwingen. Alle
   tradities staan hier NAAST ELKAAR, als gelijken: geen rangorde, geen "de ene
   ware", geen oordeel. Elke traditie vertelt haar eigen waarheid, met respect.
   Ook wie niet gelooft heeft hier een plek (humanisme, vrije gedachte, twijfel).

   Net als de andere RTF-bibliotheken wordt de catalogus DETERMINISTISCH
   samengesteld uit naamdelen (40 tradities x 25 thema's x 40 reeksen x 25
   uitgaven = exact 1.000.000). Alles is gratis, een cadeau van de RTFoundation:
   geen aankopen, geen reclame, geen verslavende trucjes. Alleen wat een profiel
   in zijn kast zet, wordt bewaard.

   Anders dan bij de kinder-app-bibliotheek bouwen we hier GEEN index van een
   miljoen namen in het geheugen: naam, doelgroep en waarde rollen ter plekke
   uit het nummer, en het scannen is begrensd. De leeftijdspoort werkt via het
   THEMA: de zachte verhalen zijn er voor de kleinsten, de diepere filosofie en
   mystiek pas voor tiener en volwassene. Zo is nooit een héle traditie voor een
   kind verborgen; alleen een enkel diep thema wacht op later. */

/* De naamdelen (tradities, thema's, reeks- en uitgavenamen) staan in
   ./geloofbieb-data.js, zodat de motor hier klein en leesbaar blijft. */
const { TRADITIES, ICONEN, THEMA, REEKS, UITGAVE } = require('./geloofbieb-data');

const PER_REEKS = UITGAVE.length;                 // 25
const PER_THEMA = REEKS.length * UITGAVE.length;  // 40 x 25 = 1000
const PER_TRAD = THEMA.length * PER_THEMA;        // 25 x 1000 = 25.000
const TOTAAL = TRADITIES.length * PER_TRAD;       // 40 x 25.000 = 1.000.000

const DOELGROEP_LABEL = { mini: 'mini (0-5)', kind: 'kind (6-11)', tiener: 'tiener (12+)', gezin: 'het hele gezin' };
/* Wat elke profielgroep mag zien: nooit iets boven de eigen groep. */
const ZICHT = {
  mini: ['mini', 'gezin'],
  kind: ['mini', 'kind', 'gezin'],
  tiener: ['mini', 'kind', 'tiener', 'gezin'],
  jong: ['mini', 'kind', 'tiener', 'gezin'],
  volw: ['mini', 'kind', 'tiener', 'gezin']
};
/* De gemiddelde winkelwaarde is analytisch te bepalen (de rest-reeks is
   uniform over de volledige periode), zodat we nooit een miljoen items hoeven
   te doorlopen om de cadeauwaarde te tonen. */
const GEM_WAARDE = 799 + 9 * 100; // 7,99 .. 25,99, gemiddeld 16,99
const SOM_WAARDE = GEM_WAARDE * TOTAAL;

function delen(i) {
  const tradIx = Math.floor(i / PER_TRAD);
  const r = i - tradIx * PER_TRAD;
  const themaIx = Math.floor(r / PER_THEMA);
  const r2 = r - themaIx * PER_THEMA;
  const reeksIx = Math.floor(r2 / PER_REEKS);
  const uitgIx = r2 - reeksIx * PER_REEKS;
  return { tradIx, themaIx, reeksIx, uitgIx };
}
/* Doelgroep en naam zonder het hele object te bouwen (voor het snelle scannen).
   De doelgroep rolt uit het THEMA, zodat de leeftijdspoort per thema klopt. */
function doelgroepVan(i) {
  const th = THEMA[Math.floor((i % PER_TRAD) / PER_THEMA)];
  return th.doel[(i * 7) % th.doel.length];
}
function naamVan(i) {
  const d = delen(i);
  return REEKS[d.reeksIx] + ' · ' + THEMA[d.themaIx].label + ' · ' + UITGAVE[d.uitgIx];
}

/* Elk nummer levert altijd hetzelfde boek: traditie, thema, naam, doelgroep en
   winkelwaarde rollen deterministisch uit het nummer. De winkelwaarde is die
   van een goed boek (7,99 - 25,99); bij de RTFoundation is hij altijd 0. */
function appVan(i) {
  if (!Number.isInteger(i) || i < 0 || i >= TOTAAL) return null;
  const d = delen(i);
  const trad = TRADITIES[d.tradIx];
  const thema = THEMA[d.themaIx];
  const doelgroep = thema.doel[(i * 7) % thema.doel.length];
  const waarde = 799 + ((i * 7919) % 19) * 100; // 7,99 .. 25,99
  const icon = ICONEN[d.tradIx % ICONEN.length];
  return {
    id: 'gel-' + i, nr: i,
    naam: REEKS[d.reeksIx] + ' · ' + thema.label + ' · ' + UITGAVE[d.uitgIx],
    traditie: trad.id, traditieLabel: trad.label,
    categorie: trad.id, categorieLabel: trad.label, icon,
    thema: thema.label, themaNr: d.themaIx,
    doelgroep, doelgroepLabel: DOELGROEP_LABEL[doelgroep],
    winkelwaardeCenten: waarde, prijsCenten: 0,
    sterren: (40 + ((i * 31) % 10)) / 10, versie: (1 + (i % 6)) + '.' + ((i * 13) % 10), grootteMB: 8 + ((i * 97) % 140),
    uitleg: thema.label + ' uit de traditie ' + trad.label + '. Onderdeel van de Geloof & Wijsheid-Bibliotheek, ' +
      'waar alle tradities als gelijken naast elkaar staan, met respect, zonder rangorde en zonder oordeel. ' +
      'In de winkel EUR ' + (waarde / 100).toFixed(2).replace('.', ',') + '; bij de RTFoundation gratis. ' +
      'Geen aankopen, geen reclame, geen verslavende trucjes.'
  };
}

function maakGeloofBieb({ db, save }) {
  const rij = (handle) => {
    if (!db.data.geloofInstallaties) db.data.geloofInstallaties = {};
    if (!Array.isArray(db.data.geloofInstallaties[handle])) db.data.geloofInstallaties[handle] = [];
    return db.data.geloofInstallaties[handle];
  };
  const magZien = (groep, doelgroep) => (ZICHT[groep] || ZICHT.kind).includes(doelgroep);
  const themaZichtbaar = (groep, thema) => thema.doel.some(d => magZien(groep, d));

  function overzicht(groep) {
    const zichtbareThemas = THEMA.filter(t => themaZichtbaar(groep, t));
    const perTradZichtbaar = zichtbareThemas.length * PER_THEMA;
    return {
      totaal: TOTAAL, totaleWinkelwaardeCenten: SOM_WAARDE, gratis: true,
      tradities: TRADITIES.map((t, ix) => ({ id: t.id, label: t.label, icon: ICONEN[ix % ICONEN.length], aantal: perTradZichtbaar })),
      themas: zichtbareThemas.map(t => ({ nr: THEMA.indexOf(t), label: t.label }))
    };
  }

  function catalogus(groep, { categorie, thema, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const ti = TRADITIES.findIndex(t => t.id === categorie);
    const themaNr = (thema === '' || thema == null) ? -1 : Number(thema);
    const van = ti >= 0 ? ti * PER_TRAD : 0;
    // zonder gekozen traditie scannen we een begrensd venster (net als de andere
    // grote bibliotheken); mét traditie precies die ene kast van 25.000
    const tot = ti >= 0 ? van + PER_TRAD : Math.min(TOTAAL, van + 40000);
    const raak = [];
    for (let i = van; i < tot && raak.length < 4000; i++) {
      if (!magZien(groep, doelgroepVan(i))) continue;
      if (themaNr >= 0 && Math.floor((i % PER_TRAD) / PER_THEMA) !== themaNr) continue;
      if (q && !naamVan(i).toLowerCase().includes(q)) continue;
      raak.push(i);
    }
    const start = (p - 1) * n;
    return {
      items: raak.slice(start, start + n).map(appVan),
      totaal: raak.length, pagina: p, paginas: Math.max(1, Math.ceil(raak.length / n))
    };
  }

  function installeer(handle, groep, id) {
    const nr = Number(String(id || '').replace(/^gel-/, ''));
    const app = appVan(nr);
    if (!app) return { status: 404, error: 'Dit boek bestaat niet in de bibliotheek.' };
    if (!magZien(groep, app.doelgroep)) return { status: 403, error: 'Dit boek is voor een andere leeftijdsgroep.' };
    const mijn = rij(handle);
    if (mijn.includes(nr)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 500) return { status: 400, error: 'Het maximum van 500 boeken is bereikt; ruim er eerst een op.' };
    mijn.push(nr); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(handle, id) {
    const nr = Number(String(id || '').replace(/^gel-/, ''));
    const mijn = rij(handle);
    const ix = mijn.indexOf(nr);
    if (ix < 0) return { status: 404, error: 'Dit boek staat niet in jouw kast.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (handle) => rij(handle).map(appVan).filter(Boolean);

  return { geloofbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, magZien, TOTAAL } };
}

module.exports = { maakGeloofBieb, TRADITIES, THEMA, TOTAAL };

/* De Reis-Bibliotheek: echte, leesbare bestemmingsgidsen van eigen RTG-redactie.

   Geen miljoen lege titels meer. Wat hier staat kun je openen en lezen: sfeer en
   hoogtepunten, wat je eet, en een praktisch woord. Klein begonnen, met zorg, en
   uit te breiden -- kwaliteit boven aantal. Voor betalende leden inbegrepen bij
   de pas; alleen wat een lid in zijn kast zet, wordt bewaard. */

const { GIDSEN } = require('./gidsen');

function teaser(tekst) {
  const eerste = String(tekst || '').split('\n')[0];
  return eerste.length > 170 ? eerste.slice(0, 167).trimEnd() + '…' : eerste;
}

const ITEMS = GIDSEN.map(([slug, bestemming, regio, titel, tekst], i) => ({
  id: 'reis-' + slug, slug, nr: i, naam: titel, titel,
  bestemming, regio, categorie: regio, categorieLabel: regio,
  uitleg: teaser(tekst), tekst,
  woorden: tekst.split(/\s+/).length,
  gratis: true, prijsCenten: 0, ledenprijsCenten: 0
}));
const OP_ID = new Map(ITEMS.map(a => [a.id, a]));
const TOTAAL = ITEMS.length;

const BESTEMMINGEN = ITEMS.map(a => a.bestemming);
const REGIOS = [...new Set(ITEMS.map(a => a.regio))];

function maakReisBieb({ db, save }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/reisbieb/index', bezit: { reisInstallaties: 'kaart' } });
  const rij = (key) => {
    const b = eigen.bak('reisInstallaties');
    if (!Array.isArray(b[key])) b[key] = [];
    return b[key];
  };
  const publiek = (a) => ({ id: a.id, slug: a.slug, naam: a.naam, titel: a.titel, bestemming: a.bestemming,
    regio: a.regio, categorie: a.categorie, categorieLabel: a.categorieLabel, uitleg: a.uitleg,
    woorden: a.woorden, gratis: true, prijsCenten: 0, ledenprijsCenten: 0 });
  const appVan = (id) => OP_ID.get(String(id || '')) || null;

  function overzicht() {
    const perRegio = {};
    for (const a of ITEMS) perRegio[a.regio] = (perRegio[a.regio] || 0) + 1;
    return {
      totaal: TOTAAL, gratis: true, leesbaar: true,
      regios: REGIOS.map(r => ({ id: r, label: r, aantal: perRegio[r] })),
      bestemmingen: BESTEMMINGEN
    };
  }

  function catalogus({ bestemming, regio, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    let arr = ITEMS;
    if (bestemming) arr = arr.filter(a => a.bestemming === String(bestemming) || a.slug === String(bestemming));
    if (regio) arr = arr.filter(a => a.regio === String(regio));
    if (q) arr = arr.filter(a => (a.naam + ' ' + a.bestemming + ' ' + a.regio + ' ' + a.tekst).toLowerCase().includes(q));
    return { items: arr.slice((p - 1) * n, (p - 1) * n + n).map(publiek), totaal: arr.length, pagina: p, paginas: Math.max(1, Math.ceil(arr.length / n)) };
  }

  // een gids echt lezen: de volledige tekst
  function lees(id) {
    const a = appVan(id);
    if (!a) return { status: 404, error: 'Deze reisgids bestaat niet in de bibliotheek.' };
    return { ok: true, gids: { ...publiek(a), tekst: a.tekst } };
  }

  function installeer(key, id) {
    const a = appVan(id);
    if (!a) return { status: 404, error: 'Deze reisgids bestaat niet in de bibliotheek.' };
    const mijn = rij(key);
    if (mijn.includes(a.id)) return { status: 200, ok: true, app: publiek(a), alGeinstalleerd: true, aantal: mijn.length };
    mijn.push(a.id); save();
    return { status: 200, ok: true, app: publiek(a), aantal: mijn.length };
  }

  function verwijder(key, id) {
    const mijn = rij(key);
    const ix = mijn.indexOf(String(id || ''));
    if (ix < 0) return { status: 404, error: 'Deze gids staat niet bij uw reisgidsen.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (key) => rij(key).map(appVan).filter(Boolean).map(publiek);

  return { reisbieb: { overzicht, catalogus, lees, installeer, verwijder, mijnApps, appVan, TOTAAL } };
}

module.exports = { maakReisBieb, GIDSEN, REGIOS, BESTEMMINGEN, TOTAAL };

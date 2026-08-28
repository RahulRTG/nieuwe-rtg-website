/* De Geloof & Wijsheid-Bibliotheek van de RTFoundation: alle religies,
   spirituele stromingen en levensbeschouwingen als GELIJKEN naast elkaar --
   geen rangorde, geen "de ene ware", geen oordeel. Ook wie niet gelooft heeft
   hier een plek.

   Geen miljoen lege titels meer: dit is een ECHTE, leesbare kern. Elk item heeft
   een echte tekst die je kunt openen en lezen (kern/geloofbieb-kern.js). Klein
   begonnen, met zorg, en uit te breiden -- kwaliteit boven aantal. Alles is
   gratis, een cadeau van de RTFoundation: geen aankopen, geen reclame, geen
   verslavende trucjes. Alleen wat een profiel in zijn kast zet, wordt bewaard.

   De leeftijdspoort werkt via de doelgroep van het item: de zachte verhalen zijn
   er voor de kleinsten, de diepere reflectie voor tiener en volwassene. */

const { KERN } = require('./geloofbieb-kern');

const DOELGROEP_LABEL = { mini: 'de kleinsten (0-5)', kind: 'kinderen (6-11)', tiener: 'tieners (12+)', gezin: 'het hele gezin' };
/* Wat elke profielgroep mag zien: nooit iets boven de eigen groep. */
const ZICHT = {
  mini: ['mini', 'gezin'],
  kind: ['mini', 'kind', 'gezin'],
  tiener: ['mini', 'kind', 'tiener', 'gezin'],
  jong: ['mini', 'kind', 'tiener', 'gezin'],
  volw: ['mini', 'kind', 'tiener', 'gezin']
};

// de leesbare kern als nette items; de teaser (uitleg) is de eerste zin
function teaser(tekst) {
  const eerste = String(tekst || '').split('\n')[0];
  return eerste.length > 160 ? eerste.slice(0, 157).trimEnd() + '…' : eerste;
}
const ITEMS = KERN.map(([traditie, traditieLabel, thema, doelgroep, titel, tekst], i) => ({
  id: 'gel-' + i, nr: i, naam: titel, titel,
  traditie, traditieLabel, categorie: traditie, categorieLabel: traditieLabel,
  thema, doelgroep, doelgroepLabel: DOELGROEP_LABEL[doelgroep] || doelgroep,
  uitleg: teaser(tekst), tekst,
  gratis: true, prijsCenten: 0
}));
const OP_ID = new Map(ITEMS.map(a => [a.id, a]));
const TOTAAL = ITEMS.length;

// de tradities en thema's die echt in de kern voorkomen (voor de filters)
const TRADITIES = [];
const TRAD_LABEL = {};
for (const a of ITEMS) { if (!TRAD_LABEL[a.traditie]) { TRAD_LABEL[a.traditie] = a.traditieLabel; TRADITIES.push({ id: a.traditie, label: a.traditieLabel }); } }
const THEMAS = [...new Set(ITEMS.map(a => a.thema))];

function maakGeloofBieb({ db, save }) {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/geloofbieb', bezit: { geloofInstallaties: 'kaart' } });
  const rij = (handle) => {
    const alles = eigen.bak('geloofInstallaties');
    if (!Array.isArray(alles[handle])) alles[handle] = [];
    return alles[handle];
  };
  const magZien = (groep, doelgroep) => (ZICHT[groep] || ZICHT.kind).includes(doelgroep);
  const publiek = (a) => ({ id: a.id, naam: a.naam, titel: a.titel, traditie: a.traditie, traditieLabel: a.traditieLabel,
    categorie: a.categorie, categorieLabel: a.categorieLabel, thema: a.thema, doelgroep: a.doelgroep,
    doelgroepLabel: a.doelgroepLabel, uitleg: a.uitleg, gratis: true, prijsCenten: 0 });
  const appVan = (id) => OP_ID.get(String(id || '')) || null;

  function zichtbaar(groep) { return ITEMS.filter(a => magZien(groep, a.doelgroep)); }

  function overzicht(groep) {
    const zicht = zichtbaar(groep);
    const perTrad = {}; for (const a of zicht) perTrad[a.traditie] = (perTrad[a.traditie] || 0) + 1;
    return {
      totaal: zicht.length, gratis: true, leesbaar: true,
      tradities: TRADITIES.filter(t => perTrad[t.id]).map(t => ({ id: t.id, label: t.label, aantal: perTrad[t.id] })),
      themas: THEMAS.filter(th => zicht.some(a => a.thema === th)).map((label, nr) => ({ nr, label }))
    };
  }

  function catalogus(groep, { categorie, thema, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const th = (thema === '' || thema == null) ? null : String(thema);
    let arr = zichtbaar(groep);
    if (categorie) arr = arr.filter(a => a.traditie === categorie);
    if (th) arr = arr.filter(a => a.thema === th || String(THEMAS.indexOf(a.thema)) === th);
    if (q) arr = arr.filter(a => (a.naam + ' ' + a.traditieLabel + ' ' + a.thema + ' ' + a.uitleg).toLowerCase().includes(q));
    return { items: arr.slice((p - 1) * n, (p - 1) * n + n).map(publiek), totaal: arr.length, pagina: p, paginas: Math.max(1, Math.ceil(arr.length / n)) };
  }

  // een item echt lezen: de volledige tekst, met dezelfde leeftijdspoort
  function lees(groep, id) {
    const a = appVan(id);
    if (!a) return { status: 404, error: 'Dit boek bestaat niet in de bibliotheek.' };
    if (!magZien(groep, a.doelgroep)) return { status: 403, error: 'Dit boek is voor een andere leeftijdsgroep.' };
    return { ok: true, boek: { ...publiek(a), tekst: a.tekst } };
  }

  function installeer(handle, groep, id) {
    const a = appVan(id);
    if (!a) return { status: 404, error: 'Dit boek bestaat niet in de bibliotheek.' };
    if (!magZien(groep, a.doelgroep)) return { status: 403, error: 'Dit boek is voor een andere leeftijdsgroep.' };
    const mijn = rij(handle);
    if (mijn.includes(a.id)) return { status: 200, ok: true, app: publiek(a), alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 500) return { status: 400, error: 'Het maximum van 500 boeken is bereikt; ruim er eerst een op.' };
    mijn.push(a.id); save();
    return { status: 200, ok: true, app: publiek(a), aantal: mijn.length };
  }

  function verwijder(handle, id) {
    const mijn = rij(handle);
    const ix = mijn.indexOf(String(id || ''));
    if (ix < 0) return { status: 404, error: 'Dit boek staat niet in jouw kast.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (handle) => rij(handle).map(appVan).filter(Boolean).map(publiek);

  return { geloofbieb: { overzicht, catalogus, lees, installeer, verwijder, mijnApps, appVan, magZien, TOTAAL } };
}

module.exports = { maakGeloofBieb, TRADITIES, THEMAS, KERN, TOTAAL };

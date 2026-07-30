/* De RTF App-Bibliotheek: de ECHTE apps van de RTFoundation. Geen twintigduizend
   verzonnen namen meer; elke tegel hier opent een bestaande, werkende pagina.
   Alles is en blijft gratis, een cadeau van de RTFoundation: geen aankopen in de
   app, geen reclame en geen verslavende trucjes.

   De catalogus staat in kern/rtfappcatalogus-data.js; alleen wat een profiel op
   zijn startscherm zet, wordt bewaard. Elke app heeft een doelgroep
   (mini/kind/tiener/gezin) en de leeftijdspoort van het profiel bepaalt wat er
   uberhaupt te zien en te installeren is: beschermde profielen zien nooit iets
   boven hun groep. */

const { CATEGORIEEN, R } = require('./rtfappcatalogus-data');

const DOELGROEP_LABEL = { mini: 'mini (0-5)', kind: 'kind (6-11)', tiener: 'tiener (12+)', gezin: 'het hele gezin' };
/* Wat elke profielgroep mag zien: nooit iets boven de eigen groep. */
const ZICHT = {
  mini: ['mini', 'gezin'],
  kind: ['mini', 'kind', 'gezin'],
  tiener: ['mini', 'kind', 'tiener', 'gezin'],
  jong: ['mini', 'kind', 'tiener', 'gezin'],
  volw: ['mini', 'kind', 'tiener', 'gezin']
};
const HUISREGEL = 'Gratis van de RTFoundation. Geen aankopen, geen reclame, geen verslavende trucjes.';

const APPS = R.map(([id, naam, categorie, doelgroep, url, uitleg]) => {
  const c = CATEGORIEEN.find(x => x.id === categorie) || {};
  return {
    id: 'rtf-' + id, sleutel: id, naam,
    categorie, categorieLabel: c.label || categorie, icon: c.icon || 'ster',
    doelgroep, doelgroepLabel: DOELGROEP_LABEL[doelgroep] || doelgroep,
    url, uitleg, huisregel: HUISREGEL,
    gratis: true, prijsCenten: 0
  };
});
const OP_ID = new Map(APPS.map(a => [a.id, a]));
const TOTAAL = APPS.length;

function maakRtfBieb({ db, save }) {
  const rij = (handle) => {
    if (!db.data.rtfAppInstallaties) db.data.rtfAppInstallaties = {};
    if (!Array.isArray(db.data.rtfAppInstallaties[handle])) db.data.rtfAppInstallaties[handle] = [];
    return db.data.rtfAppInstallaties[handle];
  };
  const magZien = (groep, doelgroep) => (ZICHT[groep] || ZICHT.kind).includes(doelgroep);
  const appVan = (id) => OP_ID.get(String(id || '')) || null;
  const zichtbaar = (groep) => APPS.filter(a => magZien(groep, a.doelgroep));

  function overzicht(groep) {
    const zicht = zichtbaar(groep);
    const per = {};
    for (const a of zicht) per[a.categorie] = (per[a.categorie] || 0) + 1;
    return {
      totaal: zicht.length, gratis: true, echt: true, huisregel: HUISREGEL,
      categorieen: CATEGORIEEN.filter(c => per[c.id]).map(c => ({ id: c.id, label: c.label, icon: c.icon, aantal: per[c.id] }))
    };
  }

  function catalogus(groep, { categorie, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    let arr = zichtbaar(groep);
    if (categorie) arr = arr.filter(a => a.categorie === String(categorie));
    if (q) arr = arr.filter(a => (a.naam + ' ' + a.categorieLabel + ' ' + a.uitleg).toLowerCase().includes(q));
    return { items: arr.slice((p - 1) * n, (p - 1) * n + n), totaal: arr.length, pagina: p, paginas: Math.max(1, Math.ceil(arr.length / n)) };
  }

  function installeer(handle, groep, id) {
    const app = appVan(id);
    if (!app) return { status: 404, error: 'Deze app bestaat niet in de bibliotheek.' };
    if (!magZien(groep, app.doelgroep)) return { status: 403, error: 'Deze app is voor een andere leeftijdsgroep.' };
    const mijn = rij(handle);
    if (mijn.includes(app.id)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    mijn.push(app.id); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(handle, id) {
    const mijn = rij(handle);
    const ix = mijn.indexOf(String(id || ''));
    if (ix < 0) return { status: 404, error: 'Deze app staat niet bij jouw apps.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (handle) => rij(handle).map(appVan).filter(Boolean);

  return { rtfbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, magZien, TOTAAL } };
}

module.exports = { maakRtfBieb, CATEGORIEEN, APPS, TOTAAL };

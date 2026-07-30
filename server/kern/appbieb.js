/* De RTG App-Bibliotheek: de ECHTE apps van het RTG-ecosysteem. Geen verzonnen
   namen en geen lege inhoud meer -- elke tegel opent een bestaande, werkende
   pagina. De vaste catalogus staat in ./appcatalogus-data.js; daarnaast komen de
   door de RTG Werkplaats gepubliceerde apps erbij (de overlay in
   db.data.appbiebExtra). Alles is voor leden inbegrepen bij de pas (ledenprijs 0);
   de RTFoundation-apps zijn voor iedereen gratis.

   Bladeren mag iedereen; alleen wat een lid "installeert" (op zijn startscherm
   zet) wordt bewaard, met een harde grens. AI adviseert hooguit welke app past;
   installeren en verwijderen doet het lid zelf. */

const { CATEGORIEEN, APPS } = require('./appcatalogus-data');

// snelle opzoektabellen op de vaste catalogus
const OP_ID = new Map(APPS.map(a => [a.id, a]));
const PER_CAT_TELLING = {};
for (const a of APPS) PER_CAT_TELLING[a.categorie] = (PER_CAT_TELLING[a.categorie] || 0) + 1;
const TOTAAL = APPS.length;

// de pseudo-categorie waaronder de door de RTG Werkplaats gepubliceerde apps en
// bibliotheek-materialen verschijnen (de Werkplaats schrijft db.data.appbiebExtra)
const WERKPLAATS_CAT = { id: 'werkplaats', label: 'Uit de Werkplaats', icon: 'ster' };

function maakAppbieb({ db, save }) {
  const rij = (key) => {
    if (!db.data.appInstallaties) db.data.appInstallaties = {};
    if (!Array.isArray(db.data.appInstallaties[key])) db.data.appInstallaties[key] = [];
    return db.data.appInstallaties[key];
  };

  // ---- de bewerkbare overlay: apps/materiaal uit de RTG Werkplaats ----
  function overlayRuw() { return Array.isArray(db.data.appbiebExtra) ? db.data.appbiebExtra : []; }
  function overlayApp(o) {
    if (!o || typeof o !== 'object' || !o.id) return null;
    return {
      id: String(o.id), naam: String(o.naam || 'RTG Werkplaats-app').slice(0, 120),
      categorie: WERKPLAATS_CAT.id, categorieLabel: WERKPLAATS_CAT.label, icon: String(o.icon || WERKPLAATS_CAT.icon),
      plank: o.plank === 'bieb' ? 'bieb' : 'winkel', plankLabel: o.plank === 'bieb' ? 'Bibliotheek' : 'App Store',
      url: null, wereld: 'rtg', bron: 'werkplaats', ledenprijsCenten: 0,
      uitleg: String(o.uitleg || 'Gemaakt in de RTG Werkplaats; voor RTG-leden inbegrepen bij de pas.').slice(0, 260)
    };
  }
  const overlayLijst = () => overlayRuw().map(overlayApp).filter(Boolean);
  const overlayVan = (id) => overlayLijst().find(a => a.id === id) || null;
  const isOverlayId = (id) => /^wx-/.test(String(id || ''));

  function appVan(id) { return OP_ID.get(String(id || '')) || (isOverlayId(id) ? overlayVan(String(id)) : null); }

  function overzicht() {
    const ov = overlayLijst();
    const cats = CATEGORIEEN.map(c => ({ id: c.id, label: c.label, icon: c.icon, aantal: PER_CAT_TELLING[c.id] || 0 }));
    if (ov.length) cats.push({ id: WERKPLAATS_CAT.id, label: WERKPLAATS_CAT.label, icon: WERKPLAATS_CAT.icon, aantal: ov.length });
    return { totaal: TOTAAL + ov.length, categorieen: cats };
  }

  // de apps die bij dit filter horen (vaste catalogus + overlay), gesorteerd op naam
  function gefilterd(categorie, q) {
    const ex = (categorie && categorie !== WERKPLAATS_CAT.id)
      ? overlayLijst().filter(a => false)   // overlay hoort alleen onder 'werkplaats' of "alles"
      : overlayLijst();
    let vast;
    if (categorie === WERKPLAATS_CAT.id) vast = [];
    else if (categorie) vast = APPS.filter(a => a.categorie === categorie);
    else vast = APPS.slice();
    let alles = ex.concat(vast);
    if (q) alles = alles.filter(a => (a.naam + ' ' + (a.uitleg || '') + ' ' + (a.categorieLabel || '')).toLowerCase().includes(q));
    return alles;
  }

  function catalogus({ categorie, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const alles = gefilterd(categorie, q);
    const start = (p - 1) * n;
    const items = alles.slice(start, start + n);
    return { items, totaal: alles.length, pagina: p, paginas: Math.max(1, Math.ceil(alles.length / n)) };
  }

  function installeer(key, id) {
    const app = appVan(id);
    if (!app) return { status: 404, error: 'Deze app bestaat niet in de bibliotheek.' };
    const mijn = rij(key);
    if (mijn.includes(app.id)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 500) return { status: 400, error: 'Het maximum van 500 apps op je startscherm is bereikt; verwijder er eerst een.' };
    mijn.push(app.id); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(key, id) {
    const mijn = rij(key);
    const ix = mijn.indexOf(String(id || ''));
    if (ix < 0) return { status: 404, error: 'Deze app staat niet op je startscherm.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  // geïnstalleerde apps; ingetrokken Werkplaats-apps vallen vanzelf weg
  const mijnApps = (key) => rij(key).map(appVan).filter(Boolean);

  return { appbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, overlayLijst, TOTAAL } };
}

module.exports = { maakAppbieb, CATEGORIEEN, APPS, TOTAAL };

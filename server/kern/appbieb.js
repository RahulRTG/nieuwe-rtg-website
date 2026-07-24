/* De RTG App-Bibliotheek: 20.000 professionele apps in de Mall, elk met een
   winkelwaarde van rond de duizend euro, en voor leden inbegrepen bij de pas
   (ledenprijs 0). De catalogus wordt deterministisch samengesteld uit
   naamdelen (geen 20.000 records in de database, dezelfde aanpak als de
   ledengids op schaal): elk nummer 0..19999 levert altijd dezelfde app op.
   Alleen wat een lid installeert wordt bewaard, met een harde grens.

   Geen echte softwaremerken; RTG-huisnamen. AI adviseert hooguit welke app
   past; installeren en verwijderen doet het lid zelf. */

const CATEGORIEEN = [
  { id: 'boekhouding', label: 'Boekhouding & fiscaal', icon: 'rekening', vak: ['Boekhouding', 'Facturatie', 'BTW-Assistent', 'Jaarrekening', 'Kasstroom'] },
  { id: 'ontwerp', label: 'Ontwerp & CAD', icon: 'ontwerp', vak: ['CAD Studio', 'Tekentafel', '3D-Modelleur', 'Plotkamer', 'Schetsboek'] },
  { id: 'foto', label: 'Fotostudio', icon: 'camera', vak: ['Fotolab', 'RAW-Studio', 'Retoucheur', 'Lichtkamer', 'Contactblad'] },
  { id: 'video', label: 'Videomontage', icon: 'film', vak: ['Montagetafel', 'Kleurenlab', 'Ondertitelaar', 'Storyboard', 'Renderstraat'] },
  { id: 'muziek', label: 'Muziekstudio', icon: 'muziek', vak: ['Opnamestudio', 'Mengtafel', 'Notenbalk', 'Mastering', 'Sampler'] },
  { id: 'vertaal', label: 'Vertalen & tekst', icon: 'taal', vak: ['Vertaalbureau', 'Redactiekamer', 'Terminologie', 'Ondertiteling', 'Corrector'] },
  { id: 'juridisch', label: 'Juridisch', icon: 'juridisch', vak: ['Contractenmaker', 'Dossierkast', 'Termijnwacht', 'Aktenboek', 'Pleitnota'] },
  { id: 'praktijk', label: 'Praktijk & zorg', icon: 'zorg', vak: ['Agendaboek', 'Patiëntenkaart', 'Declaratie', 'Verwijsbrief', 'Wachtkamer'] },
  { id: 'horeca', label: 'Horeca-beheer', icon: 'horeca', vak: ['Menukaartmaker', 'Voorraadkelder', 'Reserveringsboek', 'Keukenplanner', 'Shiftrooster'] },
  { id: 'vastgoed', label: 'Vastgoed & beheer', icon: 'maison', vak: ['Pandenboek', 'Huurcontract', 'Onderhoudsplanner', 'Taxatiehulp', 'Sleutelkast'] },
  { id: 'logistiek', label: 'Logistiek & vloot', icon: 'logistiek', vak: ['Routeplanner', 'Vrachtbrief', 'Vlootbeheer', 'Douanepapieren', 'Laadplan'] },
  { id: 'personeel', label: 'Personeel & rooster', icon: 'agenda', vak: ['Roostermaker', 'Verlofkaart', 'Urenstaat', 'Salarisstrook', 'Sollicitatiemap'] },
  { id: 'marketing', label: 'Marketing & merk', icon: 'megafoon', vak: ['Campagnebord', 'Huisstijlgids', 'Nieuwsbrief', 'Mediaplanner', 'Merkenmonitor'] },
  { id: 'beveiliging', label: 'Beveiliging & privacy', icon: 'schild', vak: ['Sleutelkluis', 'Toegangslog', 'Versleutelaar', 'Auditspoor', 'Wachtwoordkluis'] },
  { id: 'onderwijs', label: 'Onderwijs & training', icon: 'diploma', vak: ['Lesplanner', 'Toetsenmaker', 'Cijferlijst', 'Leerlingvolg', 'Diplomaboek'] },
  { id: 'data', label: 'Data & rapportage', icon: 'grafiek', vak: ['Rekenblad', 'Grafiekenmaker', 'Datakoppelaar', 'Rapportstraat', 'Voorspeller'] },
  { id: 'landbouw', label: 'Landbouw & teelt', icon: 'oogst', vak: ['Perceelboek', 'Oogstplanner', 'Stalregister', 'Weerwacht', 'Veilingklok'] },
  { id: 'bouw', label: 'Bouw & installatie', icon: 'bouw', vak: ['Bestekmaker', 'Bouwplanner', 'Calculatie', 'Opleverlijst', 'Werfdagboek'] },
  { id: 'kassa', label: 'Winkel & kassa', icon: 'store', vak: ['Kassaboek', 'Voorraadteller', 'Etikettenmaker', 'Bonnenlade', 'Schapindeling'] },
  { id: 'ai', label: 'AI-gereedschap', icon: 'ster', vak: ['Schrijfhulp', 'Beeldenmaker', 'Notulist', 'Kennisbank', 'Werkstroom'] }
];
const MERK = ['Atlas', 'Meridiaan', 'Noorderlicht', 'Ambacht', 'Fundament', 'Helder', 'Kompas', 'Lantaarn', 'Marmer', 'Anker',
  'Vizier', 'Palet', 'Sonnet', 'Kwadrant', 'Loepzuiver', 'Bastion', 'Estafette', 'Horizon', 'Kathedraal', 'Linie',
  'Monument', 'Nachtegaal', 'Obelisk', 'Passer', 'Reliëf', 'Sextant', 'Tinctuur', 'Uurwerk', 'Vesting', 'IJzersterk',
  'Zenit', 'Amber', 'Balans', 'Cirkel', 'Duet', 'Ellips', 'Facet', 'Graniet', 'Hamerslag', 'Inkt'];
const EDITIE = ['Pro', 'Studio', 'Atelier', 'Suite', 'Meester', 'Compact', 'Teams', 'Solo', 'Kantoor', 'Veld',
  'Expert', 'Prime', 'Zakelijk', 'Praktijk', 'Portable', 'Ultra', 'Vakman', 'Centraal', 'Duo', 'Archief',
  'Cloudvrij', 'Offline', 'Signatuur', 'Editie X', 'Nova'];

const TOTAAL = CATEGORIEEN.length * MERK.length * EDITIE.length; // 20 x 40 x 25 = 20.000

/* Elk nummer levert altijd dezelfde app: categorie, naam, waarde en sterren
   rollen deterministisch uit het nummer. De winkelwaarde ligt rond de
   duizend euro (799..1222); de ledenprijs is altijd 0: inbegrepen bij de pas. */
function appVan(i) {
  if (!Number.isInteger(i) || i < 0 || i >= TOTAAL) return null;
  const cat = CATEGORIEEN[Math.floor(i / (MERK.length * EDITIE.length))];
  const rest = i % (MERK.length * EDITIE.length);
  const merk = MERK[rest % MERK.length];
  const editie = EDITIE[Math.floor(rest / MERK.length)];
  const vak = cat.vak[i % cat.vak.length];
  const waarde = 79900 + ((i * 7919) % 48) * 900;           // 799,00 .. 1.222,00
  const sterren = (38 + ((i * 31) % 12)) / 10;               // 3,8 .. 4,9
  return {
    id: 'app-' + i, nr: i, naam: merk + ' ' + vak + ' ' + editie,
    categorie: cat.id, categorieLabel: cat.label, icon: cat.icon,
    winkelwaardeCenten: waarde, ledenprijsCenten: 0,
    sterren, versie: (1 + (i % 9)) + '.' + ((i * 13) % 10), grootteMB: 40 + ((i * 97) % 860),
    uitleg: cat.label + '-software van professioneel niveau. In de winkel EUR ' + Math.round(waarde / 100) + ',-; voor RTG-leden inbegrepen bij de pas.'
  };
}

/* De zoekindex: één keer opgebouwd, begrensd en klein (20.000 namen). */
const NAMEN = []; let SOM_WAARDE = 0;
for (let i = 0; i < TOTAAL; i++) { const a = appVan(i); NAMEN.push(a.naam.toLowerCase()); SOM_WAARDE += a.winkelwaardeCenten; }
const PER_CAT = MERK.length * EDITIE.length;

// De pseudo-categorie waaronder de door de RTG Werkplaats gepubliceerde apps en
// bibliotheek-materialen in de winkel verschijnen. De Werkplaats schrijft ze
// (rechtstreeks) naar db.data.appbiebExtra; hier lezen en mengen we ze alleen.
const WERKPLAATS_CAT = { id: 'werkplaats', label: 'Uit de Werkplaats', icon: 'ster' };

function maakAppbieb({ db, save }) {
  const rij = (key) => {
    if (!db.data.appInstallaties) db.data.appInstallaties = {};
    if (!Array.isArray(db.data.appInstallaties[key])) db.data.appInstallaties[key] = [];
    return db.data.appInstallaties[key];
  };

  // ---- de bewerkbare overlay: apps/materiaal uit de RTG Werkplaats ----
  function overlayRuw() { return Array.isArray(db.data.appbiebExtra) ? db.data.appbiebExtra : []; }
  // maak van een opgeslagen overlay-record een nette winkel-app; defensief, want
  // de records worden buiten deze module (door de Werkplaats) geschreven.
  function overlayApp(o) {
    if (!o || typeof o !== 'object' || !o.id) return null;
    return {
      id: String(o.id), naam: String(o.naam || 'RTG Werkplaats-app').slice(0, 120),
      categorie: WERKPLAATS_CAT.id, categorieLabel: WERKPLAATS_CAT.label, icon: String(o.icon || WERKPLAATS_CAT.icon),
      plank: o.plank === 'bieb' ? 'bieb' : 'winkel', plankLabel: o.plank === 'bieb' ? 'Bibliotheek' : 'App Store',
      winkelwaardeCenten: Math.max(0, Math.round(Number(o.winkelwaardeCenten) || 0)), ledenprijsCenten: 0,
      sterren: Number(o.sterren) || 4.6, versie: String(o.versie || '1.0'), grootteMB: Number(o.grootteMB) || 60,
      bron: 'werkplaats',
      uitleg: String(o.uitleg || 'Gemaakt in de RTG Werkplaats; voor RTG-leden inbegrepen bij de pas.').slice(0, 260)
    };
  }
  const overlayLijst = () => overlayRuw().map(overlayApp).filter(Boolean);
  const overlayVan = (id) => overlayLijst().find(a => a.id === id) || null;
  const isOverlayId = (id) => /^wx-/.test(String(id || ''));

  function overzicht() {
    const ov = overlayLijst();
    const cats = CATEGORIEEN.map(c => ({ id: c.id, label: c.label, icon: c.icon, aantal: PER_CAT }));
    if (ov.length) cats.push({ id: WERKPLAATS_CAT.id, label: WERKPLAATS_CAT.label, icon: WERKPLAATS_CAT.icon, aantal: ov.length });
    return {
      totaal: TOTAAL + ov.length,
      totaleWinkelwaardeCenten: SOM_WAARDE + ov.reduce((s, a) => s + a.winkelwaardeCenten, 0),
      categorieen: cats
    };
  }

  // de overlay-apps die bij dit filter horen (categorie/zoek)
  function overlayFilter(categorie, q) {
    let arr = overlayLijst();
    if (categorie && categorie !== WERKPLAATS_CAT.id) arr = arr.filter(a => a.categorie === categorie);
    if (q) arr = arr.filter(a => (a.naam + ' ' + a.uitleg).toLowerCase().includes(q));
    return arr;
  }

  function catalogus({ categorie, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const ci = CATEGORIEEN.findIndex(c => c.id === categorie);
    // de Werkplaats-apps staan vooraan; daarna de deterministische catalogus
    const ex = overlayFilter(categorie, q);
    let det;
    if (categorie === WERKPLAATS_CAT.id) {
      det = { aantal: 0, pak: () => -1 };                       // alleen overlay
    } else if (!q && ci >= 0) {
      det = { aantal: PER_CAT, pak: (k) => ci * PER_CAT + k };
    } else if (!q) {
      det = { aantal: TOTAAL, pak: (k) => k };
    } else {
      const raak = [];
      const van = ci >= 0 ? ci * PER_CAT : 0, tot = ci >= 0 ? (ci + 1) * PER_CAT : TOTAAL;
      for (let i = van; i < tot && raak.length < 2000; i++) if (NAMEN[i].includes(q)) raak.push(i);
      det = { aantal: raak.length, pak: (k) => raak[k] };
    }
    const totaal = ex.length + det.aantal;
    const start = (p - 1) * n;
    const items = [];
    for (let k = start; k < Math.min(start + n, totaal); k++) {
      items.push(k < ex.length ? ex[k] : appVan(det.pak(k - ex.length)));
    }
    return { items: items.filter(Boolean), totaal, pagina: p, paginas: Math.max(1, Math.ceil(totaal / n)) };
  }

  function installeer(key, id) {
    let app, sleutel;
    if (isOverlayId(id)) { app = overlayVan(String(id)); sleutel = app ? app.id : null; }
    else { const nr = Number(String(id || '').replace(/^app-/, '')); app = appVan(nr); sleutel = app ? nr : null; }
    if (!app) return { status: 404, error: 'Deze app bestaat niet in de bibliotheek.' };
    const mijn = rij(key);
    if (mijn.includes(sleutel)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 500) return { status: 400, error: 'Het maximum van 500 geïnstalleerde apps is bereikt; verwijder er eerst een.' };
    mijn.push(sleutel); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(key, id) {
    const sleutel = isOverlayId(id) ? String(id) : Number(String(id || '').replace(/^app-/, ''));
    const mijn = rij(key);
    const ix = mijn.indexOf(sleutel);
    if (ix < 0) return { status: 404, error: 'Deze app staat niet bij uw installaties.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  // een geïnstalleerde sleutel kan een nummer (vaste catalogus) of een
  // Werkplaats-id (overlay) zijn; ingetrokken overlay-apps vallen vanzelf weg.
  const mijnApps = (key) => rij(key).map(x => (typeof x === 'string' && isOverlayId(x)) ? overlayVan(x) : appVan(x)).filter(Boolean);

  return { appbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, overlayLijst, TOTAAL } };
}

module.exports = { maakAppbieb, CATEGORIEEN, TOTAAL };

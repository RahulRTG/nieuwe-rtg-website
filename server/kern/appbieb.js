/* De RTG App-Bibliotheek: 20.000 professionele apps in de Mall, elk met een
   winkelwaarde van rond de duizend euro, en voor leden inbegrepen bij de pas
   (ledenprijs 0). De catalogus wordt deterministisch samengesteld uit
   naamdelen (geen 20.000 records in de database, dezelfde aanpak als de
   ledengids op schaal): elk nummer 0..19999 levert altijd dezelfde app op.
   Alleen wat een lid installeert wordt bewaard, met een harde grens.

   Geen echte softwaremerken; RTG-huisnamen. AI adviseert hooguit welke app
   past; installeren en verwijderen doet het lid zelf. */

const CATEGORIEEN = [
  { id: 'boekhouding', label: 'Boekhouding & fiscaal', icon: '🧾', vak: ['Boekhouding', 'Facturatie', 'BTW-Assistent', 'Jaarrekening', 'Kasstroom'] },
  { id: 'ontwerp', label: 'Ontwerp & CAD', icon: '📐', vak: ['CAD Studio', 'Tekentafel', '3D-Modelleur', 'Plotkamer', 'Schetsboek'] },
  { id: 'foto', label: 'Fotostudio', icon: '📷', vak: ['Fotolab', 'RAW-Studio', 'Retoucheur', 'Lichtkamer', 'Contactblad'] },
  { id: 'video', label: 'Videomontage', icon: '🎬', vak: ['Montagetafel', 'Kleurenlab', 'Ondertitelaar', 'Storyboard', 'Renderstraat'] },
  { id: 'muziek', label: 'Muziekstudio', icon: '🎛️', vak: ['Opnamestudio', 'Mengtafel', 'Notenbalk', 'Mastering', 'Sampler'] },
  { id: 'vertaal', label: 'Vertalen & tekst', icon: '🌐', vak: ['Vertaalbureau', 'Redactiekamer', 'Terminologie', 'Ondertiteling', 'Corrector'] },
  { id: 'juridisch', label: 'Juridisch', icon: '⚖️', vak: ['Contractenmaker', 'Dossierkast', 'Termijnwacht', 'Aktenboek', 'Pleitnota'] },
  { id: 'praktijk', label: 'Praktijk & zorg', icon: '🩺', vak: ['Agendaboek', 'Patiëntenkaart', 'Declaratie', 'Verwijsbrief', 'Wachtkamer'] },
  { id: 'horeca', label: 'Horeca-beheer', icon: '🍽️', vak: ['Menukaartmaker', 'Voorraadkelder', 'Reserveringsboek', 'Keukenplanner', 'Shiftrooster'] },
  { id: 'vastgoed', label: 'Vastgoed & beheer', icon: '🏠', vak: ['Pandenboek', 'Huurcontract', 'Onderhoudsplanner', 'Taxatiehulp', 'Sleutelkast'] },
  { id: 'logistiek', label: 'Logistiek & vloot', icon: '🚚', vak: ['Routeplanner', 'Vrachtbrief', 'Vlootbeheer', 'Douanepapieren', 'Laadplan'] },
  { id: 'personeel', label: 'Personeel & rooster', icon: '🗓️', vak: ['Roostermaker', 'Verlofkaart', 'Urenstaat', 'Salarisstrook', 'Sollicitatiemap'] },
  { id: 'marketing', label: 'Marketing & merk', icon: '📣', vak: ['Campagnebord', 'Huisstijlgids', 'Nieuwsbrief', 'Mediaplanner', 'Merkenmonitor'] },
  { id: 'beveiliging', label: 'Beveiliging & privacy', icon: '🛡️', vak: ['Sleutelkluis', 'Toegangslog', 'Versleutelaar', 'Auditspoor', 'Wachtwoordkluis'] },
  { id: 'onderwijs', label: 'Onderwijs & training', icon: '🎓', vak: ['Lesplanner', 'Toetsenmaker', 'Cijferlijst', 'Leerlingvolg', 'Diplomaboek'] },
  { id: 'data', label: 'Data & rapportage', icon: '📊', vak: ['Rekenblad Pro', 'Grafiekenmaker', 'Datakoppelaar', 'Rapportstraat', 'Voorspeller'] },
  { id: 'landbouw', label: 'Landbouw & teelt', icon: '🌾', vak: ['Perceelboek', 'Oogstplanner', 'Stalregister', 'Weerwacht', 'Veilingklok'] },
  { id: 'bouw', label: 'Bouw & installatie', icon: '🏗️', vak: ['Bestekmaker', 'Bouwplanner', 'Calculatie', 'Opleverlijst', 'Werfdagboek'] },
  { id: 'kassa', label: 'Winkel & kassa', icon: '🛒', vak: ['Kassaboek', 'Voorraadteller', 'Etikettenmaker', 'Bonnenlade', 'Schapindeling'] },
  { id: 'ai', label: 'AI-gereedschap', icon: '✨', vak: ['Schrijfhulp', 'Beeldenmaker', 'Notulist', 'Kennisbank', 'Werkstroom'] }
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

function maakAppbieb({ db, save }) {
  const rij = (key) => {
    if (!db.data.appInstallaties) db.data.appInstallaties = {};
    if (!Array.isArray(db.data.appInstallaties[key])) db.data.appInstallaties[key] = [];
    return db.data.appInstallaties[key];
  };

  function overzicht() {
    return {
      totaal: TOTAAL, totaleWinkelwaardeCenten: SOM_WAARDE,
      categorieen: CATEGORIEEN.map(c => ({ id: c.id, label: c.label, icon: c.icon, aantal: PER_CAT }))
    };
  }

  function catalogus({ categorie, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const ci = CATEGORIEEN.findIndex(c => c.id === categorie);
    let nummers;
    if (!q && ci >= 0) {
      nummers = { aantal: PER_CAT, pak: (k) => ci * PER_CAT + k };
    } else if (!q) {
      nummers = { aantal: TOTAAL, pak: (k) => k };
    } else {
      const raak = [];
      const van = ci >= 0 ? ci * PER_CAT : 0, tot = ci >= 0 ? (ci + 1) * PER_CAT : TOTAAL;
      for (let i = van; i < tot && raak.length < 2000; i++) if (NAMEN[i].includes(q)) raak.push(i);
      nummers = { aantal: raak.length, pak: (k) => raak[k] };
    }
    const start = (p - 1) * n;
    const items = [];
    for (let k = start; k < Math.min(start + n, nummers.aantal); k++) items.push(appVan(nummers.pak(k)));
    return { items, totaal: nummers.aantal, pagina: p, paginas: Math.max(1, Math.ceil(nummers.aantal / n)) };
  }

  function installeer(key, id) {
    const nr = Number(String(id || '').replace(/^app-/, ''));
    const app = appVan(nr);
    if (!app) return { status: 404, error: 'Deze app bestaat niet in de bibliotheek.' };
    const mijn = rij(key);
    if (mijn.includes(nr)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 500) return { status: 400, error: 'Het maximum van 500 geïnstalleerde apps is bereikt; verwijder er eerst een.' };
    mijn.push(nr); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(key, id) {
    const nr = Number(String(id || '').replace(/^app-/, ''));
    const mijn = rij(key);
    const ix = mijn.indexOf(nr);
    if (ix < 0) return { status: 404, error: 'Deze app staat niet bij uw installaties.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (key) => rij(key).map(appVan).filter(Boolean);

  return { appbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, TOTAAL } };
}

module.exports = { maakAppbieb, CATEGORIEEN, TOTAAL };

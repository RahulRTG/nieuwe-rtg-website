/* De RTF App-Bibliotheek: 20.000 kind- en gezinsapps in de RTFoundation, elk
   met een eerlijke winkelwaarde (wat hij in een app-winkel zou kosten), maar
   bij de foundation ALTIJD gratis: een cadeau van de RTFoundation. Geen
   aankopen in de app, geen reclame en geen verslavende trucjes; dat is de
   huisregel en die staat bij elke app in de uitleg.

   Dezelfde schaal-aanpak als de RTG-bibliotheek: de catalogus wordt
   deterministisch samengesteld uit naamdelen (20 categorieen x 40 merken x
   25 edities = exact 20.000); alleen wat een profiel installeert wordt
   bewaard. Elke app heeft een doelgroep (mini/kind/tiener/gezin) en de
   leeftijdspoort van het profiel bepaalt wat er uberhaupt te zien en te
   installeren is: beschermde profielen zien nooit iets boven hun groep. */

const CATEGORIEEN = [
  { id: 'voorlezen', label: 'Voorlezen & verhalen', icon: '📖', doel: ['mini', 'kind'], vak: ['Verhaaltjes', 'Prentenboek', 'Slaapverhaal', 'Vertelkaarten', 'Voorleesstem'] },
  { id: 'rekenen', label: 'Rekenen', icon: '🔢', doel: ['kind', 'tiener'], vak: ['Tafeltrainer', 'Sommenfabriek', 'Breukenbakker', 'Hoofdrekenen', 'Rekenrace'] },
  { id: 'taal', label: 'Taal & lezen', icon: '🔤', doel: ['kind', 'tiener'], vak: ['Letterdoos', 'Leesavontuur', 'Spellingheld', 'Woordenjacht', 'Verhalenschrijver'] },
  { id: 'tekenen', label: 'Tekenen & knutselen', icon: '🎨', doel: ['mini', 'kind', 'gezin'], vak: ['Kleurplaat', 'Tekenles', 'Knutselplan', 'Stickerstudio', 'Kleikunst'] },
  { id: 'muziek', label: 'Muziek maken', icon: '🎵', doel: ['kind', 'tiener'], vak: ['Liedjesmaker', 'Pianoles', 'Ritmedoos', 'Zangkamer', 'Orkestje'] },
  { id: 'puzzels', label: 'Puzzels & denkspellen', icon: '🧩', doel: ['kind', 'tiener', 'gezin'], vak: ['Puzzelkist', 'Breinbreker', 'Doolhof', 'Geheugenspel', 'Logicaland'] },
  { id: 'coderen', label: 'Coderen & techniek', icon: '🤖', doel: ['kind', 'tiener'], vak: ['Codeblokken', 'Robotles', 'Spelletjesmaker', 'Schakelkast Junior', 'Pixelwerkplaats'] },
  { id: 'natuur', label: 'Natuur & buiten', icon: '🌳', doel: ['kind', 'gezin'], vak: ['Speurtocht', 'Bomengids', 'Vogelspotter', 'Moestuintje', 'Buitenbingo'] },
  { id: 'sport', label: 'Sport & bewegen', icon: '⚽', doel: ['kind', 'tiener', 'gezin'], vak: ['Beweegspel', 'Danskamer', 'Voetbalschool', 'Zwemdiploma', 'Springparcours'] },
  { id: 'proefjes', label: 'Wetenschap & proefjes', icon: '🔬', doel: ['kind', 'tiener'], vak: ['Proefjeslab', 'Uitvindershoek', 'Magneetles', 'Waterwerkplaats', 'Kristallenkweek'] },
  { id: 'ruimte', label: 'Ruimte & sterren', icon: '🚀', doel: ['kind', 'tiener'], vak: ['Sterrenkijker', 'Planetenreis', 'Raketbouwer', 'Maanmissie', 'Melkwegkaart'] },
  { id: 'dieren', label: 'Dieren', icon: '🐾', doel: ['mini', 'kind'], vak: ['Dierengeluiden', 'Boerderijvriendjes', 'Dierendokter', 'Oceaanontdekker', 'Safariboek'] },
  { id: 'koken', label: 'Koken voor kids', icon: '🧁', doel: ['kind', 'gezin'], vak: ['Bakplezier', 'Kinderkeuken', 'Receptenschrift', 'Pannenkoekplan', 'Smaakschool'] },
  { id: 'verkeer', label: 'Verkeer & veilig', icon: '🚦', doel: ['mini', 'kind'], vak: ['Verkeersles', 'Oversteekspel', 'Fietsdiploma', 'Bordenquiz', 'Veiligthuis'] },
  { id: 'gevoelens', label: 'Gevoelens & rust', icon: '💛', doel: ['mini', 'kind', 'tiener'], vak: ['Gevoelensweer', 'Ademwolkje', 'Complimentenpot', 'Piekerhulpje', 'Moedmeter'] },
  { id: 'slapen', label: 'Dromen & slapen', icon: '🌙', doel: ['mini', 'gezin'], vak: ['Slaapliedjes', 'Sterrenlampje', 'Bedtijdklok', 'Droomdagboek', 'Nachtrustgids'] },
  { id: 'zakgeld', label: 'Zakgeld & sparen', icon: '🐷', doel: ['kind', 'tiener'], vak: ['Spaarpot', 'Zakgeldboekje', 'Klusjesplanner', 'Wenslijstje', 'Spaardoel'] },
  { id: 'talen', label: 'Talen ontdekken', icon: '🌍', doel: ['kind', 'tiener', 'gezin'], vak: ['Woordjesreis', 'Taalvriendjes', 'Uitspraakcoach', 'Reiswoordenboek', 'Taalquiz'] },
  { id: 'school', label: 'Huiswerk & school', icon: '🎒', doel: ['kind', 'tiener'], vak: ['Huiswerkplanner', 'Topografietrainer', 'Werkstukhulp', 'Toetstimer', 'Boekverslag'] },
  { id: 'gezin', label: 'Samen in het gezin', icon: '🏡', doel: ['gezin'], vak: ['Gezinsavond', 'Fotoalbum', 'Taakverdeler', 'Uitjesplanner', 'Familiequiz'] }
];
const MERK = ['Vlinder', 'Dolfijn', 'Raket', 'Uiltje', 'Vosje', 'Sterretje', 'Ballon', 'Kikker', 'Panda', 'Egeltje',
  'Zonnetje', 'Regenboog', 'Draakje', 'Robotje', 'Walvis', 'Pinguin', 'Eekhoorn', 'Vuurtoren', 'Boomhut', 'Zwaluw',
  'Knuffel', 'Toverstaf', 'Speeldoos', 'Zeepbel', 'Springtouw', 'Krijtje', 'Legpuzzel', 'Vlieger', 'Schatkist', 'Verrekijker',
  'Kompasje', 'Lampion', 'Sneeuwvlok', 'Klavertje', 'Muisje', 'Beertje', 'Zeester', 'Libel', 'Wolkje', 'Dauwdruppel'];
const EDITIE = ['Junior', 'Mini', 'Speels', 'Avontuur', 'Klas', 'Gezin', 'Ontdek', 'Droom', 'Safari', 'Expeditie',
  'Lab', 'Club', 'Kamp', 'Reis', 'Feest', 'Held', 'Ster', 'Wereld', 'Basis', 'Plus',
  'Samen', 'Nacht', 'Zomer', 'Winter', 'Go'];

const TOTAAL = CATEGORIEEN.length * MERK.length * EDITIE.length; // 20 x 40 x 25 = 20.000
const DOELGROEP_LABEL = { mini: 'mini (0-5)', kind: 'kind (6-11)', tiener: 'tiener (12+)', gezin: 'het hele gezin' };
/* Wat elke profielgroep mag zien: nooit iets boven de eigen groep. */
const ZICHT = {
  mini: ['mini', 'gezin'],
  kind: ['mini', 'kind', 'gezin'],
  tiener: ['mini', 'kind', 'tiener', 'gezin'],
  jong: ['mini', 'kind', 'tiener', 'gezin'],
  volw: ['mini', 'kind', 'tiener', 'gezin']
};

/* Elk nummer levert altijd dezelfde app: naam, doelgroep en winkelwaarde
   rollen deterministisch uit het nummer. De winkelwaarde is die van een
   goede kinderapp in de winkel (3,99 - 13,99); bij RTF is hij altijd 0. */
function appVan(i) {
  if (!Number.isInteger(i) || i < 0 || i >= TOTAAL) return null;
  const cat = CATEGORIEEN[Math.floor(i / (MERK.length * EDITIE.length))];
  const rest = i % (MERK.length * EDITIE.length);
  const merk = MERK[rest % MERK.length];
  const editie = EDITIE[Math.floor(rest / MERK.length)];
  const vak = cat.vak[i % cat.vak.length];
  const doelgroep = cat.doel[(i * 7) % cat.doel.length];
  const waarde = 399 + ((i * 7919) % 21) * 50;              // 3,99 .. 13,99
  return {
    id: 'rtf-' + i, nr: i, naam: merk + ' ' + vak + ' ' + editie,
    categorie: cat.id, categorieLabel: cat.label, icon: cat.icon,
    doelgroep, doelgroepLabel: DOELGROEP_LABEL[doelgroep],
    winkelwaardeCenten: waarde, prijsCenten: 0,
    sterren: (40 + ((i * 31) % 10)) / 10, versie: (1 + (i % 6)) + '.' + ((i * 13) % 10), grootteMB: 15 + ((i * 97) % 220),
    uitleg: cat.label + ' voor ' + DOELGROEP_LABEL[doelgroep] + '. In de winkel EUR ' + (waarde / 100).toFixed(2).replace('.', ',') +
      '; bij de RTFoundation gratis. Geen aankopen, geen reclame, geen verslavende trucjes.'
  };
}

/* De zoekindex: een keer opgebouwd, klein en begrensd. */
const NAMEN = []; const DOEL = []; let SOM_WAARDE = 0;
for (let i = 0; i < TOTAAL; i++) { const a = appVan(i); NAMEN.push(a.naam.toLowerCase()); DOEL.push(a.doelgroep); SOM_WAARDE += a.winkelwaardeCenten; }
const PER_CAT = MERK.length * EDITIE.length;

function maakRtfBieb({ db, save }) {
  const rij = (handle) => {
    if (!db.data.rtfAppInstallaties) db.data.rtfAppInstallaties = {};
    if (!Array.isArray(db.data.rtfAppInstallaties[handle])) db.data.rtfAppInstallaties[handle] = [];
    return db.data.rtfAppInstallaties[handle];
  };
  const magZien = (groep, doelgroep) => (ZICHT[groep] || ZICHT.kind).includes(doelgroep);

  function overzicht(groep) {
    return {
      totaal: TOTAAL, totaleWinkelwaardeCenten: SOM_WAARDE, gratis: true,
      categorieen: CATEGORIEEN
        .filter(c => c.doel.some(d => magZien(groep, d)))
        .map(c => ({ id: c.id, label: c.label, icon: c.icon, aantal: PER_CAT }))
    };
  }

  function catalogus(groep, { categorie, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(1000, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const ci = CATEGORIEEN.findIndex(c => c.id === categorie);
    const van = ci >= 0 ? ci * PER_CAT : 0, tot = ci >= 0 ? (ci + 1) * PER_CAT : TOTAAL;
    // de leeftijdspoort filtert ALTIJD mee; daarom verzamelen we nummers
    const raak = [];
    for (let i = van; i < tot && raak.length < 5000; i++) {
      if (!magZien(groep, DOEL[i])) continue;
      if (q && !NAMEN[i].includes(q)) continue;
      raak.push(i);
    }
    const start = (p - 1) * n;
    return {
      items: raak.slice(start, start + n).map(appVan),
      totaal: raak.length, pagina: p, paginas: Math.max(1, Math.ceil(raak.length / n))
    };
  }

  function installeer(handle, groep, id) {
    const nr = Number(String(id || '').replace(/^rtf-/, ''));
    const app = appVan(nr);
    if (!app) return { status: 404, error: 'Deze app bestaat niet in de bibliotheek.' };
    if (!magZien(groep, app.doelgroep)) return { status: 403, error: 'Deze app is voor een andere leeftijdsgroep.' };
    const mijn = rij(handle);
    if (mijn.includes(nr)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 300) return { status: 400, error: 'Het maximum van 300 apps is bereikt; ruim er eerst een op.' };
    mijn.push(nr); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(handle, id) {
    const nr = Number(String(id || '').replace(/^rtf-/, ''));
    const mijn = rij(handle);
    const ix = mijn.indexOf(nr);
    if (ix < 0) return { status: 404, error: 'Deze app staat niet bij jouw apps.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (handle) => rij(handle).map(appVan).filter(Boolean);

  return { rtfbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, magZien, TOTAAL } };
}

module.exports = { maakRtfBieb, CATEGORIEEN, TOTAAL };

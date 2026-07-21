/* De RTF School-Bibliotheek: per leeftijdsgroep tienduizend school-apps,
   van kleuter tot universiteit en van vmbo tot vwo: 5 groepen x 10.000 =
   exact 50.000 apps. De beste en duurste leerapps uit de winkel, bij de
   RTFoundation altijd gratis, en altijd op de gezonde manier: echte
   leerdoelen, korte sessies, geen reclame, geen streaks of andere
   verslavende trucjes. Slim worden zonder verslaafd raken.

   Dezelfde schaal-aanpak als de andere bibliotheken: elk nummer levert
   deterministisch dezelfde app (groep x vak x methodehuis x editie); alleen
   wat een profiel installeert wordt bewaard. De leeftijdspoort: je ziet je
   eigen groep en alles eronder (herhalen mag altijd), nooit erboven. */

const GROEPEN = [
  { id: 'mini', label: 'Kleuter & peuter', icon: '🧸', prijsVan: 999, prijsStap: 200, vak: [
    'Kleuren & vormen', 'Letters ontdekken', 'Cijfers 1 tot 10', 'Voorbereidend schrijven', 'Luisteren',
    'Rijmen', 'Knippen & plakken', 'Samen delen', 'Seizoenen', 'Dieren & natuur',
    'Verkeer voor kleuters', 'Liedjes & taal', 'Puzzelen', 'Tellen met spel', 'Voorlezen',
    'Eerste Engels', 'Gevoelens', 'Bouwen & ruimte', 'Geheugenspel', 'Dagritme'] },
  { id: 'kind', label: 'Basisschool (groep 3-8)', icon: '🎒', prijsVan: 1999, prijsStap: 350, vak: [
    'Technisch lezen', 'Begrijpend lezen', 'Spelling', 'Rekenen', 'Breuken',
    'Tafels', 'Topografie', 'Geschiedenis', 'Natuur & techniek', 'Engels',
    'Mooi schrijven', 'Werkstukken', 'Verkeer', 'Toets-oefening', 'Studievaardigheden',
    'Muziekleer', 'Tekenen & kunst', 'Programmeren junior', 'Wereldoriëntatie', 'Verhaalsommen'] },
  { id: 'tiener', label: 'Voortgezet (vmbo, havo, vwo)', icon: '📐', prijsVan: 2999, prijsStap: 600, vak: [
    'Wiskunde', 'Nederlands', 'Engels', 'Frans', 'Duits',
    'Natuurkunde', 'Scheikunde', 'Biologie', 'Geschiedenis', 'Aardrijkskunde',
    'Economie', 'Maatschappijleer', 'Latijn & Grieks', 'Informatica', 'NaSk vmbo',
    'Examentraining vmbo', 'Examentraining havo', 'Examentraining vwo', 'Profielwerkstuk', 'Studieplanning'] },
  { id: 'jong', label: 'mbo, hbo & universiteit', icon: '🎓', prijsVan: 4999, prijsStap: 1250, vak: [
    'Statistiek', 'Programmeren', 'Anatomie & fysiologie', 'Recht', 'Bedrijfskunde',
    'Economie & finance', 'Psychologie', 'Hogere wiskunde', 'Onderzoeksmethoden', 'Academisch schrijven',
    'Presenteren', 'Boekhouden', 'Werktuigbouw', 'Verpleegkunde', 'Didactiek',
    'Marketing', 'Data-analyse', 'Filosofie', 'Vaktalen', 'Scriptiehulp'] },
  { id: 'volw', label: 'Leven lang leren', icon: '📚', prijsVan: 3999, prijsStap: 800, vak: [
    'Taal opfrissen', 'Rekenen opfrissen', 'Digitale vaardigheden', 'NT2 & inburgering', 'Geldzaken',
    'Omscholing IT', 'Omscholing zorg', 'Ondernemen', 'Rijbewijs theorie', 'EHBO',
    'Reistalen', 'Geschiedenis verdieping', 'Kunstgeschiedenis', 'Muziektheorie', 'Schrijven',
    'Spreken voor groepen', 'Gezond leven', 'Opvoeden', 'Open colleges', 'Recht & pensioen'] }
];
const MERK = ['Griffel', 'Lessenaar', 'Kroontjespen', 'Telraam', 'Atlasje', 'Schoolbord', 'Inktpot', 'Liniaal', 'Kaft', 'Agenda',
  'Passer', 'Gum', 'Boekentas', 'Krijtbord', 'Lesboek', 'Schrift', 'Potlood', 'Wereldbol', 'Microscoopje', 'Rekenliniaal',
  'Woordenaar', 'Formule', 'Proefwerk', 'Studeerkamer', 'Collegebank'];
const EDITIE = ['Basis', 'Oefening', 'Verdieping', 'Toetsklaar', 'Examen', 'Werkboek', 'Coach', 'Trainer', 'Bundel', 'Jaar 1',
  'Jaar 2', 'Compleet', 'Zomerschool', 'Bijles', 'Mondeling', 'Schriftelijk', 'Praktijk', 'Theorie', 'Meesterproef', 'Herhaling'];

const PER_GROEP = 20 * MERK.length * EDITIE.length;           // 20 x 25 x 20 = 10.000
const TOTAAL = GROEPEN.length * PER_GROEP;                    // 50.000
/* Herhalen mag altijd: je ziet je eigen groep en alles eronder, nooit erboven.
   Ouders en jongvolwassenen zien alles (die kijken mee met het hele gezin). */
const ZICHT = { mini: ['mini'], kind: ['mini', 'kind'], tiener: ['mini', 'kind', 'tiener'],
  jong: ['mini', 'kind', 'tiener', 'jong', 'volw'], volw: ['mini', 'kind', 'tiener', 'jong', 'volw'] };

function appVan(i) {
  if (!Number.isInteger(i) || i < 0 || i >= TOTAAL) return null;
  const g = GROEPEN[Math.floor(i / PER_GROEP)];
  const rest = i % PER_GROEP;
  const vak = g.vak[Math.floor(rest / (MERK.length * EDITIE.length))];
  const rest2 = rest % (MERK.length * EDITIE.length);
  const merk = MERK[rest2 % MERK.length];
  const editie = EDITIE[Math.floor(rest2 / MERK.length)];
  const waarde = g.prijsVan + ((i * 7919) % 21) * g.prijsStap;
  return {
    id: 'sch-' + i, nr: i, naam: merk + ' ' + vak + ' ' + editie,
    groep: g.id, groepLabel: g.label, icon: g.icon, vak,
    winkelwaardeCenten: waarde, prijsCenten: 0,
    sterren: (42 + ((i * 31) % 8)) / 10, versie: (1 + (i % 5)) + '.' + ((i * 13) % 10),
    uitleg: vak + ' voor ' + g.label + '. In de winkel EUR ' + (waarde / 100).toFixed(2).replace('.', ',') +
      '; bij de RTFoundation gratis. Gezond leren: echte leerdoelen, korte sessies, geen reclame en geen verslavende trucjes.'
  };
}

/* De zoekindex: een keer opgebouwd (50.000 namen), klein en begrensd. */
const NAMEN = []; let SOM_WAARDE = 0;
for (let i = 0; i < TOTAAL; i++) { const a = appVan(i); NAMEN.push(a.naam.toLowerCase()); SOM_WAARDE += a.winkelwaardeCenten; }

function maakSchoolBieb({ db, save }) {
  const rij = (handle) => {
    if (!db.data.schoolInstallaties) db.data.schoolInstallaties = {};
    if (!Array.isArray(db.data.schoolInstallaties[handle])) db.data.schoolInstallaties[handle] = [];
    return db.data.schoolInstallaties[handle];
  };
  const zicht = (groep) => ZICHT[groep] || ZICHT.kind;

  function overzicht(groep) {
    return {
      totaal: TOTAAL, perGroep: PER_GROEP, totaleWinkelwaardeCenten: SOM_WAARDE, gratis: true,
      groepen: GROEPEN.filter(g => zicht(groep).includes(g.id))
        .map(g => ({ id: g.id, label: g.label, icon: g.icon, aantal: PER_GROEP, vakken: g.vak }))
    };
  }

  function catalogus(groep, { niveau, vak, zoek, pagina, per } = {}) {
    const p = Math.max(1, Math.min(2100, Number(pagina) || 1));
    const n = Math.max(1, Math.min(48, Number(per) || 24));
    const q = String(zoek || '').toLowerCase().trim().slice(0, 60);
    const gi = GROEPEN.findIndex(g => g.id === niveau && zicht(groep).includes(g.id));
    const raak = [];
    const scan = (van, tot) => {
      for (let i = van; i < tot && raak.length < 5000; i++) {
        if (q && !NAMEN[i].includes(q)) continue;
        if (vak && appVan(i).vak !== vak) continue;
        raak.push(i);
      }
    };
    if (gi >= 0) scan(gi * PER_GROEP, (gi + 1) * PER_GROEP);
    else for (const gid of zicht(groep)) { const x = GROEPEN.findIndex(g => g.id === gid); scan(x * PER_GROEP, (x + 1) * PER_GROEP); }
    const start = (p - 1) * n;
    return { items: raak.slice(start, start + n).map(appVan), totaal: raak.length, pagina: p, paginas: Math.max(1, Math.ceil(raak.length / n)) };
  }

  function installeer(handle, groep, id) {
    const nr = Number(String(id || '').replace(/^sch-/, ''));
    const app = appVan(nr);
    if (!app) return { status: 404, error: 'Deze school-app bestaat niet.' };
    if (!zicht(groep).includes(app.groep)) return { status: 403, error: 'Deze app hoort bij een hogere leeftijdsgroep; die komt vanzelf.' };
    const mijn = rij(handle);
    if (mijn.includes(nr)) return { status: 200, ok: true, app, alGeinstalleerd: true, aantal: mijn.length };
    if (mijn.length >= 500) return { status: 400, error: 'Het maximum van 500 school-apps is bereikt; ruim er eerst een op.' };
    mijn.push(nr); save();
    return { status: 200, ok: true, app, aantal: mijn.length };
  }

  function verwijder(handle, id) {
    const nr = Number(String(id || '').replace(/^sch-/, ''));
    const mijn = rij(handle);
    const ix = mijn.indexOf(nr);
    if (ix < 0) return { status: 404, error: 'Deze app staat niet bij jouw school-apps.' };
    mijn.splice(ix, 1); save();
    return { status: 200, ok: true, aantal: mijn.length };
  }

  const mijnApps = (handle) => rij(handle).map(appVan).filter(Boolean);

  return { schoolbieb: { overzicht, catalogus, installeer, verwijder, mijnApps, appVan, TOTAAL, PER_GROEP } };
}

module.exports = { maakSchoolBieb, GROEPEN, TOTAAL };

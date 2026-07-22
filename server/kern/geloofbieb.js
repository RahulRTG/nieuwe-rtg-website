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

/* 40 tradities en levensbeschouwingen, respectvol en breed: wereldreligies en
   hun stromingen, inheemse en oude tradities, mystiek, filosofie en het
   niet-religieuze. Bewust naast elkaar, in willekeurige-ogende maar vaste
   volgorde; geen enkele staat "boven" een andere. */
const TRADITIES = [
  { id: 'christendom', label: 'Christendom' },
  { id: 'katholicisme', label: 'Katholicisme' },
  { id: 'orthodoxie', label: 'Oosters-orthodox christendom' },
  { id: 'protestantisme', label: 'Protestantse tradities' },
  { id: 'islam', label: 'Islam' },
  { id: 'soefisme', label: 'Soefisme' },
  { id: 'jodendom', label: 'Jodendom' },
  { id: 'kabbala', label: 'Kabbala' },
  { id: 'hindoeisme', label: 'Hindoeïsme' },
  { id: 'vedanta', label: 'Advaita Vedanta' },
  { id: 'boeddhisme', label: 'Boeddhisme' },
  { id: 'zen', label: 'Zen' },
  { id: 'tibetaans', label: 'Tibetaans boeddhisme' },
  { id: 'sikhisme', label: 'Sikhisme' },
  { id: 'jainisme', label: 'Jaïnisme' },
  { id: 'taoisme', label: 'Taoïsme' },
  { id: 'confucianisme', label: 'Confucianisme' },
  { id: 'shinto', label: 'Shintoïsme' },
  { id: 'bahai', label: 'Bahá’í-geloof' },
  { id: 'zoroastrisme', label: 'Zoroastrisme' },
  { id: 'gnostiek', label: 'Gnostiek' },
  { id: 'mystiek', label: 'Christelijke mystiek' },
  { id: 'inheems', label: 'Inheemse tradities' },
  { id: 'afrikaans', label: 'Afrikaanse tradities' },
  { id: 'yoruba', label: 'Yoruba & Ifá' },
  { id: 'dreaming', label: 'Aboriginal Dreaming' },
  { id: 'sjamanisme', label: 'Sjamanisme' },
  { id: 'heidendom', label: 'Modern heidendom & Wicca' },
  { id: 'keltisch', label: 'Keltische & druïdische wijsheid' },
  { id: 'noors', label: 'Noorse & Germaanse tradities' },
  { id: 'hellenisme', label: 'Griekse & Romeinse tradities' },
  { id: 'egyptisch', label: 'Oud-Egyptische tradities' },
  { id: 'rastafari', label: 'Rastafari' },
  { id: 'stoa', label: 'Stoïcijnse filosofie' },
  { id: 'humanisme', label: 'Humanisme' },
  { id: 'existentie', label: 'Existentiële filosofie' },
  { id: 'natuur', label: 'Natuurspiritualiteit' },
  { id: 'dialoog', label: 'Interreligieuze dialoog' },
  { id: 'twijfel', label: 'Vrije gedachte & twijfel' },
  { id: 'perennis', label: 'Perennialisme (de ene bron)' }
];
/* Een neutrale, waardige set iconen; bewust niet één heilig symbool aan één
   traditie gekoppeld (dat zou misrepresenteren). Ze rouleren op nummer. */
const ICONEN = ['🕊️', '📜', '🪔', '📿', '🌿', '✨', '📖', '🔔', '🌏', '💠'];

/* 25 thema's. Elk draagt de leeftijdsgeschiktheid (doel): de zachte verhalen
   voor de kleinsten, de diepere weg voor tiener en volwassene. Alle doel-waarden
   liggen binnen {mini, kind, tiener, gezin}; een volwassene ziet alles. */
const THEMA = [
  { label: 'Verhalen voor de kleinsten', doel: ['mini'] },
  { label: 'Prentenverhalen', doel: ['mini', 'kind'] },
  { label: 'Feesten & vieringen', doel: ['kind', 'gezin'] },
  { label: 'Gebruiken & rituelen', doel: ['kind', 'tiener', 'gezin'] },
  { label: 'Wijze verhalen & parabels', doel: ['kind', 'gezin'] },
  { label: 'Levens van wijzen & stichters', doel: ['kind', 'tiener'] },
  { label: 'Heilige teksten & bronnen', doel: ['tiener'] },
  { label: 'Uitleg & commentaar', doel: ['tiener'] },
  { label: 'Gebeden & liederen', doel: ['kind', 'gezin'] },
  { label: 'Meditatie & stilte', doel: ['tiener', 'gezin'] },
  { label: 'Filosofie & grote vragen', doel: ['tiener'] },
  { label: 'Ethiek & goed leven', doel: ['tiener', 'gezin'] },
  { label: 'Mystiek & innerlijke weg', doel: ['tiener'] },
  { label: 'Kunst & symboliek', doel: ['kind', 'tiener', 'gezin'] },
  { label: 'Muziek & klank', doel: ['kind', 'gezin'] },
  { label: 'Kalender & seizoenen', doel: ['kind', 'gezin'] },
  { label: 'Keuken & gastvrijheid', doel: ['kind', 'gezin'] },
  { label: 'Pelgrimage & plaatsen', doel: ['tiener', 'gezin'] },
  { label: 'Geschiedenis & stromingen', doel: ['tiener'] },
  { label: 'Interreligieuze ontmoeting', doel: ['tiener', 'gezin'] },
  { label: 'Twijfel & vrije gedachte', doel: ['tiener'] },
  { label: 'Natuur & verwondering', doel: ['kind', 'gezin'] },
  { label: 'Rites bij leven & afscheid', doel: ['tiener', 'gezin'] },
  { label: 'Vrede & vergeving', doel: ['kind', 'tiener', 'gezin'] },
  { label: 'Woordenlijst & begrippen', doel: ['tiener', 'gezin'] }
];
const REEKS = ['Bronnen', 'Wegwijzer', 'Kompas', 'Lantaarn', 'Drempel', 'Pelgrim', 'Horizon', 'Stiltehuis', 'Levensboom', 'Pad',
  'Licht', 'Draad', 'Herberg', 'Vuur', 'Water', 'Adem', 'Wortel', 'Kring', 'Zaad', 'Oogst',
  'Brug', 'Poort', 'Sleutel', 'Kaars', 'Spiegel', 'Anker', 'Ster', 'Dauw', 'Berg', 'Rivier',
  'Tuin', 'Zaailing', 'Vlam', 'Uur', 'Bel', 'Boekrol', 'Perkament', 'Zegel', 'Vaas', 'Krans'];
const UITGAVE = ['Inleiding', 'Voor kinderen', 'Voor het gezin', 'Handreiking', 'Bloemlezing', 'Naslag', 'Verdieping', 'Dagboek', 'Metgezel', 'Gids',
  'Klassiek', 'Modern', 'Kort', 'Compleet', 'Geïllustreerd', 'Verhalen', 'Vragen', 'Stil', 'Samen', 'Onderweg',
  'Bezinning', 'Jaar', 'Drempel', 'Ontmoeting', 'Vrede'];

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

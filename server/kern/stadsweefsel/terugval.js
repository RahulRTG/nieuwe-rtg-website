/* RTG Stadsweefsel, deel "terugval": de stad mag niet dom worden als wij uitvallen.

   Dit is het ongemakkelijkste bestand van het weefsel, want het gaat over wat
   er moet gebeuren als dit platform er NIET is. Een systeem dat de stad beter
   coördineert, wordt vanzelf de plek waar alles langs loopt -- en dan is een
   storing bij ons ineens een storing in de stad. Dat mag niet, en het enige
   antwoord daarop is dat elk kritiek systeem een eigen veilige stand heeft
   waar het zonder ons in valt.

   Per systeem leggen we vier dingen vast:
     terugvalstand    wat het ding doet als het ons niet meer hoort
     lokaal           hoe een mens het ter plekke bedient, zonder netwerk
     papier           waar de procedure ligt die geen scherm nodig heeft
     geoefend         wanneer dat voor het laatst ECHT is gedaan

   DAT LAATSTE VELD IS HET PUNT. Een terugvalstand die nooit is geoefend, is
   een aanname. Vandaar dat de noodkaart de oefendatum toont en een systeem
   waar die te lang geleden is, met naam noemt -- niet als waarschuwing in het
   klein, maar als eerste ding op de kaart.

   EN DE KAART ZELF MOET STOM ZIJN. weefselNoodkaart() rekent niets uit, leest
   geen tijdreeksen, raadpleegt geen AI en heeft geen enkel ander deel van het
   weefsel nodig. Hij is bedoeld om afgedrukt aan de muur te hangen, want op de
   dag dat je hem nodig hebt, is de kans groot dat je hem niet kunt opvragen.

   WAT DIT NIET IS: een schakelaar. Er staat hier geen enkele functie die iets
   in de fysieke wereld terugzet. Dit is de ADMINISTRATIE van de terugval, en
   het is eerlijker om dat te zeggen dan om te doen alsof software een brug
   handmatig kan bedienen.

   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */
const { schoon } = require('../util');

const DAG = 86400000;
const OEFEN_MAANDEN = 12;   // langer dan een jaar geleden geoefend telt als niet geoefend

/* De vertrouwenszones. Dit is geen firewall -- die hoort in de infrastructuur
   en niet in een applicatie -- maar wel de VASTGELEGDE indeling waar die
   firewall naar hoort te luisteren, met per zone wat er nooit rechtstreeks bij
   mag. De vloot (server/vloot.js) draait de domeinen al als losse processen;
   dit zegt welke van die processen elkaar zouden mogen zien. */
const ZONES = [
  { zone: 'publiek', wat: 'de leden- en bewonersapps', paden: ['/api/stad/bewoner', '/api/stad/melding', '/api/stad/raadpleging'],
    nooit: 'rechtstreeks bij sensorinname, verkeers- of energieregie' },
  { zone: 'sensorinname', wat: 'de Stadsdoos-poorten', paden: ['/api/stad/doos/'],
    nooit: 'iets anders dan metingen en hartslagen; een apparaatsleutel opent nergens anders een deur' },
  { zone: 'stadsregie', wat: 'de boardroom: scenario, regimes, energie-opdrachten', paden: ['/api/office/stad', '/api/office/weefsel'],
    nooit: 'bereikbaar zonder kantoorinlog, en nooit vanaf het publieke net' },
  { zone: 'hulpdiensten', wat: 'meldkamer en rampbeeld', paden: ['/api/office/rampbeeld', '/api/supplier/hulpdienst'],
    nooit: 'afhankelijk van de stadsregie: de meldkamer draait door als de stad plat ligt' },
  { zone: 'geld', wat: 'RTG Pay en de bank', paden: ['/api/pay', '/api/bank'],
    nooit: 'aan te sturen vanuit een stadsroute of een sensormelding' }
];

/* De systemen die een terugvalstand HOREN te hebben. De lijst hangt aan de
   objectsoorten van het register, zodat hij meegroeit met wat de stad heeft
   in plaats van een losse opsomming te blijven. */
const STANDAARD = {
  verkeerslicht: { terugval: 'knippert geel; de kruising werkt als voorrangskruising',
    lokaal: 'handkast in de regelkast naast de mast (sleutel bij de wegbeheerder)',
    papier: 'noodmap Verkeer, tabblad 3' },
  gemaal: { terugval: 'draait autonoom door op de lokale vlotterschakelaar',
    lokaal: 'schakelkast in het gemaalgebouw; handbediening met de rode knop',
    papier: 'noodmap Water, tabblad 1' },
  brug: { terugval: 'blijft in de laatste veilige stand staan (dicht voor het wegverkeer)',
    lokaal: 'bediening in het brugwachtershuis; handslinger in de kast',
    papier: 'noodmap Verkeer, tabblad 5' },
  transformator: { terugval: 'valt terug op het net van de netbeheerder; onze regie doet niets meer',
    lokaal: 'alleen door de netbeheerder; wij hebben hier geen knop',
    papier: 'contactblad Netbeheer' },
  lantaarn: { terugval: 'brandt op het vaste schema van de schemerschakelaar',
    lokaal: 'groepenkast per straat', papier: 'noodmap Openbare ruimte, tabblad 2' },
  laadpaal: { terugval: 'blijft laden op het basisvermogen; geen sturing meer',
    lokaal: 'stekker eruit', papier: 'noodmap Energie, tabblad 4' }
};

module.exports = (ctx) => {
  const { d, save, nu, obj } = ctx;

  const standen = () => { if (!d().weefselTerugval || typeof d().weefselTerugval !== 'object') d().weefselTerugval = {}; return d().weefselTerugval; };

  function zorgStanden() {
    if (Object.keys(standen()).length) return;
    for (const [soort, s] of Object.entries(STANDAARD))
      standen()[soort] = { soort, ...s, geoefendAt: null, geoefendDoor: null, notitie: null, at: nu() };
    save();
  }

  function zet({ soort, terugval, lokaal, papier, wie, notitie }) {
    zorgStanden();
    const s = String(soort || '');
    if (!obj.SOORTEN[s]) return { status: 400, error: 'Onbekende objectsoort: ' + Object.keys(obj.SOORTEN).join(', ') + '.' };
    const r = standen()[s] || (standen()[s] = { soort: s, geoefendAt: null, at: nu() });
    if (terugval !== undefined) r.terugval = schoon(terugval, 200);
    if (lokaal !== undefined) r.lokaal = schoon(lokaal, 200);
    if (papier !== undefined) r.papier = schoon(papier, 120);
    if (notitie !== undefined) r.notitie = schoon(notitie, 200) || null;
    r.door = schoon(wie, 60) || 'kantoor';
    save();
    return { ok: true, terugval: verrijk(r) };
  }

  /* Een oefening vastleggen. Dit is het enige veld dat een terugvalstand van
     een voornemen in een feit verandert, en het is met opzet een HANDELING met
     een naam en een datum: niemand kan hier per ongeluk in slagen. */
  function oefen({ soort, wie, notitie, gelukt }) {
    zorgStanden();
    const r = standen()[String(soort || '')];
    if (!r) return { status: 404, error: 'Voor die soort staat geen terugvalstand.' };
    const naam = schoon(wie, 60);
    if (!naam) return { status: 400, error: 'Wie heeft geoefend?' };
    if (gelukt === false) {
      r.laatsteMislukking = { at: nu(), door: naam, notitie: schoon(notitie, 200) || null };
      save();
      return { ok: true, terugval: verrijk(r),
        let_op: 'Een MISLUKTE oefening telt niet als geoefend. De datum blijft staan op de laatste geslaagde.' };
    }
    r.geoefendAt = nu(); r.geoefendDoor = naam;
    r.notitie = schoon(notitie, 200) || r.notitie;
    save();
    return { ok: true, terugval: verrijk(r) };
  }

  const verouderd = (r) => !r.geoefendAt || (nu() - r.geoefendAt) > OEFEN_MAANDEN * 30 * DAG;
  function verrijk(r) {
    return { ...r, aantalObjecten: obj.zoek({ soort: r.soort }).length,
      geoefendMaanden: r.geoefendAt ? Math.round((nu() - r.geoefendAt) / (30 * DAG)) : null,
      verouderd: verouderd(r),
      staat: !r.geoefendAt ? 'NOOIT GEOEFEND -- dit is een aanname, geen terugvalstand'
        : verouderd(r) ? 'langer dan ' + OEFEN_MAANDEN + ' maanden geleden geoefend' : 'geoefend en actueel' };
  }

  /* DE NOODKAART. Bewust plat, bewust kort, en bewust zonder enige berekening:
     dit is het blad dat je afdrukt. Wat NOOIT is geoefend staat bovenaan, want
     dat is het eerste wat je wilt weten op de dag dat je hem nodig hebt. */
  function noodkaart() {
    zorgStanden();
    const rij = Object.values(standen()).map(verrijk)
      .sort((a, b) => (a.geoefendAt ? 1 : 0) - (b.geoefendAt ? 1 : 0) || (a.geoefendAt || 0) - (b.geoefendAt || 0));
    const nooit = rij.filter(r => !r.geoefendAt).map(r => r.soort);
    return {
      status: 200,
      kop: 'NOODKAART RTG STAD -- wat doet de stad als dit platform er niet is',
      let_op: 'Dit blad rekent niets uit en heeft geen enkel ander deel van het systeem nodig. Druk hem af: op de dag dat je hem nodig hebt, kun je hem misschien niet opvragen.',
      nooitGeoefend: nooit,
      waarschuwing: nooit.length
        ? nooit.length + ' systeem/systemen zijn NOOIT geoefend (' + nooit.join(', ') + '). Voor die staat hieronder een aanname, geen terugvalstand.'
        : 'Alle vastgelegde terugvalstanden zijn minstens een keer echt geoefend.',
      systemen: rij,
      grondregel: 'RTG coördineert de stad; het is nooit haar enige zenuwstelsel. Elk systeem hierboven werkt zonder ons door, of stopt in een veilige stand.',
      zones: ZONES
    };
  }

  return {
    ZONES, STANDAARD, OEFEN_MAANDEN, zorgStanden, noodkaart, verrijk,
    api: {
      weefselNoodkaart: noodkaart,
      weefselTerugvalZet: zet,
      weefselOefening: oefen,
      /* NIET weefselZones: die naam was al bezet door de stadszones uit de
         geografie, en kern/stad leest daarmee zijn zonelijst. Een tweede
         functie met dezelfde naam had die stil overschreven -- de stad zou
         dan vertrouwenszones als zonenamen hebben gekregen. */
      weefselVertrouwenszones: () => ({ status: 200, zones: ZONES,
        let_op: 'Dit is de vastgelegde indeling waar de netwerkscheiding naar hoort te luisteren. De scheiding zelf hoort in de infrastructuur; een applicatie die beweert haar eigen netwerk te bewaken, bewaakt niets.' })
    }
  };
};

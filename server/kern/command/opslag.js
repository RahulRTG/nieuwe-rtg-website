/* ============================================================================
   HET OPSLAGCONTRACT VAN COMMAND -- de enige deur van dit domein naar db.data.

   Vijfde domein achter een contract, en het eerste dat de woordenschat van de
   vorige vier NIET aankon. Payroll, concern, veiligheid en mobiliteit hadden
   genoeg aan "wat bezit ik" en "wat lees ik van een ander". Command heeft vier
   soorten omgang met opslag, en ze door elkaar halen zou het contract juist een
   leugen maken. Daarom staan ze hier apart, met hun eigen naam:

     bak()               de VEERTIEN collecties die command bezit
     teller()            een GETAL, geen collectie -- het incidentnummer
     gedeeld.*           gedeeld en SCHRIJFBAAR: de schakelkast
     vreemd.*            van een ander en alleen LEZEND
     vak()               het standaardvak van de compartimentenlaag

   WAAROM `gedeeld` NIET HETZELFDE IS ALS `vreemd`. In de vorige vier contracten
   betekende `vreemd`: van een ander domein, en wij lezen alleen. Command SCHRIJFT
   in db.data.techniek.functies -- de schakelkast waarmee functies aan en uit
   gaan per land, per stad en per canary. Dat is niet stiekem: command IS het
   bedieningsvlak, en een bedieningsvlak dat de schakelkast niet mag bedienen
   heeft geen bestaansrecht. Maar het is ook niet van command: server/functies.js
   zegt met zoveel woorden dat de stand daar staat, en twintig bestanden buiten
   dit domein raken diezelfde collectie aan.

   Een contract dat dat `vreemd` zou noemen, zou liegen over de richting. Een
   contract dat het `bak` zou noemen, zou liegen over het eigendom. Vandaar een
   derde woord, en de belofte die eronder hoort is smaller: command bedient deze
   collectie, hij bezit hem niet, en wie de invarianten ervan zoekt vindt ze bij
   server/functies en niet hier.

   DRIE KOPIEEN VAN DEZELFDE ACCESSOR ZIJN ER EEN GEWORDEN. staat() -- twee
   regels die db.data.techniek.functies aanmaken -- stond in stadstart.js,
   landpakket.js en canary.js, alle drie woord voor woord gelijk, en een vierde
   keer in server/functies/wachter.js. Dit contract haalt de drie van command
   weg. De vierde blijft staan: wachter.js hoort bij de EIGENAAR van die
   collectie, en die verhuizen is werk in een domein dat nog geen contract heeft.
   Dat staat hier zodat het niet als vergeten leest.

   WAAROM vak() BESTAAT, EN WAAROM DAT GEEN GAT IS. Negen bestanden hier
   (journaal, operator, beleid, runbooks, sonde, zaken, register, mdm, mdmsamen)
   werken op een VAK: een houder waarin dezelfde sleutels worden bijgehouden.
   db.data is daar het standaardvak van, en een aanroeper mag een ander vak
   meegeven -- zo krijgt elke zaak zijn eigen journaalketen met zijn eigen zegel
   in plaats van dat alle zaken in een lijst schrijven waar ze elkaars regels
   zouden zien. Zie de kop van ./journaal.js.

   Die laag leest dus met OPZET collecties die pas bij naam bekend zijn als de
   configuratie ze noemt, en een vast register kan dat niet dekken zonder de
   voorziening kapot te maken. vak() geeft daarom het hele standaardvak terug.
   Dat is de zwakste plek van dit contract en hij hoort hardop genoemd: het is
   EEN deur met een naam en een reden, in plaats van negen zonder. Wie hier ooit
   een echte grens wil, moet eerst de vraag beantwoorden die eronder ligt --
   welke collecties mag een register tonen -- en dat is een bevoegdheidsvraag en
   geen opslagvraag.
   ========================================================================== */
'use strict';

/* ----------------------------------------------------------------------------
   WAT ER NIET IN ZIT, MET DE REDEN.
   ------------------------------------------------------------------------- */
const NIET_GEBOUWD = {
  schema: 'Veertien collecties tegelijk een schema geven vraagt per collectie een eigen ronde.',
  validatie: 'Hangt aan het schema en komt er niet voor.',
  bevoegdheid: 'Zit vandaag bij de ROUTE en bij ./toegang.js (rechten en mandaten), niet bij de ' +
    'opslag. Juist hier is dat scherp: vak() geeft een breed venster, en wie dat wil versmallen ' +
    'stelt een bevoegdheidsvraag. Die hoort bij de Authority Graph.',
  gebeurtenissen: 'server/bus.js vervoert wel maar spreekt geen taal (OS.md par. 4).',
  bewaartermijn: 'De bewaarlaag kent dit domein nog niet. commandIncidenten groeit onbegrensd.',
  vensterGrens: 'vak() geeft het hele standaardvak. Een grens daarop vraagt eerst een besluit ' +
    'over welke collecties een register mag tonen -- zie de kop hierboven.'
};

/* ----------------------------------------------------------------------------
   HET REGISTER. De veertien dingen die command BEZIT, met hun vorm.
   ------------------------------------------------------------------------- */
const REGISTER = {
  commandAlarmen:        { soort: 'kaart', wat: 'lopende alarmen van het bedieningsvlak' },
  commandProeven:        { soort: 'kaart', wat: 'uitslagen van de gezondheidsproeven' },
  commandRechten:        { soort: 'lijst', wat: 'wie mag wat in het bedieningsvlak' },
  commandMandaten:       { soort: 'lijst', wat: 'tijdelijke mandaten, met einddatum' },
  commandIncidenten:     { soort: 'lijst', wat: 'incidenten met hun tijdlijn' },
  commandIncidentTeller: { soort: 'getal', wat: 'het volgnummer voor RTG-0001, RTG-0002, ...' },
  commandClaims:         { soort: 'kaart', wat: 'wie een incident heeft opgepakt' },
  commandAgents:         { soort: 'kaart', wat: 'de agenten die meekijken, met hun laatste teken' },
  steden:                { soort: 'kaart', wat: 'per stad: staat RTG daar aan, en sinds wanneer' },
  landen:                { soort: 'kaart', wat: 'per land: welk pakket er draait' },
  zandbakken:            { soort: 'kaart', wat: 'losse compartimenten om iets te beproeven' },
  apiPoort:              { soort: 'kaart', wat: 'de stand van de API-poort per pad' },
  overnames:             { soort: 'kaart', wat: 'wanneer RTG een omgeving van een klant overnam' },
  bijstand:              { soort: 'lijst', wat: 'verzoeken om bijstand vanuit een werkruimte' }
};

const LEEG = { lijst: () => [], kaart: () => ({}), getal: () => 0 };

module.exports = function maakOpslag({ db }) {
  if (!db || !db.data) throw new Error('command/opslag: zonder db.data is er niets om te bewaren');

  function eis(naam, soorten) {
    const spec = REGISTER[naam];
    if (!spec) {
      throw new Error('command/opslag: "' + naam + '" staat niet in het register. ' +
        'Een collectie die nergens is opgeschreven, kan niemand verhuizen.');
    }
    if (soorten && !soorten.includes(spec.soort)) {
      throw new Error('command/opslag: "' + naam + '" is een ' + spec.soort +
        ' en hoort niet langs deze ingang.');
    }
    return spec;
  }
  const klopt = (soort, w) => soort === 'lijst' ? Array.isArray(w)
    : soort === 'getal' ? Number.isFinite(w)
    : (w && typeof w === 'object' && !Array.isArray(w));

  /* DE ENIGE PLEK WAAR EEN COMMAND-COLLECTIE ONTSTAAT. */
  function bak(naam) {
    const spec = eis(naam, ['lijst', 'kaart']);
    if (!klopt(spec.soort, db.data[naam])) db.data[naam] = LEEG[spec.soort]();
    return db.data[naam];
  }

  /* EEN GETAL IS GEEN COLLECTIE, en een bak() die er een teruggeeft zou het
     doen voorkomen alsof je hem kunt muteren. Dit is de enige teller die dit
     domein heeft; hij telt op en geeft de nieuwe stand terug. */
  function teller(naam, erbij) {
    const spec = eis(naam, ['getal']);
    if (!klopt(spec.soort, db.data[naam])) db.data[naam] = LEEG[spec.soort]();
    if (erbij) db.data[naam] = db.data[naam] + Number(erbij);
    return db.data[naam];
  }

  /* ----------------------------------------------------------------------------
     GEDEELD EN SCHRIJFBAAR. Command bedient deze collectie; server/functies.js
     bezit hem. Zie de kop voor waarom dat een eigen woord verdient.
     ------------------------------------------------------------------------- */
  const gedeeld = {
    /* MET EEN DUBBELE PUNT EN NIET ALS METHODE-KORTSCHRIFT, en dat is geen
       smaak. scripts/kruisscan.js (keuringsregel 9) zoekt met een tekstpatroon
       naar een naam die in een ZUSTERBESTAND op het hoogste niveau staat --
       hier `schakelkast` in ./gezondheid.js -- en slaat een sleutel met een
       dubbele punt over. Het kortschrift `schakelkast() {` glipt daar
       tussendoor en werd als kruis-slice-verwijzing gemeld terwijl het een
       SLEUTEL is en geen verwijzing. Die scanner is met opzet grof (zie zijn
       kop); hem het verschil leren vraagt een ontleder. Deze vorm kost niets
       en neemt de valse melding weg. */
    schakelkast: () => {
      const t = (db.data.techniek && typeof db.data.techniek === 'object')
        ? db.data.techniek : (db.data.techniek = {});
      const f = t.functies;
      return (f && typeof f === 'object' && !Array.isArray(f)) ? f : (t.functies = {});
    },
    /* Alleen lezen, maar wel dezelfde gedeelde collectie -- vandaar hier en
       niet bij `vreemd`, zodat er één plek is die techniek noemt. */
    techniek: () => (db.data.techniek && typeof db.data.techniek === 'object') ? db.data.techniek : {}
  };

  /* ----------------------------------------------------------------------------
     VAN EEN ANDER, EN ALLEEN LEZEND.
     ------------------------------------------------------------------------- */
  const vreemd = {
    /* ./bijstand-melden.js: bestaat deze werkruimte, en van wie is hij. */
    werkruimte: (code) => {
      const w = db.data.werkruimtes;
      if (!code || !w) return null;
      return Object.prototype.hasOwnProperty.call(w, code) ? w[code] : null;
    },
    /* ./lagen.js: welke voertalen staan aan. */
    talen: () => db.data.talen || { actief: [] }
  };

  /* Het STANDAARDVAK van de compartimentenlaag. Zie de kop: dit is met opzet
     breed, en het is de zwakste plek van dit contract. */
  const vak = () => db.data;

  return { bak, teller, gedeeld, vreemd, vak, REGISTER, NIET_GEBOUWD };
};

module.exports.REGISTER = REGISTER;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;

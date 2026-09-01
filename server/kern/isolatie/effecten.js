/* HET EFFECTMODEL -- isolatie gaat over wat er GEBEURT, niet over welk pad het doet.

   WAAROM DIT ER BOVENOP DE BESCHERMSTAND KOMT. kern/beschermstand.js bevriest
   per CATEGORIE uit de functiecatalogus, en dat werkt: het is één centrale lijst
   in plaats van duizend verspreide checks. Maar een categorie zegt waar iets
   woont, niet wat het doet. Zodra er een nieuw pad bij komt dat geld beweegt en
   in een categorie valt die doorloopt, is de grens weg zonder dat iemand iets
   heeft uitgezet. Een effectmodel keert dat om: een nieuw pad met dezelfde
   strekking valt vanzelf onder dezelfde grens.

   HIJ HANDHAAFT VANDAAG NIETS, EN DAT IS HET ONTWERP EN GEEN TEKORT.
   CONTROLPLANE.md: een nieuwe handhavingsregel loopt eerst mee in de schaduw --
   je kunt niet afdwingen wat nooit zonder te blokkeren heeft gedraaid. Deze
   laag rekent dus mee naast de beschermstand en meldt waar de twee het ONEENS
   zijn. Die lijst onenigheden is het werk; hem overslaan en meteen afdwingen is
   hoe je een platform op een dinsdagochtend stilzet.

   DE EFFECTEN ZIJN PLATFORMVERMOGEN EN GEEN DOMEINVERMOGEN. OS.md par. 4: één
   grammatica mag over "mag deze aanroep, en doet hij het?" en nooit over "wat
   voor zaak is dit". `GELD_BEWEGEN` staat er dus wel in en `bookings` niet --
   dat laatste is exact de `Asset`-fout, en die is hier al een keer gemaakt.

   DRIE GRADEN, EN DE DERDE IS DE BELANGRIJKSTE. Een pad draagt zijn effecten
   `verklaard` (iemand heeft ze opgeschreven, met een grond), `vermoed`
   (afgeleid uit de categorie van zijn functie) of `onbekend` (niets van beide).
   Een onbekend effect wordt NOOIT stil als "geen effect" gelezen: in de schaduw
   telt hij als een onenigheid, en zodra deze laag ooit handhaaft, hoort hij
   fail closed te gaan. Wie hier `[]` teruggeeft bij twijfel, heeft een meter
   gebouwd die alles goedkeurt wat hij niet begrijpt. */
'use strict';

/* ---------------------------------------------------------------------------
   DE WOORDENLIJST. Dertien effecten, en elk van hen beantwoordt de vraag "wat
   kan een aanvaller hiermee bereiken" en niet "in welk scherm zit dit".
   ------------------------------------------------------------------------ */
const EFFECTEN = Object.freeze({
  LEZEN_EIGEN:               'gegevens van de aanroeper zelf ophalen',
  SCHRIJVEN_EIGEN:           'gegevens van de aanroeper zelf wijzigen',
  SCHRIJVEN_ANDERMANS:       'gegevens wijzigen die van iemand anders zijn',
  EXTERN_BEREIKEN:           'een tweede persoon buiten RTG bereiken: mail, sms, publiceren, delen',
  VERTROUWENSRELATIE_AANGAAN:'een nieuwe blijvende koppeling: integratie, sleutel, webhook, apparaat, uitnodiging',
  RECHT_VERLENEN:            'iemand meer laten mogen dan daarvoor',
  IDENTITEIT_WIJZIGEN:       'wie iemand is of hoe hij binnenkomt',
  GELD_BEWEGEN:              'een bedrag verplaatsen, vastleggen of uitbetalen',
  BULK_UITVOER:              'veel gegevens tegelijk naar buiten',
  DERDENCODE_UITVOEREN:      'code draaien die niet van RTG is',
  ONVERTROUWDE_BYTES:        'bytes ontleden die van buiten komen: bestand, document, beeld',
  BEVEILIGING_VERZWAKKEN:    'een grens, stand, uitzondering of sleutel losser maken',
  UITGAANDE_AANROEP:         'zelf een verbinding naar buiten opzetten'
});
const NAMEN = Object.freeze(Object.keys(EFFECTEN));

/* ---------------------------------------------------------------------------
   WAT ELKE STAND SLUIT. Uitgedrukt in het paar uit ./ordening.js, want
   `beschermd` is een eigenschap en geen trede.
   ------------------------------------------------------------------------ */

/* De eigenschap `beschermd` sluit precies wat kern/beschermstand-lijst.js met
   zijn zes bevroren categorieën bedoelt: nieuwe bevoorrechte handelingen en
   mutaties van derden. Deze zes zijn de vertaling daarvan naar effecten, en het
   is die vertaling die de schaduwmeting toetst. */
const BESCHERMD_SLUIT = Object.freeze([
  'VERTROUWENSRELATIE_AANGAAN', 'RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN',
  'GELD_BEWEGEN', 'BEVEILIGING_VERZWAKKEN', 'SCHRIJVEN_ANDERMANS'
]);

/* De tredes. `waakzaam` sluit met opzet niets -- hij markeert, en een stand die
   stiekem toch iets sluit is de reden dat niemand hem meer vertrouwt.
   `beperkt` sluit gerícht per functie en niet structureel per effect; daarom
   staat hij hier leeg met de reden en niet met een lege lijst zonder uitleg. */
const TREDE_SLUIT = Object.freeze({
  normaal:  [],
  waakzaam: [],
  beperkt:  [],
  isolatie: NAMEN.filter(n => n !== 'LEZEN_EIGEN')
});
const TREDE_WAAROM = Object.freeze({
  waakzaam: 'waakzaam markeert en sluit niets; een stand die stilletjes toch iets sluit, wordt niet meer vertrouwd',
  beperkt:  'beperkt sluit gericht per functie en niet per effect; wat er dichtgaat staat in het incident zelf'
});

/* ---------------------------------------------------------------------------
   WAT PADEN VERKLAREN. Klein begonnen en met een grond per regel: een register
   dat in één ronde volloopt met vermoedens, is een register dat niemand meer
   durft af te dwingen.
   ------------------------------------------------------------------------ */
const VERKLAARD = Object.freeze([
  { patroon: /^\/api\/(pay|bank)\//,            effecten: ['GELD_BEWEGEN'],
    grond: 'alles achter kern/pay/poort.js beweegt of legt een bedrag vast' },
  { patroon: /^\/api\/appstore\/.*\/(start|draai|uitvoer)/, effecten: ['DERDENCODE_UITVOEREN'],
    grond: 'APPSTORE.md: derdencode draait in de cel, en dat is het effect' },
  { patroon: /^\/api\/techniek\//,              effecten: ['BEVEILIGING_VERZWAKKEN', 'RECHT_VERLENEN'],
    grond: 'de techniekhoek zet standen, schakelaars en zekeringen' },
  { patroon: /(zekering|incident|schakel|bevoegdheid|machtiging)/i, effecten: ['BEVEILIGING_VERZWAKKEN'],
    grond: 'zelfde strekking, ongeacht waar het pad woont -- dit is precies wat een effectmodel moet doen' },
  { patroon: /^\/api\/rtgid\//,                 effecten: ['IDENTITEIT_WIJZIGEN'],
    grond: 'RTG iD is de identiteit zelf' },
  { patroon: /(webhook|apikey|sleutel|oauth|sso|scim|koppel)/i, effecten: ['VERTROUWENSRELATIE_AANGAAN'],
    grond: 'elk van deze maakt een blijvende relatie met iets buiten de sessie' },
  { patroon: /(upload|bestand|document|foto|beeld|pdf|import)/i, effecten: ['ONVERTROUWDE_BYTES'],
    grond: 'hier komen bytes binnen die niemand van ons heeft geschreven' },
  { patroon: /(export|uitdraai|dump|archief)/i, effecten: ['BULK_UITVOER'],
    grond: 'veel gegevens tegelijk naar buiten is een eigen effect, ook als elk stuk apart mocht' }
]);

/* Wat een categorie uit de functiecatalogus VERMOEDELIJK doet. Uitdrukkelijk
   `vermoed`: de categorie zegt waar iets woont, en daaruit volgt hooguit een
   verwachting. Wie dit als verklaring leest, heeft de graad weggegooid. */
const PER_CATEGORIE = Object.freeze({
  'Toegang en identiteit':     ['RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN'],
  'Identiteit en veiligheid':  ['IDENTITEIT_WIJZIGEN'],
  'Betalen & verificatie':     ['GELD_BEWEGEN'],
  'Geld':                      ['GELD_BEWEGEN'],
  'Partners (leveranciers)':   ['SCHRIJVEN_ANDERMANS'],
  'Personeel & integraties':   ['SCHRIJVEN_ANDERMANS', 'VERTROUWENSRELATIE_AANGAAN'],
  'RTG-Backoffice':            ['SCHRIJVEN_ANDERMANS', 'BEVEILIGING_VERZWAKKEN']
});

/* ---------------------------------------------------------------------------
   DE AFLEIDING.
   ------------------------------------------------------------------------ */
function effectenVan(pad, methode, functie) {
  const p = String(pad || '');
  const uit = new Set();
  const gronden = [];
  for (const r of VERKLAARD) {
    if (!r.patroon.test(p)) continue;
    for (const e of r.effecten) uit.add(e);
    gronden.push(r.grond);
  }
  if (uit.size) {
    /* Lezen wordt er niet bij verzonnen: een GET die geld leest, beweegt geen
       geld. De methode snijdt de schrijfeffecten eruit. */
    const leest = /^(GET|HEAD|OPTIONS)$/i.test(String(methode || 'POST'));
    const effecten = leest ? ['LEZEN_EIGEN'] : [...uit];
    return { effecten, graad: 'verklaard', gronden, bron: 'kern/isolatie/effecten.js: VERKLAARD' };
  }
  const cat = functie && functie.categorie;
  if (cat && PER_CATEGORIE[cat]) {
    return { effecten: [...PER_CATEGORIE[cat]], graad: 'vermoed', gronden:
      ['afgeleid uit de categorie "' + cat + '" van zijn functie, en een categorie zegt waar iets woont'],
      bron: 'kern/isolatie/effecten.js: PER_CATEGORIE' };
  }
  /* GEEN LEGE LIJST. Een leeg antwoord leest als "dit doet niets", en dat is
     de gevaarlijkste zin in een beveiligingslaag. */
  return { effecten: null, graad: 'onbekend', gronden:
    ['geen verklaring en geen categorie met een vermoeden; dit pad heeft geen effectprofiel'],
    bron: null };
}

/* Wat een stand sluit, uitgedrukt in effecten. */
function sluit(stand) {
  const trede = stand && stand.trede;
  const uit = new Set(TREDE_SLUIT[trede] || []);
  if (stand && stand.beschermd) for (const e of BESCHERMD_SLUIT) uit.add(e);
  return [...uit];
}

/* Het schaduwoordeel. `onbekend` is met opzet een eigen uitkomst naast ja en
   nee: een laag die niet weet wat een pad doet, hoort dat te zeggen en niet te
   stemmen. */
function schaduwOordeel({ pad, methode, functie, stand }) {
  const prof = effectenVan(pad, methode, functie);
  const dicht = sluit(stand);
  if (prof.graad === 'onbekend') {
    return { oordeel: 'onbekend', effecten: null, graad: prof.graad, geraakt: [],
      waarom: 'dit pad heeft geen effectprofiel; er valt niets te wegen' };
  }
  const geraakt = prof.effecten.filter(e => dicht.includes(e));
  return {
    oordeel: geraakt.length ? 'tegenhouden' : 'doorlaten',
    effecten: prof.effecten, graad: prof.graad, gronden: prof.gronden, geraakt,
    waarom: geraakt.length
      ? 'deze stand sluit ' + geraakt.join(' en ')
      : 'geen van de effecten van dit pad staat dicht in deze stand'
  };
}

module.exports = { EFFECTEN, NAMEN, BESCHERMD_SLUIT, TREDE_SLUIT, TREDE_WAAROM,
  VERKLAARD, PER_CATEGORIE, effectenVan, sluit, schaduwOordeel };

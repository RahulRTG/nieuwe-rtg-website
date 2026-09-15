/* ============================================================================
   DE NAMENSPROJECTIE -- één taal voor audit, beleid en conflictcontrole, zonder
   dat de zeven mechanismen iets van elkaar overnemen. REPRESENTATIE.md par. 1
   en 3.1.

   DE VELDNAMEN ZIJN NIET VERZONNEN EN NIET NIEUW. `kern/economie/runtime/
   intent.js` draagt ze al: `principalRef`, `actingRef`, `purpose`, en
   `authorityRef` binnen `authorizationContext`. Vijf van de zes velden die deze
   laag nodig heeft bestaan daar onder exact die naam; alleen `mechanism`
   ontbreekt, en dat is ook het enige woord uit deze familie dat in dit hele
   huis nog vrij was (NAMENSVORM.json). Deze laag neemt die namen dus OVER in
   plaats van er een tweede stel naast te zetten.

   EN DIT IS GEEN UITBREIDING VAN DIE RUNTIME -- dat is de grens die eronder
   ligt. Die runtime bestaat om een bevestigde betaling te verdelen, en alleen
   `settlement.js` mag daar extern geld verplaatsen. Wie hem verbreedt tot de
   algemene representatielaag maakt van een geldmotor een bevoegdheidsmotor, en
   dat is precies de vermenging die WAARDE.md en GELD.md tegenhouden. Er loopt
   hier dan ook geen enkele require naar `kern/economie/`: wat gedeeld wordt is
   de TAAL en niet de machine. Twee lagen die dezelfde woorden gebruiken kunnen
   naast elkaar leven; twee lagen die elkaars code aanroepen niet.

   WAT EEN PROJECTIE IS EN WAT ZIJ NOOIT IS. Zij is een AFGELEIDE: elk mechanisme
   houdt zijn eigen object, zijn eigen namen en zijn eigen levenscyclus, en
   levert aan de grens deze zes velden. Er ontstaat geen tweede opslag en geen
   tweede waarheid -- dezelfde vorm als kern/levensgraaf/graaf.js, die om
   dezelfde reden een projectie is en geen `humans`-tabel (HDI.md par. 5.1).
   Daarom kent dit bestand ook geen db: het VORMT en het bewaart niet.

   DRIE DINGEN DIE HIER IN CODE STAAN EN NIET IN EEN AFSPRAAK:

   1. DE REFERENTIES ZIJN CODENAMEN. Niet als stijlafspraak maar als de
      privacyopzet van dit huis: klantdata draait op codenamen, echte namen
      wonen in de gescheiden kluis. Deze projectie is per definitie de vorm die
      naar een journaal, een conflictcontrole en straks een cockpit reist, en
      dat is precies waar een echte naam ongemerkt uit lekt. De zeef is
      `keurActor` uit kern/envelop.js -- HERGEBRUIKT en niet nagebouwd, want een
      tweede zeef loopt binnen een maand achter op de eerste (LAT.md regel 4).

   2. `mechanism` KOMT UIT DE GESLOTEN LIJST van ./verklaring.js. Een vrij
      tekstveld zou van deze projectie een vergaarbak maken waarin elk domein
      zijn eigen woord zet, en dan kun je er nooit meer over alle zeven dezelfde
      vraag stellen -- wat de hele reden is dat zij bestaat.

   3. `purpose` IS VERPLICHT EN WORDT NIET GERADEN. Een handeling namens iemand
      anders zonder opgegeven doel is precies wat doelbinding onmogelijk maakt
      (kern/identiteit/doelen.js). Ontbreekt hij, dan weigert deze laag -- hij
      vult geen `onbekend` in, want een veld dat stilletjes wordt gevuld leest
      later als een antwoord.
   ========================================================================== */
'use strict';

const { keurActor } = require('../envelop');
const { VERKLARING } = require('./verklaring');

/* De zes velden, met per stuk waar de naam vandaan komt. Die herkomst staat
   erbij zodat wie er een zevende bij wil zetten ziet welke afspraak hij raakt. */
const VELDEN = Object.freeze({
  principalRef: 'NAMENS WIE er gehandeld wordt -- de vertegenwoordigde. Naam uit kern/economie/runtime.',
  actingRef: 'WIE er handelt -- de vertegenwoordiger. Naam uit kern/economie/runtime (`actingRef`).',
  mechanism: 'LANGS WELKE weg die bevoegdheid loopt. Het enige nieuwe veld, en de enige vrije naam.',
  authorityRef: 'WAAROP de bevoegdheid rust: de machtiging, het mandaat, de sessie. Naam uit ' +
    'kern/economie/runtime (`authorizationContext.authorityRef`).',
  purpose: 'WAARVOOR. Naam uit kern/economie/runtime; de gronden staan in kern/identiteit/doelen.js.',
  capability: 'WELKE bevoegdheid. Optioneel: een projectie van een RELATIE noemt er geen, een ' +
    'projectie van een HANDELING wel.'
});

const VERPLICHT = Object.freeze(['principalRef', 'actingRef', 'mechanism', 'authorityRef', 'purpose']);

/* Een referentie nakijken. Geeft een reden terug in plaats van te gooien: deze
   laag wordt straks door zeven mechanismen aangeroepen en een uitzondering die
   door een `catch` wordt opgegeten is precies de stille faalvorm waar
   MENSNETWERK.md par. 0.6 over gaat. */
function keurRef(waarde, veld) {
  const s = String(waarde == null ? '' : waarde).trim();
  if (!s) return { fout: veld + ' ontbreekt. Deze projectie vult niets in wat niet is opgegeven.' };
  try {
    /* keurActor GOOIT bij een contactgegeven -- zie kern/envelop.js. Hier wordt
       dat een nette weigering, want de aanroeper is geen gebeurtenisbus maar
       een mechanisme dat een antwoord verwacht. */
    const ok = keurActor(s);
    if (!ok) return { fout: veld + ' is leeg na opschonen.' };
    return { waarde: ok };
  } catch (e) {
    return { fout: veld + ': ' + e.message + '. Op deze projectie hoort een codenaam; echte namen ' +
      'blijven in de identiteitskluis.' };
  }
}

/* VORM: maakt van losse gegevens een projectie, of zegt waarom niet. Weigert
   liever dan dat hij aanvult -- een stilletjes ingevuld veld is een antwoord
   dat niemand heeft gegeven.

   HIJ HEET GEEN `projecteer`, en dat is met opzet. Die naam woont al in
   kern/fiscaal/jaargangen.js (een datum naar een jaargang) en in
   kern/experience/projections.js -- en die tweede projecteert een context MET
   een `economicPrincipalRef` erin. Drie functies die `projecteer` heten en drie
   dingen doen, is exact de kostenpost die SEMANTIEK.json meet, en juist hier
   zou de verwarring het duurst zijn omdat het aangrenzend gebied is. Dezelfde
   reden waarom kern/carriereledger/index.js zijn schrijver `schrijfRegel` noemt
   en niet `noteer`. */
function projecteerNamens(invoer) {
  const i = invoer || {};
  const uit = {};

  const mech = String(i.mechanism || '').trim();
  if (!mech) return { error: '`mechanism` ontbreekt. Zonder mechanisme is later niet te zien langs ' +
    'welke weg deze bevoegdheid liep, en dat is de vraag die deze projectie moet kunnen beantwoorden.' };
  if (!Object.prototype.hasOwnProperty.call(VERKLARING, mech)) {
    return { error: 'onbekend mechanisme `' + mech + '`. De lijst is gesloten en staat in ' +
      'kern/namens/verklaring.js; een achtste mechanisme verklaart zich daar eerst.' };
  }
  uit.mechanism = mech;

  for (const veld of ['principalRef', 'actingRef', 'authorityRef']) {
    const r = keurRef(i[veld], veld);
    if (r.fout) return { error: r.fout };
    uit[veld] = r.waarde;
  }

  const doel = String(i.purpose || '').trim();
  if (!doel) return { error: '`purpose` ontbreekt. Een handeling namens iemand anders zonder ' +
    'opgegeven doel maakt doelbinding onmogelijk, en deze laag raadt er geen.' };
  if (doel.length > 120) return { error: '`purpose` is te lang; noem het doel en niet de toelichting.' };
  uit.purpose = doel;

  /* `capability` is optioneel en met opzet: een projectie van een RELATIE
     ("deze mens vertegenwoordigt die mens") noemt geen bevoegdheid, een
     projectie van een HANDELING wel. Eén vorm voor allebei, en het verschil
     leest een mens aan de aanwezigheid van dit veld. */
  if (i.capability != null && String(i.capability).trim()) {
    const c = String(i.capability).trim();
    if (c.length > 80) return { error: '`capability` is te lang voor een sleutel.' };
    uit.capability = c;
  }

  return { projectie: Object.freeze(uit) };
}

/* DE ZELFPROJECTIE IS EEN FOUT EN GEEN RANDGEVAL. Iemand die namens zichzelf
   handelt heeft geen machtiging nodig; verschijnt hij toch in deze vorm, dan is
   er ergens een gever met een ontvanger verward. kern/vertegenwoordiging/
   weigert dat al bij het voorstellen ("U kunt uzelf niet machtigen"); hier staat
   dezelfde regel op de projectie, zodat een mechanisme dat hem mist alsnog
   tegen een muur loopt. */
function zelfprojectie(p) {
  return !!(p && p.principalRef && p.principalRef === p.actingRef);
}

/* Wat er van deze projectie naar buiten mag. Vandaag is dat alles -- er staat
   met opzet niets gevoeligs in -- en deze functie bestaat om dat EXPLICIET te
   maken in plaats van impliciet: wie er een veld bij zet, komt hier langs en
   moet beslissen of het mee naar buiten gaat. */
function publiek(p) {
  if (!p) return null;
  const uit = { mechanism: p.mechanism, principalRef: p.principalRef, actingRef: p.actingRef,
    authorityRef: p.authorityRef, purpose: p.purpose };
  if (p.capability) uit.capability = p.capability;
  return uit;
}

module.exports = { projecteerNamens, publiek, zelfprojectie, keurRef, VELDEN, VERPLICHT };

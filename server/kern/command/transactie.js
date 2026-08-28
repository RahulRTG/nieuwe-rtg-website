/* HERSTEL ALS TRANSACTIE -- een reparatie die zelf een tweede storing kan maken
   zonder weg terug, is geen reparatie maar een gok.

   ./runbooks.js had de helft hiervan al: elke wijziging draagt zijn oude waarde
   mee, dus terugdraaien is hetzelfde mechanisme omgekeerd. Wat ontbrak zijn de
   twee stappen eromheen, en dat zijn precies de twee die een herstelknop
   normaal gesproken niet heeft:

     voorcontrole   mag dit nu, op deze schaal, met deze weg terug?
     verificatie    is het werkelijk gelukt -- positief nagekeken?

   De keten is dus VOORCONTROLE -> MOMENTOPNAME -> UITVOEREN -> VERIFICATIE ->
   VASTLEGGEN, en bij een mislukte verificatie automatisch TERUG. De twee
   poorten zelf staan in ./transactie-poorten.js.

   DE MOMENTOPNAME WORDT HIER NIET NAGEBOUWD. `run.geraakt` draagt per object de
   oude waarde, en bij deze vorm van wijziging (één veld op één object) is dat
   een volledige momentopname. Een tweede kopie ernaast zou op een dag iets
   anders zeggen dan de eerste.

   DROOG DRAAIEN BLIJFT DROOG. Een droogloop voert de voorcontrole wél uit en
   rapporteert hem -- dat is juist hoe je erachter komt of hij houdt -- maar hij
   wordt er niet door tegengehouden, en er valt niets te verifiëren.

   WAT HIER (NOG) NIET DOORHEEN LOOPT: de zaak-kant. kern/zaakcommand/ draait
   dezelfde recepten op zijn eigen register en roept ./runbooks.js rechtstreeks
   aan. Deze module is er op voorbereid -- register, db en gezondheid gaan er
   als parameter in -- maar de bedrading ligt er niet. Dat staat zo in
   BESTUUR.md en niet als stille aanname dat het overal geldt. */
'use strict';

const klok = require('../../lib/klok');

const poorten = require('./transactie-poorten');
const { NIVEAUS } = require('./risico');

/* Zonder certificaat draait een recept gewoon, maar dan zonder bovengrens en
   met alleen de universele verificatie. Een standaardcertificaat verzinnen zou
   een ongecertificeerd recept laten lezen als een gecertificeerd recept. */
function certificaatVan(rb) {
  const c = rb && rb.certificaat;
  if (c) return Object.assign({ ongecertificeerd: false }, c);
  return { ongecertificeerd: true, versie: 0, maxObjecten: null,
    terugweg: rb && rb.terugDraaibaar ? 'handmatig' : 'geen',
    verificaties: ['veld-staat-op-doel'],
    waarom: 'dit recept draagt geen certificaat: er is geen bovengrens afgesproken en de weg terug is ' +
      'alleen wat terugDraaibaar zegt' };
}

function maakTransactie({ db, runbooks, register, journaal, gezondheid }) {
  const voorcontrole = (rb, cert) => poorten.voorcontrole({ rb, cert, runbooks, gezondheid });
  const verifieer = (rb, cert, geraakt) => poorten.verifieer({ rb, cert, geraakt, register, db });

  function draai(id, opties) {
    const o = opties || {};
    const rb = runbooks.OP_ID.get(String(id));
    if (!rb) return { error: 'Dat runbook bestaat niet: ' + id, status: 404 };
    const cert = certificaatVan(rb);
    const droog = o.droog !== false;
    const voor = voorcontrole(rb, cert);

    if (!droog && !voor.mag) {
      return { error: 'De voorcontrole houdt dit tegen: ' + voor.blokkerend.map(b => b.waarom).join('; '),
        status: 409, certificaat: cert, voorcontrole: voor };
    }

    const r = runbooks.voer(String(id), o);
    if (r && r.error) return Object.assign({ certificaat: cert, voorcontrole: voor }, r);

    if (droog) {
      return { certificaat: cert, voorcontrole: voor, droog: true,
        verificatie: { goed: null, nietVanToepassing: true,
          waarom: 'een droogloop verandert niets, dus er valt niets te verifiëren' },
        keten: ['voorcontrole', 'droogloop'],
        run: r.run, oordeel: r.oordeel, overgeslagen: r.overgeslagen };
    }

    const vol = runbooks.run(r.run.id);
    const ver = verifieer(rb, cert, vol && vol.geraaktVolledig);

    /* TERUG BIJ EEN MISLUKTE VERIFICATIE, en alleen als het certificaat die weg
       belooft. Een automatische terugdraaiing op een recept dat daar niet voor
       staat, zou een tweede ongeplande wijziging zijn bovenop de eerste. */
    let terug = null;
    if (ver.goed === false && cert.terugweg === 'automatisch' && rb.terugDraaibaar) {
      terug = runbooks.draaiTerug(r.run.id, o.door || 'transactie',
        'de verificatie mislukte: ' + ver.waarom);
    }

    /* De uitslag terug op de ronde, zodat de runlijst hem later nog draagt.
       Een verificatie die alleen in het antwoord van dit ene verzoek bestaat,
       is morgen weg -- en dan staat er in de historie een ronde zonder bewijs
       dat er ooit is nagekeken. */
    runbooks.noteerVerificatie(r.run.id, { goed: ver.goed, waarom: ver.waarom,
      nietVanToepassing: !!ver.nietVanToepassing, at: klok.datum().toISOString() });

    journaal.noteer({ actor: o.door || 'transactie', actie: 'herstel verifiëren',
      objectType: 'runbook', objectId: rb.id, niveau: NIVEAUS.assist,
      reden: ver.goed === null ? 'niets geraakt, dus niets te verifiëren'
        : ver.goed ? 'verificatie geslaagd' : 'verificatie mislukt: ' + ver.waarom,
      voor: { geraakt: r.run.geraakt },
      na: { verificatie: ver.goed, teruggedraaid: !!(terug && !terug.error) } });

    return { certificaat: cert, voorcontrole: voor, verificatie: ver,
      teruggedraaid: terug && !terug.error ? terug : null,
      terugMislukt: terug && terug.error ? terug.error : null,
      run: r.run, oordeel: r.oordeel, overgeslagen: r.overgeslagen,
      keten: ['voorcontrole', 'momentopname', 'uitvoeren', 'verificatie',
        ver.goed === false ? (terug && !terug.error ? 'terug' : 'terug mislukt') : 'vastleggen'] };
  }

  return { draai, voorcontrole, verifieer, certificaatVan };
}

module.exports = { maakTransactie, certificaatVan };

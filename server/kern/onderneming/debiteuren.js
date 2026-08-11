/* DE DEBITEUREN: wie moet u nog betalen, en hoe lang al.

   De facturatie bestond al (kern/facturatie): nummers, btw, een PDF, per zaak
   uitgaand en inkomend. Wat er niet was, is de vraag die elke ondernemer stelt
   zodra hij op rekening werkt: WAT STAAT ER NOG OPEN. Facturen droegen geen
   betaalstatus, dus gold elke factuur impliciet als afgedaan en bestond er geen
   debiteurenlijst.

   DE GESCHIEDENIS TELT ALS BETAALD, EN DAT IS EXPLICIET. Facturen van voor deze
   laag hebben geen `betaald`-veld. Zou "geen veld" als open gelden, dan stond
   morgen alles wat ooit is gefactureerd op de debiteurenlijst: een alarm dat
   niets betekent, en precies daarom binnen een week niet meer gelezen wordt.
   `betaald !== false` is dus de lezing, dezelfde grandfathering als bij
   kern/ondernemerpoort.js (`online !== false`).

   DE OUDERDOMSGROEPEN ZIJN GETELD, NIET GEWOGEN. Een factuur valt in precies
   een groep op grond van hoeveel dagen hij over zijn vervaldatum is. Er komt
   geen score uit en geen voorspelling: "betalingsrisico" zou hier een getal zijn
   dat op niets rust -- wij zien alleen deze zaak, niet het betaalgedrag van die
   klant elders. Wat er wel staat is wat er staat.

   ALLES OP CODENAAM, net als het klantenboek: de debiteurenlijst is bij uitstek
   de plek waar iemand een echte naam zou willen zetten. */
'use strict';

/* Het rekenwerk (dagen over, de groepsgrenzen, het indelen) staat in
   ./ouderdom.js, gedeeld met de crediteuren. Wat WEL hier hoort zijn de
   teksten: bij een debiteur is "bel de klant" het advies, bij een crediteur
   dreigt de levering stil te vallen. De grenzen zijn rekenkunde en dus
   gedeeld; het advies is dat niet. */
const OUD = require('./ouderdom');

const TEKSTEN = {
  loopt: { label: 'Loopt nog', wat: 'Nog niet vervallen.' },
  net: { label: '1 tot 14 dagen over', wat: 'Een vriendelijke herinnering is meestal genoeg.' },
  lang: { label: '15 tot 30 dagen over', wat: 'Bel. Een tweede mail leest niemand.' },
  zeer: { label: '31 tot 60 dagen over', wat: 'Spreek een regeling af, of zet de levering stil.' },
  oud: { label: 'Meer dan 60 dagen over', wat: 'Hoe ouder, hoe kleiner de kans. Handel nu.' }
};

const rond = (n) => Math.round(n * 100) / 100;

/* De opvolgregel voor het dagbeeld. Alleen als er echt iets vervallen is:
   openstaande facturen die nog gewoon lopen zijn geen actie maar de normale
   gang van zaken. */
function debiteurenOpvolging(d) {
  if (!d || !d.vervallenAantal) return null;
  return {
    id: 'debiteuren', soort: 'factuur', aantal: d.vervallenAantal,
    kop: d.vervallenAantal + ' factu' + (d.vervallenAantal === 1 ? 'ur is' : 'ren zijn') +
      ' vervallen (' + Math.round(d.vervallenBedrag) + ' euro)',
    waarom: d.oudste
      ? 'De oudste staat ' + d.oudste.dagenOver + ' dagen open. Hoe ouder een post, hoe kleiner de kans dat hij nog binnenkomt.'
      : 'Geld dat u al verdiend heeft, maar nog niet heeft.'
  };
}

module.exports = ({ db }) => {

  const alle = () => (Array.isArray(db.data.facturen) ? db.data.facturen : []);
  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  /* Wat deze zaak heeft verstuurd en nog niet binnen is. Zie de kop voor de
     lezing van `betaald`. */
  function openVan(code) {
    return alle().filter(f => f && f.verkoper && f.verkoper.code === code && f.betaald === false);
  }

  function debiteuren(o, nuMs) {
    const s = zaakVan(o);
    if (!s) return null;
    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();

    const open = openVan(s.code).map(f => ({
      id: f.id, nummer: f.nummer, klant: f.koper.codenaam || f.koper.naam || null,
      totaal: f.totaal, datum: f.datum, vervaldatum: f.vervaldatum || null
    }));
    const ing = OUD.deelIn(open, nuT, TEKSTEN);

    return {
      zaak: s.code,
      aantal: open.length,
      bedrag: rond(open.reduce((n, f) => n + (Number(f.totaal) || 0), 0)),
      vervallenAantal: ing.vervallen.length,
      vervallenBedrag: ing.vervallenBedrag,
      groepen: ing.groepen,
      oudste: ing.oudste,
      /* `posten` is de SCHERMLIJST en op vijftig afgekapt; `alle` is de
         volledige verzameling om mee te REKENEN. Dat onderscheid ontbrak, en
         kern/onderneming/kas.js telde daardoor over de afgekapte lijst. Erger
         nog: die lijst staat gesorteerd op meest vervallen, dus wat er nog
         netjes bij loopt viel er als eerste af -- precies wat de kas als
         inkomend zoekt. Een zaak met meer dan vijftig openstaande facturen
         kreeg zo een te lage kasbeweging, en daar hangt een waarschuwing aan
         waar iemand een besluit op neemt. */
      posten: ing.rijen.slice(0, 50),
      alle: ing.rijen,
      zonderVervaldatum: ing.zonderVervaldatum,
      voorbehoud: 'Alleen facturen die als onbetaald zijn aangemerkt tellen mee. Facturen van voor deze laag dragen geen betaalstatus en gelden als betaald.'
    };
  }

  return { DEBITEUREN_TEKSTEN: TEKSTEN, debiteuren, debiteurenOpvolging };
};

module.exports.TEKSTEN = TEKSTEN;
module.exports.debiteurenOpvolging = debiteurenOpvolging;
/* Doorgegeven vanuit ./ouderdom.js: de toetsen en de crediteuren gebruiken
   dezelfde rekenkern, en die hoort maar op een plek te staan. */
module.exports.dagenOver = OUD.dagenOver;
module.exports.groepVan = OUD.groepVan;

/* DE RUNBOOK-CATALOGUS -- welke herstelrecepten er zijn, en welke velden een
   runbook nooit mag aanraken.

   Dit staat apart van de motor (./runbooks.js) omdat het GEGEVENS zijn en geen
   werking: wie een recept toevoegt, verandert wat RTG kan herstellen, niet hoe
   herstellen werkt. Die twee horen niet in hetzelfde bestand te groeien.

   BEVROREN is hier de zwaarste regel. Een veld dat een identiteit, een bedrag
   of een toegangsrecht draagt, hoort bij handelingen die per definitie een mens
   vragen -- en een runbook is juist het pad dat zonder mens kan lopen. De motor
   controleert deze lijst bij het UITVOEREN en niet bij het opschrijven: een
   grendel die alleen bij het schrijven van de catalogus knijpt, staat open voor
   alles wat er al in stond. */
'use strict';

const { s } = require('./register');

const BEVROREN = new Set(['id', 'code', 'key', 'codenaam', 'codename', 'email', 'iban', 'total', 'amount',
  'centen', 'bedrag', 'prijs', 'price', 'rate', 'tier', 'rol', 'rollen', 'rechten', 'paid']);

/* De runbooks zelf. Elk: waar hij op past (soort + voorwaarde), wat hij doet,
   en of hij terug te draaien is. Ze staan hier omdat ze productafspraken zijn
   en geen gegevens -- wie er een toevoegt, doet dat met een toets ernaast. */
const RUNBOOKS = [
  { id: 'rit-vast-hervatten', naam: 'Vastgelopen rit hervatten',
    wat: 'Een rit die op "vast" of "fout" staat terugzetten op "gepland", zodat de dispatch hem opnieuw oppakt.',
    type: 'rit', veld: 'status', naar: 'gepland', past: r => ['vast', 'fout', 'gestrand'].includes(s(r.status)),
    actie: 'route wijzigen', oorzaak: 'rit vastgelopen', terugDraaibaar: true, klantImpact: false },

  { id: 'voertuig-uit-dienst', naam: 'Storend voertuig uit dienst nemen',
    wat: 'Een voertuig met storingsmelding op "uit dienst" zetten zodat er geen ritten meer op worden gepland.',
    type: 'voertuig', veld: 'staat', naar: 'uit dienst', past: r => ['storing', 'defect'].includes(s(r.staat)),
    actie: 'voertuig uit dienst', oorzaak: 'voertuigstoring', terugDraaibaar: true, klantImpact: true },

  { id: 'bestelling-opnieuw', naam: 'Mislukte bestelling opnieuw aanbieden',
    wat: 'Een bestelling die op "mislukt" staat terugzetten op "in behandeling" zodat de keten hem opnieuw verwerkt.',
    type: 'bestelling', veld: 'status', naar: 'in behandeling', past: r => ['mislukt', 'fout'].includes(s(r.status)),
    actie: 'betaling opnieuw', oorzaak: 'verwerking mislukt', terugDraaibaar: true, klantImpact: true },

  { id: 'boeking-herstellen', naam: 'Afgebroken boeking herstellen',
    wat: 'Een boeking die halverwege bleef steken terugzetten op "aangevraagd".',
    type: 'boeking', veld: 'status', naar: 'aangevraagd', past: r => ['afgebroken', 'fout'].includes(s(r.status)),
    actie: 'boeking herstellen', oorzaak: 'boeking afgebroken', terugDraaibaar: true, klantImpact: true },

  { id: 'melding-afsluiten', naam: 'Afgehandelde melding sluiten',
    wat: 'Een melding die als opgelost is gemarkeerd maar nog openstaat, sluiten.',
    type: 'melding', veld: 'status', naar: 'gesloten', past: r => s(r.status) === 'opgelost',
    actie: 'melding sluiten', oorzaak: 'melding blijft open', terugDraaibaar: true, klantImpact: false }
];

const OP_ID = new Map(RUNBOOKS.map(r => [r.id, r]));

module.exports = { RUNBOOKS, OP_ID, BEVROREN };

/* DE SOORTEN VAN EEN WERKRUIMTE -- de tabel, los van de bouwer.

   Waarom apart: samen met ./register.js komt dit over de 10 kB uit check.js
   regel 13. De naad is echt en niet gekunsteld -- hier staat WAT een werkruimte
   kent, daar staat HOE dat een gescoped register wordt.

   ELKE SOORT DRAAGT ZIJN RECHT. Dat is geen etiket maar de scope-as van deze
   laag: ./register.js LAAT een soort WEG als het lid dat recht niet heeft. Niet
   filteren, weglaten -- zie de kop van dat bestand voor waarom dat verschil
   hier alles is.

   `veld` is de sleutel op het werkruimte-object (db.data.werkruimtes[CODE]).
   Alle bakken zijn objecten op id, geen arrays; de lezer maakt er rijen van.

   BEDRAGEN ZIJN CENTEN. Overal in deze laag, want alles in het Werk OS is
   centen. Dat is dezelfde eenheid die kern/frictie/motor.js verwacht als het
   een bedrag tegen `risico.geldGrensCenten` houdt; een register dat hier euro's
   in stopte zou een grens van 500 euro pas bij 50.000 laten aanslaan. */
'use strict';

const { s, eerste } = require('../command/register');

const bij = (...v) => v.filter(Boolean).join(' · ');
const getal = (v) => Number(v || 0);

const SOORTEN = [
  { type: 'project', label: 'Project', meervoud: 'projecten', domein: 'projecten', recht: 'project',
    veld: 'projecten', sleutel: 'id', zoek: ['id', 'naam', 'status', 'eigenaar', 'werkvorm'],
    titel: r => eerste(r, 'naam', 'id'), sub: r => bij(s(r.status), s(r.eigenaar)),
    bedrag: r => getal(r.budgetCenten) },

  { type: 'taak', label: 'Taak', meervoud: 'taken', domein: 'projecten', recht: 'project',
    veld: 'taken', sleutel: 'id', zoek: ['id', 'titel', 'kolom', 'wie', 'prioriteit'],
    titel: r => eerste(r, 'titel', 'id'), sub: r => bij(s(r.kolom), s(r.wie), s(r.deadline)) },

  /* Vervallen artikelen blijven in het register staan. De kennisbank zelf laat
     ze uit haar ZOEKUITSLAG (een oud besluit is nooit meer het antwoord) maar
     niet uit de inzage, en juist hun `vorigeId`/`opgevolgdDoorId` dragen de
     vraag "waarom staat dit er nu zo". De stand staat in `sub`, zodat een oude
     versie nooit als geldig leest. */
  { type: 'kennis', label: 'Kennisartikel', meervoud: 'kennis', domein: 'kennis', recht: 'kennis',
    veld: 'kennis', sleutel: 'id', zoek: ['id', 'titel', 'soort', 'eigenaar'],
    titel: r => eerste(r, 'titel', 'id'),
    sub: r => bij(s(r.soort), 'versie ' + s(r.versie), r.vervallen ? 'vervallen' : '', s(r.eigenaar)),
    zeef: (r, rechten) => !r.recht || rechten.includes(r.recht) },

  { type: 'klant', label: 'Klant', meervoud: 'klanten', domein: 'verkoop', recht: 'klant',
    veld: 'klanten', sleutel: 'id', zoek: ['id', 'naam', 'branche', 'land', 'kvk', 'eigenaar'],
    titel: r => eerste(r, 'naam', 'id'), sub: r => bij(s(r.branche), s(r.land), s(r.eigenaar)) },

  { type: 'kans', label: 'Verkoopkans', meervoud: 'kansen', domein: 'verkoop', recht: 'klant',
    veld: 'kansen', sleutel: 'id', zoek: ['id', 'titel', 'klant', 'fase', 'eigenaar', 'product'],
    titel: r => eerste(r, 'titel', 'id'), sub: r => bij(s(r.klant), s(r.fase), s(r.eigenaar)),
    bedrag: r => getal(r.bedragCenten) },

  { type: 'ticket', label: 'Ticket', meervoud: 'tickets', domein: 'service', recht: 'service',
    veld: 'tickets', sleutel: 'id', zoek: ['id', 'onderwerp', 'status', 'prioriteit', 'melder', 'wie'],
    titel: r => eerste(r, 'onderwerp', 'id'), sub: r => bij(s(r.status), s(r.prioriteit), s(r.wie)) },

  { type: 'storing', label: 'Storing', meervoud: 'storingen', domein: 'service', recht: 'service',
    veld: 'storingen', sleutel: 'id', zoek: ['id', 'wat', 'ernst'],
    titel: r => eerste(r, 'wat', 'id'),
    sub: r => bij(s(r.ernst), r.opgelostAt ? 'opgelost' : 'loopt') },

  { type: 'repo', label: 'Repository', meervoud: 'repositories', domein: 'bouw', recht: 'bouw',
    veld: 'repos', sleutel: 'id', zoek: ['id', 'naam', 'taal', 'eigenaar'],
    titel: r => eerste(r, 'naam', 'id'), sub: r => bij(s(r.taal), s(r.eigenaar)) },

  { type: 'issue', label: 'Issue', meervoud: 'issues', domein: 'bouw', recht: 'bouw',
    veld: 'issues', sleutel: 'id', zoek: ['id', 'titel', 'soort', 'status', 'wie'],
    titel: r => eerste(r, 'titel', 'id'), sub: r => bij(s(r.soort), s(r.status), s(r.wie)) },

  { type: 'release', label: 'Release', meervoud: 'releases', domein: 'bouw', recht: 'bouw',
    veld: 'releases', sleutel: 'id', zoek: ['id', 'versie', 'omgeving', 'goedgekeurdDoor'],
    titel: r => eerste(r, 'versie', 'id'),
    sub: r => bij(s(r.omgeving), r.teruggedraaid ? 'teruggedraaid' : '', s(r.goedgekeurdDoor)) },

  /* De vlag heeft geen id: hij heet naar zichzelf, en de opruimdatum is het
     enige wat hem eerlijk houdt. Die staat daarom in `sub` en niet ergens
     achter een knop. */
  { type: 'vlag', label: 'Feature flag', meervoud: 'vlaggen', domein: 'bouw', recht: 'bouw',
    veld: 'vlaggen', sleutel: 'naam', zoek: ['naam', 'opruimen'],
    titel: r => eerste(r, 'naam'), sub: r => bij('opruimen ' + s(r.opruimen)) },

  { type: 'apparaat', label: 'Apparaat', meervoud: 'apparaten', domein: 'it', recht: 'it',
    veld: 'apparaten', sleutel: 'id', zoek: ['id', 'nummer', 'soort', 'model', 'staat', 'bijNaam'],
    titel: r => eerste(r, 'nummer', 'id'),
    sub: r => bij(s(r.soort), s(r.model), r.versleuteld ? 'versleuteld' : 'niet versleuteld') },

  { type: 'licentie', label: 'Licentie', meervoud: 'licenties', domein: 'it', recht: 'it',
    veld: 'licenties', sleutel: 'product', zoek: ['product', 'verlooptOp'],
    titel: r => eerste(r, 'product'),
    sub: r => bij(s(r.aantal) + ' plek(ken)', s(r.verlooptOp)),
    bedrag: r => getal(r.kostenPerJaarCenten) },

  { type: 'contract', label: 'Contract', meervoud: 'contracten', domein: 'recht', recht: 'recht',
    veld: 'contracten', sleutel: 'id', zoek: ['id', 'titel', 'wederpartij', 'soort', 'status'],
    titel: r => eerste(r, 'titel', 'id'),
    sub: r => bij(s(r.wederpartij), s(r.status), r.eindigt ? 'tot ' + s(r.eindigt) : ''),
    bedrag: r => getal(r.waardeCenten) },

  { type: 'besluit', label: 'Besluit', meervoud: 'besluiten', domein: 'governance', recht: 'besluit',
    veld: 'besluiten', sleutel: 'id', zoek: ['id', 'titel', 'soort', 'status', 'eigenaar'],
    titel: r => eerste(r, 'titel', 'id'), sub: r => bij(s(r.soort), s(r.status), s(r.eigenaar)) },

  /* DE MENS, en hij is met opzet als laatste toegevoegd en niet als eerste.
     Twee dingen moesten eerst kloppen, en tot ze klopten stond hier de reden in
     plaats van de soort:

     1. `token` (de inlogsleutel) en `rtgKey` (de koppeling naar het
        persoonlijke RTG-account) staan allebei in de VERBORGEN-lijst van
        kern/command/object.js. Zonder die tweede zou het dossier een verband
        tussen twee identiteiten uitprinten dat gescheiden hoort te blijven.
     2. Er moest een manier zijn om een mens te VINDEN. Geen module verwijst
        naar een lid met zijn id -- `eigenaar`, `wie` en `door` zijn vrije tekst
        met een naam erin. Vandaar `verwijst`: dit is de enige soort in dit huis
        die op NAAM wordt gevonden en niet op sleutel.

     DAT LAATSTE IS EEN RISICO EN GEEN TRUC. Twee mensen kunnen dezelfde naam
     dragen, en dan haalt het dossier van de een het werk van de ander binnen.
     De laag die hem leest MOET dat melden; server/bedrijf/inzicht.js telt de
     dubbele namen in de werkruimte en zet ze in de uitslag. Een verband dat op
     een naam rust en zich voordoet als een sleutel, is precies het soort stille
     onwaarheid waar dit huis het vaakst op is gevallen. */
  { type: 'lid', label: 'Medewerker', meervoud: 'medewerkers', domein: 'mensen', recht: 'mens',
    veld: 'leden', sleutel: 'id', zoek: ['id', 'naam', 'functie', 'afdeling'],
    titel: r => eerste(r, 'naam', 'id'),
    sub: r => bij(s(r.functie), s(r.afdeling), s(r.status), r.extern ? 'extern' : ''),
    verwijst: r => [s(r.id), s(r.naam)].filter(Boolean) }
];

module.exports = { SOORTEN };

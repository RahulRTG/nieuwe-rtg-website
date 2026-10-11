/* De mutatiecontracten van de drager en de gezinsdeur van het genootschap (B1,
   GEMEENSCHAP-FASE0.md par. 4.1). Gemeten in test/genootschap-drager-server.test.js
   tegen een echte server, en in test/genootschap-drager.test.js op de module.

   De idempotentie zit in de module en niet in de duplicaatlaag: een herhaalde
   vraag, erkenning of losmaking wordt herkend aan de STAND van `draagOrg` en
   geeft `al: true` zonder iets te veranderen -- het eerste losmaken houdt zijn
   tijdstip (toets 6 van de moduletoets).

   De gezinsdeur roept dezelfde kernfuncties aan als de ledendeur, dus haar
   herhaalgedrag is dat van de ledendeur: binnen twee keer is `al: true`, en
   vertrekken als je al weg bent is een toestandscontrole (400 "geen lid"), geen
   tweede handeling. */
'use strict';

const OP = '2026-10-11';
const AF = { door: 'Claude (Opus 5.5), op grond van test/genootschap-drager-server.test.js en test/genootschap-drager.test.js; niet door een mens nagelezen', op: OP };
const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };
const GROEP = { klasse: 'OBJECT_SCOPED', objectVeld: 'groep',
  uitleg: 'alleen een beheerder van dit genootschap (403); voor een niet-lid bestaat het genootschap niet (404)' };
const GEZIN = { klasse: 'OBJECT_SCOPED', objectVeld: 'code',
  uitleg: 'het gezin uit `code`, en alleen met het `token` dat bij DAT gezin hoort (rtf.verifieerProfiel via ' +
    'gezinsPoort); daarbinnen alleen een gezinslid van 18 of ouder, anders 403 met de reden' };
const PARTNERCODE = { klasse: 'PUBLIC', deur: 'geen sessie; de partnercode in het lijf is de geloofsbrief (vindCode), met ipRem en codeRem',
  waarom: 'een partnerstichting heeft geen RTG-account en hoort er geen te krijgen (routes/rtfos/portalen.js); ' +
    'de code bepaalt de stichting, en partners.erkend() laat alleen een landelijk goedgekeurde of actieve stichting door. ' +
    'De remmen: 20 per minuut per bron, 60 per minuut per code.' };
const gemeten = (hoe) => ({ gemeten: 'test/genootschap-drager-server.test.js (' + OP + '): ' + hoe, op: OP });

const schrijft = (mutatieId, toegang, hoe) => ({ mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang, stand: 'PROTECTED', bewijs: gemeten(hoe), afgetekend: AF });
const leest = (mutatieId, toegang, hoe) => ({ mutatieId, herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang, stand: 'NOT_APPLICABLE', bewijs: gemeten(hoe),
  nagekeken: 'Claude las de handler: alleen lezen uit het genootschap (groepMet, S().groepen, kijk) en geen save of notify',
  afgetekend: AF });

const CONTRACTEN = {
  'POST /api/genootschap/drager/vraag': schrijft('genootschap.drager.vraag', GROEP,
    'toets 1: de tweede vraag met hetzelfde lijf gaf 200 met al: true; de stand bleef gevraagd en er kwam geen tweede drager.'),
  'POST /api/genootschap/drager/los': schrijft('genootschap.drager.los', GROEP,
    'toets 5: het tweede losmaken gaf 200 met al: true; de moduletoets 6 houdt vast dat losAt van het eerste blijft staan.'),
  'POST /api/rtfos/portaal/partner/genootschap': leest('rtfos.portaal.partner.genootschap', PARTNERCODE,
    'toets 1 en 2: alleen de genootschappen die deze stichting vroegen, met naam en stand; een niet-erkende code 403, een onbekende 404.'),
  'POST /api/rtfos/portaal/partner/genootschap/erken': schrijft('rtfos.portaal.partner.genootschap.erken', PARTNERCODE,
    'toets 1: de tweede erkenning gaf 200 met al: true en de beheerder kreeg precies een melding.'),
  'POST /api/rtf/genootschap/mijn': leest('rtf.genootschap.mijn', GEZIN, 'toets 6: de eigen genootschappen van het gezinsprofiel.'),
  'POST /api/rtf/genootschap/zoek': leest('rtf.genootschap.zoek', GEZIN,
    'toets 6: byte voor byte gelijk aan /api/genootschap/zoek voor een niet-lid met dezelfde vraag.'),
  'POST /api/rtf/genootschap/prikbord': leest('rtf.genootschap.prikbord', GEZIN, 'toets 6: 200 voor een gezinslid dat lid is.'),
  'POST /api/rtf/genootschap/agenda': leest('rtf.genootschap.agenda', GEZIN,
    'toets 6: byte voor byte gelijk aan /api/genootschap/agenda voor een lid van dezelfde groep.'),
  'POST /api/rtf/genootschap/binnen': schrijft('rtf.genootschap.binnen', GEZIN,
    'toets 6: het lidmaatschap komt op het gezinsprofiel uit de sessie en niet op een sleutel uit het lijf; tredBinnen geeft bij een tweede oproep al: true.'),
  'POST /api/rtf/genootschap/vertrek': schrijft('rtf.genootschap.vertrek', GEZIN,
    'toets 6: na vertrekken staat de groep niet meer in mijn; een tweede vertrek is een toestandscontrole (400, geen lid) en verandert niets.')
};

module.exports = { CONTRACTEN };

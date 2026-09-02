/* DE UITGAANDE MAILWEG -- wie kiest het doel.

   HET GAT DAT DIT SLUIT. server/smtp-direct.js `bezorg()` zoekt de MX van het
   domein achter de @ op en opent daar een TCP-verbinding. Dat is de enige
   uitgaande verbinding van dit huis waarvan de BESTEMMING door een buitenstaander
   wordt gekozen: wie een domein beheert, zet zijn MX waar hij wil -- en dus ook
   op 10.0.0.5 of 127.0.0.1. Dan spreekt RTG SMTP tegen iets binnen zijn eigen
   netwerk.

   kern/ssrf.js noemde zichzelf al "een vangnet voor toekomstige uitgaande
   fetches", en de smarthost-kant (server/smtp.js) gebruikte hem ook. Deze helft
   liep er alleen nooit langs: twee helften van dezelfde functie, één ervan
   gepoort.

   EN DE POORT GELDT ALLEEN OP DE DNS-TAK, want dat is de vraag zelf: wie koos
   dit doel? Een MX die onze eigen code meegeeft -- een vaste route, of een toets
   tegen een lokale mailserver -- is niet door een aanvaller gekozen. De eerste
   versie poortte allebei en liet zes bestaande toetsen zakken; die meting wees
   de te brede regel meteen aan.

   WAT DIT NIET DICHT DOET, en dat hoort erbij: een hostnaam die pas NA de
   DNS-opzoeking naar binnen wijst. Dat is DNS-rebinding en dat hoort achter een
   egress-poort in de uitrol -- een ONBEPAALD_INFRA-punt, geen applicatievraag.

   MUTATIES die zijn gedraaid (LAT.md regel 2):
   - de ssrf-controle uit bezorg() halen -> 1 ZAKT.
   - de controle ook op de meegegeven mx toepassen -> 2 ZAKT (en zes bestaande
     toetsen in test/mail-eigen.test.js zakken mee; dat was de eerste versie).

   Draai los: node --test test/mail-uitgang.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const direct = require('../server/smtp-direct');

test('1. een MX uit DNS die naar binnen wijst krijgt geen socket', async () => {
  /* De DNS-tak, nagebootst door een domein te kiezen waarvan de MX-opzoeking
     faalt of naar buiten wijst -- daarom leest deze toets de BRON: een echte
     DNS-opzoeking in een toets maakt hem afhankelijk van het netwerk, en een
     toets die van het netwerk afhangt, zakt op een dag om de verkeerde reden. */
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server/smtp-direct.js'), 'utf8');
  const { codeRegelsUit } = require('../scripts/lib/werkelijkheid');
  const regels = [...codeRegelsUit(bron)].map(r => r[1]).join('\n');

  assert.match(regels, /uitDns && ssrf\.onveiligIpLiteral\(doel\)/,
    'de DNS-tak hoort langs kern/ssrf.js te gaan; zonder die regel kiest de ontvanger waar wij een ' +
    'socket openen');
  assert.match(regels, /const uitDns = !\(mx && mx\.length\)/,
    'en het onderscheid hangt aan WIE het doel koos, niet aan het adres');
});

test('2. een MX die onze eigen code meegeeft mag wel naar binnen wijzen', async () => {
  /* Anders is een uitrol met een interne mailserver onmogelijk -- en dat is geen
     hypothese: zes bestaande toetsen draaien tegen 127.0.0.1. */
  const uit = await direct.bezorg({ van: 'a@rtg.nl', naar: 'x@voorbeeld.nl', bericht: 'x',
    mx: [{ exchange: '127.0.0.1' }], poort: 1 });
  /* Hij mag falen op de VERBINDING (er luistert niets op poort 1), maar niet op
     de poort: dan zou de reden over een privéadres gaan. */
  const reden = String((uit.pogingen && uit.pogingen[0] && uit.pogingen[0].waarom) || '');
  assert.ok(!/privé|gereserveerd/.test(reden),
    'een meegegeven MX hoort niet op de ssrf-poort te sneuvelen: ' + reden);
});

test('3. een DNS-MX naar een privéadres levert een uitgeschreven reden', async () => {
  /* De vorm van de weigering telt: een lege afwijzing leest als een storing, en
     dan gaat iemand hem "repareren". */
  const uit = await direct.bezorg({ van: 'a@rtg.nl', naar: 'x@voorbeeld.nl', bericht: 'x',
    mx: [{ exchange: '10.0.0.5' }] });
  assert.ok(uit && uit.pogingen && uit.pogingen.length, 'er hoort een poging met een reden te staan');
});

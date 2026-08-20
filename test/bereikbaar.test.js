/* ELK SCHERM MOET TE BEREIKEN ZIJN DOOR TE TIKKEN. Geen aannames.

   DE AFSPRAAK (Rahul, 11 augustus 2026, strengste variant): een scherm telt
   pas als bereikbaar wanneer je er vanaf het beginscherm naartoe kunt TIKKEN.
   Vindbaar-via-zoeken telt NIET. Dat is een zwaardere eis dan het huis tot nu
   toe hanteerde, en met opzet.

   WAAROM. Er werd gevraagd waar Magnaat te spelen was. Antwoord: nergens --
   alleen door /apps/spelen.html met de hand in te typen. De oorzaak was
   algemeen: sinds een wereldtegel RECHTSTREEKS naar zijn wereldpagina
   navigeert, wordt de items-lijst van die tegel nergens meer getekend. Wat
   alleen daar stond, had geen enkele klikroute meer. Bij het meten bleek dat
   242 schermen 13 bereikbare opleverden.

   HOE ER GEMETEN WORDT. Als GRAAF, niet per pagina: begin bij /apps/app.html,
   volg elk /apps/*.html-pad dat een pagina of een van haar eigen scripts noemt,
   en herhaal. Zo telt ook een route van drie stappen mee, en zo valt een
   pagina die alleen naar zichzelf verwijst er juist uit.

   WAT DEZE TOETS NIET IS. Hij bewijst niet dat een scherm WERKT -- alleen dat
   er een weg heen is. Het bewijs dat het werkt hoort uit de schermtoetsen te
   komen, en die werden zonder browser stilzwijgend overgeslagen; zie
   test/skipwacht.test.js, die daar sinds vandaag rood van wordt.

   DE SCHULDLIJST staat in BEREIK.json en MAG ALLEEN KRIMPEN -- zelfde afspraak
   als BEKEND in scripts/check.js regel 45. Een nieuw scherm zonder klikroute
   zakt meteen; wie er een aansluit, haalt hem van de lijst (en ook dat zakt,
   anders slijt de lijst tot namen die niets meer zeggen).

   EEN GRAAF, EN NIET TWEE. Deze toets had een eigen kopie van de meting, en die
   kopie was slechter dan scripts/lib/bereik.js: hij las alleen ABSOLUTE
   scripttags, terwijl het RTFoundation-huis zijn sessielaag -- met daarin de
   hele wereldschil -- als <script src="sessie.js"> binnenhaalt. beheer.html
   heette daardoor onbereikbaar terwijl hij gewoon in de navigatie staat. Erger
   nog: die kopie kende MAG_LOS niet, het register van schermen die met opzet
   los staan (een landingspagina komt uit een QR-code of uit een link in een
   pas, niet uit een tik). festival-gast.html stond daar netjes ingeschreven en
   zakte hier tegelijk. Twee registers en twee grafen voor een begrip zijn geen
   dubbele zekerheid maar een meningsverschil, en het duurde een samenvoeging
   voordat iemand het merkte. Meting en register komen nu allebei uit
   scripts/lib/bereik.js; hier blijft alleen de afspraak staan. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { meet, MAG_LOS } = require('../scripts/lib/bereik');

const WORTEL = path.join(__dirname, '..');
const schuldLijst = () => JSON.parse(fs.readFileSync(path.join(WORTEL, 'BEREIK.json'), 'utf8')).schuld;

test('geen NIEUW scherm zonder klikroute vanaf het beginscherm', () => {
  const r = meet();
  assert.ok(r.totaal > 100, 'de schermen zijn niet gevonden; dan meet deze regel niets');
  const schuld = new Set(schuldLijst());
  const nieuw = r.wezen.filter((w) => !MAG_LOS.has(w) && !schuld.has(w));
  assert.deepEqual(nieuw, [],
    'deze schermen zijn nergens aan te tikken en staan niet als schuld genoteerd:\n  ' + nieuw.join('\n  '));
});

test('en wie er een aansluit, haalt hem van de schuldlijst', () => {
  const r = meet();
  const los = new Set(r.wezen);
  const schuld = schuldLijst();
  const opgelost = schuld.filter((s) => !los.has(s));
  assert.deepEqual(opgelost, [],
    'deze staan als schuld genoteerd maar zijn inmiddels aan te tikken; haal ze uit BEREIK.json:\n  ' + opgelost.join('\n  '));
});

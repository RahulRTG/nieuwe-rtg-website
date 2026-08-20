/* DE LEEGTE-METING, IN EEN ECHTE DOM.

   scripts/mobielkeuring.js beweert iets simpels: "dit scherm past, rendert, en
   toont een mens toch niets". Dat oordeel werd tot vandaag alleen als GETAL
   getoetst (test/mobiel.test.js keurt veltMobiel, de pure velling). De meting
   zelf -- de code die in de pagina draait -- had geen enkele toets, en daar zat
   de fout.

   WAT ER MISGING. De meting telde alleen elementen ZONDER kinderen: "alleen
   bladeren, geen dubbeltelling". Dat klopt tegen dubbeltelling en is fout voor
   tekst, want een alinea met een <br> erin HEEFT een kind. Op
   /apps/wereld.html stond de lege staat volledig in beeld en de meting telde er
   drie tekens; ik heb dat scherm twee volle rondes lang van een gebrek
   beschuldigd dat in de meter zat.

   Deze toets legt allebei de kanten vast, want een meting die nooit meer
   aanslaat is net zo stuk als een die te vaak aanslaat.

   DE MUTATIE: zet in mobielkeuring.js de tekstknoop-lus terug naar
   `document.querySelectorAll('body *')` met `if (bl.children.length) continue`.
   Dan zakt de eerste bewering (een alinea met <br> telt weer als nul). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadBrowser } = require('./browser');
const mob = require('../scripts/mobielkeuring');

const pw = laadBrowser();
const MEET = '(function(){' + mob.BRON + '\nreturn window.__mobielKeur(' + JSON.stringify({
  hand: 'rechts', maat: mob.MAAT, onder: mob.ONDER, smal: mob.SMAL, kwart: mob.ANKERKWART }) + ')})()';

const BLAD = (inhoud) => '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
  '<style>body{margin:0;font:16px system-ui}main{padding:1rem}</style></head><body>' +
  '<main>' + inhoud + '</main></body></html>';

test('de leegte-meting telt tekst, ook als er een <br> in staat',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

    /* 1. EEN ALINEA MET EEN <br>: dit is de regressie. */
    await page.setContent(BLAD('<p>Hier is het nog stil.<br>Wat je plaatst komt hier samen.</p>'));
    let m = await page.evaluate(MEET);
    assert.equal(m.leeg, false, 'een alinea met een <br> is geen leeg scherm');
    assert.ok(m.tekens > 40, 'de tekst hoort geteld te worden, gemeten: ' + m.tekens);

    /* 2. DIEPER GENEST, want <b> en <a> in een zin doen hetzelfde. */
    await page.setContent(BLAD('<p>Een zin met <b>vet</b> en <a href="#">een link</a> erin.</p>'));
    m = await page.evaluate(MEET);
    assert.equal(m.leeg, false, 'inline opmaak maakt van een zin geen container');

    /* 3. GEEN DUBBELTELLING. Zonder de tekstknoop-aanpak telde een ouder zijn
          kinderen mee en werd elke zin twee keer geteld. */
    await page.setContent(BLAD('<div><p>abcde</p></div>'));
    m = await page.evaluate(MEET);
    assert.equal(m.tekens, 5, 'vijf tekens horen vijf te blijven, gemeten: ' + m.tekens);

    /* 4. EN EEN ECHT LEEG WERKVLAK MELDT ZICH NOG. Een meting die nooit meer
          aanslaat is net zo stuk als een die te vaak aanslaat. */
    await page.setContent(BLAD(''));
    m = await page.evaluate(MEET);
    assert.equal(m.leeg, true, 'een scherm dat werkelijk niets toont, hoort te melden');

    /* 5. WAT BUITEN BEELD STAAT TELT NIET MEE -- dat is de hele reden dat deze
          meting bestaat: een mens ziet wat er in het venster staat. */
    await page.setContent(BLAD('<div style="height:2000px"></div><p>ver naar beneden</p>'));
    m = await page.evaluate(MEET);
    assert.equal(m.leeg, true, 'tekst onder de vouw is voor deze meting geen inhoud');

    await page.close();
  } finally { await browser.close(); }
});

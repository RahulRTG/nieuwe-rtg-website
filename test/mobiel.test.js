/* DE TELEFOONPOORT MOET DICHT KUNNEN, EN OP DE JUISTE MOMENTEN OPEN BLIJVEN.

   GRAMMATICA.md belooft dat een mens zijn duim vindt wat hij zoekt, en
   ADAPTIEF.md dat een scherm op een telefoon past. Tot 19 augustus 2026 werd
   geen van beide gemeten: de breedte voor elf van de 257 schermen, het bereik
   nergens. De ronde die dat nu doet staat in scripts/mobielkeuring.js, en om
   dezelfde reden als bij het raakvlak hoort er een toets bij: een poort die je
   nooit hebt zien dichtgaan is geen poort (LAT.md regel 9).

   Twee dingen staan hier apart, want ze kunnen los stuk:

     1. HET OORDEEL. Leest de grenzen uit A11Y-INGELOGD.json en zakt bij een
        gebrek erboven -- ook bij precies een erboven, want zo sluipt het erin.
     2. DE MEETREGEL ZELF. Die draait hier op een nagemaakte pagina en niet in
        een browser: mobielInPagina raakt alleen document.querySelectorAll,
        getComputedStyle en getBoundingClientRect aan.

   De tweede kant is de belangrijkste. Deze meting is drie keer herschreven
   omdat ze op een ECHT scherm sneuvelde -- een lijst tags, een hoogtedrempel,
   de tekst in <main> -- en elke keer was de uitkomst een groen getal dat niets
   betekende. Wat hieronder staat legt vast wat die drie versies fout deden,
   zodat versie vijf niet dezelfde weg terug loopt. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { veltMobiel, MAAT, ONDER, SMAL, ANKERKWART } = require('../scripts/mobielkeuring');

const WORTEL = path.join(__dirname, '..');
const REGISTER = JSON.parse(fs.readFileSync(path.join(WORTEL, 'A11Y-INGELOGD.json'), 'utf8'));

test('het register draagt telefoongrenzen, en die zijn een getal', () => {
  /* DE MUTATIE: haal het telefoon-blok uit A11Y-INGELOGD.json. Zonder deze
     bewering zou veltMobiel dan op nul terugvallen en zou de poort er nog
     steeds "streng" uitzien terwijl niemand hem meer beheert. */
  assert.ok(REGISTER.telefoon, 'A11Y-INGELOGD.json hoort een telefoon-blok te dragen');
  for (const soort of ['breed', 'leeg', 'balk', 'duim']) {
    assert.equal(typeof REGISTER.telefoon[soort], 'number', soort + ' hoort een getal te zijn');
    assert.ok(REGISTER.telefoon[soort] >= 0, soort + ' hoort niet negatief te zijn');
  }
});

test('een gebrek erbij laat de poort zakken, ook precies een', () => {
  /* DE MUTATIE: maak van `nu > mag` een `nu > mag + 1` in veltMobiel. Dan komt
     de eerste erdoor, en zo sluipt een reeks binnen. */
  const nul = { breed: 0, leeg: 0, balk: 0, duim: 0 };
  assert.equal(veltMobiel(nul, nul).faalt, false, 'gelijk aan de grens hoort door te komen');
  for (const soort of ['breed', 'leeg', 'balk', 'duim']) {
    const een = Object.assign({}, nul); een[soort] = 1;
    const oordeel = veltMobiel(een, nul);
    assert.equal(oordeel.faalt, true, 'een ' + soort + ' erbij hoort de poort te laten zakken');
    assert.match(oordeel.melding, new RegExp(soort === 'breed' ? 'buiten beeld' : '.'),
      'en de melding hoort te zeggen WAT er mis is');
  }
});

test('minder dan de grens is geen fout maar een uitnodiging', () => {
  /* Anders wordt een verbetering een storing, en dan zet iemand de poort uit.
     DE MUTATIE: laat de `nu < mag`-tak ook faalt:true teruggeven. */
  const oordeel = veltMobiel({ breed: 0, leeg: 0, balk: 0, duim: 0 }, { breed: 3, leeg: 0, balk: 0, duim: 0 });
  assert.equal(oordeel.faalt, false);
  assert.match(oordeel.melding, /strakker/);
});

test('schermen zonder aangewezen hoofdhandeling tellen niet mee als gebrek', () => {
  /* DIT IS EEN BESLUIT EN GEEN OMISSIE (GRAMMATICA.md). Een lijst, een
     overzicht, een dagbriefing heeft geen ene handeling die eruit springt.
     Zou dit wel meetellen, dan wordt "wijs maar iets aan" de reparatie -- en
     daar wordt geen scherm beter van; /apps/muziek.html kreeg zo "Doe mee"
     aangewezen terwijl de handeling daar afspelen is.

     DE MUTATIE: zet 'geenHoofd' bij in de SOORT-lijst van veltMobiel. */
  const oordeel = veltMobiel({ breed: 0, leeg: 0, balk: 0, duim: 0, geenHoofd: 476 },
    { breed: 0, leeg: 0, balk: 0, duim: 0 });
  assert.equal(oordeel.faalt, false, 'werkvoorraad is geen gebrek');
});

test('de drempels zijn wat de grammatica belooft, en niet iets anders', () => {
  /* Deze vier getallen zijn besluiten met een reden eronder (GRAMMATICA.md).
     Ze hier vastleggen betekent: wie ze verschuift, verschuift een belofte en
     niet een detail.

     DE MUTATIE: zet MAAT op 24. Dan meet de ronde nog steeds iets, maar niet
     meer de duim -- 24 is de ondergrens voor RAKEN met een trillende hand
     (WCAG 2.5.8), en die staat al in scripts/raakvlakkeuring.js. */
  assert.equal(MAAT, 44, 'de hoofdhandeling heeft duimmaat, niet raakmaat');
  assert.equal(ONDER, 0.40, 'het middelpunt hoort in de onderste 60%');
  assert.equal(SMAL, 0.60, 'smaller dan dit deel van het venster telt als smal');
  assert.equal(ANKERKWART, 0.25, 'het kwart aan de ankerzijde is waar de duim niet komt');
  const G = fs.readFileSync(path.join(WORTEL, 'GRAMMATICA.md'), 'utf8');
  assert.match(G, /44×44/, 'GRAMMATICA.md noemt de duimmaat');
  assert.match(G, /onderste 60%/, 'GRAMMATICA.md noemt de duimlijn');
  assert.match(G, /data-hoofdactie/, 'GRAMMATICA.md noemt de conventie');
});

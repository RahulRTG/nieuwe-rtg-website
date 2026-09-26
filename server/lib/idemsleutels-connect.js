/* FOUNDATION CONNECT -- het duplicaatgedrag van de drieentwintig deuren.

   DE MEERDERHEID LEEST, EN DAT IS HIER GEEN RESTPOST MAAR DE VORM VAN DE LAAG.
   kern/connect/ bezit geen inhoud: de leerstof blijft van kern/leerstof.js, de
   buurtactiviteit van kern/rtfos/publiek.js. Dertien van de drieentwintig
   routes veranderen daarom niets, en ze zijn POST omdat dit huis geen GET met
   een sessie kent -- niet omdat er iets gebeurt (zelfde redenering als
   ./idemsleutels-bundel.js).

   DAT IS NAGEKEKEN EN HET WAS EERST NIET WAAR. Drie lezers (horizon, dossier,
   naklank-tel) maakten hun eigen rij AAN in db.data zodra iemand keek -- zonder
   save(), dus onzichtbaar tot een andere handeling toevallig opsloeg. Een route
   die `leest: true` heet en de opslag laat groeien, klopt niet met zijn eigen
   contract en niemand zou het merken. Er staat nu naast elke schrijver een
   `peil()` die niets aanmaakt; kern/connect/horizon.js schrijft in zijn kop uit
   waarom dat twee functies zijn en geen vlag.

   WAAROM EEN SLEUTEL BIJ EEN LEZER SCHAADT: de idempotentiepoort speelt binnen
   het dubbeltikvenster het BEWAARDE antwoord terug. Bij een ontdeklijst is dat
   precies verkeerd -- je ververst omdat je de stand van nu wilt. */
'use strict';

const SLEUTELS = {
  /* ---- lezen: de ontdeklus, de uitleg en de stand ---- */
  'POST /api/connect/ontdek': { leest: true },
  'POST /api/rtf/connect/ontdek': { leest: true },
  'POST /api/connect/uitleg': { leest: true },
  'POST /api/connect/dossier': { leest: true },
  'POST /api/rtf/connect/dossier': { leest: true },
  'POST /api/connect/horizon': { leest: true },
  'POST /api/rtf/connect/horizon': { leest: true },
  'POST /api/connect/naklank/tel': { leest: true },
  'POST /api/connect/portfolio': { leest: true },
  'POST /api/rtf/connect/portfolio': { leest: true },
  /* De kringroutes REKENEN alleen. kern/connect/kring.js bewaart niets: hij
     krijgt een huidige en een gewenste kring mee en geeft terug of dat mag.
     Waar de kring van een gemaakt ding LANDT, is de zaak van het domein dat dat
     ding bezit -- deze laag is de poort en niet de opslag. */
  'POST /api/connect/kring': { leest: true },
  'POST /api/rtf/connect/kring': { leest: true },
  'POST /api/connect/kring/keuzes': { leest: true },
  'POST /api/rtf/connect/kring/keuzes': { leest: true },

  /* ---- schrijven, en alle drie idempotent op hun eigen manier ---- */
  /* `open` schrijft de trede `gezien`, en die is EENMALIG per ding
     (kern/connect/tredenlijst.js). Twee keer openen is geen twee feiten, en een
     dossier dat per opening een regel bijschrijft is een kijklog. */
  'POST /api/connect/open': { velden: ['id'] },
  'POST /api/rtf/connect/open': { velden: ['id'] },
  /* Een naklank van dezelfde mens op hetzelfde ding is EEN naklank. De tweede
     aanroep komt terug met `nieuw: false` en is geen fout. */
  'POST /api/connect/naklank': { velden: ['id', 'soort'] },
  'POST /api/rtf/connect/naklank': { velden: ['id', 'soort'] },
  'POST /api/connect/naklank/weg': { velden: ['id', 'soort'] },
  /* De schuif ZET een waarde; twee keer dezelfde waarde is dezelfde stand. */
  'POST /api/connect/schuif': { velden: ['schuif'] },
  'POST /api/rtf/connect/schuif': { velden: ['schuif'] },
  /* `werk` neemt de eigen werken over uit kern/mediaos/werkherkomst.js.

     HIER STOND `zelfdeVerzoek: true` EN DAT WAS FOUT -- gevonden door
     test/connect-routes.e2e.js, en het is precies de val die
     ./idemsleutels-bundel.js beschrijft. Het lijf is altijd leeg, dus twee
     aanroepen zijn voor de poort hetzelfde verzoek, en binnen het
     dubbeltikvenster speelde hij het BEWAARDE antwoord terug. Een lid dat
     eerst keek (leeg), daarna een clip maakte en opnieuw keek, kreeg dus
     opnieuw "leeg" -- terwijl zijn werk gewoon in het register stond.

     De EFFECTEN zijn wel degelijk idempotent: `gemaakt` en `aangeboden` zijn
     eenmalig per werk-id, dus er komt nooit een tweede regel. Maar het
     ANTWOORD is dat niet, want tussen twee aanroepen kan er werk bij zijn
     gekomen. Dat is het verschil tussen idempotentie in de KERN en in de
     POORT, en alleen de eerste hebben we hier. */
  'POST /api/connect/werk': { nietIdempotent: true, waarom:
    'Het lijf is leeg, dus elke aanroep ziet er voor de poort hetzelfde uit -- maar het ANTWOORD hangt af ' +
    'van wat er sinds de vorige keer is aangemeld. Terugspelen zou een lid zijn eigen nieuwe werk laten ' +
    'missen. De effecten zijn wel idempotent: de twee treden zijn eenmalig per werk-id, dus een tweede ' +
    'aanroep schrijft niets en meldt dat in `stond`.' },
  'POST /api/rtf/connect/werk': { nietIdempotent: true, waarom:
    'Zelfde handler en zelfde reden als POST /api/connect/werk.' },

  /* ---- schrijven en met opzet NIET samen te vatten ---- */
  /* `noteer` is gemengd, en daarom staat er geen sleutel op: `begrepen` is
     eenmalig (de kern vangt de herhaling af), `toegepast` en `geoefend` zijn
     dat niet -- twee keer iets toepassen zijn twee keer. De poort mag hier dus
     niets terugspelen; de kern beslist per TREDE, en dat is de enige plek waar
     dat verschil te zien is. */
  'POST /api/connect/noteer': { nietIdempotent: true, waarom:
    'Gemengd per TREDE, en die keuze hoort in de kern en niet in de poort. `begrepen` is eenmalig ' +
    '(kern/connect/tredenlijst.js vangt de herhaling af met ok:true, nieuw:false), maar `geoefend` en ' +
    '`toegepast` zijn dat niet: twee keer iets toepassen zijn twee keer, en die samenvoegen gooit er ' +
    'stil een weg. Een sleutel hier zou het antwoord van de eerste tik terugspelen en daarmee de ' +
    'tredebeslissing overslaan.' },
  'POST /api/rtf/connect/noteer': { nietIdempotent: true, waarom:
    'Zelfde handler en zelfde reden als POST /api/connect/noteer; alleen de deur verschilt.' },
  /* Twee keer "meer hiervan" betekent meer dan een keer, tot het plafond van
     drie. Wie die twee samenvoegt, gooit er stil een weg en noemt dat een
     verbetering. Het loopt niet weg: kern/connect/horizon.js knijpt af op +-3. */
  'POST /api/connect/signaal': { nietIdempotent: true, waarom:
    'Twee keer "meer hiervan" betekent meer dan een keer. Wie die twee samenvoegt, gooit er stil een ' +
    'weg en noemt dat een verbetering. Het loopt niet weg: kern/connect/horizon.js knijpt af op +-3, ' +
    'dus honderd keer drukken betekent hetzelfde als drie keer.' },
  'POST /api/rtf/connect/signaal': { nietIdempotent: true, waarom:
    'Zelfde handler en zelfde reden als POST /api/connect/signaal; alleen de deur verschilt.' }
};

module.exports = { SLEUTELS };

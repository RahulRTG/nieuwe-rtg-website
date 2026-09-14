/* DE WERKVLOER KIJKT NAAR DE ONDERNEMING -- het contract van een route die met
   opzet niets verandert.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.

   HIJ STAAT NIET IN ./mutatiecontracten-leest.js, en dat is geen slordigheid.
   Dat bestand draagt EEN gedeeld bewijs voor zevenendertig routes (de kale ronde
   van 29 augustus plus scripts/schrijfanalyse.js), met de bestandsnaam als enige
   variabele -- precies zodat een verschil er niet onopgemerkt in sluipt. Deze
   route heeft een ANDER bewijs, en dat hoort dan ook apart te staan in plaats van
   met een half passende zin in die reeks te worden geschoven.

   NOT_APPLICABLE EIST TWEE ONAFHANKELIJKE LIJNEN, en die zijn er:

     1. GEMETEN, van buiten. test/onderneming-zaakkant.test.js toets 5 roept de
        route twee keer aan (met twee verschillende sessies) en vergelijkt het
        beeld van de onderneming op de LEDENkant ervoor en erna, byte voor byte.

        Met een besturingsproef erachter, en die is er omdat de toets zonder haar
        waardeloos was: hij vergelijkt een PROJECTIE en ziet dus alleen wat daarin
        opduikt. Nagetrokken met een mutatie -- `o.naam` overschrijven liet hem
        groen, want ondernemingNaam() leest na het koppelen de naam van de ZAAK.
        De besturingsproef verandert de onderneming nu langs een gewone ledenroute
        en eist dat hetzelfde venster het WEL ziet.

     2. UIT DE BRON, en die sluit precies het gat dat lijn 1 laat. Toets 6 leest
        server/kern/onderneming/zaakkant.js met het commentaar eruit en eist dat
        er geen toekenning aan het ondernemingsobject of aan het beeld in staat,
        en dat `save` en `db.data` er niet in voorkomen. De fabriek krijgt ze ook
        niet MEE ({ vanZaak, ondernemingBeeld }), dus persisteren kan er
        structureel niet in -- dat is sterker dan dat het er niet in staat.

   De handler zelf is een regel: `res.json(ondernemingAchterZaak(req.supplier.code))`.

   Zakken die toetsen, dan klopt dit register niet meer en hoort HET te worden
   herzien, niet de toets. */
'use strict';

const OP = '2026-09-14';

/* De aftekening is eerlijk over wat ze is: opgesteld op grond van de twee
   metingen hierboven, die in dezelfde sessie zijn gedraaid en met mutaties zijn
   nagetrokken -- niet door een mens die de handler regel voor regel heeft
   gelezen. Wie dat wel doet, vervangt deze regel door zijn naam. */
const CONTRACTEN = {
  'POST /api/supplier/onderneming': {
    mutatieId: 'onderneming.zaakkant.lezen',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    /* supplierAuth, en verder niets: elke ingelogde MEDEWERKER mag hier. Er is
       met opzet geen rolonderscheid (zie de kop van routes/supplier/onderneming.js)
       en het onderwerp komt uit de SESSIE en niet uit het lichaam -- daarom
       AUTHENTICATED en niet OBJECT_SCOPED. */
    toegang: { klasse: 'AUTHENTICATED', deur: 'supplierAuth' },
    stand: 'NOT_APPLICABLE',
    nagekeken: 'test/onderneming-zaakkant.test.js toets 6, ' + OP + ': de bron van ' +
      'server/kern/onderneming/zaakkant.js bevat geen toekenning aan het ondernemingsobject of aan het ' +
      'beeld, en noemt save noch db.data; de fabriek krijgt ze niet mee. Dat is de tweede, ' +
      'onafhankelijke lijn naast de gemeten ronde -- zij dekt precies wat een opslagmeter niet ziet.',
    bewijs: {
      gemeten: 'test/onderneming-zaakkant.test.js toets 5: twee aanroepen met twee verschillende ' +
        'sessies, het beeld van de onderneming op de ledenkant ervoor en erna byte voor byte gelijk, ' +
        'met een besturingsproef die aantoont dat datzelfde venster een echte wijziging WEL ziet',
      op: OP
    },
    afgetekend: {
      door: 'Claude (Opus 5), op grond van de twee gedraaide metingen hierboven, beide met een mutatie ' +
        'nagetrokken; niet door een mens nagelezen',
      op: OP
    }
  }
};

module.exports = { CONTRACTEN };

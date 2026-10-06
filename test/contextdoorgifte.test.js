/* ============================================================================
   DE CONTEXTDOORGIFTE MAG ALLEEN DE GOEDE KANT OP (scripts/contextdoorgifte.js,
   CONTEXTDOORGIFTE.json).

   Negen invarianten uit het Fase 2-onderzoek naar een verzoekframe. Wat vandaag
   rood is staat op zijn huidige stand in `ratel` en mag alleen verbeteren; wat
   groen is mag niet terugvallen. Deze toets houdt drie dingen vast:

     1. het register ligt niet onder zijn eigen ratel (een vastgelegde meting
        die slechter is dan de tand, is een register dat loopt achter);
     2. de twee goedkope invarianten (I5 en I9) worden hier VERS gemeten tegen
        de echte modules, dus een context die weer stil "gelukt" zegt na sluiten
        of een enterWith in server/ laat deze toets zakken;
     3. het instrument kan uitslaan (LAT.md regel 10): de indeling herkent een
        stille schrijver, de teller herkent enterWith maar niet in commentaar,
        de ratel bijt in beide richtingen, en een blinde peiling heet stuk.

   De serverhelft (I1, I3, I4, I10) draait in test/contextdoorgifte-server.test.js,
   want die start een echte server en hoort niet in de snelle registerpoort.

   Draai los: node --test test/contextdoorgifte.test.js
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const m = require('../scripts/contextdoorgifte');

const register = () => JSON.parse(fs.readFileSync(m.DOEL, 'utf8'));

test('het register draagt een tand voor elke invariant, en ligt niet onder zijn eigen ratel', () => {
  const r = register();
  for (const k of Object.keys(m.RICHTING)) {
    assert.ok(k in r.ratel, 'CONTEXTDOORGIFTE.json mist de tand "' + k + '"; draai npm run contextdoorgifte -- --vastleggen');
  }
  const fout = m.vergelijk(r.ratel, m.tandenVan(r.gemeten));
  assert.deepStrictEqual(fout, [], 'het register loopt achter op zijn eigen ratel: ' + fout.join('; ') +
    ' -- draai npm run contextdoorgifte en kijk welke invariant terugviel');
  /* Geen samengesteld cijfer: negen invarianten blijven negen. */
  assert.ok(!('totaal' in r.gemeten) && !('score' in r.gemeten), 'een totaalcijfer verbergt welke invariant bewoog');
});

test('I5 en I9 vers gemeten: geen context zegt na sluiten stil "gelukt", geen enterWith', async () => {
  const r = register();
  const i5 = await m.meetI5();
  const stil = Object.entries(i5).filter(([, k]) => k === 'stil').map(([n]) => n);
  assert.ok(stil.length <= r.ratel.i5StilNaSluiten,
    'meer contexten zeggen na sluiten stil "gelukt" dan de ratel toelaat (' + r.ratel.i5StilNaSluiten + '): ' + stil.join(', '));
  assert.strictEqual(Object.keys(i5).length, 7, 'zeven schrijvende contexten (met het verzoekframe); ontbreekt er een, dan meet I5 minder dan het zegt');
  /* Wat hier al dichtzat mag niet stil terugvallen. */
  assert.strictEqual(i5.verzoekcontext, 'weigert');
  assert.strictEqual(i5.bijeen, 'weigert');
  assert.strictEqual(i5.verzoekframe, 'weigert', 'het verzoekframe weigert na sluiten (opzet/verzoekframe.js)');
  const i9 = m.meetI9();
  assert.ok(i9.enterWith <= r.ratel.i9EnterWith, 'enterWith in server/: ' + i9.waar.join(', ') +
    ' -- gebruik run(); enterWith verandert de omliggende context en lekt over keep-alive');
  /* Het register moet hetzelfde zeggen als de verse meting, anders loopt het achter. */
  assert.strictEqual(r.gemeten.i5.stilNaSluiten, stil.length,
    'CONTEXTDOORGIFTE.json loopt achter op I5 (' + r.gemeten.i5.stilNaSluiten + ' vastgelegd, ' + stil.length + ' gemeten); draai npm run contextdoorgifte');
});

test('zelfijking: het instrument slaat uit op bekend-foute invoer', () => {
  assert.ok(m.ijkI5(), 'de I5-indeling herkent een stille schrijver niet');
  assert.ok(m.ijkI2(), 'I2 herkent een overgenomen client-id of een botsing niet');
  /* Een proefverzoek dat niet aankwam is geen nul maar niet vast te stellen. */
  assert.strictEqual(m.meetI2(m.I2_KOPPEN.map(k => ({ kop: k, status: 0, antwoordId: null })), []), null);
  assert.strictEqual(m.klasse({ uitkomst: true, veranderd: true, gemeld: false }), 'stil');
  assert.strictEqual(m.klasse({ uitkomst: undefined, veranderd: true, gemeld: false }), 'stil',
    'niets teruggeven is ook "gelukt" zeggen');
  assert.strictEqual(m.klasse({ uitkomst: false, veranderd: true, gemeld: false }), 'stil',
    'false zeggen terwijl er WEL iets veranderde is een leugen, geen weigering');
  assert.strictEqual(m.klasse({ gooide: true, veranderd: false }), 'weigert');
  assert.strictEqual(m.klasse({ uitkomst: true, veranderd: true, gemeld: true }), 'meldt');

  const EW = '.enter' + 'With(';   // opgebouwd: deze toets mag zichzelf niet meten
  assert.strictEqual(m.telEnterWith('winkel' + EW + 'x);'), 1);
  assert.strictEqual(m.telEnterWith('/* winkel' + EW + 'x) */\n// winkel' + EW + 'x)'), 0, 'commentaar telt niet');

  const ratel = { i5StilNaSluiten: 2, i1AandeelMetCorrelatie: 0.5 };
  assert.strictEqual(m.vergelijk(ratel, { i5StilNaSluiten: 3, i1AandeelMetCorrelatie: 0.5 }).length, 1, 'omlaag-tand bijt');
  assert.strictEqual(m.vergelijk(ratel, { i5StilNaSluiten: 2, i1AandeelMetCorrelatie: 0.4 }).length, 1, 'omhoog-tand bijt');
  assert.strictEqual(m.vergelijk(ratel, { i5StilNaSluiten: 1, i1AandeelMetCorrelatie: 0.9 }).length, 0, 'beter mag');
  assert.strictEqual(m.vergelijk(ratel, { i5StilNaSluiten: 1 }).length, 1, 'een lege noemer is geen groen');
  assert.strictEqual(m.vergelijk(ratel, { i5StilNaSluiten: 1 }, true).length, 0, 'behalve in een deelronde');

  const blind = { ijkKlaar: true, ijk: { timers: { gevuurdNaAfloop: 0, naAfloopMetDrager: 0 },
    envelop: { metVerzoekCorrelatie: 0 }, auth: { n: 0, metHandeling: 0, correlatieEens: 0, metFrame: 0, frameOneens: 0 } },
    frameIjk: { tweedeIdentiteit: 0 } };
  assert.strictEqual(m.ijkServer(blind).length, 7, 'een peiling die niets ziet heet stuk, niet "alles in orde"');
  /* Een peiling van voor het verzoekframe (geen frame-velden) is ook blind voor I13 en I14. */
  assert.strictEqual(m.ijkServer({ ijkKlaar: true, ijk: { timers: { gevuurdNaAfloop: 1, naAfloopMetDrager: 1 },
    envelop: { metVerzoekCorrelatie: 1 }, auth: { n: 2, metHandeling: 1, correlatieEens: 1 } } }).length, 3);
  assert.ok(m.ijkServer(null).length > 0, 'geen peiling is geen uitslag');
});

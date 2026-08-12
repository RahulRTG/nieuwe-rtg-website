/* EEN UITZONDERING VERLOOPT, OF HET IS GEEN UITZONDERING.

   EXCEPTIONS.json legt vast waar dit huis bewust van zijn eigen wetten afwijkt.
   De hele waarde van die vorm zit in twee eigenschappen, en deze toets bewaakt
   precies die twee:

     1. ELKE UITZONDERING VERLOOPT. Zonder vervaldatum is het weer een TODO, en
        een TODO overleeft iedereen die weet waarom hij er staat.
     2. ELKE UITZONDERING WIJST NAAR EEN BESTAANDE WET. Een afwijking van een
        regel die niet bestaat, is geen afwijking maar een losse mening -- en ze
        zou onzichtbaar blijven als de wet ooit wordt hernoemd of geschrapt.

   Punt 2 is de koppeling die dit register verbindt met INVARIANTS.json. Zonder
   die controle kunnen de twee lijsten uit elkaar lopen zonder dat iemand het
   merkt, en dan verwijst de ene naar iets wat de andere niet meer kent.

   En de derde: de keuring zelf moet kunnen uitslaan (LAT.md regel 10). Een
   register-controle die altijd "in orde" zegt, bewaakt niets -- dus voeren we
   haar vier gevallen waarvan we de uitkomst kennen.

   Gemuteerd en zien zakken: BIJNA_DAGEN op 0 zetten (toets 4 rood), de
   VERPLICHT-lijst leegmaken (toets 3 en 4 rood), en de datumvergelijking
   omdraaien zodat verlopen GELDIG heet (toets 4 rood).
   Draai los: node --test test/uitzonderingen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { keur, keurUitzondering, leesRegister, VERPLICHT } = require('../scripts/uitzonderingen.js');
const wetten = require('../scripts/wetten.js');

const register = leesRegister();

test('elke uitzondering is compleet en niet verlopen', () => {
  const u = keur(register);
  const stuk = u.uitzonderingen.filter(x => x.stand === 'VERLOPEN' || x.stand === 'ONVOLLEDIG');
  assert.deepEqual(stuk.map(x => x.id + ' (' + x.stand + (x.mist.length ? ': ' + x.mist.join(', ') : '') + ')'), [],
    'een verlopen of half ingevulde uitzondering is geen uitzondering maar een gewoonte');
});

test('elke uitzondering wijst naar een wet die echt bestaat', () => {
  const ids = new Set(wetten.leesRegister().wetten.map(w => w.id));
  for (const x of register.uitzonderingen) {
    if (!/^RTG-\d{3}$/.test(x.regel)) continue; // een benoemde huisregel mag ook
    assert.ok(ids.has(x.regel),
      x.id + ' wijkt af van ' + x.regel + ', maar die wet staat niet in INVARIANTS.json');
  }
});

test('id\'s zijn uniek en elke uitzondering benoemt haar risico', () => {
  const gezien = new Set();
  for (const x of register.uitzonderingen) {
    assert.match(x.id, /^EXC-\d{3}$/, 'id in de vorm EXC-nnn');
    assert.equal(gezien.has(x.id), false, x.id + ' komt twee keer voor');
    gezien.add(x.id);
    assert.ok(x.risico.length > 40,
      x.id + ' benoemt geen concreet risico -- zonder risico-analyse is dit weer een TODO');
    assert.ok(x.compenserend.length > 40,
      x.id + ' noemt geen compenserende maatregel; dan draag je de schade zonder hem te beperken');
  }
});

/* DE IJKING. Vier werelden waarvan we de uitkomst kennen, met een vaste dag
   zodat deze toets niet stilletjes van betekenis verandert als de kalender
   verschuift -- dat is precies de val waar een datumcontrole in trapt. */
test('de keuring slaat uit op verlopen, bijna verlopen en onvolledig', () => {
  const vandaag = '2026-08-12';
  const goed = { id: 'EXC-000', regel: 'RTG-000', wat: 'iets', waarom: 'reden', risico: 'schade',
    compenserend: 'maatregel', eigenaar: 'Platform', aangemaakt: '2026-01-01', verloopt: '2027-01-01' };
  const met = (o) => keurUitzondering(Object.assign({}, goed, o), vandaag).stand;

  assert.equal(met({}), 'GELDIG');
  assert.equal(met({ verloopt: '2026-08-11' }), 'VERLOPEN', 'een dag over tijd is over tijd');
  assert.equal(met({ verloopt: '2026-08-20' }), 'BINNENKORT', 'binnen dertig dagen is het moment om te plannen');
  assert.equal(met({ verloopt: 'binnenkort' }), 'ONVOLLEDIG', 'een datum die geen datum is, telt niet');

  /* DE LIJST STAAT HIER HARD, EN DAT IS EEN REPARATIE.

     Eerst liep deze lus over de geimporteerde VERPLICHT. Toen ik die als
     mutatie leegmaakte -- de controle dus volledig uitzette -- bleef deze toets
     GROEN, want een lus over een lege verzameling doet niets en een bewering die
     nooit wordt uitgevoerd kan niet zakken. Precies de vorm die
     scripts/tandeloos.js jaagt (LAT.md regel 9), en ik schreef hem hier zelf.

     Nu noemt de toets de velden zelf. Haalt iemand er een uit VERPLICHT, dan
     zakt deze regel -- en dat is het hele punt van een hek. */
  for (const veld of ['id', 'regel', 'wat', 'waarom', 'risico', 'compenserend', 'eigenaar', 'aangemaakt', 'verloopt']) {
    assert.equal(met({ [veld]: '' }), 'ONVOLLEDIG', 'een uitzondering zonder ' + veld + ' is onvolledig');
    assert.ok(VERPLICHT.includes(veld), veld + ' hoort in VERPLICHT te staan; anders bewaakt de keuring hem niet');
  }
});

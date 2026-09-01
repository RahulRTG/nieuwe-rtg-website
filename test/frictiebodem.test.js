/* ============================================================================
   DE BODEM ONDER DE FRICTIE.

   WAT HIER BEPROEFD WORDT, EN WAAROM HET ZWAAR WEEGT. kern/frictie rekent uit
   hoeveel weerstand bij een handeling hoort. Zo'n motor is nuttig omdat hij
   frictie kan WEGHALEN waar die niet nodig is -- en precies dat maakt hem
   gevaarlijk, want niet elke drempel in dit huis komt uit risico voort. Een
   KYC-besluit is zwaar omdat een mens naar een document hoort te kijken, niet
   omdat het duur is. Die grens is niet in een score te vangen: op een
   scoreschaal is "een mens moet dit doen" gewoon een hoog getal, en dan is er
   altijd een combinatie van vertrouwde omstandigheden die eronder duikt.

   De toetsen hieronder bewaken één eigenschap: FRICTIE MAG OMHOOG VAN DE
   OMSTANDIGHEDEN EN OMLAAG VAN NIETS.

   DE MUTATIES VOOR DIT BESTAND, elk een keer gedraaid en zien zakken:
     1. haal in kern/frictie/index.js `strengsteNiveau` weg uit beoordeel()
        (geef `uit.niveau` terug) -> "de bodem verzwaart" zakt;
     2. zet in kern/stuur/beleid.js de bodemtak boven `opDeLijst` uit
        -> "een pad met bodem hand is verboden voor het stuur" zakt;
     3. zet bodemregel 'kyc-besluit' op minimum 'auto'
        -> "geen enkele bodemregel staat op auto" zakt bij het laden.
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const frictie = require('../server/kern/frictie');
const { BODEM, bodemVoorPad, strengsteNiveau, keurBodem } = frictie;
const { beleidVoor, DIRECT, VOORSTEL } = require('../server/kern/stuur/beleid');

/* Een beleid dat alles op de standaardwaarde laat: de bodem moet werken zonder
   dat er iets in het beleidsregister is gezet. */
const beleid = { getal: (k, d) => d, waarde: (k, d) => d };
const F = frictie.maakFrictie({ beleid });
/* De kale motor ernaast: hij weet niets van de bodem, en is daarmee het
   ijkpunt waartegen "de bodem verzwaart alleen" te meten is. */
const MOTOR = require('../server/kern/frictie/motor').maakRisico({ beleid });

const ORDE = { auto: 0, assist: 1, hand: 2 };

test('elke bodemregel draagt een reden en een bron', () => {
  for (const r of BODEM) {
    assert.ok(r.reden && r.reden.length > 20, r.id + ' mist een uitgeschreven reden');
    assert.ok(r.bron && r.bron.length > 5, r.id + ' mist een bron');
  }
});

test('geen enkele bodemregel staat op auto -- dat is geen bodem maar een vrijbrief', () => {
  for (const r of BODEM) assert.notEqual(r.minimum, 'auto', r.id);
  assert.throws(() => keurBodem([{ id: 'proef', pad: /x/, minimum: 'auto', reden: 'x'.repeat(30), bron: 'proef' }]),
    /vrijbrief/);
});

test('een regel zonder bron komt er niet in', () => {
  assert.throws(() => keurBodem([{ id: 'proef', pad: /x/, minimum: 'hand', reden: 'x'.repeat(30) }]),
    /mist een reden of een bron/);
});

test('de bodem verzwaart: een onschuldige handeling op een bodempad blijft niet auto', () => {
  /* 'lezen' scoort nul en zou zonder bodem `auto` zijn. Dat is de scherpste
     vorm van de vraag: de score zegt "veilig" en de grens zegt "een mens". */
  const zonder = F.beoordeel('lezen', {});
  assert.equal(zonder.niveau, 'auto');

  const met = F.beoordeel('lezen', { pad: '/api/office/verify' });
  assert.equal(met.niveau, 'hand');
  assert.equal(met.score, zonder.score, 'de bodem hoort de SCORE niet te veranderen, alleen het niveau');
  assert.equal(met.bodem.id, 'kyc-besluit');
  assert.ok(met.vierOgen, 'een handeling die de machine niet mag doen, glipt niet door een enkel paar ogen');
});

test('de bodem verlaagt nooit: geen enkel pad wordt er soepeler van', () => {
  /* De eigenschap in zijn algemene vorm, over elke regel die er is -- met het
     voorbeeldpad van de regel zelf, en niet met een pad dat uit het patroon is
     afgeleid. Die eerste versie was groen om de verkeerde reden: het afgeleide
     pad viel niet onder het patroon, dus was er helemaal geen bodem in beeld. */
  for (const r of BODEM) {
    if (!r.pad) continue;
    assert.ok(r.voorbeeld && r.pad.test(r.voorbeeld), r.id + ' heeft geen bruikbaar voorbeeld');
    /* De eigenschap zelf, en niet een gevalletje ervan: het niveau MET bodem is
       exact de strengste van (het oordeel van de motor, het minimum). Zo toetst
       hij ook de kant die makkelijk sneuvelt -- de bodem mag een handeling die
       de motor al zwaarder vond niet naar zijn eigen minimum TERUGtrekken. */
    for (const actie of ['lezen', 'notitie', 'beleid zetten', 'massamutatie']) {
      const kaal = MOTOR.beoordeel(actie, {}).niveau;
      const met = F.beoordeel(actie, { pad: r.voorbeeld }).niveau;
      assert.equal(met, strengsteNiveau(kaal, r.minimum),
        r.voorbeeld + ' + ' + actie + ': ' + kaal + ' + bodem ' + r.minimum + ' gaf ' + met);
      assert.ok(ORDE[met] >= ORDE[kaal], r.voorbeeld + ' werd lichter van de bodem');
    }
  }
});

test('een padregel zonder voorbeeld komt er niet in, en een voorbeeld dat er niet onder valt evenmin', () => {
  assert.throws(() => keurBodem([{ id: 'proef', pad: /^\/api\/x/, minimum: 'hand',
    reden: 'x'.repeat(30), bron: 'proef' }]), /mist een voorbeeldpad/);
  assert.throws(() => keurBodem([{ id: 'proef', pad: /^\/api\/x/, minimum: 'hand',
    reden: 'x'.repeat(30), bron: 'proef', voorbeeld: '/api/y' }]), /valt niet onder het eigen patroon/);
});

test('strengsteNiveau kiest altijd de strengste, in beide volgordes', () => {
  const treden = ['auto', 'assist', 'hand'];
  for (const a of treden) for (const b of treden) {
    const uit = strengsteNiveau(a, b);
    assert.equal(uit, ORDE[a] >= ORDE[b] ? a : b);
    assert.equal(uit, strengsteNiveau(b, a), 'de volgorde van de twee mag niet uitmaken');
  }
  assert.equal(strengsteNiveau(null, 'assist'), 'assist');
  assert.equal(strengsteNiveau('assist', null), 'assist');
});

/* ---- de koppeling met het AI-stuur ---- */

test('een pad met bodem hand is verboden voor het stuur, ook met een geldige rol', () => {
  const uit = beleidVoor('/api/aanmelding/beslis', 'member');
  assert.equal(uit.niveau, 'verboden');
  assert.equal(uit.bodem, 'pasbesluit');
  assert.ok(uit.bron, 'een weigering zonder herkomst is niet te beoordelen');
});

test('een pad met bodem assist komt nooit als direct terug', () => {
  for (const wereld of Object.keys(DIRECT)) {
    for (const p of ['/api/bank/sepa', '/api/bank/bulk', '/api/bank/salaris', '/api/pay/uitbetaal']) {
      const uit = beleidVoor(p, wereld);
      assert.notEqual(uit.niveau, 'direct', p + ' (' + wereld + ') kwam als direct terug');
    }
  }
});

test('de bodem raakt alleen wat hij moet raken: gewone leesroutes blijven direct', () => {
  /* `direct` is inmiddels GESPLITST in `lezen` en `klein` (EXECUTIE.md blok 2);
     DIRECT bestaat nog als de vereniging van die twee. Deze toets vraagt of de
     bodem een gewone leesroute NIET aanraakt, en dat antwoord is sindsdien
     preciezer: `lezen` in plaats van `direct`. De vraag verandert niet -- wat
     hier nooit mag staan is `voorstel` of `verboden`, want dan heeft de bodem
     een route geraakt die hij met rust hoort te laten. */
  const DIRECT_FAMILIE = ['lezen', 'klein'];
  for (const [pad, wereld] of [['/api/pay/saldo', 'member'], ['/api/agenda/mijn', 'member'],
    ['/api/supplier/state', 'supplier']]) {
    const uit = beleidVoor(pad, wereld);
    assert.ok(DIRECT_FAMILIE.includes(uit.niveau),
      pad + ' (' + wereld + ') kwam terug als ' + uit.niveau + ' -- de bodem hoort een gewone ' +
      'leesroute niet te raken');
    assert.equal(uit.bodem, undefined, pad + ' draagt een bodem en dat hoort niet');
  }
});

test('geen pad op een DIRECT-lijst draagt een bodem die hem tegenspreekt', () => {
  /* Dit is de toets die morgen zakt in plaats van vandaag: wie een pad aan de
     DIRECT-lijst toevoegt dat de bodem raakt, hoort dat hier te horen -- en
     niet pas als de AI het stil heeft uitgevoerd. De lijsten dragen regexen,
     dus we toetsen op de bodempaden zelf. */
  const voorbeelden = ['/api/office/verify', '/api/office/vakbewijs/keur', '/api/aanmelding/beslis',
    '/api/auth/login', '/api/account/koppel', '/api/techniek/stand', '/api/boardroom/wie'];
  for (const p of voorbeelden) {
    const b = bodemVoorPad(p);
    assert.ok(b, p + ' raakt geen bodemregel meer');
    for (const wereld of Object.keys(DIRECT)) {
      assert.equal(beleidVoor(p, wereld).niveau, 'verboden', p + ' is niet verboden in ' + wereld);
    }
  }
});

test('een stapel waarin een geval de bodem raakt, gaat niet in de veilige hoop', () => {
  const uit = F.routeer([
    { ctx: {} },
    { ctx: { pad: '/api/office/verify' } },
    { ctx: {} }
  ], 'lezen', {});
  assert.equal(uit.veilig.length, 2);
  assert.equal(uit.mens.length, 1);
  assert.equal(uit.mens[0].oordeel.bodem.id, 'kyc-besluit');
});

test('de bodem sluit geen enkel pad af dat een mens ooit heeft goedgekeurd', () => {
  /* DE REGRESSIETOETS VAN DEZE HELE KOPPELING. Een bodem die een bestaande,
     beoordeelde route stilletjes dichtzet, is geen extra veiligheid maar een
     storing -- en wel een die pas opvalt als een lid iets niet meer kan.

     Hij loopt over ALLE paden op beide allowlists, uit de lijsten zelf en niet
     uit een kopie: komt er morgen een pad bij dat de bodem raakt, dan hoort dat
     hier te blijken. Bij het schrijven waren het er 176, waarvan er 4 een bodem
     raken -- alle vier op `assist`, en alle vier stonden ze al op VOORSTEL. De
     koppeling verandert vandaag dus niets aan wat er kan; ze legt vast dat het
     zo blijft. */
  const uit = (re) => {
    const bron = re.source.replace(/^\^|\$$/g, '').replace(/\\\//g, '/');
    const m = bron.match(/^([^(]*)\(([^)]*)\)(.*)$/);
    return m ? m[2].split('|').map(a => m[1] + a + m[3]) : [bron];
  };
  let geraakt = 0, getoetst = 0;
  for (const lijst of [DIRECT, VOORSTEL]) {
    for (const wereld of Object.keys(lijst)) {
      for (const re of lijst[wereld]) {
        for (const pad of uit(re)) {
          if (/[\[\]?*+]/.test(pad)) continue;      // geen concreet pad; die toetsen we niet
          getoetst++;
          const oordeel = beleidVoor(pad, wereld);
          assert.notEqual(oordeel.niveau, 'verboden',
            pad + ' (' + wereld + ') is door de bodem afgesloten: ' + (oordeel.reden || ''));
          if (bodemVoorPad(pad)) {
            geraakt++;
            assert.equal(oordeel.niveau, 'voorstel',
              pad + ' raakt een bodem en hoort dan minstens een voorstel te zijn');
          }
        }
      }
    }
  }
  assert.ok(getoetst > 100, 'er horen ruim honderd paden op de lijsten te staan, niet ' + getoetst);
  assert.ok(geraakt >= 4, 'de bodem hoort de vier geldpaden te raken; hij raakte er ' + geraakt);
});

test('VOORSTEL en DIRECT blijven bestaan: de bodem vervangt de allowlist niet', () => {
  assert.ok(Object.keys(DIRECT).length >= 3 && Object.keys(VOORSTEL).length >= 3);
  assert.equal(beleidVoor('/api/onbekend/pad', 'member').niveau, 'verboden');
});

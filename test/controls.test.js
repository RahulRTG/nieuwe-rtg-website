/* HET CONTROLREGISTER (scripts/controls.js) en het uitzendcontract uit TOEZICHT.md.

   WAAROM DEZE TOETS ER IS. TOEZICHT.md legt vast dat elke beheersmaatregel zes
   velden uitzendt, zodat de regulatory-laag er later op kan staan zonder dat we
   twintig bewijzen opnieuw moeten aanraken. Een contract dat alleen in een
   document staat, is een voornemen: bij de vijfde control vergeet iemand een
   veld, en dan is de laag erboven weer met de hand bij te houden.

   TWEE DINGEN WORDEN HIER HARD GEMAAKT.

   1. ELK VELD IS ER, en `grens` in het bijzonder. Een control zonder
      opgeschreven grens wordt bij het mappen naar een wettelijke eis
      onvermijdelijk te ruim gelezen: dan dekt één toets op papier drie eisen
      die hij in werkelijkheid niet raakt. Dat is de duurste fout die deze
      stapel kan maken, en hij is met een leeg tekstveld te maken.

   2. OVERGESLAGEN IS GEEN GROEN. Een e2e-bestand slaat zichzelf over als er
      geen browser is; Node meldt dan nul mislukkingen. Zou dat als PASS tellen,
      dan zetten op een kale CI juist de controls die het meest over de
      buitenkant beweren zichzelf groen. Dat is compliance-theater met een
      testrunner eronder.

   Draai los: node --test test/controls.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { verzamel, duidUitslag, VELDEN, BRONNEN } = require('../scripts/controls');

const WORTEL = path.join(__dirname, '..');
const controls = verzamel();

/* ---------- het uitzendcontract ---------- */

test('elke opgeschreven bron verklaart ook echt een control', () => {
  const stuk = controls.filter(c => c.stuk);
  assert.deepEqual(stuk, [], 'een bron in de lijst die niets verklaart, is een lege regel in het register');
  assert.equal(controls.length, BRONNEN.length);
});

test('elke control draagt alle zes velden uit TOEZICHT.md', () => {
  for (const c of controls) {
    for (const v of VELDEN) {
      const w = c[v];
      const leeg = w == null || (typeof w === 'string' && !w.trim()) || (Array.isArray(w) && !w.length);
      assert.ok(!leeg, (c.control || c.bron) + ' mist het veld ' + v);
    }
  }
});

test('geen enkele control laat zijn grens leeg of vaag', () => {
  /* Een grens van drie woorden is geen grens. De lengte is een grove maat, maar
     hij vangt wel het geval waar het om gaat: het veld invullen met "n.v.t."
     om langs deze toets te komen. */
  for (const c of controls) {
    assert.ok(c.grens.length > 40,
      c.control + ' heeft een grens van ' + c.grens.length + ' tekens; dat is te kort om iets uit te sluiten');
  }
});

test('elk genoemd bewijsbestand bestaat ook echt', () => {
  for (const c of controls) {
    for (const b of c.bewijs) {
      assert.ok(fs.existsSync(path.join(WORTEL, b)),
        c.control + ' noemt ' + b + ', maar dat bestand staat er niet');
    }
  }
});

test('control-ids zijn uniek -- twee controls met dezelfde naam maken de mapping onbruikbaar', () => {
  const ids = controls.map(c => c.control);
  assert.equal(new Set(ids).size, ids.length);
});

test('een eigenaar is een rol en geen persoon', () => {
  /* Een persoonsnaam in een controlregister verouderd zodra iemand van functie
     wisselt, en dan wijst het bewijs naar niemand. */
  for (const c of controls) {
    assert.match(c.eigenaar, /^(Security|Techniek|Compliance|Bestuur|Privacy)$/,
      c.control + ' heeft eigenaar "' + c.eigenaar + '"; dat hoort een rol te zijn');
  }
});

/* ---------- overgeslagen is geen groen ---------- */

test('een ronde waarin alles is overgeslagen, is NIET gemeten', () => {
  const uit = duidUitslag('# tests 1\n# pass 0\n# fail 0\n# skipped 1\n');
  assert.equal(uit.staat, 'niet gemeten');
  assert.equal(uit.reden, 'alles overgeslagen');
  assert.notEqual(uit.staat, 'GROEN');
});

test('een ronde die niets draaide, is ook niet gemeten', () => {
  assert.equal(duidUitslag('# pass 0\n# fail 0\n# skipped 0\n').staat, 'niet gemeten');
  assert.equal(duidUitslag('').staat, 'niet gemeten');
});

test('een ronde met echte beweringen is groen, en telt ze', () => {
  const uit = duidUitslag('# tests 20\n# pass 20\n# fail 0\n# skipped 0\n');
  assert.equal(uit.staat, 'GROEN');
  assert.equal(uit.beweringen, 20);
});

test('deels overgeslagen telt als groen zolang er echt iets is gedraaid', () => {
  /* De schermtoets slaat zichzelf over zonder browser terwijl de pure toets
     ernaast wel draait. Dat is een gemeten control met een gat, en het gat
     staat erbij -- anders zou een control met een e2e ernaast nooit groen
     kunnen worden op een machine zonder browser. */
  const uit = duidUitslag('# pass 17\n# fail 0\n# skipped 1\n');
  assert.equal(uit.staat, 'GROEN');
  assert.equal(uit.overgeslagen, 1);
});

/* ---------- het vastgelegde register ---------- */

test('CONTROLS.json is gemeten en niet opgeschreven', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'CONTROLS.json'), 'utf8'));
  assert.equal(reg.controls.length, controls.length,
    'het register loopt achter op de verklaarde controls -- draai npm run controls:vast');
  for (const c of reg.controls) {
    assert.ok(c.laatstGroen, c.control + ' heeft geen gemeten uitslag');
    if (c.laatstGroen.staat === 'GROEN') {
      assert.ok(c.laatstGroen.at, c.control + ' staat groen zonder tijdstempel; dan is "recent bewezen" niet te zien');
      assert.ok(c.laatstGroen.beweringen > 0, c.control + ' staat groen op nul beweringen');
    }
  }
});

test('het register scheidt aanwezig van recent bewezen', () => {
  /* Dat onderscheid is waar de Audit Room straks op draait. Zou de staat
     ontbreken, dan leest "de control bestaat" als "de control werkt". */
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'CONTROLS.json'), 'utf8'));
  assert.equal(typeof reg.gemeten.controls, 'number');
  assert.equal(reg.gemeten.groen + reg.gemeten.nietGroen, reg.gemeten.controls);
});

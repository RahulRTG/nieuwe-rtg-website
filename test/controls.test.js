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
const { verzamel, duidUitslag, staatVan, leesDekking, uitPad, VELDEN, BRONNEN } = require('../scripts/controls');

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

/* ---------- de derde stand: ontworpen maar niet in bedrijf ---------- */

test('een control die niet in bedrijf is, kan met GEEN ENKELE uitslag groen worden', () => {
  /* Dit is de fout die dit register zelf maakte: AUDIT-KETEN-VERANKERD stond
     groen op dertig beweringen terwijl er nergens een anker wordt weggezet. Het
     MECHANISME was bewezen, de control werkte niet -- en bij een wettelijke eis
     is dat het hele verschil. */
  const uit = staatVan({ inBedrijf: false }, { staat: 'GROEN', beweringen: 30 });
  assert.equal(uit.staat, 'NIET IN BEDRIJF');
  assert.equal(uit.mechanismeBewezen, true, 'dat het mechanisme klopt, mag wel blijven staan');
  assert.match(uit.reden, /niet in gebruik/);
});

test('een control die niet in bedrijf is en ook nog zakt, wordt niet mooier gemaakt', () => {
  const uit = staatVan({ inBedrijf: false }, { staat: 'GEZAKT', gezakt: 3 });
  assert.equal(uit.staat, 'NIET IN BEDRIJF');
  assert.equal(uit.mechanismeBewezen, false);
});

test('een gewone control gaat ongemoeid door staatVan heen', () => {
  const in_ = { staat: 'GROEN', beweringen: 5 };
  assert.deepEqual(staatVan({ control: 'X' }, in_), in_);
  assert.deepEqual(staatVan({ control: 'X', inBedrijf: true }, in_), in_);
});

test('de verankering verklaart zichzelf eerlijk als niet in bedrijf', () => {
  const v = controls.find(c => c.control === 'AUDIT-KETEN-VERANKERD');
  assert.ok(v, 'de verankering hoort als eigen control te bestaan en niet als voetnoot');
  assert.equal(v.inBedrijf, false);
  assert.match(v.grens, /NIET IN BEDRIJF/);
});

test('de lokale keten claimt niet wat alleen een anker kan zien', () => {
  /* Zonder deze toets kan iemand later de grens-tekst opschonen tot iets
     geruststellends, en dan dekt AUDIT-KETEN-LOKAAL op papier een eis af die
     hij aantoonbaar niet raakt. */
  const k = controls.find(c => c.control === 'AUDIT-KETEN-LOKAAL');
  assert.match(k.grens, /NIEUWSTE|kop/i);
  assert.match(k.grens, /VERANKERD/);
});

/* ---------- de noemer: groen zonder x/y bestaat niet ---------- */

test('elke control verklaart WAAR zijn dekking staat', () => {
  /* ROL-SCHEIDING stond GROEN op "0 doorbraken". Waar, en bij een snelle blik
     groter dan het bewijs: er waren 1000 van de 3985 routes geprobeerd. Elke
     control hier meet een deelverzameling, dus elke control hoort zijn noemer
     te tonen. */
  for (const c of controls) {
    assert.ok(c.dekking, c.control + ' verklaart geen dekking; dan leest zijn groen als een uitspraak over het geheel');
    assert.ok(c.dekking.eenheid && c.dekking.eenheid.length > 3,
      c.control + ' noemt geen eenheid -- "12 / 40" zonder waarvan zegt niets');
  }
});

test('de dekking wordt UIT HET REGISTER gelezen en niet door de control opgeschreven', () => {
  for (const c of controls) {
    const d = leesDekking(c.dekking);
    assert.ok(d && !d.stuk, c.control + ': ' + ((d && d.stuk) || 'geen dekking te lezen'));
    assert.equal(typeof d.beproefd, 'number');
    assert.equal(typeof d.totaal, 'number');
    assert.ok(d.beproefd <= d.totaal,
      c.control + ' beweert ' + d.beproefd + ' van ' + d.totaal + ' -- meer beproefd dan er bestaat');
    assert.ok(d.totaal > 0, c.control + ' heeft een noemer van nul; dan is elk percentage onzin');
  }
});

test('een teller die niet in het register staat, wordt niet stilletjes nul', () => {
  /* Nul is de geruststellendste manier om "ik weet het niet" te zeggen. */
  const d = leesDekking({ register: 'ROLPROEF.json', beproefd: 'gemeten.beproefd',
    totaal: 'gemeten.routesMetRol', eenheid: 'routes', tellers: { verzonnen: 'gemeten.bestaatNiet' } });
  assert.equal(d.tellers.verzonnen, null);
});

test('een dekking die naar een onbestaand register wijst, meldt zich als stuk', () => {
  const d = leesDekking({ register: 'BESTAATNIET.json', beproefd: 'a', totaal: 'b', eenheid: 'x' });
  assert.match(d.stuk, /niet te lezen/);
});

test('uitPad leest een getal uit een pad en geeft niets terug bij onzin', () => {
  assert.equal(uitPad({ a: { b: 3 } }, 'a.b'), 3);
  assert.equal(uitPad({ a: { b: 3 } }, 'a.c'), null);
  assert.equal(uitPad({ a: 'tekst' }, 'a'), null, 'een tekst is geen teller');
  assert.equal(uitPad({}, 12), 12, 'een vast getal mag, voor een noemer die nergens geteld wordt');
});

test('de rolproef toont de vier tellers die bij zijn oordeel horen', () => {
  const c = controls.find(x => x.control === 'ROL-SCHEIDING');
  const d = leesDekking(c.dekking);
  for (const t of ['doorbraken', 'lekken', 'zijeffecten', 'blindeRondes']) {
    assert.equal(typeof d.tellers[t], 'number',
      'ROL-SCHEIDING mist de teller ' + t + '; nul doorbraken zonder nul blinde rondes zegt niets');
  }
});

/* ---------- de bewijssoort blijft zichtbaar ---------- */

test('een control met een handmatige stap noemt die als eigen bewijssoort', () => {
  /* Zonder dit veld verdwijnt "met de hand nagetrokken" tussen de automatisch
     bewezen controls, en dan leest een lezer meer zekerheid dan er is. Dat is
     precies de fout die dit hele register moest voorkomen -- alleen hier op het
     niveau van HOE iets bewezen is in plaats van OF. */
  const g = controls.find(c => c.control === 'GELD-DURABILITY');
  assert.ok(g, 'de duurzaamheidsprimitive hoort een eigen control te zijn');
  assert.ok(g.bewijssoorten, 'zonder bewijssoorten leest een handmatige stap als automatisch');
  assert.equal(g.bewijssoorten.poortbewijs, 'HANDMATIG GEREPRODUCEERD');
  assert.equal(g.bewijssoorten['geldcommit aangesloten'], 'NIET AANGESLOTEN');
});

test('geen bewijssoort zegt PROVEN zonder dat te zijn', () => {
  /* Elke waarde is of een bewijs, of een expliciete niet-bewijs-stand. Een
     leeg veld of een vaag woord zou het onderscheid weer wegpoetsen. */
  const toegestaan = ['PROVEN', 'SELF-TESTED', 'HANDMATIG GEREPRODUCEERD',
    'NOT APPLICABLE', 'NIET AANGESLOTEN', 'ONGEMETEN'];
  for (const c of controls) {
    for (const [soort, hoe] of Object.entries(c.bewijssoorten || {})) {
      assert.ok(toegestaan.includes(hoe),
        c.control + '/' + soort + ' heeft bewijssoort "' + hoe + '", en die staat niet op de lijst');
    }
  }
});

test('het register bewaart de bewijssoorten, zodat een lezer ze terugvindt', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'CONTROLS.json'), 'utf8'));
  const g = reg.controls.find(c => c.control === 'GELD-DURABILITY');
  assert.ok(g && g.bewijssoorten && g.bewijssoorten.poortbewijs,
    'CONTROLS.json loopt achter -- draai npm run controls:vast');
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
      assert.ok(c.dekking && typeof c.dekking.beproefd === 'number',
        c.control + ' staat GROEN in het register zonder noemer -- dat is precies wat groter leest dan het bewijs');
    }
  }
});

test('het register scheidt aanwezig van recent bewezen', () => {
  /* Dat onderscheid is waar de Audit Room straks op draait. Zou de staat
     ontbreken, dan leest "de control bestaat" als "de control werkt". */
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'CONTROLS.json'), 'utf8'));
  assert.equal(typeof reg.gemeten.controls, 'number');
  assert.equal(reg.gemeten.groen + reg.gemeten.nietGroen + reg.gemeten.nietInBedrijf,
    reg.gemeten.controls, 'elke control valt in precies een stand');
  assert.ok(reg.gemeten.nietInBedrijf >= 1,
    'de verankering hoort zichtbaar in de niet-in-bedrijf-stand te staan');
});

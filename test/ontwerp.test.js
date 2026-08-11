/* RTG Design System 2.0: de regels uit ONTWERP.md, machinaal gehandhaafd.

   Waarom deze toets bestaat. Een ontwerpregel die alleen in een document staat,
   is over drie maanden twintig stijlen -- niet omdat iemand hem negeert, maar
   omdat niemand hem op het juiste moment terugleest. De regels hieronder zijn
   precies die welke je aan een scherm niet ziet: dat een modus een token mist
   valt pas op als iemand dat scherm in die modus opent, en dat een status
   alleen op kleur leunt valt pas op bij wie kleur niet ziet.

   Wat deze toets NIET doet: smaak beoordelen. Hij meet alleen dingen die of waar
   of onwaar zijn. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const lees = (p) => fs.readFileSync(path.join(WORTEL, p), 'utf8');
const CSS = lees('public/shared/rtg-ontwerp.css');

/* De vier maten die samen "dichtheid" zijn. Zet een modus er drie, dan erft de
   vierde van de vorige modus en staat het scherm er half tussenin. */
const DICHTHEID = ['--rtg-regel', '--rtg-ruim', '--rtg-ruim-klein', '--rtg-tekst'];
const MODI = ['world', 'pro', 'command'];

/* De regels uit het blad, als (kiezers, inhoud). Eerst op ; en { } splitsen en
   pas daarna zoeken, want een naïeve indexOf('.rtg-kpi') vindt die naam ook in
   de GEGROEPEERDE kiezer erboven en levert dan het verkeerde blok. Daar zakte
   de eerste versie van deze toets op, en terecht. */
/* Commentaar eerst weg. Dit blad legt per component uit WAAROM hij bestaat, en
   in die zinnen staan komma's -- zonder deze stap wordt de toelichting boven een
   regel als kiezer gelezen en splitst hij in brokken tekst die nergens op slaan.
   De eerste versie van deze toets vlagde daardoor het staartje van een
   toelichting aan met de klassenaam eraan geplakt, als verboden serif-rol. */
const REGELS = CSS.replace(/\/\*[\s\S]*?\*\//g, '').split('}')
  .map((brok) => {
    const i = brok.indexOf('{');
    if (i < 0) return null;
    const kiezers = brok.slice(0, i).split(',').map((s) => s.trim()).filter(Boolean);
    return { kiezers, inhoud: brok.slice(i + 1) };
  })
  .filter(Boolean);

// het blok van precies deze kiezer; bij meerdere treffers alles aaneen, want
// een kiezer mag verderop worden aangevuld.
function blokVan(kies) {
  const treffers = REGELS.filter((r) => r.kiezers.includes(kies));
  return treffers.length ? treffers.map((r) => r.inhoud).join('\n') : null;
}

test('elke modus zet ALLE dichtheidsmaten, niet een deel', () => {
  /* DE MUTATIE DIE DEZE TOETS HOORT TE LATEN ZAKKEN: haal --rtg-tekst weg uit
     [data-rtg-modus="command"]. Command erft dan de tekstgrootte van World,
     terwijl regelhoogte en ruimte wel krimpen -- een register met te grote
     letters in te lage regels. Dat ziet er "bijna goed" uit, en dat is de
     ergste soort fout. */
  for (const modus of MODI) {
    const blok = blokVan('[data-rtg-modus="' + modus + '"]') ||
      (modus === 'world' ? blokVan('[data-rtg-modus="world"]') : null);
    assert.ok(blok, 'modus ' + modus + ' hoort een eigen tokenblok te hebben');
    for (const t of DICHTHEID) {
      assert.match(blok, new RegExp(t.replace(/-/g, '\\-') + '\\s*:'),
        'modus ' + modus + ' mist ' + t + ' -- een half gevulde modus erft de rest en staat ertussenin');
    }
  }
});

test('een modus zet alleen dichtheid, nooit kleur of lettertype', () => {
  /* Dit is de regel die van World, Pro en Command ÉÉN systeem maakt in plaats
     van drie producten (ONTWERP.md par. 2). Zodra een modus een kleur of een
     font mag overschrijven, is "dezelfde app in een andere dichtheid" een
     belofte zonder grond. */
  for (const modus of MODI) {
    const blok = blokVan('[data-rtg-modus="' + modus + '"]');
    if (!blok) continue;
    assert.ok(!/color|background|font-family|--rtg-goud|--rtg-acc|--rtg-bg/.test(blok),
      'modus ' + modus + ' verandert kleur of lettertype; een modus mag alleen dichtheid zetten:\n' + blok.trim());
  }
});

test('serif staat op een gesloten lijst rollen en nergens anders', () => {
  /* Bodoni is ceremonieel. Een signatuur die overal staat is geen signatuur;
     dat is precies waarom het geheel vlak aanvoelde. */
  const TOEGESTAAN = ['.rtg-ceremonie', '.rtg-kpi', '.rtg-datum', '.rtg-plaats'];
  /* "sans-serif" bevat het woord serif. Die eerst weghalen, anders vlagt deze
     toets juist de Inter-regels -- de werk-rollen -- als ceremonieel. Ook dat
     zakte in de eerste versie. */
  const isSerif = (inhoud) => {
    const f = /font-family\s*:([^;]*)/i.exec(inhoud);
    if (!f) return false;
    return /\b(bodoni|(?:^|[^-\w])serif)\b/i.test(f[1].replace(/sans-serif/gi, ''));
  };
  const serifKiezers = REGELS.filter((r) => isSerif(r.inhoud)).flatMap((r) => r.kiezers);
  assert.ok(serifKiezers.length, 'er hoort een serif-rol te bestaan, anders bewijst deze toets niets');
  for (const d of serifKiezers) {
    assert.ok(TOEGESTAAN.includes(d),
      'serif staat op "' + d + '", en dat hoort niet: alleen ' + TOEGESTAAN.join(', ') +
      ' mogen ceremonieel zijn (ONTWERP.md par. 1)');
  }
});

test('alles wat een getal draagt, lijnt uit', () => {
  /* Tabulaire cijfers zijn het verschil tussen een website met getallen en een
     instrument. Elke klasse die een bedrag, referentie of teller draagt, hoort
     het token te gebruiken -- en niet zijn eigen font-variant te verzinnen. */
  for (const klasse of ['.rtg-ref', '.rtg-bedrag', '.rtg-teller', '.rtg-kpi']) {
    const blok = blokVan(klasse) || '';
    assert.ok(/tabular-nums|var\(--rtg-cijfers\)/.test(blok),
      klasse + ' hoort tabulaire cijfers te dragen (ONTWERP.md par. 8)');
  }
});

test('status leunt nooit op kleur alleen', () => {
  /* Voor wie kleur niet ziet, en op een zwart-witte print. Het teken komt uit
     het HTML-attribuut en niet uit een klasse, zodat het in de inhoud staat en
     niet alleen in een stylesheet die kan wegvallen.

     DE MUTATIE: haal de ::after met attr(data-teken) weg. De statussen zien er
     dan nog steeds prima uit -- in kleur. */
  const blok = blokVan('.rtg-status::after');
  assert.ok(blok, '.rtg-status hoort een teken te tonen');
  assert.match(blok, /content\s*:\s*attr\(data-teken\)/,
    'het teken hoort uit data-teken te komen, zodat het in de inhoud staat');

  // en er is minstens één toestand die ALLEEN kleur zet: die mag niet bestaan
  // zonder dat het teken-mechanisme erboven staat.
  assert.match(CSS, /\.rtg-status\[data-sig="incident"\]/,
    'de toestanden horen als data-sig te bestaan, niet als losse kleurklassen');
});

test('de signaalrail is zonder toestand onopvallend', () => {
  /* "Gezond" hoort geen aandacht te trekken (ONTWERP.md par. 3). Zou de rail
     zonder toestand al groen zijn, dan schreeuwt elk normaal object mee en is
     de rail waardeloos op het moment dat het ertoe doet. */
  const basis = blokVan('.rtg-rail::before');
  assert.ok(basis, 'de rail hoort een basisregel te hebben');
  assert.match(basis, /background:\s*var\(--rtg-sig-stil\)/,
    'zonder toestand hoort de rail de gewone haarlijn te zijn en geen kleur');
});

test('beweging is in tokens uitgedrukt en gaat uit als het toestel dat vraagt', () => {
  assert.match(CSS, /--rtg-tijd-kort\s*:/, 'de duren horen tokens te zijn, geen losse getallen per animatie');
  assert.match(CSS, /prefers-reduced-motion/,
    'elke animatie hoort uit te gaan bij prefers-reduced-motion');
  const rustig = CSS.slice(CSS.indexOf('prefers-reduced-motion'));
  assert.match(rustig, /animation\s*:\s*none/, 'en dan hoort de animatie echt uit te staan');
});

test('de tokenlaag zet geen tweede kleurenset naast rtg-ui.css', () => {
  /* LAT.md regel 4, op de vormtaal toegepast. Zou deze laag --rtg-goud of
     --rtg-bg opnieuw definiëren, dan zijn er twee plekken waar de huisstijl
     woont en lopen ze uit elkaar. De signaalkleuren zijn wél van deze laag:
     die gaan over toestand en niet over merk. */
  for (const merk of ['--rtg-goud', '--rtg-bg', '--rtg-txt', '--rtg-acc', '--rtg-card']) {
    assert.ok(!new RegExp('^\\s*' + merk + '\\s*:', 'm').test(CSS),
      merk + ' wordt hier opnieuw gezet; die hoort alleen in rtg-ui.css te staan');
  }
  for (const sig of ['--rtg-sig-gezond', '--rtg-sig-aandacht', '--rtg-sig-incident']) {
    assert.match(CSS, new RegExp(sig.replace(/-/g, '\\-') + '\\s*:'), sig + ' hoort hier te staan');
  }
});

test('ONTWERP.md en de tokenlaag beweren hetzelfde over de modi', () => {
  /* Een specificatie die uit de pas loopt met de code is erger dan geen
     specificatie: hij wordt geloofd. Deze toets leest de regelhoogtes uit de
     tabel in ONTWERP.md en vergelijkt ze met wat de CSS werkelijk zet. */
  const doc = lees('ONTWERP.md');
  const verwacht = { world: '56px', pro: '40px', command: '32px' };
  for (const [modus, hoogte] of Object.entries(verwacht)) {
    const blok = blokVan('[data-rtg-modus="' + modus + '"]');
    assert.ok(blok && blok.includes('--rtg-regel:' + hoogte),
      'de CSS zet voor ' + modus + ' een andere regelhoogte dan ' + hoogte);
    assert.ok(doc.includes(hoogte),
      'ONTWERP.md noemt ' + hoogte + ' niet meer, terwijl de CSS die wel zet');
  }
});

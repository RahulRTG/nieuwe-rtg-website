/* DE ROMEPROEF -- het instrument en zijn register.

   scripts/romeproef.js loopt de Rome-keten over LivingOS, WorkOS, TravelOS,
   het geld en de universele bodem van FoundationOS, tegen een wegwerpserver.
   Dat duurt een paar minuten en hoort daarom niet in een gewone toetsronde;
   dit bestand bewaakt het INSTRUMENT (dat het kan zakken, dat het niets
   verzint) en het vastgelegde REGISTER (dat elke open schakel een werklijstregel
   is en dat de drie grenzen van het besluit van 11 oktober 2026 erin zitten).

   DE MUTATIES DIE HET INSTRUMENT VERDIENDE, op 11 oktober 2026 gedraaid en
   gezien:
     - een product dat een genootschapsuitnodiging meteen tot lidmaatschap maakt
       (kern/genootschap/index.js nodigUit) liet schakel 2 op `open` en storing 1
       op `gebroken` zakken, met foutcode 1;
     - een organisator die het geldbeleid en Mijn tijd van de vriend te zien
       krijgt, liet storing 4 (MN-02) en storing 6 (budget) op `gebroken`
       zakken, met de gevonden merktekens erbij.
   Een storing die je niet hebt zien zakken is geen storing (LAT.md).

   Draai los: node --test test/romeproef.test.js
   De keten zelf: npm run romeproef (of romeproef:vast om het register te schrijven) */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'romeproef.js'), 'utf8');
const lees = (n) => JSON.parse(fs.readFileSync(path.join(WORTEL, n), 'utf8'));

test('0. de proef zakt op een open schakel zonder reden, en niet op een werklijstregel', () => {
  assert.match(bron, /uit\.sluit = .*t\.open === 0 && t\.stuk === 0 && t\.gebroken === 0 && t\.openBekend === 0/,
    'sluit hoort ALLE slechte uitkomsten te tellen, openBekend inbegrepen');
  assert.match(bron, /process\.exit\(u\.sluitMetBevinding \? 0 : 1\)/,
    'zonder foutcode op een echte open schakel is dit een meting en geen proef');
  assert.match(bron, /uit\.sluitMetBevinding =/, 'er is geen apart veld voor "loopt door, met een werklijst"');
  /* Een 5xx met een reden is nog steeds stuk: anders schrijft de proef een crash
     weg als een besluit. */
  assert.match(bron, /const vier = r && r\.status >= 400 && r\.status < 500;/);
  /* En een 4xx valt alleen onder een bevinding die OVER die weigering gaat:
     anders draagt een mislukte login de oorzaak van een andere schakel. */
  assert.match(bron, /const deur = vier && s\.bekend && s\.bekend\.weigering === true;/);
});

test('1. de proef draait op een wegwerpserver en raakt de ontwikkelserver niet', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
  assert.match(bron, /OFFICE_CODE: KANTOORCODE/, 'zonder eigen kantoorcode kan het reisbureau niets klaarzetten');
});

test('2. een zie-functie verandert de toestand niet', () => {
  /* Elke schakel heeft een doe- en een zie-functie. Een schrijfroute in de
     zie-functie meet de eigen ingreep. Een zie-functie is hier herkenbaar aan
     haar oordeel (`return { klopt`); het blok loopt van haar `async` tot dat
     oordeel en mag geen andere `async` oversteken, anders slokt hij de
     doe-functie ervoor op. */
  const { zonderCommentaar } = require('../scripts/lib/bron');
  const kaal = zonderCommentaar(bron);
  const blokken = [...kaal.matchAll(/async (?:\(\)|r|\(r\)) => \{((?:(?!async )[\s\S])*?)return \{ klopt/g)].map(m => m[1]);
  assert.ok(blokken.length >= 15, 'te weinig zie-functies gevonden (' + blokken.length + '); dan bewaakt deze toets niets');
  const schrijvend = /nodig-uit|\/binnen'|roep-bijeen|genootschap\/antwoord|richt-op|voorstel\/bevestig|pot\/zet|reisbureau\/boek|reisbureau\/betaal|klaarzetten|eisop|tijd\/verzoek|staff\/invite|werving\/verbind|gezelschap\/antwoord/;
  for (const b of blokken)
    assert.doesNotMatch(b, schrijvend, 'een zie-functie roept een schrijfroute aan; dan meet de proef zijn eigen ingreep:\n' + b.slice(0, 200));
});

test('3. de proef verzint geen route: elk pad dat hij aanroept, staat in de server', () => {
  /* De opdracht: "verzin geen route die er niet is". Een open schakel meet de
     dichtstbijzijnde BESTAANDE deur. Elk letterlijk pad in de proef moet dus
     ergens in server/ als letterlijk pad voorkomen. */
  const paden = [...new Set([...bron.matchAll(/'(\/api\/[a-z0-9/_-]+)'/g)].map(m => m[1]))];
  assert.ok(paden.length >= 25, 'te weinig paden gevonden (' + paden.length + ')');
  const teksten = [];
  (function loop(map) {
    for (const e of fs.readdirSync(map, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'data') continue;
      const p = path.join(map, e.name);
      if (e.isDirectory()) loop(p);
      else if (e.name.endsWith('.js')) teksten.push(fs.readFileSync(p, 'utf8'));
    }
  })(path.join(WORTEL, 'server'));
  const alles = teksten.join('\n');
  const verzonnen = paden.filter(p => !alles.includes("'" + p + "'"));
  assert.deepEqual(verzonnen, [], 'deze paden bestaan niet in de server: ' + verzonnen.join(', '));
});

test('4. elke open schakel is een werklijstregel: oorzaak, eigenaar, oplossing en soort', () => {
  const j = lees('ROMEPROEF.json');
  const open = j.schakels.filter(s => s.stand === 'openBekend');
  assert.equal(open.length, (j.werklijst || []).length, 'de werklijst loopt niet gelijk met de schakels');
  for (const s of open) {
    const b = s.bekend || {};
    assert.ok(['bouwen', 'besluit', 'extern'].includes(b.soort), 'schakel ' + s.nr + ': soort is bouwen, besluit of extern');
    for (const veld of ['oorzaak', 'eigenaar', 'oplossing'])
      assert.ok(b[veld] && b[veld].length > 60, 'schakel ' + s.nr + ': ' + veld + ' is te kort om een bevinding te zijn');
    assert.match(b.eigenaar, /server\/|\.md/, 'schakel ' + s.nr + ': de eigenaar wijst niet naar een bestand of document');
    assert.ok((s.ziet && s.ziet.length > 10) || s.antwoord,
      'schakel ' + s.nr + ': een open schakel hoort te zeggen wat de server WEL antwoordde');
  }
  /* En andersom: een schakel met een reden die gewoon sluit, houdt zijn reden
     niet als werklijstregel vast. Dat staat al in de telling: alleen
     openBekend komt op de werklijst. */
  for (const w of j.werklijst) assert.ok(w.oorzaak && w.oplossing && w.gemeten);
});

test('5. de drie grenzen van het besluit zitten in de storingen, en ze houden', () => {
  const j = lees('ROMEPROEF.json');
  const grenzen = j.storingen.map(s => s.grens).join(' | ');
  for (const g of [/MN-02/, /budget/, /menselijke regie/, /geld verlaat het huis niet vanzelf/])
    assert.match(grenzen, g, 'geen storing bewaakt de grens ' + g);
  for (const s of j.storingen) assert.equal(s.stand, 'gehouden', 'storing "' + s.naam + '" is gebroken: ' + s.wat);
});

test('6. het register telt op, raakt alle vier de werelden, en zegt wat het niet meet', () => {
  const j = lees('ROMEPROEF.json');
  const t = j.telling;
  assert.equal(t.gesloten + t.open + t.openBekend + t.stuk, t.schakels, 'de schakelstanden tellen niet op');
  assert.equal(t.gehouden + t.gebroken, t.storingen, 'de storingstanden tellen niet op');
  assert.ok(t.schakels >= 19 && t.storingen >= 8, 'te weinig schakels of storingen');
  assert.equal(t.open, 0, 'er staat een schakel open zonder reden -- draai npm run romeproef en repareer of verklaar');
  assert.equal(t.stuk, 0);
  assert.equal(j.sluitMetBevinding, true);
  for (const w of ['LivingOS', 'WorkOS', 'TravelOS', 'FoundationOS'])
    assert.ok(j.perWereld && j.perWereld[w] && j.perWereld[w].schakels > 0, w + ' komt in de keten niet voor');
  /* Per wereld en geen percentage: een samengesteld cijfer over vier werelden
     is de scorecard van LAT.md regel 11. */
  assert.doesNotMatch(JSON.stringify(j.perWereld), /pct|procent|score/i);
  assert.ok(j.grens && j.grens.length > 120, 'het register draagt geen uitgeschreven grens');
  assert.ok(j.stempel && j.stempel.commit, 'zonder stempel is het register niet na te lopen');
});

test('7. de proef deelt geen ketenmodule -- de vorm wordt gevonden, niet verklaard', () => {
  assert.doesNotMatch(bron, /require\(.*(lib\/keten|lib\/ketenvorm|lib\/proefvorm)/,
    'de romeproef hangt aan een gedeelde ketenmodule; dan meet ketenvorm.js zijn eigen aanname (de Asset-fout)');
});

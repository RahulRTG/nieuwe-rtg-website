/* Redactionele regressies, geen bewijs van operationele beschikbaarheid.
   De bestaande merk-, route-, prijs- en eigenaarstests blijven leidend voor
   hun eigen contracten. Hier bewaken we bronverantwoording en verhaalvorm. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const sections = [...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].map(match => match[0]);
const section = id => {
  const found = sections.filter(value => new RegExp('\\bid="' + id + '"').test(value));
  assert.equal(found.length, 1, id + ' heeft één bron');
  return found[0];
};
const text = value => value.replace(/<[^>]+>/g, ' ').replace(/&(?:amp|nbsp);/g, ' ').replace(/\s+/g, ' ').trim();
const words = value => text(value).split(/\s+/).filter(Boolean).length;

const stories = [
  {
    id: 'artikel-reizen', cover: 'reisverhaal',
    sources: ['server/kern/reizen.js', 'server/kern/invoer.js', 'server/kern/reisgezelschap-delen.js', 'server/routes/reis.js', 'PRIJZEN.md'],
    examples: [/eigen bevestiging/, /reisgenoot/, /aandachtspunten/],
    limits: [/pdf of foto[\s\S]*?niet automatisch uitgelezen/, /geen gewijzigde boeking/, /geen externe vluchtmonitoring/, /geen klantreportage/, /niet de verkoper/]
  },
  {
    id: 'artikel-leven', cover: 'goedeleven',
    sources: ['server/kern/avond/plan.js', 'server/kern/avond/aanvragen.js', 'server/kern/berichten/ai.js', 'server/kern/sociaal/dmpost.js'],
    examples: [/avondplanner/, /deelinstellingen/, /invoerveld/],
    limits: [/aangevraagd totdat de zaak heeft beslist/, /prijs ontbreekt[\s\S]*?zichtbaar/, /afhankelijk van een beschikbaar taalmodel/, /geen beschreven klantavond/i, /eigen rechten/]
  },
  {
    id: 'artikel-ondernemers', cover: 'ondernemen',
    sources: ['server/kern/onderneming/simulatie.js', 'server/kern/onderneming/dagbeeld.js', 'server/kern/onderneming/kas.js', 'server/bedrijf/rollen.js', 'PRIJZEN.md'],
    examples: [/eigen aannames/, /beginsaldo/, /Tijdelijke rechten/],
    limits: [/geen voorspelling van succes/, /Ontbrekende informatie is geen nulstand/, /afzonderlijke controle en vrijgave/, /geen volledige productievrijgave/, /geen volledige productievrijgave, omzetprognose, bankkoppeling/]
  },
  {
    id: 'artikel-foundation', cover: 'foundation-verhaal',
    sources: ['server/foundation/onderwijs.js', 'server/foundation/gezinstoegang.js', 'server/foundation/kostenpoort.js', 'server/kern/kosten/beleidkaart.js', 'server/kern/rtfos/ruil.js'],
    examples: [/lescode/, /kinderfiets/, /actieve lokale RTF-afdeling/],
    limits: [/niet automatisch tot erkende school/, /nog geen afspraak/, /volledig gratis/, /geen belofte dat iedere[\s\S]*?overal al aanwezig is/, /illustratieve situatie, geen gerapporteerde match/, /geen landelijke dekking/]
  }
];

function sourcePaths(sources) {
  // Een verkorte bestandsnaam hoort bij de laatst genoemde bronmap,
  // bijvoorbeeld reizen.js gevolgd door reiswereld.js in server/kern/.
  let directory = '';
  return [...sources.matchAll(/<code>([^<]+)<\/code>/g)].map(match => {
    const file = match[1];
    if (file.includes('/')) {
      directory = path.posix.dirname(file);
      return file;
    }
    return file.endsWith('.md') ? file : path.posix.join(directory, file);
  });
}

for (const story of stories) {
  test(story.id + ' verbindt concrete voorbeelden aan bestaande bronnen en expliciete grenzen', () => {
    const article = section(story.id);
    const sources = article.match(/<details class="ds-issue-sources">[\s\S]*?<\/details>/);
    assert.ok(sources, 'de verantwoording blijft bij het artikel');
    const paths = sourcePaths(sources[0]);
    assert.ok(paths.length >= 5, 'geen generieke verwijzing naar alleen de code');
    for (const file of paths) assert.ok(fs.existsSync(path.join(root, file)), file + ' bestaat als controleerbare bron');
    for (const file of story.sources) assert.ok(paths.includes(file), file + ' blijft vermeld');
    for (const example of story.examples) assert.match(article, example, 'het verhaal bevat een concreet gebruiksvoorbeeld');
    for (const limit of story.limits) assert.match(article, limit, 'de bijbehorende productgrens blijft zichtbaar');
    assert.match(sources[0], /geen[\s\S]*?(?:beschikbaar|productievrijgave)/i,
      'broninspectie wordt niet als algemene beschikbaarheid verkocht');
  });
}

test('de eindige coverbladen blijven kort; productdiepte staat achter een echte leesingang', () => {
  const leaves = sections.filter(value => /\bdata-issue-page\b/.test(value));
  assert.equal(leaves.length, 18);
  for (const leaf of leaves) {
    const id = leaf.match(/\bid="([^"]+)"/)[1];
    assert.ok(words(leaf) <= 80, id + ' blijft een blad om te bekijken, geen lang artikel');
    assert.doesNotMatch(leaf, /class="ds-issue-sources"|<code>/, 'bronverantwoording staat in de verdieping');
  }
  for (const story of stories) {
    const cover = section(story.cover);
    assert.match(cover, new RegExp('href="#' + story.id + '"'), 'het blad opent zijn eigen verhaal');
    const prose = section(story.id).match(/<div class="ds-issue-prose">([\s\S]*?)<\/div>/);
    assert.ok(prose, 'de leesinhoud heeft een eigen tekstvlak');
    assert.ok(words(prose[1]) >= 200, story.id + ' biedt meer dan een doorgeplaatste teaser');
    assert.ok((prose[1].match(/<h3>/g) || []).length >= 3, 'de verdieping is scanbaar');
    assert.ok((prose[1].match(/<p>/g) || []).length >= 6, 'de verdieping heeft uitgewerkte uitleg');
  }
});

test('de editie voegt geen verzonnen interviewantwoorden of klantcitaten toe', () => {
  const approvedAnswers = [
    '“Reizen, de mens en ondernemers”',
    '“Verrast door schoonheid, kunst en nieuwe perspectieven”',
    '“Een ingewikkeld systeem dat alleen voor een kleine elite werkt”'
  ];
  const interview = section('artikel-interview');
  assert.deepEqual([...interview.matchAll(/<dd>([\s\S]*?)<\/dd>/g)].map(match => text(match[1])), approvedAnswers);
  assert.match(interview, /letterlijk aangeleverd[\s\S]*?goedgekeurd[\s\S]*?geen gereconstrueerd interview/);
  // Een nieuw echt citaat kan worden toegevoegd na broncontrole en een
  // expliciete uitbreiding van deze lijst, niet als verzonnen testimonial.
  const quotations = [...html.matchAll(/<(?:blockquote|q)\b[^>]*>([\s\S]*?)<\/(?:blockquote|q)>/g)].map(match => text(match[1]));
  assert.deepEqual(quotations, [approvedAnswers[0], '“To see takes time, like to have a friend takes time.”']);
  assert.match(section('artikel-atelier'), /Georgia O’Keeffe[\s\S]*?https:\/\/www\.moma\.org\/audio\/playlist\/329\/4355/);
  for (const story of stories) assert.doesNotMatch(section(story.id), /<(?:blockquote|q|cite)\b/i,
    'productvoorbeelden worden niet als klantinterview gepresenteerd');
});

test('registertellingen heten onderdelen en zijn geen beschikbaarheidsbelofte', () => {
  const truth = read('public/site/website-truth.js');
  const countLines = truth.split('\n').filter(line => /\.textContent\s*=/.test(line) && /featureCount/.test(line));
  assert.equal(countLines.length, 3, 'wereldkaart, compacte teller en wereldpagina behouden hun telling');
  for (const line of countLines) assert.match(line, /onderdelen/, 'featureCount telt onderdelen, niet beschikbare apps');
  assert.match(truth, /een vermelding is geen beschikbaarheidsgarantie/);
  assert.match(truth, /toegang verschilt per functie/);
  assert.match(truth, /Toegang en beschikbaarheid verschillen per onderdeel/);
  assert.match(read('public/site/explore.js'), /world\.featureCount \+ ' onderdelen/);
  assert.match(read('public/site/platform-data.js'), /applications:say\('applications','onderdelen[^']*'/,
    'ook de compacte platformteller gebruikt geen app-aantal als productbelofte');
  assert.match(section('explore'), /toegang en beschikbaarheid verschillen per onderdeel/i);
});

'use strict';

/* Presentatiecontract, geen bewijs dat passen verkoopbaar of diensten live zijn.
   RTG Pass en TravelOS zijn de referenties; dezelfde lat geldt voor alle tien. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const CASES = [
  { file: 'passen/rtg-pass', pass: 'rtg' },
  { file: 'werelden/travelos', world: 'travel', scenario: 'travel', volume: true },
  { file: 'passen/community', pass: 'community' },
  { file: 'passen/business-lite', pass: 'business-lite' },
  { file: 'passen/business-pass', pass: 'business' },
  { file: 'passen/lifestyle-pass', pass: 'lifestyle' },
  { file: 'werelden/livingos', world: 'living', scenario: 'dinner', volume: true },
  { file: 'werelden/workos', world: 'work', scenario: 'work' },
  { file: 'werelden/foundationos', world: 'foundation', scenario: 'family' },
  { file: 'techniek/techniek' }
];
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const attribute = (tag, name) => (tag.match(new RegExp('\\b' + name + '="([^"]*)"')) || [])[1];
const copy = html => html.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|#160);/g, ' ').replace(/\s+/g, ' ').trim();
const hasClass = (tag, name) => (attribute(tag, 'class') || '').split(/\s+/).includes(name);

// De sluitende elementgrens telt geneste tags mee, ook bij sections in sections.
function element(html, predicate) {
  for (const match of html.matchAll(/<([a-z][a-z0-9]*)\b[^>]*>/gi)) {
    if (!predicate(match[0])) continue;
    const start = match.index, end = start + match[0].length;
    if (/^(?:img|link|input|meta|br|hr)$/i.test(match[1])) return { tag: match[0], html: match[0], start, end };
    const tags = new RegExp('<(\\/?)' + match[1] + '\\b[^>]*>', 'gi');
    tags.lastIndex = end;
    let depth = 1, closing;
    while ((closing = tags.exec(html))) {
      depth += closing[1] ? -1 : 1;
      if (!depth) return { tag: match[0], html: html.slice(start, tags.lastIndex), start, end: tags.lastIndex };
    }
    assert.fail('Niet-gesloten element: ' + match[0]);
  }
  return null;
}
function required(html, predicate, label) {
  const found = element(html, predicate);
  assert.ok(found, label);
  return found;
}
function localAsset(host, tag) {
  const src = attribute(tag, 'src');
  assert.ok(src && !/^(?:[a-z]+:|\/\/)/i.test(src), host + ' gebruikt lokaal beeld');
  const file = path.resolve(ROOT, path.dirname(host), src.split(/[?#]/)[0]);
  assert.ok(file.startsWith(ROOT + path.sep) && fs.existsSync(file), host + ': bestaand asset ' + src);
  return file;
}

for (const c of CASES) test(c.file + ': redactionele bron, echte hoofdstukken en één visuele eigenaar', () => {
  const host = 'public/site/' + c.file + '.html', html = read(host);
  const body = required(html, tag => /^<body\b/.test(tag), host + ' body');
  assert.ok(hasClass(body.tag, 'ds-public-editorial'), host + ' kiest de redactionele compositie');
  assert.ok(hasClass(body.tag, 'ds-public-story'), host + ' behoudt de publieke eigenaar');
  assert.match(html, /<html\b[^>]*\bdata-ds(?:\s|>)/);
  assert.equal(attribute(body.tag, 'data-rtg-world'), 'living');
  const styles = [...html.matchAll(/<link\b[^>]*>/g)].map(m => m[0]).filter(tag => attribute(tag, 'rel') === 'stylesheet');
  assert.deepEqual(styles.map(tag => path.resolve(ROOT, path.dirname(host), attribute(tag, 'href'))),
    ['public/fonts/fonts.css', 'public/ds/rtg-ds.css'].map(file => path.join(ROOT, file)));
  assert.doesNotMatch(html, /<style\b|\sstyle=/i, host + ' geen tweede stijllaag');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, host + ' één hoofdtitel');

  const hero = required(html, tag => hasClass(tag, 'world-hero'), host + ' hero');
  const cover = required(hero.html, tag => /^<figure\b/.test(tag) && hasClass(tag, 'ds-public-cover'), host + ' cover in hero');
  const image = required(cover.html, tag => /^<img\b/.test(tag), host + ' coverbeeld');
  assert.ok(localAsset(host, image.tag).includes(path.sep + 'images' + path.sep + 'editorial' + path.sep));
  assert.ok((attribute(image.tag, 'alt') || '').trim().length > 10, host + ' beschrijvend beeldalternatief');
  assert.ok(Number(attribute(image.tag, 'width')) > 0 && Number(attribute(image.tag, 'height')) > 0, host + ' vaste beeldverhouding');
  if (c.volume) {
    assert.ok(hasClass(body.tag, 'ds-public-volume'), host + ' kiest de bladercompositie');
    assert.equal((html.match(/<main\b/g) || []).length, 1, host + ' één main');
    const main = required(html, tag => /^<main\b/.test(tag) && attribute(tag, 'id') === 'verhaal', host + ' hoofdinhoud');
    const reel = required(main.html, tag => /\bdata-editorial-reel(?:\s|>)/.test(tag), host + ' blader-eigenaar');
    const track = required(reel.html, tag => /\bdata-reel-track(?:\s|>)/.test(tag), host + ' native bladerstrook');
    const pages = [...track.html.matchAll(/<article\b[^>]*\bdata-reel-page\b[^>]*>/g)];
    assert.equal(pages.length, 5, host + ' vijf echte artikelen');
    assert.ok(hasClass(pages[0][0], 'world-hero'), host + ' cover is het eerste blad');
    assert.doesNotMatch(track.html, /<figcaption\b/, host + ' beeldlabels staan in het colofon');
    assert.doesNotMatch(html, /class="[^"]*\bds-public-chapters\b/, host + ' geen tweede hoofdstukrail');
    assert.match(reel.html, /data-reel-controls/); assert.match(reel.html, /data-reel-prev/); assert.match(reel.html, /data-reel-next/);
    assert.match(reel.html, /data-reel-status[^>]*>\s*1\s*\/\s*5\s*</, host + ' beginstatus');
    for (const id of ['werelddetails', 'colofon']) {
      const disclosure = required(main.html, tag => /^<details\b/.test(tag) && attribute(tag, 'id') === id, host + ' native ' + id);
      assert.doesNotMatch(disclosure.tag, /\sopen(?:\s|=|>)/, host + ' ' + id + ' start gesloten');
      assert.match(reel.html, new RegExp('href="#' + id + '"'), host + ' echte link naar ' + id);
      assert.match(disclosure.html, /<summary\b/, host + ' ook zonder JS te openen');
      if (id === 'werelddetails') {
        assert.ok(hasClass(disclosure.tag, 'ds-volume-library'));
        assert.equal((disclosure.html.match(/class="proof-detail"/g) || []).length, 7, host + ' zeven oorspronkelijke bewijscontracten');
        assert.match(disclosure.html, /href="#verhaal"/, host + ' terug naar de bladen');
      } else {
        assert.match(copy(disclosure.html), /AI/);
        assert.match(disclosure.html, /PROVENANCE\.json|ink-provenance\.json/, host + ' herleidbare beeldherkomst');
      }
    }
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, host + ' unieke doelen');
  } else {
    const caption = required(cover.html, tag => /^<figcaption\b/.test(tag), host + ' expliciete beeldherkomst');
    assert.match(copy(caption.html), /RTG/); assert.match(copy(caption.html), /AI/); assert.match(copy(caption.html), /sfeerbeeld/i);
    const stroke = required(hero.html, tag => /^<img\b/.test(tag) && hasClass(tag, 'ds-public-stroke'), host + ' geschilderde horizon');
    assert.match(localAsset(host, stroke.tag), /rtg-painted-horizon\.webp$/);
    assert.equal(attribute(stroke.tag, 'alt'), '', host + ' penseelstreek is decoratie, geen inhoud');

    const chapters = required(html, tag => /^<nav\b/.test(tag) && hasClass(tag, 'ds-public-chapters'), host + ' hoofdstuknavigatie');
    assert.ok(attribute(chapters.tag, 'aria-label'), host + ' benoemde hoofdstuknavigatie');
    assert.ok(chapters.start >= hero.end, host + ' hoofdstukken volgen de cover');
    const links = [...chapters.html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)].map(m => m[0]);
    assert.ok(links.length >= 3, host + ' meerdere echte hoofdstukken');
    const hrefs = links.map(link => attribute(link, 'href'));
    assert.equal(new Set(hrefs).size, hrefs.length, host + ' geen dubbele hoofdstukdoelen');
    for (const link of links) {
      const href = attribute(link, 'href');
      assert.match(href, /^#[\w-]+$/, host + ' native anker, geen nepknop');
      assert.ok(copy(link).length > 2, host + ' benoemd hoofdstuk');
      assert.equal([...html.matchAll(/\bid="([^"]+)"/g)].filter(m => m[1] === href.slice(1)).length, 1, host + ' uniek bestaand doel ' + href);
    }
  }
  for (const owner of ['website-truth.js', 'platform-detail.js']) {
    assert.equal([...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].filter(m => m[1].split('/').pop() === owner).length, 1, host + ' behoudt ' + owner);
  }
  assert.equal((html.match(/data-language-picker/g) || []).length, 1, host + ' bestaande taaleigenaar');
  assert.match(html, /rahul-travel-group-logo\.jpg/, host + ' volledige merklockup behouden');
});

test('pasprijs en status blijven vooraan; volledige jaarafspraken volgen het verhaal', () => {
  for (const c of CASES.filter(row => row.pass)) {
    const html = read('public/site/' + c.file + '.html');
    const hero = required(html, tag => hasClass(tag, 'world-hero'), c.file + ' hero');
    const main = required(html, tag => /^<main\b/.test(tag), c.file + ' verhaal');
    const terms = required(html, tag => attribute(tag, 'id') === 'beschikbaarheid', c.file + ' afspraken');
    assert.match(html, new RegExp('data-pass="' + c.pass + '"'));
    assert.match(html, /data-commercial-policy="2026-11-12\.1"/);
    assert.match(hero.html, /data-policy-price/);
    assert.match(copy(hero.html), /nog niet (?:boekbaar|te boeken|vrijgegeven)/i, c.file + ' verkoopstatus blijft direct zichtbaar');
    assert.doesNotMatch(hero.html, /data-policy-billing/, c.file + ' jaaruitleg verdringt de cover niet');
    assert.match(terms.html, /data-policy-billing/);
    assert.equal((html.match(/data-policy-billing/g) || []).length, 1, c.file + ' één canonieke jaaruitleg');
    assert.ok(terms.start > main.start && terms.end < main.end, c.file + ' afspraken staan in het verhaal');
    const before = html.slice(main.start, terms.start);
    assert.match(before, /<h2\b/, c.file + ' een echt verhaal komt vóór de afspraken');
    assert.ok(copy(before).split(' ').length >= 60, c.file + ' geen verplaatste titel zonder verhaal');
    assert.match(html, /href="[^\"]*#prijsbeleid"/, c.file + ' volledige commerciële bron blijft bereikbaar');
  }
});

test('wereldscenario’s blijven bij de echte demonstratie-eigenaar, na het verhaal', () => {
  for (const c of CASES.filter(row => row.world)) {
    const html = read('public/site/' + c.file + '.html');
    const main = required(html, tag => /^<main\b/.test(tag), c.file + ' verhaal');
    const demo = required(html, tag => attribute(tag, 'data-story-demo') === c.scenario, c.file + ' eigen demonstratie');
    assert.match(html, new RegExp('data-world="' + c.world + '"'));
    assert.ok(demo.start > main.start && demo.end < main.end, c.file + ' demo staat in hoofdinhoud');
    const before = html.slice(main.start, demo.start);
    assert.ok((before.match(/<h2\b/g) || []).length >= 2, c.file + ' inhoudelijke hoofdstukken komen eerst');
    assert.match(demo.html, /data-story-fallback/);
    assert.match(copy(demo.html), /demonstratie|voorbeeld/i);
    for (const owner of ['experience-core.js', 'storyline-stage.js', 'storyline-world.js']) {
      assert.equal([...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].filter(m => m[1].split('/').pop() === owner).length, 1, c.file + ' behoudt ' + owner);
    }
  }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test('Bestanden bewaart zichtbaarheid als toestand en niet als inline presentatie', () => {
  const html = lees('public/apps/bestanden.html');
  const gedrag = lees('public/apps/bestanden/app/01-overzicht.js') + '\n' +
    lees('public/apps/bestanden/app.js') + '\n' + lees('public/apps/bestanden/paneel.js');
  assert.doesNotMatch(html, /\sstyle=/);
  for (const id of ['gedeeldKop', 'officeKop', 'bkKijk', 'bkVersieWrap', 'bkHerstel']) {
    assert.match(html, new RegExp('id="' + id + '"[^>]*hidden|hidden[^>]*id="' + id + '"'));
    assert.doesNotMatch(gedrag, new RegExp("\\$\\('#" + id + "'\\)\\.style\\.display"));
  }
});

test('Clips gebruikt de centrale presentatierollen voor alle vaste actierijen', () => {
  const html = lees('public/apps/clips.html');
  const markup = html.slice(0, html.lastIndexOf('<script'));
  assert.doesNotMatch(markup, /<[a-z][^>]*\sstyle=/i);
  assert.match(html, /\/ds\/componenten\/presentatierol\.css/);
  assert.equal((html.match(/class="ds-presentatie-actierij"/g) || []).length, 2);
  assert.equal((html.match(/class="ds-presentatie-keuzerij(?: h-mt50)?"/g) || []).length, 3);
});

test('Backoffice, Foundation Agenda en RTG iD delen presentatie en zichtbaarheid', () => {
  for (const bestand of ['public/apps/backoffice.html', 'public/apps/foundation/agenda.html', 'public/apps/rtgid.html']) {
    const html = lees(bestand);
    assert.doesNotMatch(html, /<[a-z][^>]*\sstyle=/i, bestand);
    assert.match(html, /\/ds\/componenten\/presentatierol\.css/, bestand);
  }
  const backoffice = ['backoffice-01.js', 'backoffice-03.js', 'backoffice-04.js']
    .map(naam => lees('public/apps/backoffice/' + naam)).join('\n');
  for (const id of ['liveInd', 'tlPager', 'ontLiveScrim']) {
    assert.doesNotMatch(backoffice, new RegExp("\\$\\('#" + id + "'\\)\\.style\\.display"));
  }
  const agenda = lees('public/apps/foundation/agenda.html');
  for (const id of ['nieuwKnop', 'afSchool', 'afWeg']) {
    assert.doesNotMatch(agenda, new RegExp("\\$\\('#" + id + "'\\)\\.style\\.display"));
  }
  for (const id of ['nieuwKnop', 'afSchool', 'afWeg']) {
    assert.match(agenda, new RegExp('id="' + id + '"[^>]*hidden|hidden[^>]*id="' + id + '"'));
  }
  assert.match(agenda, /function verberg\(el, verborgen\)/,
    'Agenda synchroniseert native hidden met de bestaande visuele hulpklasse');
  assert.match(lees('public/shared/rtg-editorial-v4.css'),
    /\.daily-action\):where\(:not\(\[hidden\],\.h-weg,\.rtg-command-form button\)\)\{display:inline-flex!important/,
    'Editorial V4 maakt verborgen knoppen niet opnieuw zichtbaar en verdringt geen actievariant');
  const rtgid = lees('public/apps/rtgid.html');
  for (const id of ['koppelKaart', 'kNamens', 'kMaak']) {
    assert.doesNotMatch(rtgid, new RegExp("\\$\\('#" + id + "'\\)\\.style\\.display"));
  }
});

test('Foundation School en Kassa hebben geen vaste inline presentatie', () => {
  for (const bestand of ['public/apps/foundation/school.html', 'public/apps/kassa.html']) {
    const html = lees(bestand);
    assert.doesNotMatch(html, /<[a-z][^>]*\sstyle=/i, bestand);
    assert.match(html, /\/ds\/componenten\/presentatierol\.css/, bestand);
  }
});

test('vijf Heritage-werktuigen delen vaste presentatierollen', () => {
  for (const bestand of [
    'public/apps/foundation/overhoren.html',
    'public/apps/gemeente.html',
    'public/apps/rtgkantoor.html',
    'public/apps/sitemaker.html',
    'public/apps/websitestudio.html'
  ]) {
    const html = lees(bestand);
    const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    assert.doesNotMatch(markup, /<[a-z][^>]*\sstyle=/i, bestand);
    assert.match(html, /\/ds\/componenten\/presentatierol\.css/, bestand);
  }
});

test('de laatste tien vaste presentatiestijlen komen uit het Design System', () => {
  const gevallen = [
    ['public/apps/leverancier.html', 'stClock', 'ds-presentatie-gespreksrij'],
    ['public/apps/podium.html', 'kijkerLijst', 'ds-presentatie-noot-op'],
    ['public/apps/pay.html', 'gDemo', 'ds-presentatie-linkknop'],
    ['public/apps/media.html', 'regelaarsRij', 'ds-presentatie-regelaars'],
    ['public/apps/zaal.html', 'stopKnop', 'ds-presentatie-rechts'],
    ['public/apps/lab.html', 'lab3d', 'ds-presentatie-canvas-vol'],
    ['public/apps/handel.html', 'hGenre', 'ds-presentatie-veld-middel'],
    ['public/apps/foundation/beheer.html', 'dlgWisTitel', 'ds-presentatie-waarschuwing'],
    ['public/apps/foundation/index.html', 'pGezinNaam', 'ds-presentatie-gezinsnaam'],
    ['public/apps/foundation/club.html', 'pNaam', 'ds-presentatie-kop-klein']
  ];
  for (const [bestand, anker, rol] of gevallen) {
    const html = lees(bestand);
    assert.match(html, /\/ds\/componenten\/presentatierol\.css/, bestand);
    assert.match(html, new RegExp('class="[^"]*' + rol + '[^"]*"'), bestand + ': ' + rol);
    assert.match(html, new RegExp('id="' + anker + '"'), bestand + ': ' + anker);
  }

  const statischePresentatie = [
    /style="display:flex;align-items:center;gap:0\.9rem;"/,
    /style="margin-top:-0\.3rem;"/,
    /style="text-decoration:none;"/,
    /style="display:flex;gap:0\.35rem;flex-wrap:wrap;margin-top:0\.5rem;"/,
    /style="margin-left:auto;"/,
    /style="display:block;width:100%;border-radius:0;touch-action:none;cursor:grab;"/,
    /style="flex:0 1 16rem;"/,
    /style="color:var\(--zacht\);font-size:\.88rem;margin-bottom:1\.25rem;line-height:1\.45;"/,
    /style="font-size:1\.9rem;margin-top:\.4rem;"/,
    /style="font-size:1\.1rem;"/
  ];
  const bron = gevallen.map(([bestand]) => lees(bestand)).join('\n');
  for (const patroon of statischePresentatie) assert.doesNotMatch(bron, patroon);
});

test('alle vaste markup gebruikt native zichtbaarheid in plaats van style.display', () => {
  const schermen = new Map([
    ['public/apps/notities.html', ['gedeeldKop', 'ntLijstWrap']],
    ['public/apps/leverancier.html', ['bellBadge']],
    ['public/apps/scanner.html', ['cameraStop', 'bewaarRij']],
    ['public/apps/gemeentepda.html', ['rahulFab']],
    ['public/apps/podium.html', ['studioLiveDot']],
    ['public/apps/galerij.html', ['terugblikWrap', 'albumPad', 'albums']],
    ['public/apps/gemeenteloket.html', ['rahulFab']],
    ['public/apps/rijksloket.html', ['rahulFab']],
    ['public/apps/handel.html', ['hZaak', 'hPrijs']],
    ['public/apps/vertaler.html', ['bewaardKop', 'histKop']],
    ['public/apps/foundation/keuken.html', ['bOpruim']],
    ['public/apps/foundation/klusjes.html', ['geldBlok', 'maakBlok']],
    ['public/apps/foundation/schrift.html', ['tekentools']],
    ['public/apps/foundation/zakgeld.html', ['week']],
    ['public/apps/foundation/ochtend.html', ['kinderenBlok']]
  ]);
  for (const [bestand, ids] of schermen) {
    const html = lees(bestand);
    const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
    assert.doesNotMatch(markup, /<[a-z][^>]*\sstyle=/i, bestand);
    for (const id of ids) {
      assert.match(markup, new RegExp('id="' + id + '"[^>]*hidden|hidden[^>]*id="' + id + '"'),
        bestand + ': ' + id + ' begint veilig verborgen');
    }
    if (bestand !== 'public/apps/notities.html') {
      assert.match(html, /\/ds\/componenten\/presentatierol\.css/, bestand);
    }
  }

  const gedrag = [
    'public/apps/notities/app/app-01.js', 'public/apps/notities/app/app-02.js',
    'public/apps/leverancier/leverancier-83.js', 'public/apps/scanner/app.js',
    'public/apps/gemeentepda.html', 'public/apps/podium.html',
    'public/apps/galerij/app.js', 'public/apps/gemeenteloket.html',
    'public/apps/rijksloket.html', 'public/apps/handel-aanvraag.js',
    'public/apps/vertaler/app.js', 'public/apps/foundation/keuken.html',
    'public/apps/foundation/klusjes.html', 'public/apps/foundation/schrift.html',
    'public/apps/foundation/zakgeld.html', 'public/apps/foundation/ochtend.html'
  ].map(lees).join('\n');
  const ids = Array.from(new Set(Array.from(schermen.values()).flat().concat(['ntTekstWrap', 'tijdlijn', 'hGenre'])));
  for (const id of ids) {
    assert.doesNotMatch(gedrag, new RegExp("\\$\\('#" + id + "'\\)\\.style\\.display"), id);
    assert.doesNotMatch(gedrag, new RegExp("getElementById\\('#" + id + "'\\)\\.style\\.display"), id);
  }
});

test('gedeelde bediening maakt dynamische markup zonder inline presentatie', () => {
  const bronnen = [
    'public/shared/metgezel/metgezel-03.js',
    'public/shared/rtg-schil/05-context.js',
    'public/shared/paspoortscan.js',
    'public/shared/schoolbel.js'
  ];
  const gedrag = bronnen.map(lees).join('\n');
  assert.doesNotMatch(gedrag, /style=/, 'gedeelde HTML-sjablonen dragen geen stijlattributen');
  assert.doesNotMatch(gedrag, /\.style\.(?:display|cssText)/,
    'zichtbaarheid en componentvorm lopen niet via DOM-stijlschrijfacties');

  const contracten = [
    ['public/apps/app.html', '/ds/componenten/paspoortscan.css'],
    ['public/apps/foundation/school.html', '/ds/componenten/schoolbel.css'],
    ['public/apps/schoolpartner.html', '/ds/componenten/schoolbel.css']
  ];
  for (const [bestand, component] of contracten) {
    assert.match(lees(bestand), new RegExp(component.replace(/[/.]/g, '\\$&')), bestand + ': ' + component);
  }
  assert.match(lees('public/ds/componenten/paspoortscan.css'), /^@layer rtg\.component/);
  assert.match(lees('public/ds/componenten/schoolbel.css'), /^@layer rtg\.component/);
});

test('gedeelde herstel- en rustvensters laten hun vorm aan het Design System', () => {
  for (const bestand of ['public/shared/pinherstel.js', 'public/shared/schermrust.js']) {
    const bron = lees(bestand);
    assert.doesNotMatch(bron, /\.style\.cssText|setAttribute\(['"]style['"]/, bestand);
  }
  assert.match(lees('public/apps/app.html'), /\/ds\/componenten\/pinherstel\.css/);
  for (const bestand of [
    'public/apps/muziek.html', 'public/apps/spelen.html', 'public/apps/theater.html',
    'public/apps/app.html', 'public/apps/vonk.html', 'public/apps/podium.html',
    'public/apps/media.html', 'public/apps/clips.html', 'public/apps/foundation/vrienden.html'
  ]) {
    assert.match(lees(bestand), /\/ds\/componenten\/schermrust\.css/, bestand);
  }
  assert.match(lees('public/ds/componenten/pinherstel.css'), /^@layer rtg\.component/);
  assert.match(lees('public/ds/componenten/schermrust.css'), /^@layer rtg\.component/);
});

test('Meelezen en lokale ondertiteling delen één toegankelijke DS-presentatie', () => {
  for (const bestand of ['public/shared/meelezen.js', 'public/shared/meeluister.js']) {
    const bron = lees(bestand);
    assert.doesNotMatch(bron, /\.style\.cssText|setAttribute\(['"]style['"]/, bestand);
  }
  for (const bestand of [
    'public/apps/service-bel.html', 'public/apps/leverancier.html', 'public/apps/meet.html',
    'public/apps/rendezvous.html', 'public/apps/app.html', 'public/apps/vonk.html',
    'public/apps/foundation/school.html', 'public/apps/schoolpartner.html',
    'public/apps/foundation/vrienden.html', 'public/apps/foundation/contact.html',
    'public/apps/service.html', 'public/apps/personeel.html'
  ]) {
    assert.match(lees(bestand), /\/ds\/componenten\/meelezen\.css/, bestand);
  }
  assert.match(lees('public/ds/componenten/meelezen.css'), /^@layer rtg\.component/);
});

test('Verbinding gebruikt op iedere host uitsluitend de centrale DS-presentatie', () => {
  for (const bestand of [
    'public/shared/verbinding/verbinding-01.js',
    'public/shared/verbinding/verbinding-02.js'
  ]) {
    const bron = lees(bestand);
    assert.doesNotMatch(bron, /\.style\.(?:cssText|opacity|transform|background|color|borderColor)/, bestand);
    assert.doesNotMatch(bron, /setAttribute\(['"]style['"]/, bestand);
  }
  for (const bestand of [
    'public/apps/backoffice.html', 'public/apps/spelen.html', 'public/apps/leverancier.html',
    'public/apps/app.html', 'public/apps/boardroom.html', 'public/apps/personeel.html',
    'public/apps/werkplek.html'
  ]) {
    const html = lees(bestand);
    assert.match(html, /\/ds\/componenten\/verbinding\.css/, bestand);
    assert.match(html, /\/ds\/componenten\/melding\.css/, bestand);
  }
  assert.match(lees('public/ds/componenten/verbinding.css'), /^\/\*[\s\S]*@layer rtg\.component/);
});

test('Invisible Arrival gebruikt voor de nadering uitsluitend de bestaande plekcomponent', () => {
  const bron = lees('public/shared/plaatsnadering.js');
  assert.doesNotMatch(bron, /createElement\(['"]style['"]|\.style\.|setAttribute\(['"]style['"]/, bron);
  assert.match(bron, /className = 'rtgnader ds-plek'/);
  assert.match(bron, /className = 'ja ds-knop ds-knop--primair'/);
  assert.match(bron, /className = 'nee ds-knop ds-knop--stil'/);
  assert.match(lees('public/ds/bediening.css'), /componenten\/plek\.css/);
  assert.match(lees('public/apps/arrival.html'), /\/ds\/rtg-ds\.css/);
});

test('levende RTG-codes delen één presentatiecontract op beide hosts', () => {
  const bron = lees('public/shared/dyncode.js');
  assert.doesNotMatch(bron, /\.style\.(?:cssText|textAlign)|setAttribute\(['"]style['"]/, bron);
  assert.match(bron, /classList\.add\('ds-dyncode'\)/);
  assert.match(bron, /className = 'ds-dyncode__ring'/);
  assert.match(bron, /className = 'ds-dyncode__beeld'/);
  for (const bestand of ['public/apps/app.html', 'public/apps/foundation/vrienden.html']) {
    assert.match(lees(bestand), /\/ds\/componenten\/dyncode\.css/, bestand);
  }
  assert.match(lees('public/ds/componenten/dyncode.css'), /^\/\*[\s\S]*@layer rtg\.component/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const realityRuntime = require('../public/shared/social-intelligence-runtime.js');

const ROOT = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(ROOT, bestand), 'utf8');

test('de gedeelde commandotoets vraagt altijd een bewuste sneltoets', () => {
  assert.equal(realityRuntime.isCommandKey(null), false);
  assert.equal(realityRuntime.isCommandKey({ ctrlKey:true, metaKey:false, key:'k' }), true);
  assert.equal(realityRuntime.isCommandKey({ ctrlKey:false, metaKey:true, key:'K' }), true);
  assert.equal(realityRuntime.isCommandKey({ ctrlKey:false, metaKey:false, key:'k' }), false);
});

test('Sociaal en De Salon delen dezelfde elite-schil zonder hun functies samen te voegen', () => {
  const sociaal = lees('public/apps/sociaal.html');
  const salon = lees('public/apps/salon.html');

  for (const html of [sociaal, salon]) {
    assert.match(html, /rtg-social-elite/);
    assert.match(html, /\/shared\/social-elite\.css/);
    assert.match(html, /rtg-social-commandbar topbar cmd-tabs/);
  }
  assert.match(sociaal, /Uw wereld, zorgvuldig dichtbij\./);
  assert.match(sociaal, /class="sociaal-stage"/);
  assert.match(sociaal, /\/shared\/sociaal-elite\.css/);
  assert.match(salon, /class="salon-werkveld"/);
  assert.match(salon, /class="salon-stage"/);
  assert.match(salon, /\/shared\/salon-elite\.css/);
  assert.match(salon, /const TABS=\[\['feed','Feed'\].*\['ik','Mijn profiel'\]\]/);
});

test('de elite-schil houdt mobiele bediening op een menselijke maat', () => {
  const sociaal = lees('public/shared/sociaal-elite.css');
  const salon = lees('public/shared/salon-elite.css');
  assert.match(salon, /\.rtg-salon-elite \.rij button[\s\S]*min-height:44px/);
  assert.match(salon, /\.rtg-salon-elite \.knop[\s\S]*min-height:48px/);
  assert.match(salon, /body\.rtg-stijl\.rtg-salon-elite \.kaart[\s\S]*background-image:none/,
    'Salon-kaarten winnen ook van het gedeelde donkere oppervlak');
  assert.match(salon, /body\.rtg-stijl\.rtg-salon-elite input:not\(\[type=range\]\)[\s\S]*background:#fff/,
    'velden blijven op het lichte Salon-oppervlak leesbaar');
  assert.match(sociaal, /\.sociaal-ruimtes a[\s\S]*min-height:(?:6[4-9]|[7-9]\d)px/);
});

test('Social OS heeft overal dezelfde vijf primaire ruimtes', () => {
  const suite = lees('public/shared/social-suite.js');
  const salon = lees('public/apps/salon.html');
  const sociaal = lees('public/apps/sociaal.html');
  const routes = ['/apps/sociaal.html', '/apps/comm.html', '/apps/salon.html',
    '/apps/genootschap.html', '/apps/sociaal-prive.html'];
  for (const route of routes) {
    assert.ok(suite.includes(route), route + ' staat in de gedeelde schil');
    assert.ok(salon.includes(route), route + ' staat in De Salon');
    assert.ok(sociaal.includes(route) || route === '/apps/sociaal.html', route + ' staat in Vandaag');
  }
  for (const app of ['comm', 'genootschap', 'pulse', 'meet', 'vonk', 'rendezvous', 'cercle', 'entourage', 'attenties']) {
    const html = lees('public/apps/' + app + '.html');
    assert.match(html, /\/shared\/social-suite\.css/);
    assert.match(html, /\/shared\/social-suite\.js/);
  }
});

test('de suiteschil gebruikt echte routes en laat appbediening voorgaan op beschrijvende tekst', () => {
  const suite = lees('public/shared/social-suite.js');
  const salon = lees('public/apps/salon.html');
  const genootschap = lees('public/apps/genootschap.html');

  assert.match(suite, /persoon\.href = '\/apps\/salon\.html#ik'/,
    'de profielzegel opent de bestaande Salon-profielruimte');
  assert.doesNotMatch(suite, /\/apps\/profiel\.html/,
    'de schil verzint geen profielpagina die niet bestaat');
  assert.match(salon, /BEGIN_TAB=.*inzicht\|ik.*location\.hash/,
    'de Salon kan de profielruimte rechtstreeks openen');
  assert.doesNotMatch(suite, /Mensen, voorkeuren en reisgereedheid rond uw gezelschap/,
    'de hero kaapt de bestaande tabnaam Uw gezelschap niet');
  assert.match(genootschap, /<script id="rtgAppMenuJs" src="\/shared\/appmenu\.js" defer><\/script>/,
    'Genootschap wacht niet op een laat dynamisch appmenu');
  assert.match(suite, /plaatsKringmenu[\s\S]*kop\.insertBefore\(knop, kop\.firstChild\)/,
    'de Kringen-kop houdt het appmenu buiten de ingeklapte mobiele titelrij');
});

test('de privéwereld ontsluit bestaande capabilities zonder een tweede gegevenslaag', () => {
  const privé = lees('public/apps/sociaal-prive.html');
  for (const route of ['/apps/meet.html', '/apps/vonk.html', '/apps/rendezvous.html',
    '/apps/cercle.html', '/apps/entourage.html', '/apps/attenties.html']) {
    assert.ok(privé.includes(route), route + ' heeft een volwaardige ingang');
  }
  assert.doesNotMatch(privé, /fetch\(|localStorage|<form/i,
    'de hub navigeert alleen; de bestaande apps blijven eigenaar van hun gegevens');
  assert.match(privé, /Niets gaat weg zonder uw bevestiging|pas na uw bevestiging/);
});

test('de nieuwe suiteschil bewaakt bruikbare bediening en responsieve panelen', () => {
  const css = lees('public/shared/social-suite.css');
  assert.match(css, /body\.rtg-suite-page button,[\s\S]*min-height:44px/);
  assert.match(css, /@media\(min-width:1280px\)[\s\S]*rtg-message-context/);
  assert.match(css, /@media\(max-width:900px\)[\s\S]*rtg-suitenav[\s\S]*bottom:0/);
  assert.match(css, /rtg-social-circles>header\.ios-nav>#osMenuBtn\{display:flex!important;\}/,
    'de mobiele Kringen-schil houdt de veilige systeemdeur zichtbaar');
  assert.doesNotMatch(css, /rtg-social-circles[^}]*#osMenuBtn\{[^}]*display:none/,
    'geen responsieve regel mag het appmenu verbergen');
});

test('de Social-filter bedient echte serverregels en is volledig met toetsenbord te gebruiken', () => {
  const html = lees('public/apps/sociaal.html');
  assert.match(html, /id="sociaalFilterMenu" role="menu"/);
  assert.equal((html.match(/role="menuitemradio"/g) || []).length, 5);
  assert.match(html, /const FILTERS = \{/);
  assert.match(html, /const filterRegels = regels =>/);
  assert.match(html, /if \(WERELD_DATA\) teken\(WERELD_DATA\)/);
  assert.match(html, /if \(LIJN_DATA\) tekenLijn\(LIJN_DATA\)/);
  assert.match(html, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/);
  assert.match(html, /e\.key === 'Escape'/);
});

test('alle zichtbare Salon-acties zijn aan hun bestaande productroutes gekoppeld', () => {
  const html = lees('public/apps/salon.html');
  for (const route of ['/api/like', '/api/salon/bewaar', '/api/salon/verberg',
    '/api/salon/meld', '/api/salon/archiveer', '/api/salon/weg', '/api/salon/plaats',
    '/api/salon/volg-lid', '/api/salon/bio', '/api/salon/reacties',
    '/api/salon/reageer', '/api/salon/reactie-weg', '/api/salon/ai/bijschrift',
    '/api/salon/ai/reacties', '/api/chat/send']) {
    assert.ok(html.includes(route), route + ' is aangesloten');
  }
  assert.match(html, /id="salonMelding" role="status" aria-live="polite"/);
  assert.match(html, /async function werk\(knop,taak\)/);
  assert.match(html, /postId:Number\(b\.dataset\.like\),liked:b\.getAttribute\('aria-pressed'\)!=='true'/);
  assert.match(html, /id="wisZoek"/);
  assert.match(html, /#zoekveld'\)\.onkeydown/);
  assert.match(html, /TERUG_PROFIEL/);
});

test('de uitgebreide Social- en Salon-scripts blijven syntactisch geldig', () => {
  for (const bestand of ['public/apps/sociaal.html', 'public/apps/salon.html']) {
    const html = lees(bestand);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    assert.ok(scripts.length, bestand + ' heeft een inline productscript');
    for (const script of scripts) assert.doesNotThrow(() => new Function(script));
  }
});

test('Reality Engine is in elke Social-ruimte dezelfde werkende systeemlaag', () => {
  const apps = ['sociaal', 'salon', 'comm', 'genootschap', 'sociaal-prive', 'pulse',
    'meet', 'vonk', 'rendezvous', 'cercle', 'entourage', 'attenties'];
  for (const app of apps) {
    assert.match(lees('public/apps/' + app + '.html'),
      /<link href="\/shared\/social-intelligence\.css" rel="stylesheet">/,
      app + ' laadt de Intelligence-stijl zonder visuele flits');
    assert.match(lees('public/apps/' + app + '.html'),
      /<script src="\/shared\/social-intelligence\.js" defer><\/script>/,
      app + ' laadt de gedeelde Intelligence-laag');
    assert.match(lees('public/apps/' + app + '.html'),
      /<script src="\/shared\/social-intelligence-deck\.js" defer><\/script>/,
      app + ' laadt het gedeelde commandodeck');
    assert.match(lees('public/apps/' + app + '.html'),
      /<script src="\/shared\/social-intelligence-runtime\.js" defer><\/script>/,
      app + ' laadt de gedeelde Intelligence-runtime');
    assert.match(lees('public/apps/' + app + '.html'),
      /<script src="\/shared\/social-intelligence-data\.js" defer><\/script>/,
      app + ' verbindt het commandodeck met de bestaande Social-routes');
  }

  const js = lees('public/shared/social-intelligence.js') +
    lees('public/shared/social-intelligence-deck.js') +
    lees('public/shared/social-intelligence-runtime.js') +
    lees('public/shared/social-intelligence-data.js');
  assert.match(js, /REALITY GRAPH/);
  assert.match(js, /MENS BESLIST/);
  assert.match(js, /navigator\.onLine/);
  assert.match(js, /location\.protocol === 'https:'/,
    'de netwerkstatus claimt alleen TLS wanneer de pagina echt via HTTPS draait');
  assert.match(js, /event\.ctrlKey \|\| event\.metaKey/);
  for (const route of ['/api/sociaal/graaf', '/api/sociaal/beleid',
    '/api/sociaal/beleid/zet', '/api/sociaal/rahul', '/api/sociaal/actielog']) {
    assert.ok(js.includes(route), route + ' is in de Control Plane aangesloten');
  }
  assert.match(js, /role="tablist"/);
  assert.match(js, /Waarop dit antwoord rust/);
  assert.match(js, /Automatische verzending bestaat niet/);
  assert.doesNotMatch(js, /on(?:click|keydown|submit)\s*=/i,
    'de gedeelde laag gebruikt geen inline event handlers');
  for (const bestand of ['social-intelligence.js', 'social-intelligence-deck.js',
    'social-intelligence-runtime.js', 'social-intelligence-data.js']) {
    const bron = lees('public/shared/' + bestand);
    assert.doesNotThrow(() => new Function(bron));
    assert.ok(Buffer.byteLength(bron) <= 10 * 1024, bestand + ' blijft onder 10 kB');
  }
});

test('bestaande Social-functies hebben een bedienbare ingang in hun eigen ruimte', () => {
  const verwachtingen = {
    'genootschap.html': ['/genootschap/pas-aan', '/genootschap/nodig-uit', '/genootschap/rol',
      '/genootschap/eruit', '/genootschap/reactie-weg'],
    'pulse.html': ["api('profiel'", "api('volg'"],
    'cercle.html': ["api('cercle/club'", "api('cercle/gast/terug'"],
    'entourage.html': ["api('entourage/persoon'", "api('entourage/doc'", "api('entourage/doc/weg'"],
    'attenties.html': ["api('attenties/relatie'", "api('attenties/gift'", "api('attenties/gift/weg'"]
  };
  for (const [bestand, routes] of Object.entries(verwachtingen)) {
    const html = lees('public/apps/' + bestand);
    for (const route of routes) assert.ok(html.includes(route), route + ' is aangesloten in ' + bestand);
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    for (const script of scripts) assert.doesNotThrow(() => new Function(script), bestand + ' blijft geldige browsersyntaxis');
  }
});

test('Reality Engine blijft bruikbaar, leesbaar en rustig op mobiel', () => {
  const css = lees('public/shared/social-intelligence.css');
  assert.match(css, /--rtg-intel-height:76px/);
  assert.match(css, /\.rtg-intel-command\{[\s\S]*min-height:44px/);
  assert.match(css, /@media\(max-width:760px\)[\s\S]*rtg-intel-deck/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)[\s\S]*animation:none/);
  assert.match(css, /\.rtg-suitehero\.rtg-intel-host[\s\S]*min-height:330px/);
  assert.match(css, /body\.rtg-intel-messages \.comm\{inset:calc\(var\(--suite-stack\) \+ var\(--rtg-intel-height\)\)/);
});

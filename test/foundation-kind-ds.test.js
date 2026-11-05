'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const { fixture, tick } = require('./lib/foundation-ds-fixture');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const html = n => read('public/apps/foundation/' + n + '.html');
function script(n) {
  if (n === 'gevoel') return read('public/apps/foundation/gevoel.js');
  if (n === 'mediawijs') return ['00','01'].map(i => read('public/apps/foundation/mediawijs/mediawijs-' + i + '.js')).join('');
  return html(n).match(/<script>\s*([\s\S]*?)<\/script>/)[1];
}
function route(n) {
  const f = fixture();
  f.add('div').id = 'balk';
  f.add('main').innerHTML = html(n).match(/<main[^>]*>([\s\S]*?)<\/main>/)[1];
  f.context.navigator = {}; f.context.scrollTo = () => {};
  f.context.location.reload = () => { f.reloaded = true; };
  f.loops = new Map();
  f.context.setInterval = (fn, delay) => { f.loops.set(1, { fn, delay }); return 1; };
  f.context.clearInterval = key => f.loops.delete(key);
  vm.runInContext(script(n), f.context);
  return f;
}

test('four Foundation routes use DS while retaining their distinct session gates and functional owners', () => {
  for (const n of ['gevoel','pesten','opvoeden','mediawijs']) {
    const h = html(n), js = script(n);
    assert.match(h, /<html[^>]*data-ds/); assert.match(h, /<main[^>]*id="main"/);
    assert.match(h, /data-rtg-world="foundation"/);
    assert.doesNotMatch(h, /<style\b|style="|href="(?:stijl|premium)\.css"|href="\/shared\/.*\.css"|src="\/shared\/levendekleur\.js"/);
    assert.match(h, /\/fonts\/fonts\.css/); assert.match(h, /\/ds\/rtg-ds\.css/);
    assert.ok(h.indexOf('/ds/shell.js') < h.indexOf('sessie.js'));
    for (const owner of ['sessie.js','samen.js','premium.js','/shared/rtg-world-desktop.js','/shared/uitstap.js']) assert.ok(h.includes('src="' + owner + '"'), owner);
    assert.match(js, new RegExp('Sessie\\.eis' + (n === 'opvoeden' ? 'Familie' : 'Profiel') + '\\(\\)'));
    assert.match(js, new RegExp("kind:\\s*'" + n + "'")); new vm.Script(js);
    assert.doesNotMatch(js, /RTGUitvoer\.bron|localStorage\.setItem/);
  }
  for (const p of ['gevoel.js','mediawijs/mediawijs-00.js','mediawijs/mediawijs-01.js']) assert.ok(Buffer.byteLength(read('public/apps/foundation/' + p)) < 10240, p);
});

test('published feelings, parenting advice and online scenarios remain byte-identical through the presentation migration', () => {
  const cases = [
    ['gevoel','GEVOELENS','function teken','8dba67d4e96d975f617aac0b2ca0bc5adc8331518d9f10d4162732197ce226a3'],
    ['mediawijs','SITUATIES','let volgorde','efcf439d81403796399a17d67aea00586d28a7ded6f52e828995c87bf0137e79'],
    ['opvoeden','ONDERWERPEN','const ob =','90a48f4a83b9e1e029fe2a3c20679ee7635adbdb33c0807fd0b03eaa3e68dcdd']
  ];
  for (const [n, begin, end, expected] of cases) {
    const s = script(n), data = s.slice(s.indexOf('const ' + begin), s.indexOf(end));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), expected, n);
  }
});

test('feeling selection is local, explicit save waits for consent, and the original breath cadence stops', async () => {
  const f = route('gevoel'), count = f.requests.length;
  assert.equal(f.node('#koppen').querySelectorAll('button').length, 6);
  const blij = f.node('#koppen').querySelectorAll('button')[0]; blij.click();
  assert.equal(f.requests.length, count); assert.equal(blij.getAttribute('aria-pressed'), 'true');
  assert.match(f.node('#antwoord').textContent, /Wat fijn/);
  f.node('#bewaarKnop').click(); const req = f.requests.at(-1);
  assert.equal(req.url, '/api/rtf/welzijn/stemming');
  assert.deepEqual(JSON.parse(req.opts.body), { code: 'GEZIN', token: 'TOKEN', gevoel: 'blij' });
  f.reply(req, { error: 'Ouder moet toestemmen', hoe: 'toestemming', zelf: false }, 403); await tick();
  assert.equal(f.node('#toestemRij').hidden, false); assert.equal(f.node('#toestemKnop').hidden, true);
  f.node('#bewaarKnop').click(); f.reply(f.requests.at(-1), { hoe: 'toestemming', zelf: true }, 403); await tick();
  assert.equal(f.node('#toestemKnop').hidden, false);
  f.node('#toestemKnop').click(); const consent = f.requests.at(-1);
  assert.equal(consent.url, '/api/rtf/welzijn/toestemming'); assert.equal(JSON.parse(consent.opts.body).aan, true);
  f.reply(consent, { ok: true, toestemming: true }); await tick(); assert.equal(f.requests.at(-1).url, '/api/rtf/welzijn/stemming');
  f.node('#ademknop').click(); assert.equal(f.loops.get(1).delay, 4000); assert.equal(f.node('#bol').textContent, 'in');
  f.loops.get(1).fn(); assert.equal(f.node('#bol').textContent, 'uit');
  f.node('#ademknop').click(); assert.equal(f.loops.size, 0); assert.equal(f.node('#bol').classList.contains('uit'), false);
});

test('family help still sends the explicit child message and preserves a rejected draft', async () => {
  const f = route('pesten'); f.node('#tekst').value = 'Ik wil samen praten'; f.node('#praat').click();
  const req = f.requests.at(-1); assert.equal(req.url, '/api/foundation/gezin/bericht');
  assert.deepEqual(JSON.parse(req.opts.body), { code:'GEZIN', token:'TOKEN', naar:'allen', soort:'hulp', tekst:'Ik wil samen praten' });
  f.reply(req, { error:'Geen verbinding' }, 503); await tick();
  assert.equal(f.node('#tekst').value, 'Ik wil samen praten'); assert.equal(f.node('#fout').textContent, 'Geen verbinding');
  assert.equal(f.node('#ok').hidden, true);
});

test('family help serializes attempts and only a matching actual server receipt clears the submitted draft', async () => {
  const f = route('pesten'), input = f.node('#tekst'), send = f.node('#praat');
  input.value = '<Praat> met mij'; send.click(); const req = f.requests.at(-1), count = f.requests.length;
  send.onclick(); assert.equal(f.requests.length, count, 'single-flight also protects a second handler invocation');
  input.value = 'Een later concept';
  f.reply(req, { ok: true, bericht: { id: 'BERICHT', van:'ouder', naar:'allen', soort:'hulp', tekst:'Praat met mij' } }); await tick();
  assert.equal(f.node('#ok').hidden, false); assert.equal(input.value, 'Een later concept'); assert.equal(send.disabled, false);
  send.click(); f.reply(f.requests.at(-1), { ok: true, bericht: { id:'TWEE', van:'ouder', naar:'allen', soort:'hulp', tekst:'Een later concept' } }); await tick();
  assert.equal(input.value, '');
});

test('family help never treats HTTP 200 errors or unrelated/partial receipts as delivery', async () => {
  const receipt = { id:'ID', van:'ouder', naar:'allen', soort:'hulp', tekst:'Concept' };
  for (const data of [null, {}, { ok:false, bericht:receipt }, { ok:true, error:'Niet gelukt', bericht:receipt },
    { ok:'true', bericht:receipt }, { ok:true }, ...['id','van','naar','soort','tekst'].map(k => ({ ok:true, bericht:{ ...receipt, [k]: k === 'id' ? '' : 'ANDERS' } }))]) {
    const f = route('pesten'); f.node('#tekst').value = 'Concept'; f.node('#praat').click(); f.reply(f.requests.at(-1), data); await tick();
    assert.equal(f.node('#ok').hidden, true, JSON.stringify(data)); assert.equal(f.node('#tekst').value, 'Concept');
    assert.match(f.node('#fout').textContent, /niet bevestigd/); assert.equal(f.node('#praat').disabled, false);
  }
});

test('family help binds late success and failure to the initiating profile and cannot send with its old token', async () => {
  for (const outcome of ['success','failure']) for (const changed of [
    { code:'ANDER', token:'TOKEN', profiel:{ id:'ouder' } },
    { code:'GEZIN', token:'NIEUW', profiel:{ id:'ouder' } },
    { code:'GEZIN', token:'TOKEN', profiel:{ id:'kind' } }
  ]) {
    const f = route('pesten'); f.node('#tekst').value = 'Vraag van A'; f.node('#praat').click(); const req = f.requests.at(-1);
    f.session.zet(changed); f.node('#tekst').value = 'Concept van B';
    if (outcome === 'success') f.reply(req, { ok:true, bericht:{ id:'A', van:'ouder', naar:'allen', soort:'hulp', tekst:'Vraag van A' } });
    else req.reject(new Error('PRIVÉ FOUT VAN A'));
    await tick();
    assert.equal(f.node('#ok').hidden, true); assert.equal(f.node('#tekst').value, 'Concept van B');
    assert.match(f.node('#fout').textContent, /profiel is gewijzigd/); assert.doesNotMatch(f.node('#fout').textContent, /PRIVÉ/);
    const count = f.requests.length; f.node('#praat').click(); assert.equal(f.requests.length, count);
  }
});

test('parenting topics and local media choices retain their existing content and state transitions', () => {
  const p = route('opvoeden'), buttons = p.node('#onderwerpen').querySelectorAll('button');
  assert.equal(buttons.length, 6); buttons[1].click(); assert.match(p.node('#tips').textContent, /Maak duidelijke afspraken/);
  assert.ok(buttons.every(b => b.classList.contains('ds-knop')));
  const f = route('mediawijs'), count = f.requests.length, options = f.node('#opties').querySelectorAll('button');
  assert.equal(options.length, 3); options[0].click();
  assert.ok(options.every(b => b.disabled)); assert.equal(f.node('#uitleg').hidden, false); assert.equal(f.node('#regel').hidden, false);
  assert.match(f.node('#stand').textContent, /^1 van de /); assert.equal(f.requests.length, count);
  f.node('#verder').click(); assert.ok(f.node('#opties').querySelectorAll('button').every(b => !b.disabled));
  assert.equal(f.node('#uitleg').hidden, true); assert.equal(route('mediawijs').node('#stand').textContent, '');
});

test('canonical exercise CSS preserves reduced motion, wrapping and non-colour answer labels', () => {
  const css = read('public/ds/componenten/foundation-coach.css');
  assert.match(css, /@layer rtg\.component/); assert.doesNotMatch(css, /!important|#[\da-f]{3,8}\b|\b(?:margin|padding)-(?:left|right)\s*:/i);
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.ds-foundation-adembol\s*\{ transition: none/);
  assert.match(css, /minmax\(0, 1fr\)/); assert.match(css, /\.ds-foundation-keuze[^}]*white-space: normal/);
  assert.match(script('mediawijs'), /Verstandige keuze\.[\s\S]*Kan beter\.[\s\S]*Dit levert problemen op\./);
});

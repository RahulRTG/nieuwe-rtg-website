/* RONDE 5: de Vonk-productervaring mag de bewezen Connection-contracten alleen
   presenteren. Deze toetsen bewaken de eindige dag, disclosure-reden, states,
   scopeslot en de mobiele/a11y-basics van het echte scherm. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Vonk = require('../public/shared/vonk-2-core');

const root = path.resolve(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(root, bestand), 'utf8');

test("Today's Six vult nooit op en toont nooit meer dan de bewezen zes", () => {
  const twee = Vonk.vandaag([{ codenaam:'Maan' }, { codenaam:'Ster' }]);
  assert.equal(twee.aantal, 2); assert.deepEqual(twee.mensen.map(x => x.codenaam), ['Maan', 'Ster']);
  const acht = Vonk.vandaag(Array.from({ length:8 }, (_, i) => ({ codenaam:'Lid ' + i })));
  assert.equal(acht.aantal, 6); assert.equal(acht.mensen.length, 6);
});

test('de client verzint geen waarom-regel uit profielwaarden', () => {
  const model = Vonk.kandidaat({ codenaam:'Maan', kenmerken:{ geloof:{ label:'Moslim' } },
    waarom:{ ja:['Geloof: komt overeen'], open:['Beschikbaarheid nog open'] }, religion:'verborgen' });
  assert.deepEqual(model.waarom.passend, ['Geloof: komt overeen']);
  assert.deepEqual(model.waarom.open, ['Beschikbaarheid nog open']);
  assert.equal(JSON.stringify(model.waarom).includes('Moslim'), false);
  assert.equal(Object.hasOwn(model, 'religion'), false);
});

test('de client gebruikt uitsluitend tijdelijke Vonk-fototickets', () => {
  const veilig = Vonk.kandidaat({ codenaam:'Maan', media:[{ id:'1', position:0,
    src:'/api/vonk/profile-photo/delivery/abc_DEF-123', alt:'Portret' },
  { id:'2', src:'https://bucket.example/permanent.jpg', alt:'Niet gebruiken' }] });
  assert.equal(veilig.media.length, 1);
  assert.equal(Vonk.hoofdfoto(veilig).alt, 'Portret');
  assert.equal(Vonk.hoofdfoto({ media:[{ src:'/media/prive-geheim.jpg' }] }), null);
});

test('Vonk-fasen onderscheiden match, gesprek, bevestigde en actieve date', () => {
  assert.equal(Vonk.fase({}, '2026-09-22'), 'MATCH');
  assert.equal(Vonk.fase({ berichten:[{ tekst:'Hoi' }] }, '2026-09-22'), 'CONVERSATION');
  const bewijs={ state:'CONFIRMED', finality:'SOURCE_ATTESTED', missing:['operational-outcome'] };
  assert.equal(Vonk.fase({ status:'bevestigd', reservering:bewijs,
    tafel:{ datum:'2026-09-24' } }, '2026-09-22'), 'DATE_CONFIRMED');
  assert.equal(Vonk.fase({ status:'bevestigd', reservering:bewijs,
    tafel:{ datum:'2026-09-22' } }, '2026-09-22'), 'DATE_ACTIVE');
  assert.equal(Vonk.fase({ status:'bevestigd', reservering:{ state:'CONFIRMED',
    missing:['provider-confirmation'] }, tafel:{ datum:'2026-09-22' } }, '2026-09-22'),
  'RESERVATION_UNKNOWN');
  assert.equal(Vonk.fase({ status:'bevestigd', reservering:{ state:'UNKNOWN', missing:[] },
    tafel:{ datum:'2026-09-22' } }, '2026-09-22'), 'RESERVATION_UNKNOWN');
});

test('gesprekstarters gebruiken uitsluitend geprojecteerde matchvelden', () => {
  const prompts = Vonk.gesprekstarters({ kenmerken:{ leven:{ label:'Een rustig leven' } },
    wanneer:{ samen:{ slot:'do-avond' } }, verborgen:'geheim' });
  assert.ok(prompts.some(x => /rustig leven/.test(x)));
  assert.ok(prompts.some(x => /ontmoeten/.test(x)));
  assert.equal(prompts.join(' ').includes('geheim'), false);
});

test('browserhistorie bewaart root en kandidaatcontext zonder businessstate', () => {
  assert.equal(Vonk.hashVoor('matches'), '#matches');
  assert.equal(Vonk.hashVoor('vandaag', 'Maan & Ster'), '#vandaag/profiel/Maan%20%26%20Ster');
  assert.deepEqual(Vonk.leesHash('#vandaag/profiel/Maan%20%26%20Ster'), { tab:'vandaag', kandidaat:'Maan & Ster' });
});

test('het echte Vonk-scherm bevat de complete R5-keten maar geen verboden façadefuncties', () => {
  const html = lees('public/apps/vonk.html');
  const css = lees('public/shared/vonk-2.css');
  assert.match(html, /Today[’']s Six/);
  for (const tekst of ['Connection Passport', 'Open to connect', 'Meet Halfway', 'Date', 'Safety'])
    assert.match(html, new RegExp(tekst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(html, /data-(?:action|feature)=["'](?:voice|video|route|boost|super-like)/i);
  assert.match(html, /vonk-profile-dialog/); assert.match(html, /aria-live/);
  assert.match(css, /safe-area-inset/); assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media\(max-width:620px\)/); assert.match(css, /min-height:52px/);
});

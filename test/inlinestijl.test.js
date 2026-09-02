/* DE OMZETTING VAN INLINE STIJLEN NAAR KLASSEN (TAKEN.md 4.51).

   WAT HIER OP HET SPEL STAAT. Deze omzetting raakt 43 schermen en verandert
   niets wat je kunt zien -- en juist daarom is hij gevaarlijk: een fout valt
   niet op als een fout maar als "hij ziet er anders uit dan ik dacht". Twee
   grenzen houden hem eerlijk, en allebei komen ze uit iets dat hier echt is
   misgegaan.

   1. EEN INLINE STIJL DIE JAVASCRIPT AANRAAKT IS GEEN STIJL MAAR TOESTAND.
      `style="display:none;"` werd een klasse, en test/notities.e2e.js viel om:
      de app zet `el.style.display = ''` om zo'n vak te TONEN, en een lege inline
      waarde wint niet meer van een klasse. Het vak bleef onzichtbaar. De
      berekende-stijlproef kon dat per definitie niet zien -- die meet de
      rusttoestand zonder JavaScript, en dit is de toestand die pas na een tik
      ontstaat.

   2. ALLEEN .html. In een .js-bestand bestaat het onderscheid markup/script
      niet: daar staat elk style-attribuut in een string. De eerste meting telde
      daardoor 1160 "kandidaten" waarvan honderden uit bundeldelen kwamen --
      allemaal fictie.

   En een derde die geen grens is maar een eerlijkheidseis: een klasse die de
   proef heeft AFGEKEURD hoort niet in het <style>-blok te staan. Zeven
   bestanden droegen na de eerste ronde een kop zonder inhoud: een blok dat zegt
   dat er iets is omgezet terwijl er niets is omgezet.

   Draai los: node --test test/inlinestijl.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const WORTEL = path.join(__dirname, '..');
const OMZET = path.join(WORTEL, 'scripts', 'inlinestijl-omzet.js');

function metBestand(naam, inhoud, doe) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'inlinestijl-'));
  const p = path.join(map, naam);
  fs.writeFileSync(p, inhoud);
  try { return doe(p); } finally { fs.rmSync(map, { recursive: true, force: true }); }
}

function draai(bestand, extra) {
  return spawnSync(process.execPath, [OMZET, bestand, ...(extra || [])], { encoding: 'utf8', cwd: WORTEL });
}

const PAGINA = (lijf) => '<!doctype html><html lang="nl"><head><style>\n  .x{color:red}\n</style></head><body>' +
  lijf + '</body></html>';

test('herhaalde waarden worden een klasse, en de waarde staat er letterlijk in', () => {
  const lijf = '<p style="font-size:.8rem;color:blue">a</p><p style="font-size:.8rem;color:blue">b</p>';
  metBestand('t.html', PAGINA(lijf), (p) => {
    const r = draai(p);
    assert.equal(r.status, 0, r.stderr);
    const uit = fs.readFileSync(p, 'utf8');
    assert.doesNotMatch(uit, /style="font-size/, 'het attribuut staat er nog');
    const klasse = (/\.(i-[0-9a-z-]+)\{font-size:\.8rem;color:blue\}/.exec(uit) || [])[1];
    assert.ok(klasse, 'geen klasse met de letterlijke waarde in het <style>-blok');
    assert.equal((uit.match(new RegExp('class="' + klasse + '"', 'g')) || []).length, 2);
  });
});

test('een waarde die maar EEN keer voorkomt blijft staan', () => {
  /* Een klasse met een gebruiker is geen winst maar een omweg. */
  metBestand('t.html', PAGINA('<p style="color:green">a</p>'), (p) => {
    const r = draai(p);
    assert.equal(r.status, 0);
    assert.match(fs.readFileSync(p, 'utf8'), /style="color:green"/);
  });
});

test('GRENS 1: display:none is toestand en wordt nooit omgezet', () => {
  /* De fout die test/notities.e2e.js vond. `el.style.display = ''` toont een
     vak; is de inline stijl weg, dan wint de klasse en blijft het verborgen. */
  const lijf = '<div style="display:none;">a</div><div style="display:none;">b</div>';
  metBestand('t.html', PAGINA(lijf), (p) => {
    const r = draai(p);
    const uit = fs.readFileSync(p, 'utf8');
    assert.equal((uit.match(/style="display:none;"/g) || []).length, 2,
      'display:none is omgezet; dat breekt elk vak dat de app zelf toont');
    assert.doesNotMatch(uit, /\.i-/, 'er is een klasse gemaakt voor een schakelaar');
  });
});

test('GRENS 1b: visibility:hidden ook niet', () => {
  const lijf = '<div style="visibility:hidden">a</div><div style="visibility:hidden">b</div>';
  metBestand('t.html', PAGINA(lijf), (p) => {
    draai(p);
    assert.equal((fs.readFileSync(p, 'utf8').match(/style="visibility:hidden"/g) || []).length, 2);
  });
});

test('GRENS 1c: een element waarvan de app zelf de stijl zet, blijft met rust', () => {
  const lijf = '<div id="vak" style="padding:1rem">a</div><div style="padding:1rem">b</div>' +
    '<script>document.querySelector("#vak").style.padding = "2rem";</script>';
  metBestand('t.html', PAGINA(lijf), (p) => {
    draai(p);
    const uit = fs.readFileSync(p, 'utf8');
    assert.match(uit, /id="vak" style="padding:1rem"/, 'de app schrijft op dit element; de inline stijl hoort te blijven');
  });
});

test('GRENS 2: een .js-bestand wordt geweigerd, met de reden', () => {
  /* Daar staat elk style-attribuut in een string. Zou dit script eroverheen
     lopen, dan verbouwt hij tekst die de proef nooit te zien krijgt. */
  metBestand('t.js', 'var h = \'<p style="color:red">a</p><p style="color:red">b</p>\';', (p) => {
    const r = draai(p);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /alleen \.html/);
    assert.match(fs.readFileSync(p, 'utf8'), /style="color:red"/);
  });
});

test('een style-attribuut BINNEN een <script> blijft staan', () => {
  const lijf = '<p style="color:red">a</p><p style="color:red">b</p>' +
    '<script>var h = \'<i style="color:red"></i><i style="color:red"></i>\';</script>';
  metBestand('t.html', PAGINA(lijf), (p) => {
    draai(p);
    const uit = fs.readFileSync(p, 'utf8');
    assert.equal((uit.match(/<i style="color:red">/g) || []).length, 2,
      'de omzetting is in een JavaScript-string gaan schrijven');
  });
});

test('alles afgekeurd is GEEN blok: er blijft geen lege kop achter', () => {
  /* Zeven bestanden droegen die na de eerste ronde -- een blok dat zegt dat er
     iets is omgezet terwijl er niets is omgezet. */
  const lijf = '<p style="color:red">a</p><p style="color:red">b</p>';
  metBestand('t.html', PAGINA(lijf), (p) => {
    const eerst = draai(p);
    const klasse = (/\.(i-[0-9a-z-]+)\{/.exec(fs.readFileSync(p, 'utf8')) || [])[1];
    assert.ok(klasse, eerst.stderr);
    fs.writeFileSync(p, PAGINA(lijf));                        // terug naar de begintoestand
    const lijst = p.replace(/\.html$/, '.txt');
    fs.writeFileSync(lijst, klasse + '\n');
    const r = draai(p, ['--overslaan', lijst]);
    assert.equal(r.status, 0);
    const uit = fs.readFileSync(p, 'utf8');
    assert.doesNotMatch(uit, /inlinestijl-omzet\.js/, 'er staat een kop zonder klassen eronder');
    assert.match(r.stdout, /niets omgezet/);
  });
});

test('een tweede ronde hernoemt niets: dezelfde waarde geeft dezelfde klasse', () => {
  /* De naam komt uit de waarde zelf. Zou hij uit een teller komen, dan
     verschuift elke klasse zodra er ergens een attribuut bijkomt, en dan is
     iedere diff onleesbaar. */
  const lijf = '<p style="color:red">a</p><p style="color:red">b</p>';
  const naam = (p) => { draai(p); return (/\.(i-[0-9a-z-]+)\{/.exec(fs.readFileSync(p, 'utf8')) || [])[1]; };
  const a = metBestand('t.html', PAGINA(lijf), naam);
  const b = metBestand('t.html', PAGINA('<span>iets ervoor</span>' + lijf), naam);
  assert.equal(a, b);
});

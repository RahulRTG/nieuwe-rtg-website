/* MEELEZEN: de tekstbaan in een live gesprek (TAKEN.md 4.31).

   TOEGANKELIJK.md zegt het zo hard als het is: acht live vormen hebben geen weg
   naar tekst, en zolang die er niet is kan een dove deelnemer NIET MEEDOEN aan
   een gesprek in dit huis. public/shared/meelezen.js is die weg -- geen
   ondertiteling, want er wordt niets van spraak naar tekst omgezet, maar een
   baan waarin deelnemers meeschrijven en die bij iedereen live meeloopt.

   WAT HIER HET ZWAARST WEEGT, en dat zijn twee dingen:

     1. WAT BINNENKOMT IS TEKST VAN EEN ANDER. Het gaat langs de seinweg van het
        gesprek, en die draagt ook SDP-blokken -- er wordt niets aan gesaneerd.
        Zou deze module het als HTML op het scherm zetten, dan is een
        gespreksuitnodiging een manier om script bij iemand anders te draaien.
     2. HET MAG ZICH NIET VOORDOEN ALS ONDERTITELING. Een regel die een machine
        heeft geraden is iets anders dan een regel die iemand heeft getypt, en
        dat verschil hoort op het scherm te staan.

   Zonder browser, met een DOM-stomp die precies genoeg kan. Dit huis heeft geen
   dependencies, dus geen jsdom; de stomp staat hieronder en doet niets slims.

   Draai los: node --test test/meelezen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/* ---------- de DOM-stomp ---------- */
function maakDom() {
  function El(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attrs = {};
    this.style = { cssText: '' };
    this.luisteraars = {};
    this._tekst = '';
    this.hidden = false;
  }
  El.prototype.appendChild = function (k) { this.children.push(k); k.ouder = this; return k; };
  El.prototype.removeChild = function (k) { this.children = this.children.filter(x => x !== k); return k; };
  El.prototype.setAttribute = function (n, v) { this.attrs[n] = String(v); };
  El.prototype.getAttribute = function (n) { return this.attrs[n] === undefined ? null : this.attrs[n]; };
  El.prototype.addEventListener = function (n, f) { (this.luisteraars[n] = this.luisteraars[n] || []).push(f); };
  El.prototype.vuur = function (n, ev) { for (const f of (this.luisteraars[n] || [])) f(ev || { preventDefault() {} }); };
  El.prototype.focus = function () { this.gefocust = true; };
  Object.defineProperty(El.prototype, 'firstChild', { get() { return this.children[0] || null; } });
  Object.defineProperty(El.prototype, 'textContent', {
    get() { return this.children.length ? this.children.map(k => k.textContent).join('') : this._tekst; },
    set(v) { this.children = []; this._tekst = String(v); }
  });
  /* innerHTML BESTAAT hier niet. Zou de module hem toch gebruiken, dan valt deze
     toets om met een duidelijke fout in plaats van stil te slagen -- dat is het
     hele punt van deze stomp. */
  Object.defineProperty(El.prototype, 'innerHTML', {
    get() { throw new Error('innerHTML gelezen'); },
    set() { throw new Error('meelezen.js zet innerHTML -- tekst van een ander hoort NOOIT als HTML op het scherm'); }
  });

  function Tekst(t) { this._tekst = String(t); }
  Object.defineProperty(Tekst.prototype, 'textContent', { get() { return this._tekst; } });

  const d = {
    createElement: (t) => new El(t),
    createTextNode: (t) => new Tekst(t)
  };
  return { d, El };
}

/* Zoeken op klasse in plaats van op positie: een toets die `children[3]` telt,
   zakt zodra iemand er een element boven zet -- en dan meet hij de volgorde en
   niet het gedrag. */
function vind(el, klasse) {
  if (el.className === klasse) return el;
  for (const k of (el.children || [])) { const t = vind(k, klasse); if (t) return t; }
  return null;
}

function laad(opties) {
  opties = opties || {};
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'meelezen.js'), 'utf8');
  const { d } = maakDom();
  const w = {};
  /* Een nagemaakte spraakkoppeling. shared/spraaktekst.js heeft zijn eigen
     toetsen; hier gaat het alleen om wat DEZE module met hem doet. */
  const spraak = { aan: true, gestopt: 0 };
  if (opties.metSpraak) {
    w.RTGSpraakTekst = { koppel: () => ({ get aan() { return spraak.aan; },
      stop: () => { spraak.gestopt++; spraak.aan = false; } }) };
  }
  new Function('window', 'document', bron)(w, d);
  return { w, d, spraak };
}

/* ---------- de toetsen ---------- */

test('DE VEILIGHEID: een regel van een ander gaat als TEKST het scherm op', () => {
  /* De seinweg draagt ook SDP en saneert niets. Zou dit als HTML landen, dan is
     een gespreksuitnodiging een manier om script bij iemand anders te draaien.
     De DOM-stomp gooit bij innerHTML, dus dit zakt hard in plaats van zacht. */
  const { w } = laad();
  const m = w.RTGMeelezen.maak({});
  const boos = '<img src=x onerror="alert(1)">';
  m.voed(boos, { wie: 'De ander' });
  assert.deepEqual(m.regels(), ['De ander: ' + boos], 'de tekens staan er, als tekst');
});

test('DE VEILIGHEID: ook de NAAM van de ander is tekst', () => {
  const { w } = laad();
  const m = w.RTGMeelezen.maak({});
  m.voed('hallo', { wie: '<script>x</script>' });
  assert.match(m.regels()[0], /^<script>x<\/script>: hallo$/);
});

test('een machineregel zegt dat hij van een machine komt', () => {
  /* Sinds 2 september 2026 voedt shared/spraaktekst.js deze baan met bron
     'machine'. Geraden tekst mag zich niet voordoen als geschreven tekst: wie
     meeleest hoort te weten welke van de twee hij leest. */
  const { w } = laad();
  const m = w.RTGMeelezen.maak({});
  m.voed('dit is geraden', { bron: 'machine' });
  assert.match(m.regels()[0], /\(automatisch\)$/);
  m.voed('dit is getypt', { bron: 'mens' });
  assert.doesNotMatch(m.regels()[1], /automatisch/);
});

test('typen stuurt de regel EN zet hem meteen zelf neer', () => {
  /* Wie meeleest moet zien dat zijn regel is verzonden, ook als de ander
     wegvalt. Wachten op een echo van de andere kant zou betekenen dat je bij
     een haperende verbinding je eigen woorden niet ziet. */
  const { w } = laad();
  const verzonden = [];
  const m = w.RTGMeelezen.maak({ ik: 'Jij', stuur: (r) => verzonden.push(r) });
  const rij = vind(m.el, 'meelees-rij');
  const veld = vind(m.el, 'meelees-veld');
  veld.value = '  ik  hoor   je  niet  ';
  rij.vuur('submit');
  assert.deepEqual(verzonden, ['ik hoor je niet'], 'witruimte samengetrokken, verstuurd');
  assert.deepEqual(m.regels(), ['Jij: ik hoor je niet']);
  assert.equal(veld.value, '', 'en het veld is leeg voor de volgende regel');
});

test('een lege regel gaat nergens heen', () => {
  const { w } = laad();
  const verzonden = [];
  const m = w.RTGMeelezen.maak({ stuur: (r) => verzonden.push(r) });
  const rij = vind(m.el, 'meelees-rij');
  vind(m.el, 'meelees-veld').value = '   ';
  rij.vuur('submit');
  assert.deepEqual(verzonden, []);
  assert.deepEqual(m.regels(), []);
});

test('een binnenkomende regel VOUWT DE BAAN OPEN', () => {
  /* Een regel die niemand ziet omdat het paneel dicht staat, is geen weg naar
     tekst. Dit is de regel waar de hele voorziening op staat of valt. */
  const { w } = laad();
  const m = w.RTGMeelezen.maak({});
  assert.equal(m.isOpen, false, 'dicht bij het begin: het gesprek zelf staat voorop');
  m.voed('ben je er nog?', { wie: 'De ander' });
  assert.equal(m.isOpen, true);
});

test('de baan is een LOG met aria-live, zodat een schermlezer meekomt', () => {
  const { w } = laad();
  const m = w.RTGMeelezen.maak({});
  const baan = vind(m.el, 'meelees-baan');
  assert.equal(baan.getAttribute('role'), 'log');
  assert.equal(baan.getAttribute('aria-live'), 'polite', 'meelezen is geen alarm');
  assert.ok(baan.getAttribute('aria-label'), 'en hij zegt wat hij is');
  const knop = vind(m.el, 'meelees-knop');
  assert.equal(knop.getAttribute('aria-expanded'), 'false');
  m.open();
  assert.equal(knop.getAttribute('aria-expanded'), 'true', 'de knop zegt of hij openstaat');
});

test('de baan loopt niet vol: oude regels schuiven eruit', () => {
  const { w } = laad();
  const m = w.RTGMeelezen.maak({});
  for (let i = 0; i < w.RTGMeelezen.BEWAAR + 20; i++) m.voed('regel ' + i, {});
  assert.equal(m.regels().length, w.RTGMeelezen.BEWAAR);
  assert.equal(m.regels()[m.regels().length - 1], 'regel ' + (w.RTGMeelezen.BEWAAR + 19), 'de nieuwste staat onderaan');
});

test('een regel wordt afgekapt, en dat gebeurt HIER en niet op de server', () => {
  /* De server mag deze payload niet begrenzen: dezelfde weg draagt SDP-blokken
     en die zijn groot. Dus kapt de baan af wat hij toont. */
  const { w } = laad();
  const m = w.RTGMeelezen.maak({});
  m.voed('x'.repeat(5000), {});
  assert.equal(m.regels()[0].length, w.RTGMeelezen.MAX);
});

test('DE BEDRADING: elke gespreksvorm die de baan draagt, stuurt en ontvangt hem', () => {
  /* Een module die nergens hangt is geen voorziening. Deze toets kijkt in de
     echte bestanden of de twee kanten er allebei zijn: een `tekst`-sein eruit,
     en een tak die hem binnenlaat. Zonder deze toets kan iemand de ontvangkant
     weghalen en blijft het scherm er compleet uitzien. */
  const WORTEL = path.join(__dirname, '..');
  const DRAGERS = [
    ['public/shared/schoolbel.js', /kind === 'tekst'/, /mee\.voed\(/],
    ['public/apps/foundation/gezin-rt.js', /kind === 'tekst'/, /mee\.voed\(/],
    ['public/apps/meet/kamer.js', /kind === 'tekst'/, /mee\.voed\(/],
    ['public/shared/teamcall.js', /kind === 'tekst'/, /mee\.voed\(/],
    ['public/apps/app-main.js', /kind === 'tekst'/, /\.voed\(/],
    ['public/apps/foundation/vrienden.html', /kind==='tekst'/, /\.voed\(/]
  ];
  for (const [rel, ontvang, zet] of DRAGERS) {
    const s = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    assert.match(s, /RTGMeelezen/, rel + ' laadt de baan');
    assert.match(s, /'tekst'/, rel + ' kent een tekstsein');
    assert.match(s, ontvang, rel + ' laat een binnenkomende regel binnen');
    assert.match(s, zet, rel + ' zet hem in de baan');
  }
});

test('DE ZES GESPREKKEN LADEN DE MODULE OOK ECHT', () => {
  /* Een module die in de code wordt aangeroepen maar nergens wordt ingeladen,
     is een stille `if (window.RTGMeelezen)` die altijd false is -- en dan ziet
     het scherm er compleet uit terwijl er niets is. Dit is precies de vorm die
     LAT.md regel 9 bedoelt. */
  const WORTEL = path.join(__dirname, '..');
  const SCHERMEN = ['public/apps/app.html', 'public/apps/meet.html', 'public/apps/schoolpartner.html',
    'public/apps/foundation/school.html', 'public/apps/foundation/contact.html', 'public/apps/foundation/vrienden.html'];
  for (const rel of SCHERMEN) {
    const s = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
    assert.match(s, /shared\/meelezen\.js/, rel + ' laadt shared/meelezen.js');
  }
});

test('DE BAAN DICHT IS DE MICROFOON UIT', () => {
  /* Een herkenner die doorluistert achter een paneel dat niemand ziet, is
     precies wat de knop niet mag opleveren: het scherm zegt dan niets meer over
     een microfoon die wel aanstaat. Gemeten door de stop-tak weg te halen en
     deze toets te zien zakken. */
  const { w, spraak } = laad({ metSpraak: true });
  const m = w.RTGMeelezen.maak({});
  m.open();
  assert.equal(m.spraakAan, true, 'de aanname onder deze toets: de nagemaakte koppeling staat aan');
  m.sluit();
  assert.equal(spraak.gestopt, 1, 'de baan ging dicht en de microfoon bleef aan');
  assert.equal(m.spraakAan, false);
});

test('zonder spraakmodule werkt de baan gewoon als eerst', () => {
  /* De goede kant om te ontbreken: meetypen blijft. check.js regel 65 houdt vast
     dat elke pagina die de module gebruikt hem ook laadt. */
  const { w } = laad();
  const m = w.RTGMeelezen.maak({});
  assert.equal(m.spraakAan, false);
  m.voed('hallo', { wie: 'De ander' });
  assert.deepEqual(m.regels(), ['De ander: hallo']);
});

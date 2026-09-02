/* SPRAAK NAAR TEKST: de herkenner onder de meeleesbaan (TAKEN.md 4.31).

   WAT HIER HET ZWAARST WEEGT, en het zijn er vier:

     1. UIT IS DE STARTSTAND. Een herkenner die vanzelf begint is een microfoon
        die meeluistert zonder dat iemand daarom vroeg. Deze toets zakt zodra
        het bouwen van de bediening zelf al een herkenner start.
     2. GERADEN TEKST HEET GERADEN. Elke regel gaat de baan in met bron
        'machine'; zou hij als 'mens' binnenkomen, dan doet een gok zich voor
        als een mens die iets zei.
     3. HET VERZOEK ZET NIETS AAN BIJ DE ANDER. "Vraag om live tekst" is een
        REGEL en geen schakelaar -- LIFE.md par. 4: alles wat een tweede persoon
        bereikt wordt klaargezet, nooit automatisch. Deze toets zakt zodra die
        knop iets anders doet dan tekst sturen.
     4. EEN VERHINDERING DRAAGT EEN REDEN. Kan de browser het niet, dan staat de
        knop uit MET de reden erbij, en niet grijs zonder uitleg
        (GRAMMATICA.md).

   Zonder browser, met dezelfde DOM-stomp als test/meelezen.test.js en een
   nagemaakte SpeechRecognition die precies genoeg kan. Dit huis heeft geen
   dependencies, dus geen jsdom.

   Draai los: node --test test/spraaktekst.test.js */
'use strict';
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
    this.disabled = false;
  }
  El.prototype.appendChild = function (k) { this.children.push(k); k.ouder = this; return k; };
  El.prototype.insertBefore = function (k) { this.children.push(k); k.ouder = this; return k; };
  El.prototype.setAttribute = function (n, v) { this.attrs[n] = String(v); };
  El.prototype.getAttribute = function (n) { return this.attrs[n] === undefined ? null : this.attrs[n]; };
  El.prototype.addEventListener = function (n, f) { (this.luisteraars[n] = this.luisteraars[n] || []).push(f); };
  El.prototype.vuur = function (n, ev) { for (const f of (this.luisteraars[n] || [])) f(ev || { preventDefault() {} }); };
  Object.defineProperty(El.prototype, 'nextSibling', { get() { return null; } });
  Object.defineProperty(El.prototype, 'parentNode', { get() { return this.ouder || null; } });
  Object.defineProperty(El.prototype, 'textContent', {
    get() { return this.children.length ? this.children.map(k => k.textContent).join('') : this._tekst; },
    set(v) { this.children = []; this._tekst = String(v); }
  });
  const d = {
    documentElement: { lang: 'nl' },
    createElement: (t) => new El(t),
    createTextNode: (t) => ({ textContent: String(t) })
  };
  return { d, El };
}

/* ---------- een nagemaakte herkenner ----------

   Hij houdt bij hoe vaak hij gestart is; dat is wat toets 1 meet. `zeg()` doet
   alsof er een zin is afgerond. */
function maakMotor() {
  const gestart = [];
  function SR() { this.lang = null; this.continuous = null; this.interimResults = null; SR.laatste = this; }
  SR.prototype.start = function () { gestart.push(this); };
  SR.prototype.stop = function () { if (this.onend) this.onend(); };
  SR.prototype.zeg = function (t) {
    this.onresult({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: t }, length: 1 }] });
  };
  return { SR, gestart };
}

function laad(opties) {
  opties = opties || {};
  const bron = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'spraaktekst.js'), 'utf8');
  const { d } = maakDom();
  const motor = maakMotor();
  const w = { isSecureContext: opties.onveilig ? false : true };
  if (!opties.geenMotor) w.SpeechRecognition = motor.SR;
  new Function('window', 'document', bron)(w, d);
  return { w, d, motor };
}

function bedien(w, d, zend) {
  const kop = d.createElement('div');
  const wrap = d.createElement('div');
  wrap.appendChild(kop);
  const regels = [];
  const koppel = w.RTGSpraakTekst.koppel({
    kop: kop,
    knopStijl: '',
    zend: (r, bron) => { regels.push({ r, bron }); if (zend) zend(r, bron); },
    open: () => {}
  });
  const knop = (klasse) => kop.children.find(k => k.className === klasse);
  return { koppel, kop, regels, spraakKnop: knop('meelees-spraak'), vraagKnop: knop('meelees-vraag') };
}

/* ---------- de toetsen ---------- */

test('UIT IS DE STARTSTAND: het bouwen van de bediening start geen herkenner', () => {
  const { w, d, motor } = laad();
  const b = bedien(w, d);
  assert.equal(motor.gestart.length, 0, 'er is een herkenner gestart zonder dat iemand op de knop drukte');
  assert.equal(b.spraakKnop.getAttribute('aria-pressed'), 'false');
  assert.equal(b.spraakKnop.textContent, 'Spreek mee');
});

test('een tik start hem, en een tweede tik stopt hem', () => {
  const { w, d, motor } = laad();
  const b = bedien(w, d);
  b.spraakKnop.vuur('click');
  assert.equal(motor.gestart.length, 1);
  assert.equal(b.spraakKnop.getAttribute('aria-pressed'), 'true');
  assert.equal(b.spraakKnop.textContent, 'Stop met spreken');
  b.spraakKnop.vuur('click');
  assert.equal(b.spraakKnop.getAttribute('aria-pressed'), 'false');
  assert.equal(b.spraakKnop.textContent, 'Spreek mee');
});

test('GERADEN TEKST HEET GERADEN: elke herkende zin gaat de baan in als machine', () => {
  const { w, d, motor } = laad();
  const b = bedien(w, d);
  b.spraakKnop.vuur('click');
  motor.SR.laatste.zeg('dit heeft niemand getypt');
  assert.deepEqual(b.regels, [{ r: 'dit heeft niemand getypt', bron: 'machine' }],
    'een geraden regel die als mens binnenkomt, doet een gok voorkomen als iemand die iets zei');
});

test('HET VERZOEK ZET NIETS AAN: de vraagknop stuurt tekst en start geen herkenner', () => {
  /* LIFE.md par. 4 staat hierboven: alles wat een tweede persoon bereikt wordt
     klaargezet en nooit automatisch. Zou deze knop de microfoon van de ander
     aanzetten, dan is dat precies wat daar verboden is -- en het zou hier ook
     niet eens KUNNEN, want dit draait bij de vrager. */
  const { w, d, motor } = laad();
  const b = bedien(w, d);
  b.vraagKnop.vuur('click');
  assert.equal(motor.gestart.length, 0, 'het verzoek startte een herkenner');
  assert.equal(b.regels.length, 1);
  assert.equal(b.regels[0].bron, 'mens', 'het verzoek komt van een mens en niet van een machine');
  assert.match(b.regels[0].r, /Spreek mee/, 'het verzoek zegt wat de ander moet doen');
});

test('EEN VERHINDERING DRAAGT EEN REDEN: zonder motor staat de knop uit met uitleg', () => {
  const { w, d } = laad({ geenMotor: true });
  assert.equal(w.RTGSpraakTekst.beschikbaar(), false);
  const b = bedien(w, d);
  assert.equal(b.spraakKnop.disabled, true);
  /* ZICHTBAAR, en niet in een `title`. Een tooltip op een uitgeschakelde knop
     krijg je met een toetsenbord niet te pakken en een schermlezer leest hem
     niet betrouwbaar voor -- dan bereikt de reden precies de mensen niet voor
     wie deze knop bestaat. Deze toets vond die fout in de eerste versie. */
  const stand = (b.kop.parentNode.children || []).find(k => k.className === 'meelees-stand');
  assert.equal(stand.hidden, false, 'de reden staat er niet zichtbaar bij');
  assert.match(stand.textContent, /kan geen spraak/,
    'een knop die uitstaat zonder reden is precies wat GRAMMATICA.md verbiedt');
});

test('buiten een beveiligde verbinding zegt hij dat, en niet iets anders', () => {
  const { w } = laad({ onveilig: true });
  assert.match(w.RTGSpraakTekst.waarom(), /beveiligde verbinding/);
});

test('de taal komt van de PAGINA en niet van het toestel', () => {
  /* Een RTG-scherm in het Nederlands hoort niet naar Engels te luisteren omdat
     iemands telefoon zo staat. */
  const { w, d, motor } = laad();
  const b = bedien(w, d);
  b.spraakKnop.vuur('click');
  assert.equal(motor.SR.laatste.lang, 'nl-NL');
  assert.equal(w.RTGSpraakTekst.taalVanPagina(), 'nl-NL');
});

test('alleen AFGERONDE zinnen: interimResults staat uit', () => {
  /* Een tussenstand die bij elk woord verandert is in een aria-live-baan
     onleesbaar: een schermlezer begint elke keer opnieuw. */
  const { w, d, motor } = laad();
  const b = bedien(w, d);
  b.spraakKnop.vuur('click');
  assert.equal(motor.SR.laatste.interimResults, false);
  assert.equal(motor.SR.laatste.continuous, true);
});

test('een herkenner die uit zichzelf stopt, komt terug zolang de gebruiker hem aan wil', () => {
  /* De stilste manier waarop deze functie kapot kan: het lampje staat aan, de
     gebruiker denkt dat hij gevolgd wordt, en er komt niets meer. */
  const { w, d, motor } = laad();
  const b = bedien(w, d);
  b.spraakKnop.vuur('click');
  assert.equal(motor.gestart.length, 1);
  motor.SR.laatste.onend();
  assert.equal(motor.gestart.length, 2, 'hij kwam niet terug na een stilte');
  assert.equal(b.spraakKnop.getAttribute('aria-pressed'), 'true');
});

test('een geweigerde microfoon zet de knop uit MET de reden', () => {
  const { w, d, motor } = laad();
  const b = bedien(w, d);
  b.spraakKnop.vuur('click');
  motor.SR.laatste.onerror({ error: 'not-allowed' });
  assert.equal(b.spraakKnop.getAttribute('aria-pressed'), 'false');
  const stand = (b.kop.parentNode.children || []).find(k => k.className === 'meelees-stand');
  assert.match(stand.textContent, /geen toegang tot de microfoon/);
  assert.equal(stand.hidden, false, 'een reden die verborgen blijft, is geen reden');
});

test('stilte is geen storing: no-speech laat hem gewoon staan', () => {
  const { w, d, motor } = laad();
  const b = bedien(w, d);
  b.spraakKnop.vuur('click');
  motor.SR.laatste.onerror({ error: 'no-speech' });
  assert.equal(b.spraakKnop.getAttribute('aria-pressed'), 'true',
    'even niets zeggen mag de herkenner niet uitzetten');
});

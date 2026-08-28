/* DE HANDELING (server/opzet/handeling.js).

   WAT HIER OP HET SPEL STAAT. Dit is de tweede helft van de brug tussen de
   poortwachter (die WIE weet) en de opslag (die weet WAT ER VERANDERT). Zonder
   deze laag is er geen blast radius te berekenen, en zonder blast radius geen
   risicobudget en geen bewijsbonnetje. Het getal dat hij oplevert -- hoeveel
   rijen heeft DIT ENE VERZOEK bewogen -- is precies waar een grens op hoort te
   staan.

   EN OMDAT HET EEN METER IS, MOET JE HEM HEBBEN ZIEN UITSLAAN (LAT.md regel 10).
   Een meting die altijd nul zegt ziet er precies zo uit als een systeem waarin
   niets gebeurt. Deze toets voert hem daarom echte bewegingen: een rij erbij, een
   massaverwijdering, een collectie die nieuw ontstaat, en een vervanging met
   gelijk aantal -- die laatste MOET hij missen, en dat is de blinde vlek die in
   de kop staat. Een toets die alleen de treffers laat zien, verkoopt de meter
   voor meer dan hij is.

   DE MELDING is de andere helft: boven de grens hoort er een regel te komen, en
   eronder niet. Een melder die bij elk verzoek roept is ruis, en een die nooit
   roept is er geen.

   Draai los: node --test test/handeling.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const handeling = require('../server/opzet/handeling');

/* Een nagemaakt verzoek en antwoord: genoeg om de middleware echt te draaien
   zonder een server op te zetten. res.finish is waar de meting valt, dus die
   moeten we zelf kunnen afvuren -- precies zoals Express dat doet. */
function harnas(data, opties) {
  const regels = [];
  const req = { id: 'corr-1', path: '/api/proef', method: 'POST' };
  const luisteraars = {};
  const res = { on: (naam, fn) => { (luisteraars[naam] = luisteraars[naam] || []).push(fn); } };
  const mw = handeling.middleware({
    data: () => data.huidig,
    log: (niveau, bericht, velden) => regels.push({ niveau, bericht, velden }),
    ...(opties || {})
  });
  return {
    req, res, regels,
    draai(werk) {
      mw(req, res, () => { if (werk) werk(); });
      for (const fn of luisteraars.finish || []) fn();
      return req.handeling;
    }
  };
}

/* ---------- de meting ---------- */

test('een rij erbij is een handeling van een rij', () => {
  const data = { huidig: { boekingen: [], leden: [1, 2, 3] } };
  const h = harnas(data);
  const uit = h.draai(() => { data.huidig.boekingen.push({ id: 1 }); });
  assert.equal(uit.geraakt, 1);
  assert.deepEqual(uit.doel, ['boekingen']);
  assert.deepEqual(uit.wijzigingen, [{ collectie: 'boekingen', van: 0, naar: 1, delta: 1 }]);
});

test('een verzoek dat niets verandert levert nul en geen wijzigingen', () => {
  const data = { huidig: { boekingen: [1], leden: [1, 2] } };
  const uit = harnas(data).draai(() => {});
  assert.equal(uit.geraakt, 0);
  assert.deepEqual(uit.wijzigingen, []);
  assert.deepEqual(uit.doel, []);
});

test('MASSAVERWIJDERING: het getal waar een blast-radius-grens op hoort te staan', () => {
  /* Dit is waar de hele laag voor bestaat. Zonder deze meting is "4280
     medewerkers weg" technisch precies hetzelfde verzoek als "1 boeking erbij". */
  const medewerkers = new Array(4280).fill(0).map((_, i) => ({ id: i }));
  const data = { huidig: { medewerkers, boekingen: [] } };
  const uit = harnas(data).draai(() => { data.huidig.medewerkers.length = 0; });
  assert.equal(uit.geraakt, 4280);
  assert.deepEqual(uit.wijzigingen, [{ collectie: 'medewerkers', van: 4280, naar: 0, delta: -4280 }]);
});

test('een collectie die NIEUW ontstaat telt als groei vanaf nul', () => {
  const data = { huidig: { leden: [1] } };
  const uit = harnas(data).draai(() => { data.huidig.facturen = [{ id: 1 }, { id: 2 }]; });
  assert.equal(uit.geraakt, 2);
  assert.deepEqual(uit.wijzigingen, [{ collectie: 'facturen', van: 0, naar: 2, delta: 2 }]);
});

test('een collectie die VERDWIJNT telt als krimp naar nul', () => {
  const data = { huidig: { leden: [1, 2, 3], oud: [1, 2] } };
  const uit = harnas(data).draai(() => { delete data.huidig.oud; });
  assert.equal(uit.geraakt, 2);
  assert.deepEqual(uit.wijzigingen, [{ collectie: 'oud', van: 2, naar: 0, delta: -2 }]);
});

test('de grootste beweging staat vooraan', () => {
  const data = { huidig: { a: [], b: [], c: [] } };
  const uit = harnas(data).draai(() => {
    data.huidig.a.push(1);
    for (let i = 0; i < 50; i++) data.huidig.b.push(i);
    for (let i = 0; i < 7; i++) data.huidig.c.push(i);
  });
  assert.deepEqual(uit.wijzigingen.map(w => w.collectie), ['b', 'c', 'a']);
  assert.equal(uit.geraakt, 58);
});

/* ---------- de blinde vlekken, met een toets erop ---------- */

test('BLINDE VLEK: een wijziging BINNEN een rij is onzichtbaar', () => {
  /* Dit is geen bug maar de prijs die in de kop staat, en hij hoort vastgelegd
     te zijn: wie deze meter later voor meer aanziet dan hij is, laat deze toets
     zakken. Vierduizend mensen op non-actief zetten beweegt geen enkel rij-aantal. */
  const medewerkers = new Array(4000).fill(0).map((_, i) => ({ id: i, actief: true }));
  const data = { huidig: { medewerkers } };
  const uit = harnas(data).draai(() => { for (const m of data.huidig.medewerkers) m.actief = false; });
  assert.equal(uit.geraakt, 0, 'als dit ooit iets anders dan 0 wordt, is de meter DIEPER gaan kijken -- werk de kop bij');
});

test('BLINDE VLEK: vervanging met gelijk aantal is delta nul', () => {
  const data = { huidig: { rijen: [1, 2, 3, 4, 5] } };
  const uit = harnas(data).draai(() => { data.huidig.rijen = [9, 8, 7, 6, 5]; });
  assert.equal(uit.geraakt, 0);
});

test('raakt() vult het gat dat de rij-telling niet ziet', () => {
  /* De uitweg voor die eerste blinde vlek: een handeling die zelf zegt wat hij
     aanraakt. Vandaag nog nergens aangeroepen in de server, en dat staat zo in
     de kop -- maar de weg moet wel werken, anders is het een dood voornemen. */
  const medewerkers = new Array(4000).fill(0).map((_, i) => ({ id: i, actief: true }));
  const data = { huidig: { medewerkers } };
  const h = harnas(data);
  const uit = h.draai(() => {
    for (const m of data.huidig.medewerkers) m.actief = false;
    assert.equal(handeling.raakt('medewerker-status', 4000), true, 'raakt() hoort binnen een verzoek te werken');
  });
  assert.equal(uit.geraakt, 4000);
});

test('raakt() buiten een verzoek doet niets en zegt dat ook', () => {
  assert.equal(handeling.raakt('iets', 5), false);
  assert.equal(handeling.huidige(), null);
});

/* ---------- de melding ---------- */

test('boven de grens komt er een regel, met het aantal en waar', () => {
  const data = { huidig: { medewerkers: new Array(handeling.GRENS + 10).fill(0) } };
  const h = harnas(data);
  h.draai(() => { data.huidig.medewerkers.length = 0; });
  const groot = h.regels.filter(r => r.bericht === 'grote handeling');
  assert.equal(groot.length, 1, 'geen melding bij ' + (handeling.GRENS + 10) + ' rijen:\n' + JSON.stringify(h.regels));
  assert.equal(groot[0].niveau, 'warn');
  assert.equal(groot[0].velden.rijen, handeling.GRENS + 10);
  assert.match(groot[0].velden.waar, /medewerkers-/);
  assert.equal(groot[0].velden.id, 'corr-1', 'de melding draagt het correlatie-id van het verzoek');
});

test('onder de grens komt er GEEN regel -- een melder die altijd roept is ruis', () => {
  const data = { huidig: { boekingen: [] } };
  const h = harnas(data);
  h.draai(() => { data.huidig.boekingen.push({ id: 1 }); });
  assert.equal(h.regels.filter(r => r.bericht === 'grote handeling').length, 0);
});

test('precies OP de grens telt als groot: de grens hoort erbij, niet erbuiten', () => {
  const data = { huidig: { rijen: [] } };
  const h = harnas(data);
  h.draai(() => { for (let i = 0; i < handeling.GRENS; i++) data.huidig.rijen.push(i); });
  assert.equal(h.regels.filter(r => r.bericht === 'grote handeling').length, 1);
});

/* ---------- hij valt nooit om, en zwijgt ook niet ---------- */

test('een meting die omvalt levert een REDEN, geen stille nul', () => {
  /* Een stille nul zou gelezen worden als "dit verzoek veranderde niets" -- het
     gevaarlijkste antwoord dat deze laag kan geven (LAT.md regel 5). */
  const h = {
    correlatie: 'x', pad: '/a', methode: 'POST',
    voor: { keys() { throw new Error('kapotte grondtelling'); } },
    gemeld: [], wijzigingen: [], geraakt: 0, doel: [], gesloten: false
  };
  assert.doesNotThrow(() => handeling.sluit(h, { a: [1] }));
  assert.equal(h.geraakt, null, 'niet 0, want 0 betekent "er gebeurde niets"');
  assert.ok(h.fout, 'en de reden staat erin');
});

test('een verzoek zonder database levert een lege meting en geen uitzondering', () => {
  const data = { huidig: null };
  let uit;
  assert.doesNotThrow(() => { uit = harnas(data).draai(() => {}); });
  assert.equal(uit.geraakt, 0);
});

test('sluit() twee keer aanroepen telt niet dubbel', () => {
  const data = { huidig: { a: [] } };
  const h = harnas(data);
  const uit = h.draai(() => { data.huidig.a.push(1); });
  const nogmaals = handeling.sluit(uit, { a: [1, 2, 3, 4, 5] });
  assert.equal(nogmaals.geraakt, 1, 'een tweede sluiting mag de uitslag niet overschrijven');
});

/* ---------- de context ---------- */

test('de handeling is binnen het verzoek op te vragen zonder req door te geven', () => {
  /* Dat is de hele reden voor AsyncLocalStorage: een module diep in de kern kan
     bij de lopende handeling zonder dat 2700 aanroepplekken een parameter erbij
     krijgen. */
  const data = { huidig: { a: [] } };
  let gezien = null;
  harnas(data).draai(() => { gezien = handeling.huidige(); });
  assert.ok(gezien, 'handeling.huidige() gaf niets binnen het verzoek');
  assert.equal(gezien.correlatie, 'corr-1');
  assert.equal(gezien.pad, '/api/proef');
});

/* ---------- en dan de vraag die een nagemaakt verzoek NIET kan beantwoorden ----------

   Alles hierboven draait op een verzonnen db.data. Daarmee is bewezen dat de
   REKENKANT klopt, en niets over de enige aanname die er echt toe doet: haalt
   deze laag in een DRAAIENDE server werkelijk db.data op? Lukt dat niet, dan
   vangt de middleware dat netjes af en meet hij voor eeuwig nul -- een meter die
   groen staat omdat hij niets ziet, en precies waar LAT.md regel 3 en 10 over
   gaan.

   Dus: een echte server, de grens op 1, een echt verzoek dat een rij aanmaakt,
   en de eis dat de melding in zijn log verschijnt. Zonder database-koppeling
   blijft dat log leeg en zakt deze toets. */
const cp = require('child_process');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function post(port, pad, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body || {});
    const req = http.request({ host: '127.0.0.1', port, path: pad, method: 'POST', timeout: 8000,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let b = ''; res.on('data', d => (b += d)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end(data);
  });
}
function get(port, pad) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pad, timeout: 8000 }, res => {
      let b = ''; res.on('data', d => (b += d)); res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
  });
}

test('IN EEN ECHTE SERVER: de laag haalt db.data op en meldt een handeling', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-handeling-'));
  let kind = null, log = '';
  try {
    let port, op = false;
    for (let poging = 0; poging < 4 && !op; poging++) {
      port = 39000 + Math.floor(Math.random() * 2000);
      kind = cp.spawn(process.execPath, ['--experimental-sqlite', 'server/server.js'], {
        cwd: ROOT,
        env: Object.assign({}, process.env, {
          PORT: String(port), RTG_DATA_DIR: dataDir, RTG_CSP_NONCE: '0', NODE_ENV: 'test',
          RTG_DEMO: '1', ANTHROPIC_API_KEY: '', RTG_PG: '',
          // de grens op 1: elke rij die erbij komt hoort een regel te geven
          RTG_HANDELING_GRENS: '1'
        }),
        stdio: ['ignore', 'pipe', 'pipe']
      });
      log = '';
      kind.stdout.on('data', d => { log += d; });
      kind.stderr.on('data', d => { log += d; });
      const eind = Date.now() + 30000;
      while (Date.now() < eind) {
        try { const r = await get(port, '/api/health'); if (r.status) { op = true; break; } } catch (e) {}
        if (/EADDRINUSE/.test(log)) break;
        await new Promise(r => setTimeout(r, 250));
      }
      if (!op) { kind.kill('SIGKILL'); kind = null; }
    }
    assert.ok(op, 'server kwam niet op:\n' + log.slice(-1500));

    /* EEN AANROEP DIE ECHT SCHRIJFT, en die eis is duurder geleerd dan hij
       lijkt. Hier stond een POST naar /api/register met de opmerking "een
       registratie maakt een lid aan: gegarandeerd minstens een rij erbij".

       Dat eindpunt heeft NOOIT bestaan -- niet op main, en ook niet op de basis
       van deze tak. De aanroep gaf gewoon 404. En toch stond deze toets een week
       lang groen, want elk verzoek deed toevallig ook een schrijfactie, en DAT
       was wat er gemeten werd. Toen main die vaste heffing per verzoek
       weghaalde (een terechte versnelling: p50 en p99 gehalveerd) viel de toets
       om -- niet omdat de laag stuk was, maar omdat de mutatie die hij dacht te
       maken er nooit was geweest.

       Een toets die iets anders meet dan zijn naam zegt, is precies het soort
       dat groen blijft tot het ertoe doet. Daarom nu een aanroep die BESTAAT en
       waarvan de schrijfactie met naam in de melding terugkomt: het kantoorlogin
       zet een regel in securityLog, en de meting noteert `"waar":"securityLog+1"`.
       Verdwijnt die route, dan zakt de statuscontrole hieronder meteen in plaats
       van dat deze toets stilletjes iets anders gaat meten.

       WAT DEZE TOETS NIET BEWIJST, en dat hoort erbij. Hij bewaakt NIET dat
       hervat() de handelingscontext na het lezen van de body terugzet: met
       hervat() weggemuteerd blijft deze toets groen, want /api/office/login
       verliest die context niet. Die garantie staat in
       test/begrotingroute.test.js, en daar zakken er twee van de drie zodra
       hervat() eruit gaat. Deze toets bewijst het andere stuk: dat de laag in
       een ECHTE server bij db.data komt en niet altijd nul meet. */
    const r = await post(port, '/api/office/login', { code: 'RTG-OFFICE' });
    assert.equal(r.status, 200, 'het kantoorlogin bestaat niet meer, dus deze toets meet niets: ' +
      JSON.stringify(r).slice(0, 200));
    // res.finish loopt na het antwoord; even ademruimte voor het log
    await new Promise(r => setTimeout(r, 600));

    assert.match(log, /grote handeling/,
      'geen enkele handelingsmelding in een echte server -- de laag komt niet bij db.data ' +
      'en meet dus altijd nul:\n' + log.slice(-2000));
    assert.doesNotMatch(log, /handelingsmeting mislukt/,
      'de meting viel om in een echte server:\n' + log.slice(-2000));
  } finally {
    if (kind) kind.kill('SIGKILL');
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});

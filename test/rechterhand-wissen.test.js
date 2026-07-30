/* ============================================================================
   DE RECHTERHAND: WAT ER WEGGEGOOID WORDT.

   Dit bestand bestaat omdat de WAARGENOMEN dekkingsmeting (scripts/dekking.js)
   een patroon liet zien dat een tekstzoektocht nooit had opgeleverd. Van de 24
   endpoints van De Rechterhand die de hele suite lang nooit werden aangeroepen,
   zijn er 23 een `/weg` -- een verwijdering.

   Dat is geen toeval maar de vorm van hoe tests groeien. Je schrijft ze bij een
   nieuwe functie, en dan toets je of hij WERKT: aanmaken, teruglezen, tellen.
   Weggooien is het pad dat je zelf nooit neemt als je aan het bouwen bent. Zo
   is een hele klasse handelingen -- de onomkeerbare klasse, uitgerekend -- door
   dertien deelmodules heen ongetoetst gebleven.

   DE TWEE VRAGEN

   1. WORDT ER WEGGEGOOID WAT ER WEG MOET, EN NIET MEER DAN DAT? Een filter met
      een verkeerde vergelijking gooit alles weg, of niets. Beide zien er van
      buiten hetzelfde uit als het goed gaat: status 200.

   2. KAN LID B IETS VAN LID A WEGGOOIEN? Dit is de scherpe. Alle `weg`-functies
      werken op L(key) -- het dossier van de INGELOGDE persoon -- en filteren
      daarbinnen op id. Dat is de goede bouw, maar hij is van buiten onzichtbaar:
      een verwijdering die niets vond geeft OOK 200 ok terug. De status zegt hier
      dus niets, en de test kijkt daarom altijd naar wat er bij A overblijft.
      Zou een van deze functies ooit op de hele database gaan filteren in plaats
      van op het eigen dossier, dan valt hij hier om en nergens anders.

   Draai los: node --experimental-sqlite --test test/rechterhand-wissen.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, elevateTier } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rh-wissen-'));
let srv, base, A, B, office;

const raw = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const rh = (pad, body, token) => raw('member/rechterhand/' + pad, body, token);

/* Twee ECHTE Lifestyle-leden. Zelf registreren geeft altijd hooguit RTG -- een
   pas komt er pas na een menselijk akkoord -- dus registreren we als RTG en
   tillen op langs de enige geldige weg (helper.elevateTier, met een kantoor-
   token). Twee demo-inlogs zouden hetzelfde account zijn en dan toetst deel 2
   hieronder niets. */
let teller = 0;
async function lid(naam) {
  const u = (Date.now() + (++teller) * 7919).toString().slice(-9);
  const r = await raw('auth/register', { name: naam, email: 'rw' + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1985-06-06', tier: 'rtg' });
  assert.ok(r.body.token, 'lid ' + naam + ' geregistreerd');
  await elevateTier(base, r.body.token, 'lifestyle', office);
  const proef = await rh('cellier', {}, r.body.token);
  assert.equal(proef.status, 200, naam + ' heeft de Lifestyle Pass');
  return { token: r.body.token, naam };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-WISSEN' } });
  base = srv.base;
  office = (await raw('office/login', { code: 'KANTOOR-WISSEN' })).body.token;
  A = await lid('Lid A');
  B = await lid('Lid B');
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ============================================================================
   DEEL 1 -- weggooien doet precies een ding weg

   Elke regel: maak er TWEE aan, gooi de eerste weg, en eis dat de tweede er nog
   staat. Zonder dat tweede item toont een test alleen aan dat de lijst leeg is
   geworden, en dat is precies wat een te brede filter ook doet.
   ========================================================================== */

async function tweeEnWeg(t, { zet, lees, weg, sleutel }) {
  const merk = 'x' + Math.random().toString(36).slice(2, 8);
  await zet('Eerste-' + merk);
  await zet('Tweede-' + merk);
  const voor = await lees();
  const eerste = voor.find(x => (x[sleutel] || '').includes('Eerste-' + merk));
  const tweede = voor.find(x => (x[sleutel] || '').includes('Tweede-' + merk));
  assert.ok(eerste && tweede, t + ': beide items staan er');

  const r = await weg(eerste.id);
  assert.equal(r.status, 200, t + ': de eigenaar mag weggooien');

  const na = await lees();
  assert.equal(na.some(x => x.id === eerste.id), false, t + ': de eerste is weg');
  assert.ok(na.some(x => x.id === tweede.id), t + ': en de tweede staat er NOG -- geen te brede filter');
}

test('1. Cellier, Garde-robe en Cercle: een item weg, de rest blijft', async () => {
  await tweeEnWeg('cellier', {
    zet: n => rh('cellier/zet', { naam: n, aantal: 2 }, A.token),
    lees: async () => (await rh('cellier', {}, A.token)).body.flessen,
    weg: id => rh('cellier/weg', { id }, A.token), sleutel: 'naam'
  });
  await tweeEnWeg('garderobe/stuk', {
    zet: n => rh('garderobe/stuk', { naam: n, categorie: 'pak' }, A.token),
    lees: async () => (await rh('garderobe', {}, A.token)).body.stukken,
    weg: id => rh('garderobe/stuk/weg', { id }, A.token), sleutel: 'naam'
  });
  await tweeEnWeg('garderobe/vakman', {
    zet: n => rh('garderobe/vakman', { naam: n, vak: 'kleermaker' }, A.token),
    lees: async () => (await rh('garderobe', {}, A.token)).body.vaklui,
    weg: id => rh('garderobe/vakman/weg', { id }, A.token), sleutel: 'naam'
  });
  await tweeEnWeg('cercle/club', {
    zet: n => rh('cercle/club', { naam: n, stad: 'Wenen' }, A.token),
    lees: async () => (await rh('cercle', {}, A.token)).body.clubs,
    weg: id => rh('cercle/club/weg', { id }, A.token), sleutel: 'naam'
  });
});

test('2. Maison: staf, taak en logregel -- en een taak raakt zijn persoon netjes kwijt', async () => {
  await tweeEnWeg('maison/taak', {
    zet: n => rh('maison/taak', { wat: n, dag: '2026-09-01' }, A.token),
    lees: async () => (await rh('maison', {}, A.token)).body.taken,
    weg: id => rh('maison/taak/weg', { id }, A.token), sleutel: 'wat'
  });
  await tweeEnWeg('maison/log', {
    zet: n => rh('maison/log', { tekst: n }, A.token),
    lees: async () => (await rh('maison', {}, A.token)).body.logboek,
    weg: id => rh('maison/log/weg', { id }, A.token), sleutel: 'tekst'
  });

  /* Staf apart: wie weggaat laat taken achter. Die horen niet mee het graf in
     -- het werk bestaat nog -- maar ze mogen ook niet naar een persoon blijven
     wijzen die er niet meer is. */
  const merk = 'y' + Math.random().toString(36).slice(2, 8);
  await rh('maison/staf', { naam: 'Vertrekt-' + merk, rol: 'huishoudster' }, A.token);
  await rh('maison/staf', { naam: 'Blijft-' + merk, rol: 'chauffeur' }, A.token);
  let d = (await rh('maison', {}, A.token)).body;
  const vertrekt = d.staf.find(x => x.naam.includes('Vertrekt-' + merk));
  const blijft = d.staf.find(x => x.naam.includes('Blijft-' + merk));
  await rh('maison/taak', { wat: 'Ramen zemen ' + merk, voor: vertrekt.id, dag: '2026-09-02' }, A.token);

  assert.equal((await rh('maison/staf/weg', { id: vertrekt.id }, A.token)).status, 200);
  d = (await rh('maison', {}, A.token)).body;
  assert.equal(d.staf.some(x => x.id === vertrekt.id), false, 'de vertrekker is weg');
  assert.ok(d.staf.some(x => x.id === blijft.id), 'de ander staat er nog');
  const taak = d.taken.find(t => t.wat === 'Ramen zemen ' + merk);
  assert.ok(taak, 'de taak bestaat nog: het werk verdween niet met de persoon');
  assert.equal(taak.voor, '', 'maar hij wijst niet meer naar iemand die er niet is');
});

test('3. Nalatenschap: document, contact en wens -- de gevoeligste lijst van allemaal', async () => {
  /* Deze drie staan versleuteld op schijf (lifestyle.key). Weggooien hoort hier
     dus ook echt weggooien te zijn, en niet "verbergen in de weergave". */
  await tweeEnWeg('nalatenschap/doc', {
    zet: n => rh('nalatenschap/doc', { titel: n, soort: 'testament', waar: 'kluis' }, A.token),
    lees: async () => (await rh('nalatenschap', {}, A.token)).body.documenten,
    weg: id => rh('nalatenschap/doc/weg', { id }, A.token), sleutel: 'titel'
  });
  await tweeEnWeg('nalatenschap/contact', {
    zet: n => rh('nalatenschap/contact', { naam: n, rol: 'notaris' }, A.token),
    lees: async () => (await rh('nalatenschap', {}, A.token)).body.contacten,
    weg: id => rh('nalatenschap/contact/weg', { id }, A.token), sleutel: 'naam'
  });

  const merk = 'z' + Math.random().toString(36).slice(2, 8);
  const geheim = 'WENS-' + merk;
  await rh('nalatenschap/wens', { titel: 'Uitvaart ' + merk, tekst: geheim }, A.token);
  const wens = (await rh('nalatenschap', {}, A.token)).body.wensen.find(w => w.tekst === geheim);
  assert.ok(wens, 'de wens staat er');
  assert.equal((await rh('nalatenschap/wens/weg', { id: wens.id }, A.token)).status, 200);
  const na = (await rh('nalatenschap', {}, A.token)).body;
  assert.equal(na.wensen.some(w => w.id === wens.id), false, 'de wens is uit het dossier');
  assert.equal(JSON.stringify(na).includes(geheim), false, 'en de tekst komt nergens meer terug');
});

test('4. Logboek en Hangar: een regel weg laat het object staan, het object weg neemt zijn regels mee', async () => {
  const merk = 'l' + Math.random().toString(36).slice(2, 8);
  await rh('logboek/object', { naam: 'Riva-' + merk, soort: 'jacht' }, A.token);
  await rh('logboek/object', { naam: 'Aston-' + merk, soort: 'auto' }, A.token);
  let d = (await rh('logboek', {}, A.token)).body;
  const riva = d.objecten.find(o => o.naam === 'Riva-' + merk);
  const aston = d.objecten.find(o => o.naam === 'Aston-' + merk);
  await rh('logboek/regel', { objectId: riva.id, wat: 'Keuring ' + merk, soort: 'keuring', datum: '2026-01-01', kosten: 100 }, A.token);
  await rh('logboek/regel', { objectId: aston.id, wat: 'Beurt ' + merk, soort: 'onderhoud', datum: '2026-01-02', kosten: 200 }, A.token);

  d = (await rh('logboek', {}, A.token)).body;
  const regelRiva = d.regels.find(r => r.wat === 'Keuring ' + merk);
  assert.equal((await rh('logboek/regel/weg', { id: regelRiva.id }, A.token)).status, 200);
  d = (await rh('logboek', {}, A.token)).body;
  assert.ok(d.objecten.some(o => o.id === riva.id), 'het object blijft als de regel weggaat');
  assert.ok(d.regels.some(r => r.wat === 'Beurt ' + merk), 'de regel van het ANDERE object staat er nog');

  // en het object weggooien neemt zijn eigen regels mee, maar niet die van een ander
  assert.equal((await rh('logboek/object/weg', { id: aston.id }, A.token)).status, 200);
  d = (await rh('logboek', {}, A.token)).body;
  assert.equal(d.objecten.some(o => o.id === aston.id), false);
  assert.equal(d.regels.some(r => r.wat === 'Beurt ' + merk), false, 'de regels van het object gingen mee');
  assert.ok(d.objecten.some(o => o.id === riva.id), 'het andere object is ongemoeid gebleven');

  // Hangar: dezelfde vraag met toestellen en vluchten
  const h = 'h' + Math.random().toString(36).slice(2, 8);
  await rh('hangar/toestel', { naam: 'Falcon-' + h, type: 'jet', basis: 'Rotterdam' }, A.token);
  await rh('hangar/toestel', { naam: 'Heli-' + h, type: 'heli', basis: 'Ibiza' }, A.token);
  let hd = (await rh('hangar', {}, A.token)).body;
  const falcon = hd.toestellen.find(t => t.naam === 'Falcon-' + h);
  const heli = hd.toestellen.find(t => t.naam === 'Heli-' + h);
  await rh('hangar/vlucht', { toestelId: falcon.id, van: 'Rotterdam', naar: 'Nice', datum: '2026-06-01', uren: 2 }, A.token);
  await rh('hangar/vlucht', { toestelId: heli.id, van: 'Ibiza', naar: 'Formentera', datum: '2026-06-02', uren: 1 }, A.token);

  hd = (await rh('hangar', {}, A.token)).body;
  const vlucht = hd.vluchten.find(v => v.naar === 'Nice');
  assert.equal((await rh('hangar/vlucht/weg', { id: vlucht.id }, A.token)).status, 200);
  hd = (await rh('hangar', {}, A.token)).body;
  assert.equal(hd.vluchten.some(v => v.id === vlucht.id), false);
  assert.ok(hd.vluchten.some(v => v.naar === 'Formentera'), 'de vlucht van het andere toestel staat er nog');
  assert.equal((await rh('hangar/toestel/weg', { id: heli.id }, A.token)).status, 200);
  hd = (await rh('hangar', {}, A.token)).body;
  assert.equal(hd.toestellen.some(t => t.id === heli.id), false);
  assert.ok(hd.toestellen.some(t => t.id === falcon.id), 'het andere toestel is ongemoeid');
});

test('5. Reisboek en Table: onderdelen binnen een dossier', async () => {
  const merk = 'r' + Math.random().toString(36).slice(2, 8);
  const reis = (await rh('reis/zet', { naam: 'Ibiza-' + merk, bestemming: 'Ibiza', van: '2026-08-01', tot: '2026-08-10' }, A.token)).body.reis;
  const reis2 = (await rh('reis/zet', { naam: 'Milaan-' + merk, bestemming: 'Milaan', van: '2026-09-01', tot: '2026-09-04' }, A.token)).body.reis;
  await rh('reis/item', { reisId: reis.id, lijst: 'legs', van: 'Rotterdam', naar: 'Ibiza', datum: '2026-08-01' }, A.token);
  await rh('reis/item', { reisId: reis.id, lijst: 'legs', van: 'Ibiza', naar: 'Rotterdam', datum: '2026-08-10' }, A.token);

  let boek = (await rh('reisboek', {}, A.token)).body;
  const heen = boek.reizen.find(x => x.id === reis.id).legs.find(l => l.naar === 'Ibiza');
  assert.equal((await rh('reis/item/weg', { reisId: reis.id, lijst: 'legs', itemId: heen.id }, A.token)).status, 200);
  boek = (await rh('reisboek', {}, A.token)).body;
  const nu = boek.reizen.find(x => x.id === reis.id);
  assert.equal(nu.legs.some(l => l.id === heen.id), false, 'de heenreis is weg');
  assert.equal(nu.legs.length, 1, 'de terugreis staat er nog');
  // een onderdeel uit een lijst die niet bestaat is een nette 404, geen stille 200
  assert.equal((await rh('reis/item/weg', { reisId: reis.id, lijst: 'verzonnen', itemId: 'x' }, A.token)).status, 404);

  assert.equal((await rh('reis/weg', { id: reis.id }, A.token)).status, 200);
  boek = (await rh('reisboek', {}, A.token)).body;
  assert.equal(boek.reizen.some(x => x.id === reis.id), false, 'de reis is weg');
  assert.ok(boek.reizen.some(x => x.id === reis2.id), 'de andere reis staat er nog');

  // Table: gast bijwerken, gast weg, menugang weg, en het event zelf weg
  const ev = (await rh('table/zet', { naam: 'Diner-' + merk, datum: '2026-09-20', tijd: '19:30' }, A.token)).body.event;
  await rh('table/gast', { eventId: ev.id, naam: 'Sanne', dieet: 'geen noten', tafel: '1' }, A.token);
  await rh('table/gast', { eventId: ev.id, naam: 'Omar', dieet: 'halal', tafel: '1' }, A.token);
  await rh('table/menu', { eventId: ev.id, gang: 'voor', gerecht: 'Oesters' }, A.token);
  await rh('table/menu', { eventId: ev.id, gang: 'hoofd', gerecht: 'Zeebaars' }, A.token);

  let tafels = (await rh('table', {}, A.token)).body.events.find(x => x.id === ev.id);
  const sanne = tafels.gasten.find(g => g.naam === 'Sanne');
  const omar = tafels.gasten.find(g => g.naam === 'Omar');

  const bijwerken = await rh('table/gast/zet', { eventId: ev.id, gastId: sanne.id, tafel: '3', dieet: 'geen noten, geen schaaldieren' }, A.token);
  assert.equal(bijwerken.status, 200);
  tafels = (await rh('table', {}, A.token)).body.events.find(x => x.id === ev.id);
  assert.equal(tafels.gasten.find(g => g.id === sanne.id).tafel, '3', 'de gast is verplaatst');
  assert.equal(tafels.gasten.find(g => g.id === omar.id).dieet, 'halal', 'de andere gast is niet meeveranderd');
  // een gast die niet bestaat geeft 404, geen stille wijziging
  assert.equal((await rh('table/gast/zet', { eventId: ev.id, gastId: 'bestaat-niet', tafel: '9' }, A.token)).status, 404);

  assert.equal((await rh('table/gast/weg', { eventId: ev.id, gastId: sanne.id }, A.token)).status, 200);
  const voorGang = (await rh('table', {}, A.token)).body.events.find(x => x.id === ev.id);
  assert.equal(voorGang.gasten.some(g => g.id === sanne.id), false);
  assert.ok(voorGang.gasten.some(g => g.id === omar.id), 'de andere gast zit er nog');

  const oesters = voorGang.menu.find(m => m.gerecht === 'Oesters');
  assert.equal((await rh('table/menu/weg', { eventId: ev.id, itemId: oesters.id }, A.token)).status, 200);
  const naMenu = (await rh('table', {}, A.token)).body.events.find(x => x.id === ev.id);
  assert.equal(naMenu.menu.some(m => m.id === oesters.id), false);
  assert.equal(naMenu.menu.length, 1, 'de hoofdgang staat er nog');

  assert.equal((await rh('table/weg', { id: ev.id }, A.token)).status, 200);
  assert.equal((await rh('table', {}, A.token)).body.events.some(x => x.id === ev.id), false, 'het diner is weg');
});

test('6. Attenties en Mecenaat: giften weg, relaties weg', async () => {
  const merk = 'a' + Math.random().toString(36).slice(2, 8);
  await rh('attenties/relatie', { naam: 'Mentor-' + merk, band: 'mentor' }, A.token);
  await rh('attenties/relatie', { naam: 'Peet-' + merk, band: 'familie' }, A.token);
  let d = (await rh('attenties', {}, A.token)).body;
  const mentor = d.relaties.find(r => r.naam === 'Mentor-' + merk);
  const peet = d.relaties.find(r => r.naam === 'Peet-' + merk);
  await rh('attenties/gift', { relatieId: mentor.id, wat: 'Eerste editie ' + merk, bedrag: 1200 }, A.token);
  await rh('attenties/gift', { relatieId: peet.id, wat: 'Wijn ' + merk, bedrag: 80 }, A.token);

  d = (await rh('attenties', {}, A.token)).body;
  const gift = d.relaties.find(r => r.id === mentor.id).giften[0];
  assert.equal((await rh('attenties/gift/weg', { id: gift.id }, A.token)).status, 200);
  d = (await rh('attenties', {}, A.token)).body;
  assert.equal((d.relaties.find(r => r.id === mentor.id).giften || []).length, 0, 'de gift is weg');
  assert.equal((d.relaties.find(r => r.id === peet.id).giften || []).length, 1, 'de gift bij de ander staat er nog');

  assert.equal((await rh('attenties/relatie/weg', { id: mentor.id }, A.token)).status, 200);
  d = (await rh('attenties', {}, A.token)).body;
  assert.equal(d.relaties.some(r => r.id === mentor.id), false);
  assert.ok(d.relaties.some(r => r.id === peet.id), 'de andere relatie staat er nog');

  await tweeEnWeg('mecenaat/gift', {
    zet: n => rh('mecenaat/gift', { doel: n, thema: 'onderwijs', bedrag: 500 }, A.token),
    lees: async () => (await rh('mecenaat', {}, A.token)).body.giften,
    weg: id => rh('mecenaat/gift/weg', { id }, A.token), sleutel: 'doel'
  });
});

test('7. Entourage: een persoon weg', async () => {
  await tweeEnWeg('entourage/persoon', {
    zet: n => rh('entourage/persoon', { naam: n, band: 'vriend' }, A.token),
    lees: async () => (await rh('entourage', {}, A.token)).body.gezelschap,
    weg: id => rh('entourage/persoon/weg', { id }, A.token), sleutel: 'naam'
  });
});

/* ============================================================================
   DEEL 2 -- DE GRENS: lid B gooit niets van lid A weg

   Hier zegt de STATUS niets. Elke weg-functie filtert binnen het eigen dossier,
   dus een verwijdering die niets vond geeft net zo goed 200 ok terug als een
   die wel iets vond. Van buiten is dat identiek. De enige eerlijke toets is
   daarom: laat B alles proberen, en kijk daarna bij A of er iets ontbreekt.
   ========================================================================== */

test('8. lid B probeert alle 23 verwijderingen op de gegevens van lid A -- er verdwijnt niets', async () => {
  const merk = 'grens' + Math.random().toString(36).slice(2, 8);

  // A bouwt van elke soort precies een ding op
  await rh('cellier/zet', { naam: 'Margaux-' + merk, aantal: 3 }, A.token);
  await rh('garderobe/stuk', { naam: 'Smoking-' + merk, categorie: 'pak' }, A.token);
  await rh('garderobe/vakman', { naam: 'Atelier-' + merk, vak: 'kleermaker' }, A.token);
  await rh('cercle/club', { naam: 'Annabel-' + merk, stad: 'Londen' }, A.token);
  await rh('entourage/persoon', { naam: 'Sofia-' + merk, band: 'partner' }, A.token);
  await rh('maison/staf', { naam: 'Maria-' + merk, rol: 'huishoudster' }, A.token);
  await rh('maison/taak', { wat: 'Zilver-' + merk, dag: '2026-08-01' }, A.token);
  await rh('maison/log', { tekst: 'Loodgieter-' + merk }, A.token);
  await rh('nalatenschap/doc', { titel: 'Testament-' + merk, soort: 'testament', waar: 'kluis' }, A.token);
  await rh('nalatenschap/contact', { naam: 'Notaris-' + merk, rol: 'notaris' }, A.token);
  await rh('nalatenschap/wens', { titel: 'Uitvaart-' + merk, tekst: 'In stilte' }, A.token);
  await rh('mecenaat/gift', { doel: 'School-' + merk, thema: 'onderwijs', bedrag: 500 }, A.token);
  await rh('logboek/object', { naam: 'Riva-' + merk, soort: 'jacht' }, A.token);
  await rh('hangar/toestel', { naam: 'Falcon-' + merk, type: 'jet', basis: 'Rotterdam' }, A.token);
  await rh('attenties/relatie', { naam: 'Mentor-' + merk, band: 'mentor' }, A.token);
  const reis = (await rh('reis/zet', { naam: 'Reis-' + merk, bestemming: 'Ibiza', van: '2026-08-01', tot: '2026-08-05' }, A.token)).body.reis;
  await rh('reis/item', { reisId: reis.id, lijst: 'legs', van: 'RTM', naar: 'IBZ', datum: '2026-08-01' }, A.token);
  const ev = (await rh('table/zet', { naam: 'Diner-' + merk, datum: '2026-09-20', tijd: '19:30' }, A.token)).body.event;
  await rh('table/gast', { eventId: ev.id, naam: 'Gast-' + merk }, A.token);
  await rh('table/menu', { eventId: ev.id, gang: 'voor', gerecht: 'Oesters-' + merk }, A.token);

  // de ids ophalen die B straks probeert
  const cel = (await rh('cellier', {}, A.token)).body.flessen[0];
  const gard = (await rh('garderobe', {}, A.token)).body;
  const cer = (await rh('cercle', {}, A.token)).body.clubs[0];
  const ent = (await rh('entourage', {}, A.token)).body.gezelschap[0];
  const mai = (await rh('maison', {}, A.token)).body;
  const nal = (await rh('nalatenschap', {}, A.token)).body;
  const mec = (await rh('mecenaat', {}, A.token)).body.giften[0];
  const lb = (await rh('logboek', {}, A.token)).body;
  await rh('logboek/regel', { objectId: lb.objecten[0].id, wat: 'Keuring-' + merk, soort: 'keuring', datum: '2026-01-01' }, A.token);
  const lb2 = (await rh('logboek', {}, A.token)).body;
  const hg = (await rh('hangar', {}, A.token)).body;
  await rh('hangar/vlucht', { toestelId: hg.toestellen[0].id, van: 'RTM', naar: 'NCE', datum: '2026-06-01', uren: 2 }, A.token);
  const hg2 = (await rh('hangar', {}, A.token)).body;
  const att = (await rh('attenties', {}, A.token)).body.relaties[0];
  await rh('attenties/gift', { relatieId: att.id, wat: 'Boek-' + merk, bedrag: 90 }, A.token);
  const att2 = (await rh('attenties', {}, A.token)).body.relaties[0];
  const boek = (await rh('reisboek', {}, A.token)).body.reizen.find(x => x.id === reis.id);
  const tafel = (await rh('table', {}, A.token)).body.events.find(x => x.id === ev.id);

  /* Alle 23 verwijderingen, uitgevoerd door B met de ids van A. De status is
     hier bewust GEEN assertie: 200 betekent "er is binnen jouw eigen dossier
     gefilterd", en dat is precies het gedrag dat we willen. */
  const pogingen = [
    ['cellier/weg', { id: cel.id }],
    ['garderobe/stuk/weg', { id: gard.stukken[0].id }],
    ['garderobe/vakman/weg', { id: gard.vaklui[0].id }],
    ['cercle/club/weg', { id: cer.id }],
    ['entourage/persoon/weg', { id: ent.id }],
    ['maison/staf/weg', { id: mai.staf[0].id }],
    ['maison/taak/weg', { id: mai.taken[0].id }],
    ['maison/log/weg', { id: mai.logboek[0].id }],
    ['nalatenschap/doc/weg', { id: nal.documenten[0].id }],
    ['nalatenschap/contact/weg', { id: nal.contacten[0].id }],
    ['nalatenschap/wens/weg', { id: nal.wensen[0].id }],
    ['mecenaat/gift/weg', { id: mec.id }],
    ['logboek/object/weg', { id: lb2.objecten[0].id }],
    ['logboek/regel/weg', { id: lb2.regels[0].id }],
    ['hangar/toestel/weg', { id: hg2.toestellen[0].id }],
    ['hangar/vlucht/weg', { id: hg2.vluchten[0].id }],
    ['attenties/relatie/weg', { id: att2.id }],
    ['attenties/gift/weg', { id: att2.giften[0].id }],
    ['reis/weg', { id: reis.id }],
    ['reis/item/weg', { reisId: reis.id, lijst: 'legs', itemId: boek.legs[0].id }],
    ['table/weg', { id: ev.id }],
    ['table/gast/weg', { eventId: ev.id, gastId: tafel.gasten[0].id }],
    ['table/menu/weg', { eventId: ev.id, itemId: tafel.menu[0].id }]
  ];
  assert.equal(pogingen.length, 23, 'alle 23 verwijderingen worden geprobeerd');
  for (const [pad, body] of pogingen) {
    const r = await rh(pad, body, B.token);
    assert.notEqual(r.status, 500, pad + ' hoort niet om te vallen op een vreemd id');
  }

  // B mag ook geen gast van A verplaatsen (de enige zet-route in deze lijst)
  await rh('table/gast/zet', { eventId: ev.id, gastId: tafel.gasten[0].id, tafel: '99' }, B.token);

  /* En nu de enige toets die telt: bij A staat alles er nog, en niets is
     veranderd. Zou een van de 23 op de hele database filteren in plaats van op
     het eigen dossier, dan mist hier precies dat ene ding. */
  const alles = JSON.stringify({
    cellier: (await rh('cellier', {}, A.token)).body,
    garderobe: (await rh('garderobe', {}, A.token)).body,
    cercle: (await rh('cercle', {}, A.token)).body,
    entourage: (await rh('entourage', {}, A.token)).body,
    maison: (await rh('maison', {}, A.token)).body,
    nalatenschap: (await rh('nalatenschap', {}, A.token)).body,
    mecenaat: (await rh('mecenaat', {}, A.token)).body,
    logboek: (await rh('logboek', {}, A.token)).body,
    hangar: (await rh('hangar', {}, A.token)).body,
    attenties: (await rh('attenties', {}, A.token)).body,
    reisboek: (await rh('reisboek', {}, A.token)).body,
    table: (await rh('table', {}, A.token)).body
  });
  for (const naam of ['Margaux', 'Smoking', 'Atelier', 'Annabel', 'Sofia', 'Maria', 'Zilver', 'Loodgieter',
    'Testament', 'Notaris', 'Uitvaart', 'School', 'Riva', 'Falcon', 'Mentor', 'Boek', 'Keuring',
    'Reis', 'Diner', 'Gast', 'Oesters'])
    assert.ok(alles.includes(naam + '-' + merk), naam + ' van lid A hoort er nog te staan');

  const tafelNa = (await rh('table', {}, A.token)).body.events.find(x => x.id === ev.id);
  assert.notEqual(tafelNa.gasten[0].tafel, '99', 'B heeft de gast van A ook niet verplaatst');
  assert.equal((await rh('reisboek', {}, A.token)).body.reizen.find(x => x.id === reis.id).legs.length, 1,
    'en het onderdeel binnen de reis van A staat er nog');
});

test('9. het dossier van B is en blijft leeg van A', async () => {
  /* De spiegelkant: B heeft niets aangemaakt in deze reeks, dus zijn dossier
     hoort leeg te zijn. Stond er iets van A in, dan lekte de lees-kant. */
  const vanB = JSON.stringify({
    cellier: (await rh('cellier', {}, B.token)).body,
    maison: (await rh('maison', {}, B.token)).body,
    nalatenschap: (await rh('nalatenschap', {}, B.token)).body,
    table: (await rh('table', {}, B.token)).body,
    reisboek: (await rh('reisboek', {}, B.token)).body
  });
  assert.equal(/Margaux|Testament|Notaris|Maria|Diner-/.test(vanB), false,
    'niets van lid A is in het dossier van lid B te zien');
});

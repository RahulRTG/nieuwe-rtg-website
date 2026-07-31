/* ============================================================================
   HET BEHEER VAN EEN GENOOTSCHAP -- 3 endpoints.

   Deze drie wees de waargenomen dekkingsmeting aan als nooit aangeroepen:
   pas-aan, eruit en reactie-weg. De rest van de familie was wel beproefd
   (test/genootschap.test.js legt vast dat geheim echt geheim is en dat een
   uitnodiging geen lidmaatschap is); dit zijn precies de drie waar iemand
   MACHT uitoefent over een ander.

   WAT ER OP HET SPEL STAAT

   - ERUIT ZETTEN IS VAN HET BESTUUR, EN NOOIT VAN JEZELF. Een gewoon lid dat
     een ander kan verwijderen maakt van een genootschap een kaapbare groep.
     En jezelf eruit zetten is geen beheerdaad maar vertrekken -- dat heeft
     zijn eigen knop, want de laatste beheerder mag niet zomaar weglopen.
   - EEN REACTIE WIS JE ALS HIJ VAN JOU IS, OF ALS JIJ HET BESTUUR BENT. Wie
     andermans reactie kan wissen, kan een gesprek herschrijven waar de ander
     bij staat.
   - AANPASSEN IS BESTUURSWERK, EN EEN GENOOTSCHAP HOUDT ZIJN NAAM. Een lege
     naam is geen naam.

   WAT IK HIER NIET ZELF BESLIS: pasAan laat een beheerder de soort wijzigen,
   ook van 'geheim' naar 'openbaar'. Dat maakt een genootschap dat voor
   niemand zichtbaar was in een klap vindbaar. Dat kan een bewuste keuze zijn
   (een bestuur mag zijn eigen club openen), maar het kan ook eenrichtings-
   verkeer horen te zijn. De toets legt hieronder alleen vast WAT het nu doet,
   met een naam die dat eerlijk zegt -- veranderen is een besluit voor RTG.

   Draai los: node --experimental-sqlite --test test/genootschap-beheer.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, baas, lid, buiten;
let groep = null, prikId = null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-genbeheer-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + '/api' + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let n = 0;
async function nieuwLid(naam) {
  const u = Date.now().toString(36) + (n++) + Math.random().toString(36).slice(2, 6);
  const r = await api('/auth/register', { name: naam, email: u + '@voorbeeld.test',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'genootgeheim1', geboortedatum: '1988-08-08', tier: 'rtg', pasApp: 'rtg' });
  assert.equal(r.status, 200, 'registreren: ' + JSON.stringify(r.body));
  const p = await api('/metier/ik', {}, r.body.token);
  return { token: r.body.token, codenaam: p.body.profiel.codenaam };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '0' } });
  base = srv.base;
  baas = await nieuwLid('De Voorzitter');
  lid = await nieuwLid('Gewoon Lid');
  buiten = await nieuwLid('Buitenstaander');

  const g = await api('/genootschap/richt-op', { naam: 'Het Leesgezelschap', soort: 'besloten',
    over: 'Wij lezen, en daarna praten wij erover.' }, baas.token);
  assert.ok(g.body.ok, JSON.stringify(g.body));
  groep = g.body.groep.id;
  assert.ok((await api('/genootschap/nodig-uit', { groep, wie: lid.codenaam }, baas.token)).body.ok);
  assert.ok((await api('/genootschap/binnen', { groep }, lid.token)).body.ok, 'het lid is binnen');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. aanpassen is bestuurswerk, en een naam kan niet leeg', async () => {
  assert.ok((await api('/genootschap/pas-aan', { groep, naam: 'Gekaapt' }, lid.token)).body.error,
    'een gewoon lid past het genootschap niet aan');
  assert.ok((await api('/genootschap/pas-aan', { groep, naam: 'Gekaapt' }, buiten.token)).body.error,
    'iemand van buiten al helemaal niet');
  assert.ok((await api('/genootschap/pas-aan', { groep: 'bestaatniet', naam: 'X' }, baas.token)).body.error);

  const leeg = await api('/genootschap/pas-aan', { groep, naam: '   ' }, baas.token);
  assert.ok(leeg.body.error, 'een genootschap zonder naam kan niet');

  const ok = await api('/genootschap/pas-aan', { groep, naam: 'Het Grote Leesgezelschap',
    over: 'Wij lezen alles.', regels: 'Wie niet uitleest, trakteert.' }, baas.token);
  assert.ok(ok.body.ok, JSON.stringify(ok.body));
  assert.equal(ok.body.groep.naam, 'Het Grote Leesgezelschap');

  /* Wat niet wordt meegestuurd blijft staan. Zou een ontbrekend veld leeg
     worden, dan wist een scherm dat alleen de naam bewerkt stilletjes de
     regels van het huis. */
  const naam2 = await api('/genootschap/pas-aan', { groep, naam: 'Het Leesgezelschap' }, baas.token);
  assert.equal(naam2.body.groep.over, 'Wij lezen alles.', 'de omschrijving staat er nog');
});

test('2. de soort is te wijzigen door het bestuur -- ook van geheim naar openbaar', async () => {
  /* Dit legt vast wat het systeem NU doet, niet wat het zou moeten doen. Zie
     de kop van dit bestand: of het openen van een geheim genootschap een
     bestuursrecht is of eenrichtingsverkeer hoort te zijn, is een besluit
     voor RTG en niet iets wat een toets stilletjes vastzet. */
  const gh = await api('/genootschap/richt-op', { naam: 'De Stille Kamer', soort: 'geheim' }, baas.token);
  const id = gh.body.groep.id;
  assert.ok(!(await api('/genootschap/zoek', { zoek: 'stille' }, buiten.token)).body.groepen.some(g => g.id === id),
    'geheim staat in geen enkele lijst');

  assert.ok((await api('/genootschap/pas-aan', { groep: id, soort: 'onzin' }, baas.token)).body.ok,
    'een soort die we niet kennen wordt genegeerd, niet overgenomen');
  const na = await api('/genootschap/zoek', { zoek: 'stille' }, buiten.token);
  assert.ok(!na.body.groepen.some(g => g.id === id), 'en dus is hij nog steeds geheim');

  /* EN OPENZETTEN KAN NIET. Dit was tot deze ronde wel zo, en dat is een
     stille verschuiving van de ergste soort: wie zich bij een GEHEIM
     genootschap aansluit doet dat onder die beslotenheid, en met een klik van
     het bestuur stond hij in een lijst die iedereen kan doorzoeken -- zonder
     dat hem iets gevraagd was en zonder dat hij het merkte.

     De zichtbaarheid kan sindsdien alleen DICHTER. Beslotener mag altijd; dat
     neemt niemand iets af. Wil een bestuur echt naar buiten, dan richten ze een
     openbaar genootschap op en nodigen ze hun leden uit -- dan zegt ieder zelf
     ja. */
  const open = await api('/genootschap/pas-aan', { groep: id, soort: 'openbaar' }, baas.token);
  assert.ok(!open.body.ok, 'een geheim genootschap gaat niet open');
  assert.match(open.body.error || '', /beslotener|opener/i, 'en zegt waarom: ' + JSON.stringify(open.body));
  assert.ok(!(await api('/genootschap/zoek', { zoek: 'stille' }, buiten.token)).body.groepen.some(g => g.id === id),
    'hij staat dus nog steeds in geen enkele lijst');

  /* De andere kant op mag wel. Een openbaar genootschap dat besloten wordt,
     sluit een deur -- daar wordt niemand zichtbaar van. */
  const opb = await api('/genootschap/richt-op', { naam: 'Het Open Portaal', soort: 'openbaar' }, baas.token);
  const oid = opb.body.groep.id;
  assert.ok((await api('/genootschap/zoek', { zoek: 'portaal' }, buiten.token)).body.groepen.some(g => g.id === oid),
    'openbaar is vindbaar');
  assert.ok((await api('/genootschap/pas-aan', { groep: oid, soort: 'geheim' }, baas.token)).body.ok,
    'en mag geheim worden');
  assert.ok(!(await api('/genootschap/zoek', { zoek: 'portaal' }, buiten.token)).body.groepen.some(g => g.id === oid),
    'daarna is hij weg uit de lijst');
});

test('3. een reactie wis je als hij van jou is, of als jij het bestuur bent', async () => {
  const p = await api('/genootschap/prik', { groep, tekst: 'Welk boek doen we volgende maand?' }, baas.token);
  assert.ok(p.body.ok, JSON.stringify(p.body));
  prikId = (await api('/genootschap/prikbord', { groep }, baas.token)).body.berichten[0].id;

  assert.ok((await api('/genootschap/reageer', { groep, id: prikId, tekst: 'Ik stem voor iets kort.' }, lid.token)).body.ok);
  assert.ok((await api('/genootschap/reageer', { groep, id: prikId, tekst: 'En ik voor iets dik.' }, baas.token)).body.ok);
  const bord = (await api('/genootschap/prikbord', { groep }, baas.token)).body.berichten[0];
  assert.equal(bord.reacties.length, 2);
  const vanLid = bord.reacties.find(r => /kort/.test(r.tekst));
  const vanBaas = bord.reacties.find(r => /dik/.test(r.tekst));

  assert.ok((await api('/genootschap/reactie-weg', { groep, id: prikId, reactieId: vanBaas.id }, lid.token)).body.error,
    'een gewoon lid wist de reactie van een ander niet: dat is een gesprek herschrijven waar de ander bij staat');
  assert.ok((await api('/genootschap/reactie-weg', { groep, id: prikId, reactieId: vanLid.id }, buiten.token)).body.error,
    'iemand van buiten komt er niet eens bij');
  assert.ok((await api('/genootschap/reactie-weg', { groep, id: prikId, reactieId: 99999 }, baas.token)).body.error,
    'een reactie die niet bestaat');
  assert.ok((await api('/genootschap/reactie-weg', { groep, id: 'bestaatniet', reactieId: vanLid.id }, baas.token)).body.error);

  // je eigen reactie mag altijd weg
  assert.ok((await api('/genootschap/reactie-weg', { groep, id: prikId, reactieId: vanLid.id }, lid.token)).body.ok);
  // en het bestuur mag die van een ander wel: dat is moderatie, niet kaping
  assert.ok((await api('/genootschap/reactie-weg', { groep, id: prikId, reactieId: vanBaas.id }, baas.token)).body.ok);
  assert.equal((await api('/genootschap/prikbord', { groep }, baas.token)).body.berichten[0].reacties.length, 0);
});

test('4. eruit zetten is van het bestuur, en nooit van jezelf', async () => {
  assert.ok((await api('/genootschap/eruit', { groep, wie: baas.codenaam }, lid.token)).body.error,
    'een gewoon lid zet de voorzitter er niet uit');
  assert.ok((await api('/genootschap/eruit', { groep, wie: lid.codenaam }, buiten.token)).body.error);
  assert.ok((await api('/genootschap/eruit', { groep, wie: buiten.codenaam }, baas.token)).body.error,
    'iemand die er niet in zit kun je er niet uit zetten');
  assert.ok((await api('/genootschap/eruit', { groep, wie: 'BestaatNiet' }, baas.token)).body.error);

  /* Jezelf eruit zetten gaat langs vertrek(), en dat is geen woordspel: daar
     zit de regel dat de laatste beheerder niet zomaar weg kan lopen. Zou het
     hier ook mogen, dan is die regel met een omweg te omzeilen en blijft er
     een genootschap achter dat niemand meer kan besturen. */
  const zelf = await api('/genootschap/eruit', { groep, wie: baas.codenaam }, baas.token);
  assert.ok(zelf.body.error, 'de voorzitter zet zichzelf er niet uit');
  assert.match(zelf.body.error, /vertrekken/i, 'en wordt naar de goede knop gestuurd: ' + zelf.body.error);

  const weg = await api('/genootschap/eruit', { groep, wie: lid.codenaam }, baas.token);
  assert.ok(weg.body.ok, JSON.stringify(weg.body));
  assert.ok(!(await api('/genootschap/mijn', {}, lid.token)).body.groepen.some(g => g.id === groep),
    'het lid staat niet meer op zijn eigen lijst');
  assert.ok((await api('/genootschap/prikbord', { groep }, lid.token)).body.error,
    'en komt niet meer op het prikbord');
});

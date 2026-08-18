/* Integratietests voor de extra premium ROS-apps van de Lifestyle Pass:
   Reisboek (reisdossier + documenten-attentie), Cellier (wijnkelder + drinkvenster),
   Table (diners: gasten + menu) en Maison (staf + taken). Gated op de Lifestyle Pass.
   Draai los: node --test test/rechterhand.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, elevateTier } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rechterhand-'));
let child;

const raw = (pad, body, token) => fetch(BASE + '/api' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
});
const json = r => r.json();
const rh = (pad, body, token) => raw('/member/rechterhand/' + pad, body, token);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

let teller = 0;
const officeTok = async () => (await json(await raw('/office/login', { code: 'RTG-OFFICE' }))).token;
async function lidMet(tier) {
  const t = Date.now() + '' + (teller++);
  // zelf-registreren geeft altijd RTG; een echt Lifestyle/Business-lid ontstaat
  // pas na een menselijk akkoord, dus registreren we als RTG en tillen op.
  const regTier = (tier === 'lifestyle' || tier === 'business') ? 'rtg' : tier;
  const r = await json(await raw('/auth/register', { name: 'Lid ' + t, email: 'l' + t + '@v.test', phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1980-05-05', tier: regTier }));
  if (tier === 'lifestyle' || tier === 'business') await elevateTier(BASE, r.token, tier, await officeTok());
  return r.token;
}
const gisteren = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

test('Reisboek: een reis met legs, verblijf en een verlopen document dat opvalt', async () => {
  const tok = await lidMet('lifestyle');
  const r = await json(await rh('reis/zet', { naam: 'Ibiza zomer', bestemming: 'Ibiza', van: '2026-08-01', tot: '2026-08-10' }, tok));
  assert.ok(r.ok && r.reis.id);
  const id = r.reis.id;
  assert.equal((await rh('reis/item', { reisId: id, lijst: 'legs', van: 'Rotterdam', naar: 'Ibiza', vervoer: 'privéjet', datum: '2026-08-01' }, tok)).status, 200);
  assert.equal((await rh('reis/item', { reisId: id, lijst: 'verblijven', naam: 'Villa', plaats: 'Ibiza', in: '2026-08-01', uit: '2026-08-10' }, tok)).status, 200);
  // een paspoort dat al verlopen is -> attentiepunt
  assert.equal((await rh('reis/item', { reisId: id, lijst: 'documenten', soort: 'Paspoort', houder: 'De heer', geldigTot: gisteren() }, tok)).status, 200);
  // een leeg onderdeel wordt geweigerd
  assert.equal((await rh('reis/item', { reisId: id, lijst: 'legs', van: '' }, tok)).status, 400);
  const d = await json(await rh('reisboek', {}, tok));
  const reis = d.reizen.find(x => x.id === id);
  assert.equal(reis.legs.length, 1);
  assert.equal(reis.verblijven.length, 1);
  assert.ok(d.attenties.some(a => a.soort === 'Paspoort' && a.verlopen), 'het verlopen paspoort valt op');
});

test('Cellier: flessen met drinkvenster, kelderwaarde en een fles schenken', async () => {
  const tok = await lidMet('lifestyle');
  const j = new Date().getFullYear();
  await rh('cellier/zet', { naam: 'Margaux', domein: 'Ch. Margaux', kleur: 'rood', jaargang: j - 10, aantal: 6, waarde: 800, drinkVan: j - 2, drinkTot: j + 5 }, tok);
  const f2 = await json(await rh('cellier/zet', { naam: 'Champagne', kleur: 'mousserend', aantal: 12, waarde: 120, drinkVan: j + 3, drinkTot: j + 8 }, tok));
  assert.ok(f2.ok);
  const d = await json(await rh('cellier', {}, tok));
  assert.equal(d.totaalFlessen, 18);
  assert.equal(d.kelderwaarde, 6 * 800 + 12 * 120);
  const margaux = d.flessen.find(x => x.naam === 'Margaux');
  assert.equal(margaux.staat, 'op dronk');
  assert.equal(d.flessen.find(x => x.naam === 'Champagne').staat, 'laten liggen');
  assert.ok(d.opDronk >= 1);
  // een fles schenken telt af
  assert.equal((await json(await rh('cellier/schenk', { id: margaux.id }, tok))).aantal, 5);
});

test('Table: een diner met gastenlijst (dieet) en een menu per gang', async () => {
  const tok = await lidMet('lifestyle');
  const e = await json(await rh('table/zet', { naam: 'Verjaardag', datum: '2026-09-20', tijd: '19:30', locatie: 'Thuis' }, tok));
  const id = e.event.id;
  assert.equal((await rh('table/gast', { eventId: id, naam: 'Sanne', dieet: 'geen noten', tafel: '1' }, tok)).status, 200);
  assert.equal((await rh('table/gast', { eventId: id, naam: 'Omar', dieet: 'halal', tafel: '1' }, tok)).status, 200);
  assert.equal((await rh('table/menu', { eventId: id, gang: 'voor', gerecht: 'Oesters', wijn: 'Chablis' }, tok)).status, 200);
  const d = await json(await rh('table', {}, tok));
  const ev = d.events.find(x => x.id === id);
  assert.equal(ev.gastenAantal, 2);
  assert.equal(ev.menu.length, 1);
  assert.ok(ev.gasten.some(g => g.dieet === 'halal'));
});

test('Maison: staf, een taak toewijzen en afvinken, en een logboek', async () => {
  const tok = await lidMet('lifestyle');
  await rh('maison/staf', { naam: 'Maria', rol: 'huishoudster', telefoon: '0612' }, tok);
  let d = await json(await rh('maison', {}, tok));
  const mariaId = d.staf[0].id;
  await rh('maison/taak', { wat: 'Zilver poetsen', voor: mariaId, dag: '2026-08-01' }, tok);
  d = await json(await rh('maison', {}, tok));
  assert.equal(d.openTaken, 1);
  const taak = d.taken[0];
  assert.equal(taak.voorNaam, 'Maria');
  assert.equal((await rh('maison/taak/klaar', { id: taak.id, klaar: true }, tok)).status, 200);
  assert.equal((await json(await rh('maison', {}, tok))).openTaken, 0);
  await rh('maison/log', { tekst: 'Loodgieter komt woensdag' }, tok);
  assert.ok((await json(await rh('maison', {}, tok))).logboek.some(l => /Loodgieter/.test(l.tekst)));
});

test('Rahul adviseert per app in de u-vorm (demo-antwoord zonder sleutel)', async () => {
  const tok = await lidMet('lifestyle');
  await rh('cellier/zet', { naam: 'Barolo', aantal: 3, waarde: 90 }, tok);
  const r = await json(await rh('ai', { app: 'cellier', vraag: 'Welke fles schenk ik vanavond?' }, tok));
  assert.ok(r.ok && r.antwoord && r.antwoord.length > 10);
  assert.match(r.antwoord, /\bu\b|uw/i, 'de sommelier spreekt u aan met u');
  // een onbekende app wordt geweigerd
  assert.equal((await rh('ai', { app: 'onzin', vraag: 'hoi' }, tok)).status, 400);
});

test('Garde-robe: een stuk en een vakman, geteld per categorie', async () => {
  const tok = await lidMet('lifestyle');
  assert.equal((await rh('garderobe/stuk', { naam: 'Smoking', categorie: 'pak', merk: 'op maat', kleur: 'zwart', maat: '50', waar: 'Villa Ibiza' }, tok)).status, 200);
  assert.equal((await rh('garderobe/stuk', { naam: 'Instappers', categorie: 'schoenen' }, tok)).status, 200);
  // een leeg stuk wordt geweigerd
  assert.equal((await rh('garderobe/stuk', { naam: '' }, tok)).status, 400);
  assert.equal((await rh('garderobe/vakman', { naam: 'Atelier X', vak: 'kleermaker', plaats: 'Milaan' }, tok)).status, 200);
  const d = await json(await rh('garderobe', {}, tok));
  assert.equal(d.aantal, 2);
  assert.equal(d.perCategorie.pak, 1);
  assert.equal(d.vaklui.length, 1);
});

test('Mecenaat: giften, betaald vs toegezegd en het deel via de RTFoundation', async () => {
  const tok = await lidMet('lifestyle');
  await rh('mecenaat/gift', { doel: 'Schoolproject', thema: 'onderwijs', bedrag: 50000, betaald: true, foundation: true }, tok);
  const open = await json(await rh('mecenaat/gift', { doel: 'Natuurfonds', thema: 'natuur', bedrag: 20000, betaald: false }, tok));
  assert.ok(open.ok);
  let d = await json(await rh('mecenaat', {}, tok));
  assert.equal(d.betaald, 50000);
  assert.equal(d.toegezegd, 20000);
  assert.equal(d.viaFoundation, 50000);
  // de toezegging alsnog markeren als betaald
  assert.equal((await rh('mecenaat/betaald', { id: open.gift.id, betaald: true }, tok)).status, 200);
  d = await json(await rh('mecenaat', {}, tok));
  assert.equal(d.betaald, 70000);
  assert.equal(d.toegezegd, 0);
});

test('Nalatenschap: documenten/contacten/wensen, ontsleuteld terug en versleuteld op schijf', async () => {
  const tok = await lidMet('lifestyle');
  const marker = 'KLUISPLEK-' + Math.random().toString(36).slice(2);
  assert.equal((await rh('nalatenschap/doc', { titel: 'Testament', soort: 'testament', waar: marker }, tok)).status, 200);
  assert.equal((await rh('nalatenschap/contact', { naam: 'Mr. De Vries', rol: 'notaris', telefoon: '0612345678' }, tok)).status, 200);
  assert.equal((await rh('nalatenschap/wens', { titel: 'Uitvaart', tekst: 'In stilte' }, tok)).status, 200);
  const d = await json(await rh('nalatenschap', {}, tok));
  assert.equal(d.documenten[0].waar, marker, 'de plek komt ontsleuteld terug');
  assert.equal(d.contacten[0].telefoon, '0612345678');
  assert.equal(d.wensen[0].tekst, 'In stilte');
  // de gevoelige plek staat NERGENS als platte tekst op schijf
  let opSchijf = false;
  const scan = dir => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const st = fs.statSync(p); if (st.isDirectory()) scan(p); else if (fs.readFileSync(p).includes(marker)) opSchijf = true; } };
  scan(TMP);
  assert.equal(opSchijf, false, 'de plek mag niet leesbaar op schijf staan');
});

test('Logboek: object met een regel die verlopen is en opvalt', async () => {
  const tok = await lidMet('lifestyle');
  const o = await json(await rh('logboek/object', { naam: 'Riva', soort: 'jacht', merk: 'Riva', bouwjaar: 2018 }, tok));
  assert.ok(o.ok);
  let d = await json(await rh('logboek', {}, tok));
  const obj = d.objecten.find(x => x.naam === 'Riva');
  // een keuring die alweer had gemoeten -> attentiepunt
  assert.equal((await rh('logboek/regel', { objectId: obj.id, wat: 'Grote keuring', soort: 'keuring', datum: '2025-01-01', volgende: gisteren(), kosten: 4500 }, tok)).status, 200);
  // een regel zonder object wordt geweigerd
  assert.equal((await rh('logboek/regel', { objectId: 'bestaatniet', wat: 'iets' }, tok)).status, 404);
  d = await json(await rh('logboek', {}, tok));
  assert.equal(d.totaalKosten, 4500);
  assert.ok(d.attenties.some(a => a.object === 'Riva' && a.verlopen), 'de verlopen keuring valt op');
});

test('Cercle: clubs geteld per stad en gastpassen opgeteld', async () => {
  const tok = await lidMet('lifestyle');
  await rh('cercle/club', { naam: 'Annabel', stad: 'Londen', lidnummer: 'A-12', sinds: 2015, gastpassen: 4, reciprociteit: 'diverse clubs' }, tok);
  await rh('cercle/club', { naam: 'Le Cercle', stad: 'Parijs', gastpassen: 2 }, tok);
  await rh('cercle/club', { naam: 'The Club', stad: 'Londen', gastpassen: 0 }, tok);
  const d = await json(await rh('cercle', {}, tok));
  assert.equal(d.aantal, 3);
  assert.equal(d.steden, 2);
  assert.equal(d.gastpassen, 6);
});

test('Hangar: een toestel met een gelogde vlucht, positie volgt de aankomst', async () => {
  const tok = await lidMet('lifestyle');
  await rh('hangar/toestel', { naam: 'Falcon', type: 'jet', registratie: 'PH-RTG', basis: 'Rotterdam', stoelen: 12 }, tok);
  let d = await json(await rh('hangar', {}, tok));
  const t = d.toestellen[0];
  assert.equal(t.positie, 'Rotterdam', 'zonder vluchten staat het op de thuishaven');
  assert.equal((await rh('hangar/vlucht', { toestelId: t.id, van: 'Rotterdam', naar: 'Ibiza', datum: gisteren(), uren: 2.5 }, tok)).status, 200);
  // een vlucht zonder toestel wordt geweigerd
  assert.equal((await rh('hangar/vlucht', { toestelId: 'x', van: 'A' }, tok)).status, 404);
  d = await json(await rh('hangar', {}, tok));
  assert.equal(d.toestellen[0].positie, 'Ibiza', 'de positie volgt de laatste aankomst');
  assert.equal(d.totaalUren, 2.5);
});

test('Entourage: reisgezelschap met een paspoort dat opvalt', async () => {
  const tok = await lidMet('lifestyle');
  await rh('entourage/persoon', { naam: 'Sofia', band: 'partner', dieet: 'vegetarisch', paspoortTot: gisteren() }, tok);
  await rh('entourage/persoon', { naam: 'Karim', band: 'vriend' }, tok);
  const d = await json(await rh('entourage', {}, tok));
  assert.equal(d.aantal, 2);
  assert.ok(d.attenties.some(a => a.naam === 'Sofia' && a.verlopen), 'het verlopen paspoort valt op');
});

test('Attenties: relatie met een naderende verjaardag en giftgeschiedenis', async () => {
  const tok = await lidMet('lifestyle');
  const morgen = new Date(Date.now() + 86400000);
  const mmdd = String(morgen.getMonth() + 1).padStart(2, '0') + '-' + String(morgen.getDate()).padStart(2, '0');
  await rh('attenties/relatie', { naam: 'Mentor', band: 'mentor', verjaardag: mmdd }, tok);
  let d = await json(await rh('attenties', {}, tok));
  const r = d.relaties.find(x => x.naam === 'Mentor');
  assert.ok(r.dagenTot <= 1, 'de verjaardag is (bijna) morgen');
  assert.ok(d.aankomend.some(a => a.naam === 'Mentor'));
  assert.equal((await rh('attenties/gift', { relatieId: r.id, wat: 'Eerste editie', gelegenheid: 'verjaardag', bedrag: 1200 }, tok)).status, 200);
  d = await json(await rh('attenties', {}, tok));
  assert.equal(d.relaties.find(x => x.id === r.id).giften.length, 1);
});

test('de extra ROS-apps zijn gated op de Lifestyle Pass (RTG niet, Business wel)', async () => {
  const rtg = await lidMet('rtg');
  for (const p of ['reisboek', 'cellier', 'garderobe', 'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties'])
    assert.equal((await rh(p, {}, rtg)).status, 403, p + ' hoort gated te zijn');
  const biz = await lidMet('business');
  assert.equal((await rh('maison', {}, biz)).status, 200);
  assert.equal((await rh('hangar', {}, biz)).status, 200);
});

/* ---- ronde 5: wat elders een conciergedienst of een reisabonnement kost ---- */

test('Cercle: reciprociteit is een lijst, en waarheen beantwoordt de echte vraag', async () => {
  const tok = await lidMet('lifestyle');
  await rh('cercle/club', { naam: 'Club Milano', stad: 'Milaan', lidnummer: 'M-88', sinds: 2019,
    dresscode: 'Jasje verplicht', reciprociteit: ['Casa Lisboa', 'The Athenaeum'], gastpassen: 2 }, tok);
  // een oude tekstregel blijft werken: die wordt op komma's gesplitst
  await rh('cercle/club', { naam: 'Club Parijs', stad: 'Parijs', reciprociteit: 'Casa Lisboa; Club Milano', gastpassen: 1 }, tok);

  const d = await json(await rh('cercle', {}, tok));
  assert.equal(d.aantal, 2);
  const milaan = d.clubs.find(c => c.naam === 'Club Milano');
  assert.deepEqual(milaan.reciprociteit, ['Casa Lisboa', 'The Athenaeum'], 'een echte lijst, geen tekstveld');
  const parijs = d.clubs.find(c => c.naam === 'Club Parijs');
  assert.deepEqual(parijs.reciprociteit, ['Casa Lisboa', 'Club Milano'], 'de oude tekstregel leest als twee clubs');
  assert.equal(d.reciprociteiten, 4);

  // de vraag die het waard is: waar kan ik terecht?
  const w = await json(await rh('cercle/waarheen', { stad: 'Milaan' }, tok));
  assert.equal(w.eigen.length, 1);
  assert.equal(w.eigen[0].club, 'Club Milano');
  assert.equal(w.eigen[0].lidnummer, 'M-88');
  assert.ok(w.bron.includes('zelf heeft ingevuld'), 'de app zegt erbij dat zij niets belooft namens een club');

  const lissabon = await json(await rh('cercle/waarheen', { stad: 'Casa Lisboa' }, tok));
  assert.equal(lissabon.viaGast.length, 2, 'twee lidmaatschappen geven toegang tot Casa Lisboa');
});

test('Cercle: gastpassen hebben een boekhouding en die klopt', async () => {
  const tok = await lidMet('lifestyle');
  await rh('cercle/club', { naam: 'Club Wenen', stad: 'Wenen', gastpassen: 2 }, tok);
  let d = await json(await rh('cercle', {}, tok));
  const id = d.clubs[0].id;

  const g1 = await json(await rh('cercle/gast', { id, wie: 'Een gast', stad: 'Wenen' }, tok));
  assert.equal(g1.gastpassen, 1, 'het saldo loopt terug');
  const g2 = await json(await rh('cercle/gast', { id, wie: 'Nog een gast' }, tok));
  assert.equal(g2.gastpassen, 0);
  const g3 = await json(await rh('cercle/gast', { id, wie: 'Te veel' }, tok));
  assert.ok(g3.error, 'op is op');

  d = await json(await rh('cercle', {}, tok));
  assert.equal(d.clubs[0].gastlog.length, 2, 'wie er mee was staat in het logboek');
  assert.equal(d.gastenDitJaar, 2);

  // een vergissing kan terug
  const terug = await json(await rh('cercle/gast/terug', { id, gastId: d.clubs[0].gastlog[0].id }, tok));
  assert.equal(terug.gastpassen, 1);
});

test('Entourage: elk document heeft een vervaldatum, en er is een waarschuwlijst', async () => {
  const tok = await lidMet('lifestyle');
  const over = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const lang = new Date(Date.now() + 900 * 86400000).toISOString().slice(0, 10);
  const weg = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);

  await rh('entourage/persoon', { naam: 'Reisgenoot A', band: 'partner', telefoon: '0600', dieet: 'geen noten' }, tok);
  await rh('entourage/persoon', { naam: 'Reisgenoot B', band: 'vriend', paspoortTot: weg }, tok);
  let d = await json(await rh('entourage', {}, tok));
  const a = d.gezelschap.find(p => p.naam === 'Reisgenoot A');
  const b = d.gezelschap.find(p => p.naam === 'Reisgenoot B');

  // het oude losse paspoortveld telt gewoon mee als document
  assert.ok(d.attenties.some(x => x.naam === 'Reisgenoot B' && x.soort === 'paspoort' && x.verlopen),
    'een verlopen paspoort uit het oude veld staat in de lijst');

  await rh('entourage/doc', { id: a.id, soort: 'visum', tot: over, nummer: 'V-1' }, tok);
  await rh('entourage/doc', { id: a.id, soort: 'rijbewijs', tot: lang }, tok);
  d = await json(await rh('entourage', {}, tok));
  const soorten = d.attenties.filter(x => x.naam === 'Reisgenoot A').map(x => x.soort);
  assert.deepEqual(soorten, ['visum'], 'alleen wat binnen het venster valt; het rijbewijs van 2029 niet');
  assert.equal(d.attenties[0].verlopen, true, 'wat al verlopen is staat bovenaan');
  assert.ok(d.bron.includes('Inreisvereisten'), 'de app belooft niets over inreisregels');

  // documenten kunnen ook weer weg
  const av = (await json(await rh('entourage', {}, tok))).gezelschap.find(p => p.naam === 'Reisgenoot A');
  await rh('entourage/doc/weg', { id: av.id, docId: av.documenten.find(x => x.soort === 'visum').id }, tok);
  d = await json(await rh('entourage', {}, tok));
  assert.equal(d.attenties.some(x => x.naam === 'Reisgenoot A'), false);
});

test('Entourage: een gezelschap samenstellen zegt wat er nog ontbreekt', async () => {
  const tok = await lidMet('lifestyle');
  const lang = new Date(Date.now() + 900 * 86400000).toISOString().slice(0, 10);
  await rh('entourage/persoon', { naam: 'Compleet', band: 'partner', telefoon: '0600', dieet: 'vis' }, tok);
  await rh('entourage/persoon', { naam: 'Half', band: 'vriend' }, tok);
  let d = await json(await rh('entourage', {}, tok));
  const compleet = d.gezelschap.find(p => p.naam === 'Compleet');
  const half = d.gezelschap.find(p => p.naam === 'Half');
  await rh('entourage/doc', { id: compleet.id, soort: 'paspoort', tot: lang }, tok);

  const alleen = await json(await rh('entourage/gezelschap', { ids: [compleet.id] }, tok));
  assert.equal(alleen.gereed, true, alleen.tekst);
  assert.deepEqual(alleen.dieten, [{ naam: 'Compleet', dieet: 'vis' }], 'de dieetlijst voor wie de tafel reserveert');

  const samen = await json(await rh('entourage/gezelschap', { ids: [compleet.id, half.id] }, tok));
  assert.equal(samen.gereed, false);
  const wat = samen.punten.filter(p => p.naam === 'Half').map(p => p.wat);
  assert.ok(wat.some(w => /geen enkel document/.test(w)));
  assert.ok(wat.some(w => /telefoonnummer/.test(w)));
  assert.ok(wat.some(w => /dieet onbekend/.test(w)));
  assert.equal(samen.punten.some(p => p.naam === 'Compleet'), false, 'over wie compleet is staat er niets');

  assert.ok((await json(await rh('entourage/gezelschap', { ids: [] }, tok))).error, 'zonder mensen geen gezelschap');
});

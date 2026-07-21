/* De Rechtbank (kern/overheid/rechtbank.js) + de Overheids-PDA
   (kern/overheid/pda.js). Getest: de zaakketen (aanbrengen -> zitting op de
   rol -> uitspraak door een MENS, daarna dicht), de samenwerking bezwaar ->
   beroep (griffie en inwoner) met de Berichtenbox, de zittingsrol zonder
   dubbelboekingen, en de PDA voor receptie, security, schoonmaak en bode op
   elke overheidslocatie. Alleen voor het rijk.
   Draai los: node --experimental-sqlite --test test/rechtbank.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const vandaag = () => new Date().toISOString().slice(0, 10);

let srv, base, lid, rijk, partner;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rechtbank-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  lid = (await api(base, '/api/auth/register', { name: 'Inwoner Recht', email: 'rb' + u + '@x.nl',
    phone: '063' + u.slice(1), password: 'geheim123', geboortedatum: '1985-04-04', tier: 'rtg', pasApp: 'rtg' })).body.token;
  const roster = await api(base, '/api/supplier/roster', { code: 'RIJK' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  rijk = (await api(base, '/api/supplier/login', { code: 'RIJK', staffId: man.id, pin: '1234' })).body.token;
  partner = (await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));

test('1. de zaakketen: aanbrengen, zitting op de rol, uitspraak door een mens -- en daarna is het dossier dicht', async () => {
  const mk = await api(base, '/api/overheid/rb/zaak', { type: 'civiel', titel: 'Geschil over een charterovereenkomst', eiser: 'Zeearend', verweerder: 'Rederij Zuid', omschrijving: 'De charter is geannuleerd zonder restitutie.' }, rijk);
  assert.equal(mk.status, 200);
  const ref = mk.body.zaak.ref;
  assert.equal(mk.body.zaak.status, 'aangebracht');
  // uitspraak zonder zitting kan niet: eerst de rol
  assert.equal((await api(base, '/api/overheid/rb/uitspraak', { ref, beslissing: 'toegewezen', motivatie: 'x'.repeat(20) }, rijk)).status, 409);
  // zitting plannen
  const zit = await api(base, '/api/overheid/rb/zitting', { ref, datum: morgen(), tijd: '10:00', zaal: 'Zittingszaal A', rechter: 'mr. Van der Meer' }, rijk);
  assert.equal(zit.status, 200);
  assert.equal(zit.body.zaak.status, 'gepland');
  // dezelfde zaal op hetzelfde moment is bezet
  const mk2 = await api(base, '/api/overheid/rb/zaak', { titel: 'Tweede geschil', eiser: 'Valk', verweerder: 'Havenbedrijf' }, rijk);
  const botst = await api(base, '/api/overheid/rb/zitting', { ref: mk2.body.zaak.ref, datum: morgen(), tijd: '10:00', zaal: 'Zittingszaal A' }, rijk);
  assert.equal(botst.status, 409);
  assert.match(botst.body.error, /bezet/);
  // een uitspraak draagt altijd een motivatie
  assert.equal((await api(base, '/api/overheid/rb/uitspraak', { ref, beslissing: 'toegewezen', motivatie: 'kort' }, rijk)).status, 400);
  const von = await api(base, '/api/overheid/rb/uitspraak', { ref, beslissing: 'toegewezen', motivatie: 'De annulering zonder restitutie is in strijd met de overeenkomst.' }, rijk);
  assert.equal(von.status, 200);
  assert.equal(von.body.zaak.status, 'uitspraak');
  // daarna is het dossier dicht: geen tweede uitspraak, geen nieuwe zitting
  assert.equal((await api(base, '/api/overheid/rb/uitspraak', { ref, beslissing: 'afgewezen', motivatie: 'toch andersom bekeken' }, rijk)).status, 409);
  assert.equal((await api(base, '/api/overheid/rb/zitting', { ref, datum: morgen(), zaal: 'Raadkamer' }, rijk)).status, 409);
});

test('2. de samenwerking: een ongegrond bezwaar gaat als beroep de rechtbank in, en alles landt in de Berichtenbox', async () => {
  // de inwoner maakt bezwaar; het rijk verklaart het ongegrond
  const bz = await api(base, '/api/overheid/bezwaar', { tegen: 'Aanslag afvalstoffenheffing', reden: 'De heffing telt een tweede container die ik niet heb.' }, lid);
  assert.equal(bz.status, 200);
  const bref = bz.body.bezwaar.ref;
  // beroep tegen een nog lopend bezwaar kan niet
  assert.equal((await api(base, '/api/overheid/beroep', { ref: bref }, lid)).status, 409);
  assert.equal((await api(base, '/api/overheid/bezwaar/beslis', { ref: bref, besluit: 'ongegrond', motivatie: 'De registratie toont twee containers.' }, rijk)).status, 200);
  // nu gaat de inwoner ZELF in beroep via MijnOverheid
  const ber = await api(base, '/api/overheid/beroep', { ref: bref }, lid);
  assert.equal(ber.status, 200);
  assert.equal(ber.body.zaak.type, 'bestuur');
  assert.equal(ber.body.zaak.bron.ref, bref);
  // niet twee keer in beroep tegen hetzelfde bezwaar
  assert.equal((await api(base, '/api/overheid/beroep', { ref: bref }, lid)).status, 409);
  assert.equal((await api(base, '/api/overheid/rb/beroep', { ref: bref }, rijk)).status, 409);
  // de zaak staat bij de eigen zaken van de inwoner, en de Berichtenbox weet ervan
  const mijn = await api(base, '/api/overheid/zaken/mijn', {}, lid);
  assert.ok(mijn.body.zaken.some(z => z.ref === ber.body.zaak.ref));
  const box = await api(base, '/api/overheid/berichten', {}, lid);
  assert.ok(box.body.berichten.some(b => /zaak aangebracht/i.test(b.titel)), 'de rechtbank meldt zich in de Berichtenbox');
  // de cockpit ziet het hele huis
  const c = await api(base, '/api/overheid/rb/cockpit', {}, rijk);
  assert.equal(c.status, 200);
  assert.ok(c.body.zaken >= 3);
  assert.ok(Array.isArray(c.body.signalen));
});

test('3. de AI-griffier helpt met het beeld en oordeelt nooit', async () => {
  const r = await api(base, '/api/overheid/rb/ai', { vraag: 'Wat plan ik als eerste?' }, rijk);
  assert.equal(r.status, 200);
  assert.ok(r.body.antwoord && r.body.antwoord.length > 20);
  assert.match(r.body.antwoord, /rechter/i, 'het antwoord wijst naar de rechter als beslisser');
});

test('4. de PDA-receptie: een bezoeker krijgt een badge en wordt weer uitgeschreven -- op elke locatie', async () => {
  for (const locatie of ['rechtbank', 'gemeentehuis']) {
    const o = await api(base, '/api/overheid/pda/overzicht', { locatie }, rijk);
    assert.equal(o.status, 200);
    assert.ok(o.body.ruimtes.length >= 5, locatie + ' heeft ruimtes');
    const inr = await api(base, '/api/overheid/pda/bezoeker/in', { locatie, naam: 'Mevr. Jansen', voor: 'zitting van 10:00' }, rijk);
    assert.equal(inr.status, 200);
    assert.match(inr.body.bezoeker.badge, /^B-[0-9A-F]{4}$/);
    const uit = await api(base, '/api/overheid/pda/bezoeker/uit', { id: inr.body.bezoeker.id }, rijk);
    assert.equal(uit.status, 200);
    assert.equal((await api(base, '/api/overheid/pda/bezoeker/uit', { id: inr.body.bezoeker.id }, rijk)).status, 409, 'niet twee keer uitschrijven');
  }
  assert.equal((await api(base, '/api/overheid/pda/overzicht', { locatie: 'casino' }, rijk)).status, 400, 'geen onzin-locaties');
});

test('5. de PDA-security: rondes en incidenten, melden en netjes sluiten', async () => {
  const locatie = 'belastingkantoor';
  const ronde = await api(base, '/api/overheid/pda/ronde', { locatie }, rijk);
  assert.equal(ronde.status, 200);
  assert.ok(ronde.body.ronde.checkpoints >= 5, 'de ronde gaat langs alle ruimtes');
  const inc = await api(base, '/api/overheid/pda/incident', { locatie, ruimte: 'Spreekkamer 1', soort: 'techniek', ernst: 2, tekst: 'Deurdranger van spreekkamer 1 hapert.' }, rijk);
  assert.equal(inc.status, 200);
  const sluit = await api(base, '/api/overheid/pda/incident/sluit', { id: inc.body.incident.id, oplossing: 'Facilitair heeft de dranger vervangen.' }, rijk);
  assert.equal(sluit.status, 200);
  assert.equal((await api(base, '/api/overheid/pda/incident/sluit', { id: inc.body.incident.id }, rijk)).status, 409);
  const lijst = await api(base, '/api/overheid/pda/incidenten', { locatie }, rijk);
  assert.ok(lijst.body.incidenten.some(i => i.id === inc.body.incident.id && i.gesloten));
});

test('6. de PDA-schoonmaak: dagtaken per ruimte, afvinken en extra werk', async () => {
  const locatie = 'rijkskantoor';
  const t = await api(base, '/api/overheid/pda/taken', { locatie }, rijk);
  assert.equal(t.status, 200);
  assert.ok(t.body.taken.length >= t.body.ruimtes.length, 'elke ruimte een dagtaak');
  const open = t.body.taken.find(x => !x.klaar);
  assert.equal((await api(base, '/api/overheid/pda/taak/klaar', { id: open.id }, rijk)).status, 200);
  assert.equal((await api(base, '/api/overheid/pda/taak/klaar', { id: open.id }, rijk)).status, 409, 'niet dubbel afvinken');
  const extra = await api(base, '/api/overheid/pda/taak/extra', { locatie, ruimte: 'Kantoortuin', tekst: 'Koffie omgevallen bij de vergadertafel.' }, rijk);
  assert.equal(extra.status, 200);
  assert.equal(extra.body.taak.extra, true);
});

test('7. de bode ziet de zittingsrol op de PDA en zet de zaal klaar; de zittingszaal komt op de schoonmaaklijst', async () => {
  // een zitting VANDAAG, zodat de bode en de schoonmaak hem zien
  const mk = await api(base, '/api/overheid/rb/zaak', { titel: 'Kort geding strandpaviljoen', eiser: 'Reiger', verweerder: 'Gemeente' }, rijk);
  await api(base, '/api/overheid/rb/zitting', { ref: mk.body.zaak.ref, datum: vandaag(), tijd: '14:00', zaal: 'Zittingszaal B' }, rijk);
  const rol = await api(base, '/api/overheid/pda/zittingen', {}, rijk);
  const zit = rol.body.zittingen.find(z => z.ref === mk.body.zaak.ref);
  assert.ok(zit && !zit.klaargezet, 'de zitting staat op de bode-lijst');
  assert.equal((await api(base, '/api/overheid/pda/klaarzet', { ref: mk.body.zaak.ref }, rijk)).status, 200);
  assert.equal((await api(base, '/api/overheid/pda/klaarzet', { ref: mk.body.zaak.ref }, rijk)).status, 409, 'staat al klaar');
  // de griffie-cockpit ziet hetzelfde: geen bode-signaal meer voor deze zaal
  const c = await api(base, '/api/overheid/rb/cockpit', {}, rijk);
  assert.ok(!c.body.signalen.some(s => s.soort === 'bode' && s.ref === mk.body.zaak.ref));
  // en de schoonmaak ziet de zaal automatisch op de dagtaken staan
  const t = await api(base, '/api/overheid/pda/taken', { locatie: 'rechtbank' }, rijk);
  assert.ok(t.body.taken.some(x => x.extra && x.ruimte === 'Zittingszaal B' && /zitting/.test(x.tekst)), 'de zaal staat op de schoonmaaklijst');
});

test('8. de PDA-AI denkt mee per rol (en de medewerker handelt)', async () => {
  const r = await api(base, '/api/overheid/pda/ai', { locatie: 'rechtbank', rol: 'security', vraag: 'Waar let ik vandaag op?' }, rijk);
  assert.equal(r.status, 200);
  assert.ok(r.body.antwoord && r.body.antwoord.length > 20);
});

test('9. rechtbank en PDA zijn alleen voor het rijk: partner en anoniem komen er niet in', async () => {
  assert.equal((await api(base, '/api/overheid/rb/cockpit', {}, partner)).status, 403);
  assert.equal((await api(base, '/api/overheid/rb/cockpit', {}, null)).status, 401);
  assert.equal((await api(base, '/api/overheid/pda/overzicht', { locatie: 'rechtbank' }, partner)).status, 403);
  assert.equal((await api(base, '/api/overheid/pda/overzicht', { locatie: 'rechtbank' }, null)).status, 401);
});

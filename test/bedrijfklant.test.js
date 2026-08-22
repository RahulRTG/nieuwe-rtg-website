/* RTG Werk OS, deel 3: klanten, verkoop en de servicedesk.

   Vijf beweringen, allemaal over eerlijk tellen:

   - EEN VERLOREN KANS VRAAGT EEN REDEN en een gewonnen kans een bedrag.
   - DE PIJPLIJN IS EEN REKENSOM (bedrag maal de kans van de fase) en noemt
     zichzelf geen prognose.
   - WAT EEN KLANT AFNEEMT IS EEN VERWIJZING, geen tweede administratie -- en
     er is nergens een waarde-per-klant-score.
   - DE REACTIEKLOK STOPT BIJ EEN MENS: een automatische ontvangstbevestiging
     zet hem niet stil.
   - EEN OVERSCHRIJDING BLIJFT STAAN, ook als het ticket later netjes wordt
     opgelost, en sluiten kan niet met een leeg oplossingsveld.
   Draai los: node --test test/bedrijfklant.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bedrijfklant-'));
const api = (pad, body) => fetch(BASE + '/api/bedrijf' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let W, B, VK, SV;
async function lid(naam, rollen) {
  const a = (await api('/lid/aanmeld', { werkruimte: W, naam })).body;
  await api('/lid/besluit', { werkruimte: W, beheerToken: B, lidId: a.lidId, akkoord: true });
  await api('/lid/rollen', { werkruimte: W, beheerToken: B, lidId: a.lidId, rollen });
  return { werkruimte: W, lidToken: a.lidToken, id: a.lidId, naam };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const w = (await api('/werkruimte/maak', { naam: 'RTG Verkoop', land: 'NL' })).body;
  W = w.werkruimte; B = w.beheerToken;
  VK = await lid('Vera', ['verkoop']);
  SV = await lid('Sam', ['service']);
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('een klantbeeld verwijst naar de producten, en rangschikt geen klanten', async () => {
  const k = (await api('/klant/zet', Object.assign({ naam: 'Restaurant De Kade', branche: 'horeca',
    contacten: [{ naam: 'J. de Kade', rol: 'eigenaar', email: 'j@dekade.nl' }, { rol: 'zonder naam' }] }, VK))).body.klant;
  assert.equal(k.contacten.length, 1, 'een contact zonder naam is geen contact');

  const zonder = await api('/klant/product', Object.assign({ klantId: k.id, product: 'horeca-os' }, VK));
  assert.equal(zonder.status, 400, 'zonder verwijzing is dit een tweede administratie');
  assert.match(zonder.body.error, /zaakcode|verwijzing/i);

  const met = (await api('/klant/product', Object.assign({ klantId: k.id, product: 'horeca-os',
    verwijzing: 'KIKUNOI' }, VK))).body;
  assert.equal(met.klant.producten[0].verwijzing, 'KIKUNOI');
  await api('/klant/product', Object.assign({ klantId: k.id, product: 'betalingen', verwijzing: 'KIKUNOI' }, VK));

  const beeld = (await api('/klant', Object.assign({ klantId: k.id }, VK))).body;
  assert.equal(beeld.klant.producten.length, 2, 'een klantbeeld over meerdere RTG-producten');
  assert.match(beeld.let, /geen waarde-per-klant-score/i);
  const plat = JSON.stringify(beeld);
  assert.ok(!/klantwaarde|waardescore|score:/i.test(plat), 'er staat nergens een waarderingscijfer per klant');

  const raar = await api('/klant/product', Object.assign({ klantId: k.id, product: 'ruimtevaart', verwijzing: 'X' }, VK));
  assert.equal(raar.status, 400);
});

test('een verloren kans vraagt een reden, een gewonnen kans een bedrag', async () => {
  const k = (await api('/klant', VK)).body.klanten[0];
  const a = (await api('/kans/maak', Object.assign({ klantId: k.id, titel: 'Horeca OS voor drie zaken',
    product: 'horeca-os', bedrag: 12000 }, VK))).body.kans;

  const stil = await api('/kans/fase', Object.assign({ kansId: a.id, fase: 'verloren' }, VK));
  assert.equal(stil.status, 400);
  assert.match(stil.body.error, /leert de trechter niets/i);

  await api('/kans/fase', Object.assign({ kansId: a.id, fase: 'demo' }, VK));
  const b = (await api('/kans/maak', Object.assign({ klantId: k.id, titel: 'Werk OS erbij' }, VK))).body.kans;
  const leeg = await api('/kans/fase', Object.assign({ kansId: b.id, fase: 'gewonnen' }, VK));
  assert.equal(leeg.status, 400, '"gewonnen" zonder getal is een gevoel');

  const gewonnen = (await api('/kans/fase', Object.assign({ kansId: b.id, fase: 'gewonnen', bedrag: 3000 }, VK))).body;
  assert.equal(gewonnen.kans.bedragCenten, 300000);
  const nogmaals = await api('/kans/fase', Object.assign({ kansId: b.id, fase: 'demo' }, VK));
  assert.equal(nogmaals.status, 409, 'een afgesloten kans gaat niet terug de trechter in');

  const c = (await api('/kans/maak', Object.assign({ klantId: k.id, titel: 'School OS', bedrag: 5000 }, VK))).body.kans;
  await api('/kans/fase', Object.assign({ kansId: c.id, fase: 'verloren', reden: 'te duur gevonden' }, VK));

  const p = (await api('/pijplijn', VK)).body;
  assert.equal(p.open.aantal, 1, 'alleen de demo-kans staat nog open');
  assert.equal(p.open.gewogenCenten, 600000, '12.000 x 50% van de demofase');
  assert.equal(p.perFase.demo.kansPct, 50);
  assert.equal(p.verloren.redenen['te duur gevonden'], 1, 'de verliesredenen worden geteld');
  assert.equal(p.scoringPct, 50, 'een gewonnen, een verloren');
  assert.match(p.let, /geen prognose/i);
  assert.ok(!/prognose[^a-z]/i.test(JSON.stringify(p.open)), 'het woord prognose staat niet bij de cijfers zelf');
});

test('de reactieklok stopt bij een mens, niet bij een ontvangstbevestiging', async () => {
  const t = (await api('/ticket/maak', Object.assign({ onderwerp: 'Kassa doet het niet',
    prioriteit: 'kritiek', melder: 'De Kade' }, SV))).body.ticket;

  const auto = (await api('/ticket/reageer', Object.assign({ ticketId: t.id,
    tekst: 'Wij hebben uw melding ontvangen.', automatisch: true }, SV))).body;
  assert.equal(auto.sla.reactieGehaald, null, 'een automatische bevestiging zet de klok niet stil');
  assert.match(auto.let, /loopt door tot een mens antwoordt/i);

  const mens = (await api('/ticket/reageer', Object.assign({ ticketId: t.id,
    tekst: 'Ik kijk er nu naar, monteur onderweg.' }, SV))).body;
  assert.equal(mens.sla.reactieGehaald, true, 'pas het antwoord van een mens stopt hem');
  assert.equal(mens.sla.reactieNorm, 15, 'kritiek staat op vijftien minuten');
  assert.equal(mens.reacties, 2, 'de bevestiging blijft wel gewoon staan');
});

test('sluiten vraagt een oplossing, en een overschrijding blijft staan', async () => {
  const t = (await api('/ticket/maak', Object.assign({ onderwerp: 'Bon niet leesbaar', prioriteit: 'laag' }, SV))).body.ticket;
  const leeg = await api('/ticket/sluit', Object.assign({ ticketId: t.id }, SV));
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /leert niemand iets/i);

  const dicht = (await api('/ticket/sluit', Object.assign({ ticketId: t.id, oplossing: 'Nieuwe bonrol geplaatst.' }, SV))).body;
  assert.equal(dicht.ticket.status, 'gesloten');
  assert.equal(dicht.sla.oplosGehaald, true);

  const nogmaals = await api('/ticket/sluit', Object.assign({ ticketId: t.id, oplossing: 'nogmaals' }, SV));
  assert.equal(nogmaals.status, 409);

  // waarderen kan pas na sluiten, en onder vijf antwoorden komt er geen cijfer
  const tevroeg = await api('/ticket/waardeer', Object.assign({ ticketId: 'bestaatniet', cijfer: 5 }, SV));
  assert.equal(tevroeg.status, 404);
  await api('/ticket/waardeer', Object.assign({ ticketId: t.id, cijfer: 5 }, SV));

  const beeld = (await api('/service/beeld', SV)).body;
  assert.equal(beeld.tevredenheid, null, 'een gemiddelde uit een antwoord is geen gemiddelde');
  assert.match(beeld.tevredenheidUitleg, /4 antwoord\(en\) nodig/);
  assert.equal(beeld.normen.kritiek.reactieMin, 15);
});

test('een storing bundelt tickets, en een evaluatie noemt oorzaak en maatregel', async () => {
  const s = (await api('/storing/meld', Object.assign({ wat: 'Betaalverkeer ligt plat', ernst: 'zwaar' }, SV))).body.storing;
  const t1 = (await api('/ticket/maak', Object.assign({ onderwerp: 'Kan niet pinnen', prioriteit: 'hoog' }, SV))).body.ticket;
  const t2 = (await api('/ticket/maak', Object.assign({ onderwerp: 'Betaling mislukt', prioriteit: 'hoog' }, SV))).body.ticket;
  for (const t of [t1, t2]) await api('/storing/koppel', Object.assign({ storingId: s.id, ticketId: t.id }, SV));

  const half = await api('/storing/evalueer', Object.assign({ storingId: s.id, oorzaak: 'certificaat verlopen' }, SV));
  assert.equal(half.status, 400, 'een evaluatie zonder maatregel is een verslag');

  const ev = (await api('/storing/evalueer', Object.assign({ storingId: s.id,
    oorzaak: 'certificaat van de betaalprovider verlopen',
    maatregel: 'bewaking op de vervaldatum, met een melding dertig dagen vooraf' }, SV))).body;
  assert.equal(ev.storing.evaluatie.geraakteTickets, 2, 'vijftig meldingen over hetzelfde zijn een storing');
  assert.ok(ev.storing.opgelostAt);

  const beeld = (await api('/service/beeld', SV)).body;
  assert.equal(beeld.storingen, 0, 'een geevalueerde storing staat niet meer open');
  assert.equal(beeld.open.perPrioriteit.hoog, 2);
});

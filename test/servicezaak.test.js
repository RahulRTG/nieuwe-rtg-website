/* RTG SERVICE VOOR EEN ZAAK -- de ingang die er niet was.

   HET GAT DAT DIT DICHT. Een leverancier, restaurant, vervoerder of gemeente kon
   RTG nergens een hulpvraag stellen. Er was wel een ZIN -- routes/supplier/
   abonnement.js vertelt of er een vaste contactpersoon is -- maar geen kanaal:
   geen enkele route waarlangs een zaak iets kon melden. Wat een gast aan tafel
   wel had (routes/gast/verzoek.js), had een zaak richting RTG niet.

   Wat deze toetsen vastleggen:

   1. Het systeem VRAAGT niet wie er meldt. De zaakcode komt uit de sessie; er is
      geen veld waarin een zaak zijn eigen nummer moet intikken.
   2. De doelgroep wordt door de ROUTE gezet en niet uit het lichaam gelezen. Een
      melder die zichzelf een organisatie mag noemen, routeert zichzelf naar een
      ander team.
   3. Een zaak krijgt een MENS, en niet De Rechterhand. Die is een gekochte
      pas-dienst, en een zaak heeft geen pas.
   4. Zaken zien elkaars meldingen niet, ook niet met een geldig zaaknummer.
   5. Het kantoor ziet meteen met wie het praat -- vijf velden, en niet de hele
      klantweergave met menu's en foto's erin. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

async function alsZaak(p, code) {
  const r = await p('/api/supplier/roster', { code });
  const man = (r.body.staff || []).find(s => s.role === 'manager');
  assert.ok(man, 'geen manager bij ' + code + ': ' + JSON.stringify(r.body).slice(0, 160));
  const lg = await p('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(lg.body.token, 'de manager van ' + code + ' logt in: ' + JSON.stringify(lg.body).slice(0, 160));
  return lg.body.token;
}

async function opzet() {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = post(srv.base);
  return { srv, p, zaakToken: await alsZaak(p, 'KIKUNOI'), balie: await kantoorAlsPersoon(srv.base) };
}

test('een zaak meldt iets, en hoeft zijn eigen nummer niet op te zoeken', async () => {
  const o = await opzet();
  try {
    const r = await o.p('/api/supplier/service/open', {
      onderwerp: 'betaling', titel: 'Onze uitbetaling van vrijdag is niet aangekomen',
      tekst: 'De weekafrekening staat sinds vrijdag op pending.', geld: 'flink', impact: 'flink'
    }, o.zaakToken);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.zaak.doelgroep, 'zaak');
    /* De doelgroep brengt hem bij het zakelijke team, waar het contract en de
       werkruimte bekend zijn -- niet bij de ledenbalie, waar men over
       abonnementen gaat. */
    assert.equal(r.body.zaak.team, 'zakelijk');
  } finally { await stop(o.srv); }
});

test('een zaak kan zichzelf geen andere doelgroep geven', async () => {
  const o = await opzet();
  try {
    const r = await o.p('/api/supplier/service/open',
      { doelgroep: 'lid', onderwerp: 'betaling', titel: 'Wij proberen ons voor te doen als lid' }, o.zaakToken);
    assert.equal(r.body.zaak.doelgroep, 'zaak',
      'de client kon de doelgroep zetten en zichzelf naar een ander team routeren');
    assert.equal(r.body.zaak.team, 'zakelijk');
  } finally { await stop(o.srv); }
});

test('een zaak krijgt een mens, en dat is niet De Rechterhand', async () => {
  const o = await opzet();
  try {
    const z = (await o.p('/api/supplier/service/open',
      { onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }, o.zaakToken)).body.zaak;
    const m = await o.p('/api/supplier/service/mens', { id: z.id }, o.zaakToken);
    assert.equal(m.body.ok, true, JSON.stringify(m.body).slice(0, 200));
    assert.equal(m.body.overname.team, 'zakelijk');
    assert.doesNotMatch(m.body.let, /Rechterhand/,
      'een zaak kreeg De Rechterhand toegezegd; dat is een gekochte pas-dienst');
    assert.equal(m.body.zaak.stand, 'wachtOpMens');

    /* En hij staat in dezelfde wachtrij als alle andere meldingen. Er komt geen
       tweede rij voor zakelijke melders bij. */
    const rij = await o.p('/api/office/service/wachtrij', { team: 'zakelijk' }, o.balie);
    assert.equal(rij.body.zaken.length, 1, JSON.stringify(rij.body.tel));
  } finally { await stop(o.srv); }
});

test('zaken zien elkaars meldingen niet', async () => {
  const o = await opzet();
  try {
    const mijn = (await o.p('/api/supplier/service/open',
      { onderwerp: 'betaling', titel: 'Onze uitbetaling ontbreekt' }, o.zaakToken)).body.zaak;
    const ander = await alsZaak(o.p, 'ESVEDRA');
    const gluur = await o.p('/api/supplier/service/zaak', { id: mijn.id }, ander);
    assert.equal(gluur.status, 404, 'een andere zaak kon deze melding openen met alleen het nummer');
    const praat = await o.p('/api/supplier/service/bericht', { id: mijn.id, tekst: 'hallo daar' }, ander);
    assert.equal(praat.status, 404, 'een andere zaak kon in een vreemde melding schrijven');
  } finally { await stop(o.srv); }
});

test('het kantoor ziet met wie het praat, en niet de hele klantweergave', async () => {
  const o = await opzet();
  try {
    const z = (await o.p('/api/supplier/service/open',
      { onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }, o.zaakToken)).body.zaak;
    const d = await o.p('/api/office/service/zaak', { id: z.id }, o.balie);
    assert.equal(d.status, 200, JSON.stringify(d.body).slice(0, 200));
    const pf = d.body.zaakprofiel;
    assert.ok(pf, 'de medewerker ziet niet met wie hij praat en moet dus alsnog het klantnummer vragen');
    assert.equal(pf.code, 'KIKUNOI');
    assert.ok(pf.naam, 'de naam van de zaak ontbreekt');
    /* VIJF VELDEN EN NIET MEER. publicSupplier() is de KLANTweergave, met
       menu's, foto's, kamers en evenementen; een medewerker die een storing
       onderzoekt heeft daar niets aan, en alles wat hier binnenkomt is meteen
       ook alles wat er in de wachtrij te zien is. */
    assert.deepEqual(Object.keys(pf).sort(), ['code', 'gevonden', 'naam', 'partnerStand', 'soort', 'stad'],
      'het zaakprofiel draagt meer dan de vijf velden: ' + JSON.stringify(Object.keys(pf)));
  } finally { await stop(o.srv); }
});

test('een zaak bevestigt toegang net als een lid', async () => {
  const o = await opzet();
  try {
    const z = (await o.p('/api/supplier/service/open',
      { onderwerp: 'zaak', titel: 'Onze werkruimte doet raar' }, o.zaakToken)).body.zaak;
    const v = await o.p('/api/office/service/bevestiging/vraag',
      { id: z.id, capabilities: ['organisatie.stand'], reden: 'de werkruimte reageert niet sinds vanmorgen' }, o.balie);
    assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));

    const wacht = await o.p('/api/supplier/service/bevestigingen', {}, o.zaakToken);
    assert.equal(wacht.body.verzoeken.length, 1, 'er stond niets klaar op de werkplek van de zaak');
    assert.match(String(wacht.body.verzoeken[0].code), /^\d{6}$/);

    const ok = await o.p('/api/supplier/service/bevestig', { id: wacht.body.verzoeken[0].id }, o.zaakToken);
    assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));
    assert.deepEqual(ok.body.machtiging.capabilities, ['organisatie.stand'],
      'er ging iets anders open dan wat de zaak bevestigde');
  } finally { await stop(o.srv); }
});

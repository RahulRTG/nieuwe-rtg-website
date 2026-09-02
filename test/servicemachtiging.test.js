/* DE SERVICEMACHTIGING EN DE SUPPORTBEVESTIGING.

   TWEE FOUTEN DIE HIER WORDEN VASTGEZET.

   DE EERSTE was een dode tak. De zware capabilities (identiteit openen,
   bankgegevens, compensatie, uitvoer) stonden "voor de zekerheid" niet in de
   teamtabel. Omdat een machtiging alleen kan VERSMALLEN naar wat het team
   nodig heeft, kon geen enkele aanvraag ooit zwaar werk bevatten -- en werd de
   tweede handtekening, de duurste grendel van deze laag, nooit uitgevoerd
   terwijl de toets erover groen stond. Dezelfde vorm als de cap `rooms` uit
   PLATFORM.md. Toets 5 hieronder loopt daarom door de HELE zware keten heen.

   DE TWEEDE was uitvoerbaarheid. kern/ledenbalie.js leidt per lid een vaste
   steuncode af en het scherm zegt "het lid leest die voor uit de app" -- maar
   geen enkele route liet een lid die code zien. Een beveiligde werkstroom die
   niet uitvoerbaar is, is erger dan geen: hij ziet er af uit, en in de praktijk
   vraagt de balie dan maar iets anders. De vervanging is geen zichtbaar vast
   geheim maar een BEVESTIGING: het lid ziet wie er vraagt, waarvoor, en drukt
   zelf. De code die overblijft is de terugval -- vijf minuten, een keer, aan
   deze zaak gebonden. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

function laag() {
  const db = { data: {} };
  const save = () => {};
  const zaken = require('../server/kern/service/zaak')({ db, save, crypto });
  const machtigingen = require('../server/kern/service/machtiging')({ db, save, crypto, zaken });
  const bevestiging = require('../server/kern/service/bevestiging')({ db, save, crypto, zaken, machtigingen });
  return { db, zaken, machtigingen, bevestiging };
}
const REDEN = 'de uitbetaling staat sinds gisteren op pending';

test('een machtiging versmalt alleen, en zegt wat er wegviel', () => {
  const l = laag();
  const z = l.zaken.open({ melder: 'user-1', onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }).zaak;
  const v = l.machtigingen.verleen({ zaakId: z.id, mens: 'nadia', reden: REDEN,
    capabilities: ['betaling.stand', 'lid.dossier', 'verzonnen.recht'] });
  assert.deepEqual(v.machtiging.capabilities, ['betaling.stand'],
    'er kwam iets bij dat het team niet nodig heeft: ' + JSON.stringify(v.machtiging.capabilities));
  assert.deepEqual(v.geweigerd.sort(), ['lid.dossier', 'verzonnen.recht'],
    'wat wegviel wordt niet gemeld; dan denkt de medewerker dat het systeem stuk is');
});

test('een machtiging opent niets bij een andere zaak', () => {
  const l = laag();
  const a = l.zaken.open({ melder: 'user-1', onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }).zaak;
  const b = l.zaken.open({ melder: 'user-1', onderwerp: 'betaling', titel: 'Tweede vraag over geld' }).zaak;
  const v = l.machtigingen.verleen({ zaakId: a.id, mens: 'nadia', reden: REDEN, capabilities: ['betaling.stand'] });
  assert.equal(l.machtigingen.magNu(v.machtiging.id, 'betaling.stand', { zaakId: a.id }).mag, true);
  const nee = l.machtigingen.magNu(v.machtiging.id, 'betaling.stand', { zaakId: b.id });
  assert.equal(nee.mag, false, 'dezelfde mens opende met een machtiging van zaak A ook zaak B');
  assert.match(nee.waarom, new RegExp(a.id), 'de weigering noemt niet bij welke zaak de machtiging hoort');
});

test('verlopen is een berekende toestand en geen opruimactie', () => {
  const l = laag();
  const z = l.zaken.open({ melder: 'user-1', onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }).zaak;
  const v = l.machtigingen.verleen({ zaakId: z.id, mens: 'nadia', reden: REDEN, capabilities: ['betaling.stand'] });
  /* De klok terugzetten in de opslag, niet de stand. Zou er ergens een
     opgeslagen `verlopen: true` staan, dan blijft deze machtiging geldig tot
     een schoonmaker langskomt -- en dan hangt de belofte "hij verloopt vanzelf"
     van een cron af. Dezelfde regel als kern/command/bijstand.js. */
  l.db.data.serviceMachtigingen[0].tot = new Date(Date.now() - 1000).toISOString();
  assert.equal(l.machtigingen.stand(l.db.data.serviceMachtigingen[0]), 'verlopen');
  assert.equal(l.machtigingen.magNu(v.machtiging.id, 'betaling.stand').mag, false);
});

test('zwaar werk vraagt een tweede mens, en nooit de aanvrager zelf', () => {
  const l = laag();
  const z = l.zaken.open({ melder: 'user-1', onderwerp: 'account', titel: 'Ik kan niet meer inloggen' }).zaak;
  assert.equal(z.team, 'toegang');
  const v = l.machtigingen.verleen({ zaakId: z.id, mens: 'nadia', capabilities: ['identiteit.openen'],
    reden: 'account recovery, het lid meldt zich aan de balie' });
  assert.deepEqual(v.machtiging.zwaar, ['identiteit.openen'],
    'zwaar werk werd niet als zwaar herkend -- dit is de dode tak uit de kop');
  assert.equal(l.machtigingen.magNu(v.machtiging.id, 'identiteit.openen').mag, false,
    'zwaar werk ging open met een enkele handtekening');
  assert.ok(l.machtigingen.tekenBij(v.machtiging.id, { mens: 'nadia' }).error,
    'de aanvrager kon zijn eigen tweede handtekening zetten');
  l.machtigingen.tekenBij(v.machtiging.id, { mens: 'joris' });
  assert.equal(l.machtigingen.magNu(v.machtiging.id, 'identiteit.openen').mag, true);
});

test('een bevestiging levert precies de machtiging op die het lid heeft gelezen', () => {
  const l = laag();
  const z = l.zaken.open({ melder: 'user-7', onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }).zaak;
  l.bevestiging.vraag({ zaakId: z.id, mens: 'nadia', doel: 'betaalstand bekijken',
    capabilities: ['betaling.stand'], reden: REDEN });
  const inApp = l.bevestiging.voorLid('user-7')[0];
  assert.ok(inApp.reden, 'het lid ziet niet waarvoor er wordt gevraagd');
  const r = l.bevestiging.bevestig(inApp.id, { melder: 'user-7' });
  assert.deepEqual(r.machtiging.capabilities, inApp.capabilities,
    'er ging iets anders open dan wat het lid bevestigde');
});

test('de code staat in de app van het lid en niet op het scherm van de medewerker', () => {
  const l = laag();
  const z = l.zaken.open({ melder: 'user-7', onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }).zaak;
  const v = l.bevestiging.vraag({ zaakId: z.id, mens: 'nadia', capabilities: ['betaling.stand'], reden: REDEN });
  assert.equal(v.bevestiging.code, undefined,
    'de medewerker kon de code van zijn eigen scherm aflezen; dan bevestigt de terugval niets');
  assert.match(String(l.bevestiging.voorLid('user-7')[0].code), /^\d{6}$/);
});

test('de terugvalcode werkt een keer, en alleen voor wie erom vroeg', () => {
  const l = laag();
  const z = l.zaken.open({ melder: 'user-7', onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }).zaak;
  l.bevestiging.vraag({ zaakId: z.id, mens: 'nadia', capabilities: ['betaling.stand'], reden: REDEN });
  const code = l.bevestiging.voorLid('user-7')[0].code;
  assert.ok(l.bevestiging.metCode(code, { mens: 'joris' }).error,
    'een andere medewerker kon de code van een collega gebruiken');
  assert.equal(l.bevestiging.metCode(code, { mens: 'nadia' }).ok, true);
  assert.ok(l.bevestiging.metCode(code, { mens: 'nadia' }).error, 'de code werkte een tweede keer');
});

test('een bevestiging staat op naam: een ander lid kan hem niet indrukken', () => {
  const l = laag();
  const z = l.zaken.open({ melder: 'user-7', onderwerp: 'betaling', titel: 'Uitbetaling ontbreekt' }).zaak;
  const v = l.bevestiging.vraag({ zaakId: z.id, mens: 'nadia', capabilities: ['betaling.stand'], reden: REDEN });
  assert.ok(l.bevestiging.bevestig(v.bevestiging.id, { melder: 'user-9' }).error);
  assert.ok(l.bevestiging.weiger(v.bevestiging.id, { melder: 'user-9' }).error);
  assert.equal(l.bevestiging.weiger(v.bevestiging.id, { melder: 'user-7' }).ok, true,
    'weigeren hoort net zo makkelijk te zijn als bevestigen');
});

test('de hele keten over de echte routes: vragen, bevestigen, openen', async () => {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  const p = async (pad, body, tok) => {
    const r = await fetch(srv.base + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    const lid = (await p('/api/auth/register', { name: 'Bevestig Lid', email: 'bevestiglid@x.nl',
      phone: '0612340007', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' })).body.token;
    const balie = await kantoorAlsPersoon(srv.base);
    const z = (await p('/api/service/open', { onderwerp: 'betaling', titel: 'Mijn uitbetaling ontbreekt',
      betrokken: { soort: 'betaling', code: 'PAY-829192' } }, lid)).body.zaak;

    const v = await p('/api/office/service/bevestiging/vraag', { id: z.id, doel: 'betaalstand bekijken',
      capabilities: ['betaling.stand'], reden: REDEN }, balie);
    assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));
    assert.equal(JSON.stringify(v.body).includes('"code"'), false, 'de code lekte naar de kantoorkant');

    const wacht = await p('/api/service/bevestigingen', {}, lid);
    assert.equal(wacht.body.verzoeken.length, 1, 'er stond niets klaar in de app van het lid');
    assert.match(wacht.body.let, /nooit per e-mail/i,
      'het lid krijgt geen waarschuwing over waar RTG dit NIET vraagt');

    const ok = await p('/api/service/bevestig', { id: wacht.body.verzoeken[0].id }, lid);
    assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));

    const mijne = await p('/api/office/service/machtigingen', {}, balie);
    assert.equal(mijne.body.machtigingen.length, 1);
    assert.equal(mijne.body.tel.permanenteToegang, 0,
      'er is permanente toegang ontstaan; deze laag hoort er nul te houden');
  } finally { await stop(srv); }
});

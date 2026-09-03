/* RTG SERVICE: DE GEMEENSCHAPPELIJKE ENVELOP.

   Deze toetsen leggen vooral vast wat de servicelaag NIET doet, want dat is
   waar de merkregels zitten en wat bij een verbouwing als eerste sneuvelt:

   1. Een zaak draagt een VERWIJZING en nooit gegevens. Wie er een bedrag of een
      adres in stopt, ziet het verdwijnen -- niet omdat het geheim is, maar omdat
      de wachtrij anders zelf een uitdraai wordt.
   2. De melder weegt zichzelf niet. "URGENT!!!" verandert niets aan de
      prioriteit; de berekening doet dat, en haar opbouw staat erbij.
   3. Wat NIET gemeten is, zegt dat het niet gemeten is. Geen nul, geen streepje.
   4. Een lid ziet alleen zijn eigen zaken, ook als hij een geldig zaaknummer
      van iemand anders raadt.
   5. De kantoorkant vraagt een zetel op naam -- de gedeelde kantoorcode opent
      wel de ruimte maar wijst niemand aan. */
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

const OFFICE_CODE = 'RTG-OFFICE';

async function opzet() {
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE } });
  const p = post(srv.base);
  const lid = await p('/api/auth/register', { name: 'Service Lid', email: 'servicelid@x.nl',
    phone: '0612340001', password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  const balie = await kantoorAlsPersoon(srv.base);
  return { srv, p, lid: lid.body.token, balie };
}

test('een zaak draagt een verwijzing en nooit de gegevens erachter', async () => {
  const o = await opzet();
  try {
    const r = await o.p('/api/service/open', {
      onderwerp: 'betaling', titel: 'Mijn uitbetaling is niet aangekomen',
      tekst: 'Sinds gisteren staat hij op pending.',
      betrokken: { soort: 'betaling', code: 'PAY-829192', bedrag: 81000, iban: 'NL00BANK0123456789' }
    }, o.lid);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
    const b = r.body.zaak.betrokken;
    assert.deepEqual(Object.keys(b).sort(), ['code', 'soort'],
      'de zaak draagt meer dan soort en code: ' + JSON.stringify(b));
    assert.equal(b.code, 'PAY-829192');
    assert.ok(!JSON.stringify(r.body).includes('NL00BANK'), 'het IBAN reisde mee in de zaak');
  } finally { await stop(o.srv); }
});

test('de melder weegt zichzelf niet: schreeuwen verandert de prioriteit niet', async () => {
  const o = await opzet();
  try {
    const stil = await o.p('/api/service/open', { onderwerp: 'anders', titel: 'Waar vind ik mijn factuur' }, o.lid);
    const hard = await o.p('/api/service/open', { onderwerp: 'anders', titel: 'URGENT!!! DIT MOET NU!!!',
      prioriteit: 'P0', urgentie: 'zwaar', impact: 'zwaar', omvang: 'zwaar', geld: 'zwaar' }, o.lid);
    assert.equal(stil.body.zaak.prioriteit, 'P4');
    /* De client MAG termen meesturen (dat is wat het formulier vraagt), maar
       geen prioriteit. P0 is met opzet niet uit termen bereikbaar: dat is een
       menselijk besluit. */
    assert.notEqual(hard.body.zaak.prioriteit, 'P0',
      'een melder kon zichzelf op P0 zetten; dat hoort een mens te doen');
  } finally { await stop(o.srv); }
});

test('wat niet gemeten is, zegt dat het niet gemeten is', async () => {
  const o = await opzet();
  try {
    const r = await o.p('/api/service/open', { onderwerp: 'app', titel: 'Het scherm blijft leeg' }, o.lid);
    const d = await o.p('/api/service/zaak', { id: r.body.zaak.id }, o.lid);
    const k = d.body.zaak.klokken;
    assert.equal(k.eersteReactie.nietGemeten, true, 'er stond een reactietijd zonder reactie');
    assert.ok(k.eersteReactie.waarom, 'nietGemeten zonder reden is een streepje met opsmuk');
    assert.equal(k.eersteReactie.minuten, undefined, 'een niet-gemeten klok droeg toch een getal');
    assert.equal(k.menselijkeReactie.nietGemeten, true);
    assert.equal(k.wachtOpMelder.minuten, 0, 'nul is hier een echt antwoord en hoort er te staan');
  } finally { await stop(o.srv); }
});

test('een lid ziet alleen zijn eigen zaken', async () => {
  const o = await opzet();
  try {
    const mijn = await o.p('/api/service/open', { onderwerp: 'reis', titel: 'Mijn boeking staat dubbel' }, o.lid);
    const ander = await o.p('/api/auth/register', { name: 'Ander Lid', email: 'anderlid@x.nl',
      phone: '0612340002', password: 'geheim123', geboortedatum: '1991-02-02', pasApp: 'rtg' });
    const gluur = await o.p('/api/service/zaak', { id: mijn.body.zaak.id }, ander.body.token);
    assert.equal(gluur.status, 404, 'een ander lid kon een zaak openen met alleen het nummer');
    const praat = await o.p('/api/service/bericht', { id: mijn.body.zaak.id, tekst: 'hallo daar' }, ander.body.token);
    assert.equal(praat.status, 404, 'een ander lid kon in een vreemde zaak schrijven');
  } finally { await stop(o.srv); }
});

test('de kantoorkant vraagt een zetel op naam, niet de gedeelde kantoorcode', async () => {
  const o = await opzet();
  try {
    const kantoor = await o.p('/api/office/login', { code: OFFICE_CODE });
    assert.ok(kantoor.body.token, 'de gedeelde code geeft wel een kantoorsessie');
    const r = await o.p('/api/office/service/wachtrij', {}, kantoor.body.token);
    assert.equal(r.status, 403, 'de wachtrij ging open met alleen de gedeelde code');
    assert.match(r.body.error, /zetel/i, 'de weigering legt niet uit wat er ontbreekt');

    const metZetel = await o.p('/api/office/service/wachtrij', {}, o.balie);
    assert.equal(metZetel.status, 200, JSON.stringify(metZetel.body).slice(0, 200));
    assert.ok(metZetel.body.tel, 'de wachtrij komt zonder tellingen terug');
  } finally { await stop(o.srv); }
});

test('de klok stopt terwijl RTG op de melder wacht', async () => {
  const o = await opzet();
  try {
    const z = (await o.p('/api/service/open', { onderwerp: 'bestelling', titel: 'Mijn bestelling kwam niet aan' }, o.lid)).body.zaak;
    await o.p('/api/office/service/bericht', { id: z.id, tekst: 'Wat is het bezorgadres?' }, o.balie);
    await o.p('/api/office/service/stand', { id: z.id, naar: 'wachtOpMelder', notitie: 'adres gevraagd' }, o.balie);
    await o.p('/api/service/bericht', { id: z.id, tekst: 'Kerkstraat 1' }, o.lid);
    const d = await o.p('/api/service/zaak', { id: z.id }, o.lid);
    assert.equal(d.body.zaak.klokken.wachtOpMelder.perioden, 1,
      'de wachtperiode op de melder is niet geteld: ' + JSON.stringify(d.body.zaak.klokken));
    /* En de stand loopt weer zodra de melder antwoordt -- anders blijft een zaak
       waarin de melder net heeft gereageerd voor altijd "wacht op de melder". */
    assert.equal(d.body.zaak.stand, 'inBehandeling', 'de zaak bleef op wachten staan na antwoord van de melder');
  } finally { await stop(o.srv); }
});

test('een klacht aan de balie krijgt een envelop, en blijft een klacht', async () => {
  const o = await opzet();
  try {
    const st = await o.p('/api/state', {}, o.lid);
    const codenaam = st.body.state.user.codename;
    const gevonden = await o.p('/api/office/balie/zoek', { codenaam }, o.balie);
    const id = gevonden.body.treffers[0].id;
    const k = await o.p('/api/office/balie/klacht', { id, soort: 'betaling',
      tekst: 'De medewerker aan de telefoon was onbeschoft.' }, o.balie);
    assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 200));
    assert.ok(k.body.zaak, 'de klacht kreeg geen servicezaak als envelop');

    const d = await o.p('/api/office/service/zaak', { id: k.body.zaak }, o.balie);
    assert.equal(d.body.zaak.soort, 'klacht');
    assert.ok(d.body.zaak.koppelingenLijst.some(x => x.soort === 'klacht' && x.code === k.body.klacht.id),
      'de envelop wijst niet terug naar de klacht');

    /* DE KERN VAN DEZE TOETS. De zaak sluiten sluit de KLACHT niet. Anders
       verdwijnt "de medewerker was onbeschoft" op het moment dat de betaling
       alsnog rondkomt. */
    await o.p('/api/office/service/stand', { id: k.body.zaak, naar: 'opgelost' }, o.balie);
    const status = await o.p('/api/office/balie/klacht/status', { klachtId: k.body.klacht.id, status: 'open' }, o.balie);
    assert.equal(status.body.klacht.status, 'open', 'de klacht liep mee met de zaak');
  } finally { await stop(o.srv); }
});

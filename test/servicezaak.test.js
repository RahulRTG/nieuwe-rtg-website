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

test('de operationele stand van een zaak gaat pas open met een machtiging', async () => {
  const o = await opzet();
  try {
    const z = (await o.p('/api/supplier/service/open',
      { onderwerp: 'zaak', titel: 'Onze werkruimte doet raar' }, o.zaakToken)).body.zaak;

    /* ZONDER MACHTIGING STAAT ER NIET NIETS, MAAR DE REDEN. Een leeg vak wordt
       ingevuld met iemands eigen aanname. */
    const dicht = await o.p('/api/office/service/zaak', { id: z.id }, o.balie);
    assert.equal(dicht.body.zaakstand.open, false, 'de operationele stand stond zomaar open');
    assert.match(dicht.body.zaakstand.waarom, /machtiging/i, 'er staat geen reden waarom hij dicht is');
    /* Het BASISprofiel blijft wel open: een medewerker moet weten met wie hij
       praat zonder eerst iets te vragen. */
    assert.equal(dicht.body.zaakprofiel.code, 'KIKUNOI');

    const v = await o.p('/api/office/service/bevestiging/vraag',
      { id: z.id, capabilities: ['organisatie.stand'], reden: 'de werkruimte reageert niet sinds vanmorgen' }, o.balie);
    const wacht = await o.p('/api/supplier/service/bevestigingen', {}, o.zaakToken);
    const ok = await o.p('/api/supplier/service/bevestig', { id: wacht.body.verzoeken[0].id }, o.zaakToken);
    assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));

    /* EN NU GAAT ER ECHT IETS DOOR DE POORT. Dit is de eerste aanroeper van
       magNu(); daarvoor legde de machtiging toestemming vast en opende hij
       niets -- niet voor een AI en ook niet voor een mens. */
    const open = await o.p('/api/office/service/zaak',
      { id: z.id, machtiging: ok.body.machtiging.id }, o.balie);
    assert.equal(open.body.zaakstand.open, true, JSON.stringify(open.body.zaakstand).slice(0, 200));
    assert.equal(typeof open.body.zaakstand.bestellingenOpen, 'boolean');

    /* Een machtiging van deze zaak opent niets bij een andere zaak. */
    const ander = (await o.p('/api/supplier/service/open',
      { onderwerp: 'zaak', titel: 'Tweede melding' }, o.zaakToken)).body.zaak;
    const kruis = await o.p('/api/office/service/zaak',
      { id: ander.id, machtiging: ok.body.machtiging.id }, o.balie);
    assert.equal(kruis.body.zaakstand.open, false, 'een machtiging van zaak A opende zaak B');
  } finally { await stop(o.srv); }
});

test('een AI krijgt alleen de actieve capability; verwijderde namen maken geen machtiging', async () => {
  const o = await opzet();
  try {
    const z = (await o.p('/api/supplier/service/open',
      { onderwerp: 'zaak', titel: 'Onze werkruimte reageert niet' }, o.zaakToken)).body.zaak;
    /* Op moduleniveau, want een AI vraagt niet langs de kantoorroute: die draagt
       de sleutel van een MENS uit de sessie, en juist daarom kan niemand zich
       voordoen als machine. */
    const crypto = require('crypto');
    const db = { data: {} };
    const zaken = require('../server/kern/service/zaak')({ db, save: () => {}, crypto });
    const mach = require('../server/kern/service/machtiging')({ db, save: () => {}, crypto, zaken });
    const zz = zaken.open({ melder: 'zaak-X', doelgroep: 'zaak', onderwerp: 'zaak', titel: 'Werkruimte' }).zaak;

    const v = mach.verleen({ zaakId: zz.id, mens: 'ai:onderzoeker',
      capabilities: ['organisatie.stand', 'identiteit.uitdaging', 'identiteit.openen'],
      reden: 'de AI kijkt mee met dit werkruimteprobleem' });
    assert.deepEqual(v.machtiging.capabilities, ['organisatie.stand'],
      'de AI kreeg een capability zonder lezer: ' + JSON.stringify(v.machtiging.capabilities));
    assert.ok(v.geweigerd.includes('identiteit.uitdaging'), 'de gewone verwijderde capability wordt niet gemeld');
    assert.ok(v.geweigerd.includes('identiteit.openen'), 'de weigering wordt niet gemeld');

    /* Een vroegere zware naam kan niet meer tot de ceremonie komen: zonder
       echte lezer ontstaat er helemaal geen machtiging om bij te tekenen. */
    const vanMens = mach.verleen({ zaakId: zz.id, mens: 'nadia',
      capabilities: ['identiteit.openen'], reden: 'account recovery aan de balie' });
    assert.equal(vanMens.status, 403);
    assert.deepEqual(vanMens.geweigerd, ['identiteit.openen']);
    assert.deepEqual(mach.ZWAAR, {});
    assert.equal(z.doelgroep, 'zaak');
  } finally { await stop(o.srv); }
});

/* DE DERDE AI-ROL, VAN VRAAG TOT POORT. Het besluit van de eigenaar was: de AI
   mag inzien, maar alleen na bevestiging door het lid. Deze toets legt die hele
   weg af en houdt vooral de twee dingen vast die stil kapot kunnen gaan: dat er
   VOOR de bevestiging niets opengaat, en dat de AI geen machtiging kan lenen die
   op naam van een mens staat. */
test('de AI-onderzoeker opent pas iets nadat het lid heeft bevestigd, en leent nooit', async () => {
  const crypto = require('crypto');
  const db = { data: {} };
  const save = () => {};
  const zaken = require('../server/kern/service/zaak')({ db, save, crypto });
  const loop = require('../server/kern/service/loop')({ zaken, save });
  const mach = require('../server/kern/service/machtiging')({ db, save, crypto, zaken });
  const bev = require('../server/kern/service/bevestiging')({ db, save, crypto, zaken, machtigingen: mach });
  const ond = require('../server/kern/service/onderzoeker')({ zaken, loop, machtigingen: mach, bevestiging: bev, save });

  const z = zaken.open({ melder: 'lid-77', doelgroep: 'lid', onderwerp: 'zaak',
    titel: 'Mijn werkruimte reageert niet' }).zaak;
  /* `teVragen` en niet `benodigd`: wat de ZETEL al verleent hoort niet in een
     bevestiging, en `zaak.lezen` was de eerste die `benodigd` opleverde. Deze
     toets koos dus precies de bevoegdheid die er niet meer in thuishoort. */
  const cap = require('../server/kern/service/router').teVragen(z.team).find(c => !mach.ZWAAR[c]);
  assert.ok(cap, 'dit team kan het lid nergens toestemming voor vragen');

  /* Wat de AI zonder iets al heeft, is de zaak zelf en verder niets. */
  const s = ond.stof(z.id);
  assert.ok(s.stof.tijdlijn, 'de onderzoeker ziet de zaak niet');
  assert.ok(!('melder' in s.stof), 'de onderzoeker kreeg de melder mee');

  const v = ond.vraagToegang({ zaakId: z.id, capabilities: [cap, 'identiteit.openen'],
    reden: 'om te zien waar de werkruimte vastloopt' });
  assert.ok(v.ok, JSON.stringify(v));
  assert.equal(v.machine, true, 'de aanvraag noemt zichzelf geen machine');
  assert.equal(v.bevestiging.machine, true, 'het lid ziet niet dat er een machine vraagt');
  assert.ok(v.nietGevraagd.some(u => u.capability === 'identiteit.openen'),
    'een niet-actieve capability werd stilzwijgend meegevraagd of weggelaten');

  /* VOOR de bevestiging is er geen machtiging, dus is er niets te openen. */
  assert.equal(v.bevestiging.machtiging, null, 'er ontstond een machtiging zonder het lid');
  assert.equal(ond.poort(null, cap, { zaakId: z.id }).mag, false);

  const b = bev.bevestig(v.bevestiging.id, { melder: 'lid-77' });
  assert.ok(b.ok, JSON.stringify(b));
  assert.equal(ond.poort(b.machtiging.id, cap, { zaakId: z.id }).mag, true, 'de poort ging niet open na bevestiging');

  /* En hij leent niet: een machtiging op naam van een mens opent voor de AI
     niets, ook al draagt hij exact dezelfde capability. */
  const vanMens = mach.verleen({ zaakId: z.id, mens: 'nadia', capabilities: [cap],
    reden: 'nadia kijkt zelf naar dit werkruimteprobleem' });
  const geleend = ond.poort(vanMens.machtiging.id, cap, { zaakId: z.id });
  assert.equal(geleend.mag, false, 'de AI leende de machtiging van een mens');
  assert.match(geleend.waarom, /mens/i);

  /* EN EEN TWEEDE VRAAG SCHRIJFT NIETS. De bevestiging hergebruikt een lopend
     verzoek; de tijdlijnregel ernaast deed dat eerst niet en liep vol met een
     handeling die niet gebeurde. Gevonden met een kale ronde, niet met lezen. */
  const z2 = zaken.open({ melder: 'lid-78', doelgroep: 'lid', onderwerp: 'zaak',
    titel: 'Mijn werkruimte reageert ook niet' }).zaak;
  const vraag = () => ond.vraagToegang({ zaakId: z2.id, capabilities: [cap],
    reden: 'om te zien waar de werkruimte vastloopt' });
  vraag();
  const na1 = zaken.vind(z2.id).tijdlijn.length;
  const tweede = vraag();
  assert.equal(tweede.hergebruikt, true, 'er ontstond een tweede verzoek voor dezelfde vraag');
  assert.equal(zaken.vind(z2.id).tijdlijn.length, na1,
    'de tweede vraag schreef opnieuw op de tijdlijn terwijl er geen tweede verzoek was');
});

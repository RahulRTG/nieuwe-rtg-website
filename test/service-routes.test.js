/* DE ZESTIEN ROUTES VAN RTG SERVICE DIE NERGENS VOLUIT STONDEN.

   WAAROM DIT BESTAND BESTAAT. scripts/deltapoort.js eist dat een nieuw endpoint
   in DEZELFDE wijziging een toets krijgt -- een endpoint dat later een toets
   krijgt, krijgt hem niet. De poort zoekt LETTERLIJK naar het routepad in
   test/*.js (scripts/lib/dekkingsindex.js), en zestien routes van de servicelaag
   kwamen in geen enkel toetsbestand voluit voor. Sommige ervan draaiden wel
   degelijk mee -- op moduleniveau, of via een helper die het pad plakte -- maar
   een pad dat de poort niet ziet, is voor de poort een pad zonder toets. Hier
   staan ze alle zestien als tekenreeks, en elk wordt over HTTP aangeroepen tegen
   een echte server.

   DE VOLGORDE IS DIE WAARIN EEN MENS ZE TEGENKOMT:

   1. de deur: zonder sessie, met de verkeerde rol, en met alleen de gedeelde
      kantoorcode (die opent de ruimte, maar wijst niemand aan);
   2. het lid: wat er te kiezen valt, en een bevestiging WEIGEREN -- waarna de
      terugvalcode van datzelfde verzoek niets meer opent, en een nieuw verzoek
      met de code wel;
   3. het kantoor aan een zaak: eigenaar, gewicht, koppeling;
   4. de tweede handtekening onder zwaar werk, en nooit van de aanvrager zelf;
   5. de AI-onderzoeker: wat hij zou kunnen, en wat hij vraagt -- zonder dat er
      iets opengaat voordat het lid drukt;
   6. de borden die over zaken heen kijken: kwaliteit, foutsignaal, kanalen;
   7. de zaak (leverancier): keuzes, weigeren, en de persoonlijke stand die na
      een koppeling een storing noemt en na een herstelmelding zegt dat WIJ dat
      meldden -- niet dat een meter het bevestigt.

   ELKE BEWERING GAAT OVER IETS ECHTS IN HET ANTWOORD: een stand, een veld, een
   geweigerde reden. Waar een lijst leeg hoort te zijn, staat eerst vast dat
   dezelfde lijst even daarvoor NIET leeg was (scripts/tandeloos.js).

   MUTATIES, GEDAAN EN TERUGGEDRAAID -- een toets die je niet hebt zien zakken
   is geen toets (LAT.md). Elke mutatie is op een schone kopie van HEAD
   uitgevoerd, de gerichte toets is rood gezien, en de bron is byte voor byte
   hersteld:

   - kern/service/machtiging.js tekenBij(): de regel `if (w === m.mens) return
     403` weggehaald. Toets 4 zakte: de aanvrager kreeg 200 op zijn eigen tweede
     handtekening in plaats van 403.
   - kern/service/bevestiging.js weiger(): `b.geweigerdAt = nu()` weggehaald.
     Toets 2 zakte: de bevestiging stond na het weigeren op 'open' in plaats van
     'geweigerd'.
   - routes/service-kantoor.js: `balieAuth` van /api/office/service/eigenaar
     gehaald. Toets 1 zakte: met alleen de gedeelde kantoorcode kwam het verzoek
     bij de handler (404 op de onbekende zaak) in plaats van bij de deur (403).
   - kern/service/onderzoeker.js mag(): de ZWAAR-tak weggehaald. Toets 5 zakte:
     bank.gegevens stond op `kan: true`.
   - kern/service/persoonlijk.js: `wij` altijd op 'gemeld-hersteld'. Toets 7
     zakte op de stand VOOR de herstelmelding ('gemeld-hersteld' waar 'onbekend'
     hoort). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const OFFICE_CODE = 'RTG-OFFICE';
const REDEN = 'de uitbetaling staat sinds gisteren op pending';

const post = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

/* Dezelfde weg als test/servicezaak.test.js: de manager van een zaak uit de
   seed logt in met zijn pin. */
async function alsZaak(p, code) {
  const r = await p('/api/supplier/roster', { code });
  const man = (r.body.staff || []).find(s => s.role === 'manager');
  assert.ok(man, 'geen manager bij ' + code + ': ' + JSON.stringify(r.body).slice(0, 160));
  const lg = await p('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(lg.body.token, 'de manager van ' + code + ' logt in: ' + JSON.stringify(lg.body).slice(0, 160));
  return lg.body.token;
}

async function lidMet(p, naam, email, telefoon) {
  const r = await p('/api/auth/register', { name: naam, email, phone: telefoon,
    password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
  assert.ok(r.body.token, 'registratie van ' + email + ': ' + JSON.stringify(r.body).slice(0, 160));
  return r.body.token;
}

async function opzet() {
  /* LOCAL_AI_URL leeg, met opzet: het kanalenbord (toets 6) hoort dan te zeggen
     dat ondertitelen NIET beschikbaar is, en wat dat voor een dove deelnemer
     betekent. Zou de omgeving van de machine hier een modelserver aandragen,
     dan toetste dit bestand iets anders op elke machine. */
  const srv = await startServer({ env: { SMTP_URL: '', OFFICE_CODE, LOCAL_AI_URL: '', LOCAL_AI_BASE_URL: '' } });
  const p = post(srv.base);
  const lid = await lidMet(p, 'Route Lid', 'routelid@x.nl', '0612340016');
  const balie = await kantoorAlsPersoon(srv.base);
  assert.ok(balie, 'geen baliezetel op naam te krijgen');
  return { srv, p, lid, balie };
}

/* Een TWEEDE mens aan de balie. kantoorAlsPersoon() levert de eigenaar, en twee
   keer aanroepen levert twee keer dezelfde sleutel; de tweede handtekening eist
   een ANDER mens. Dus de weg die een medewerker in het echt loopt: een eigen
   account, een zetel van de eigenaar, en de kantoorrol starten. */
async function tweedeMens(o) {
  const tok = await lidMet(o.p, 'Tweede Mens', 'tweedemens@x.nl', '0612340017');
  const st = await o.p('/api/state', {}, tok);
  const codenaam = st.body.state && st.body.state.user && st.body.state.user.codename;
  assert.ok(codenaam, 'het tweede account heeft geen codenaam');
  const zoek = await o.p('/api/office/balie/zoek', { codenaam }, o.balie);
  const id = ((zoek.body.treffers || [])[0] || {}).id;
  assert.ok(id, 'de balie vindt het tweede account niet: ' + JSON.stringify(zoek.body).slice(0, 160));
  const zetel = await o.p('/api/office/balie/zetel', { key: 'user-' + id }, o.balie);
  assert.equal(zetel.status, 200, 'de zetel: ' + JSON.stringify(zetel.body).slice(0, 160));
  const k = await o.p('/api/account/koppel', { soort: 'kantoor', code: OFFICE_CODE }, tok);
  assert.equal(k.status, 200, 'koppelen: ' + JSON.stringify(k.body).slice(0, 160));
  const s = await o.p('/api/account/start', { rol: 'kantoor' }, tok);
  assert.ok(s.body.token, 'de kantoorrol start niet: ' + JSON.stringify(s.body).slice(0, 160));
  return { token: s.body.token, key: 'user-' + id };
}

/* ------------------------------------------------------------- 1. de deur -- */
const ROUTES = {
  lid: ['/api/service/keuzes', '/api/service/weiger'],
  zaak: ['/api/supplier/service/keuzes', '/api/supplier/service/weiger', '/api/supplier/service/stand'],
  kantoor: ['/api/office/service/ai/mag', '/api/office/service/ai/vraag',
    '/api/office/service/kwaliteit', '/api/office/service/foutsignaal/koppel',
    '/api/office/service/kanalen', '/api/office/service/eigenaar', '/api/office/service/weeg',
    '/api/office/service/koppel', '/api/office/service/bevestiging/code',
    '/api/office/service/machtiging/tekenbij', '/api/office/service/machtiging/intrek']
};

test('de deur: zonder sessie, met de verkeerde rol, en met alleen de gedeelde kantoorcode', async () => {
  const o = await opzet();
  try {
    const alle = [].concat(ROUTES.lid, ROUTES.zaak, ROUTES.kantoor);
    assert.equal(alle.length, 16, 'dit bestand hoort precies de zestien routes van de deltapoort te dragen');

    for (const pad of alle) {
      const r = await o.p(pad, { id: 'SUP-0000', code: '000000' });
      assert.equal(r.status, 401, pad + ' zonder sessie gaf ' + r.status + ': ' + JSON.stringify(r.body).slice(0, 120));
      assert.ok(r.body.error, pad + ' weigert zonder reden');
    }

    /* De verkeerde rol is geen sessie. Een lid komt niet langs de kantoorpoort,
       en een zaak niet langs de ledenpoort -- de poorten zijn per rol en
       herkennen elkaars tokens niet als "ook ingelogd". */
    const zaakTok = await alsZaak(o.p, 'KIKUNOI');
    for (const pad of ROUTES.kantoor) {
      const r = await o.p(pad, { id: 'SUP-0000' }, o.lid);
      assert.equal(r.status, 401, pad + ' ging open voor een lid: ' + r.status);
    }
    for (const pad of ROUTES.lid) {
      const r = await o.p(pad, { id: 'BEV-0000' }, zaakTok);
      assert.equal(r.status, 401, pad + ' ging open voor een zaak: ' + r.status);
    }

    /* De gedeelde code opent de ruimte, maar wijst niemand aan. Werk aan de
       zaak van een lid hoort herleidbaar te zijn tot een mens, dus 403 met de
       reden erbij -- en op ELKE kantoorroute van deze laag, niet alleen op de
       wachtrij die test/service.test.js al bewaakt. */
    const gedeeld = await o.p('/api/office/login', { code: OFFICE_CODE });
    assert.ok(gedeeld.body.token, 'de gedeelde code geeft wel een kantoorsessie');
    for (const pad of ROUTES.kantoor) {
      const r = await o.p(pad, { id: 'SUP-0000' }, gedeeld.body.token);
      assert.equal(r.status, 403, pad + ' ging open met alleen de gedeelde code: ' + r.status);
      assert.match(String(r.body.error), /zetel/i, pad + ' legt niet uit dat er een zetel ontbreekt');
    }
  } finally { await stop(o.srv); }
});

/* ------------------------------------------------------------- 2. het lid -- */
test('het lid: de keuzes noemen zijn mens, en weigeren maakt de terugvalcode waardeloos', async () => {
  const o = await opzet();
  try {
    const k = await o.p('/api/service/keuzes', {}, o.lid);
    assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 200));
    assert.ok(k.body.soorten.some(s => s.id === 'ondersteuning'), 'de soorten missen "ondersteuning"');
    assert.ok(k.body.onderwerpen.some(s => s.id === 'betaling'), 'de onderwerpen missen "betaling"');
    assert.ok(k.body.kanalen.some(c => c.id === 'app'), 'de gebouwde kanalen missen de app');
    /* De kanalen die er NOG NIET zijn gaan mee, met hun reden: anders leest een
       scherm "telefoon bestaat niet" in plaats van "is nog niet aangesloten". */
    const tel = k.body.nogNiet.find(n => n.id === 'telefoon');
    assert.ok(tel && tel.waarom, 'het niet-gebouwde kanaal "telefoon" ontbreekt of draagt geen reden');
    assert.match(String(k.body.hulpAdres), /^hulp@/, 'het serviceadres ontbreekt in de keuzes');
    /* De RTG Pass krijgt een mens -- een medewerker, en niet De Rechterhand. */
    assert.equal(k.body.mens.rechtstreeks, true);
    assert.equal(k.body.mens.team, 'leden');
    assert.doesNotMatch(String(k.body.mens.heet), /Rechterhand/);

    const z = (await o.p('/api/service/open', { onderwerp: 'betaling', titel: 'Mijn uitbetaling ontbreekt' }, o.lid)).body.zaak;
    const v = await o.p('/api/office/service/bevestiging/vraag',
      { id: z.id, capabilities: ['betaling.stand'], reden: REDEN }, o.balie);
    assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));
    const wacht = await o.p('/api/service/bevestigingen', {}, o.lid);
    assert.equal(wacht.body.verzoeken.length, 1, 'er stond niets klaar in de app');
    const verzoek = wacht.body.verzoeken[0];
    assert.match(String(verzoek.code), /^\d{6}$/);

    /* Een ander lid kan het verzoek niet weigeren: het staat op naam. */
    const ander = await lidMet(o.p, 'Ander Lid', 'anderlid@x.nl', '0612340018');
    const vreemd = await o.p('/api/service/weiger', { id: verzoek.id }, ander);
    assert.equal(vreemd.status, 403, 'een ander lid kon het verzoek weigeren');
    assert.match(String(vreemd.body.error), /niet op uw naam/i);

    const w = await o.p('/api/service/weiger', { id: verzoek.id }, o.lid);
    assert.equal(w.status, 200, JSON.stringify(w.body).slice(0, 200));
    assert.equal(w.body.bevestiging.stand, 'geweigerd');

    /* Na het weigeren is het verzoek dood: niet alsnog te bevestigen, weg uit
       de app, en de zes cijfers openen bij de medewerker niets meer. */
    const alsnog = await o.p('/api/service/bevestig', { id: verzoek.id }, o.lid);
    assert.equal(alsnog.status, 400);
    assert.match(String(alsnog.body.error), /geweigerd/);
    const leeg = await o.p('/api/service/bevestigingen', {}, o.lid);
    assert.equal(leeg.body.verzoeken.length, 0, 'een geweigerd verzoek bleef in de app staan');
    const dood = await o.p('/api/office/service/bevestiging/code', { code: verzoek.code }, o.balie);
    assert.equal(dood.status, 404, 'de code van een geweigerd verzoek opende iets: ' + JSON.stringify(dood.body).slice(0, 160));
    const niets = await o.p('/api/office/service/machtigingen', {}, o.balie);
    assert.equal(niets.body.tel.totaal, 0, 'er ontstond een machtiging zonder dat het lid iets bevestigde');

    /* De terugval die WEL werkt: een nieuw verzoek, het lid leest de cijfers
       voor, de medewerker typt ze in. Een keer -- de tweede keer is hij op. */
    const v2 = await o.p('/api/office/service/bevestiging/vraag',
      { id: z.id, capabilities: ['betaling.stand'], reden: REDEN }, o.balie);
    assert.equal(v2.status, 200, JSON.stringify(v2.body).slice(0, 200));
    assert.notEqual(v2.body.bevestiging.id, verzoek.id, 'het geweigerde verzoek werd hergebruikt');
    const code2 = (await o.p('/api/service/bevestigingen', {}, o.lid)).body.verzoeken[0].code;
    const kort = await o.p('/api/office/service/bevestiging/code', { code: 'abc' }, o.balie);
    assert.equal(kort.status, 400, 'iets anders dan zes cijfers werd als code aangenomen');
    const open = await o.p('/api/office/service/bevestiging/code', { code: code2 }, o.balie);
    assert.equal(open.status, 200, JSON.stringify(open.body).slice(0, 200));
    assert.deepEqual(open.body.machtiging.capabilities, ['betaling.stand']);
    assert.equal(open.body.bevestiging.via, 'code');
    const nogEens = await o.p('/api/office/service/bevestiging/code', { code: code2 }, o.balie);
    assert.equal(nogEens.status, 404, 'de code werkte een tweede keer');

    /* En intrekken: de machtiging bestaat nog (voor het journaal), maar geldt
       niet meer. */
    const geldig = await o.p('/api/office/service/machtigingen', {}, o.balie);
    assert.equal(geldig.body.machtigingen.length, 1);
    const weg = await o.p('/api/office/service/machtiging/intrek', { id: open.body.machtiging.id }, o.balie);
    assert.equal(weg.status, 200, JSON.stringify(weg.body).slice(0, 200));
    assert.equal(weg.body.machtiging.stand, 'ingetrokken');
    const na = await o.p('/api/office/service/machtigingen', {}, o.balie);
    assert.equal(na.body.machtigingen.length, 0, 'een ingetrokken machtiging telde nog als geldig');
    assert.equal(na.body.tel.totaal, 1, 'intrekken wiste de machtiging; het journaal hoort hem te houden');
    assert.equal(na.body.tel.geldig, 0);
    const spook = await o.p('/api/office/service/machtiging/intrek', { id: 'MCH-BESTAATNIET' }, o.balie);
    assert.equal(spook.status, 404);
  } finally { await stop(o.srv); }
});

/* ----------------------------------------------- 3. het kantoor aan een zaak -- */
test('het kantoor aan een zaak: eigenaar, gewicht met reden, en een koppeling die niets overtrekt', async () => {
  const o = await opzet();
  try {
    const z = (await o.p('/api/service/open', { onderwerp: 'bestelling', titel: 'Mijn bestelling kwam niet aan' }, o.lid)).body.zaak;

    /* Eigenaar zonder `wie` is de medewerker zelf -- de sleutel uit de sessie,
       en niet iets wat de client opgeeft. */
    const zelf = await o.p('/api/office/service/eigenaar', { id: z.id }, o.balie);
    assert.equal(zelf.status, 200, JSON.stringify(zelf.body).slice(0, 200));
    assert.match(String(zelf.body.zaak.eigenaar), /^user-\d+$/, 'de eigenaar is niet de mens uit de sessie');
    const nadia = await o.p('/api/office/service/eigenaar', { id: z.id, wie: 'nadia' }, o.balie);
    assert.equal(nadia.body.zaak.eigenaar, 'nadia');
    const onbekend = await o.p('/api/office/service/eigenaar', { id: 'SUP-BESTAATNIET' }, o.balie);
    assert.equal(onbekend.status, 404);
    /* De tijdlijn is de waarheid: elke wissel staat erin met van en naar. */
    const d1 = await o.p('/api/office/service/zaak', { id: z.id }, o.balie);
    const wissels = d1.body.zaak.tijdlijn.filter(r => r.wat === 'eigenaar');
    assert.equal(wissels.length, 2, 'de tijdlijn mist eigenaarswissels');
    assert.equal(wissels[1].van, zelf.body.zaak.eigenaar);
    assert.equal(wissels[1].naar, 'nadia');

    /* Het gewicht: de kern eist een reden, en de reden is niet voor de vorm --
       zonder redenen is de berekening nooit te verbeteren. */
    const zonder = await o.p('/api/office/service/weeg', { id: z.id, naar: 'P1' }, o.balie);
    assert.equal(zonder.status, 400, 'een overschrijving zonder reden ging door');
    assert.match(String(zonder.body.error), /waarom/i);
    const fout = await o.p('/api/office/service/weeg', { id: z.id, naar: 'P9', reden: 'twintig zaken kunnen niet afrekenen' }, o.balie);
    assert.equal(fout.status, 400);
    assert.match(String(fout.body.error), /Kies een prioriteit/);
    const w = await o.p('/api/office/service/weeg', { id: z.id, naar: 'P1', reden: 'twintig zaken kunnen niet afrekenen' }, o.balie);
    assert.equal(w.status, 200, JSON.stringify(w.body).slice(0, 200));
    assert.equal(w.body.zaak.prioriteit, 'P1');
    const d2 = await o.p('/api/office/service/zaak', { id: z.id }, o.balie);
    assert.equal(d2.body.zaak.prioriteitOpbouw.door, 'mens');
    assert.equal(d2.body.zaak.prioriteitOpbouw.berekendWas, z.prioriteit,
      'de berekening ernaast is weg; dan is niet meer te zien of de mens afweek');

    /* De koppeling: een soort en een code, en niets meer. */
    const half = await o.p('/api/office/service/koppel', { id: z.id, soort: 'incident' }, o.balie);
    assert.equal(half.status, 400, 'een koppeling zonder code ging door');
    const k = await o.p('/api/office/service/koppel', { id: z.id, soort: 'incident', code: 'RTG-0042' }, o.balie);
    assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 200));
    assert.equal(k.body.zaak.koppelingen, 1);
    const nog = await o.p('/api/office/service/koppel', { id: z.id, soort: 'incident', code: 'RTG-0042' }, o.balie);
    assert.equal(nog.body.let, 'Al gekoppeld.');
    assert.equal(nog.body.zaak.koppelingen, 1, 'dezelfde koppeling kwam er twee keer in');
    const d3 = await o.p('/api/office/service/zaak', { id: z.id }, o.balie);
    assert.deepEqual(d3.body.zaak.koppelingenLijst, [{ soort: 'incident', code: 'RTG-0042' }],
      'de koppeling draagt meer dan een soort en een code');
    /* En het lid ziet hem in zijn eigen stand -- als "onbekend", want Service
       weet alleen wat zij zelf heeft gemeld. */
    const st = await o.p('/api/service/stand', {}, o.lid);
    assert.equal(st.body.raakt.length, 1, 'het lid ziet de storing die zijn zaak raakt niet');
    assert.equal(st.body.raakt[0].incident, 'RTG-0042');
    assert.equal(st.body.raakt[0].wij, 'onbekend');
  } finally { await stop(o.srv); }
});

/* ----------------------------------------------- 4. de tweede handtekening -- */
test('zwaar werk vraagt een tweede mens over de echte route, en nooit de aanvrager zelf', async () => {
  const o = await opzet();
  try {
    const z = (await o.p('/api/service/open', { onderwerp: 'account', titel: 'Ik kom niet meer in mijn account' }, o.lid)).body.zaak;
    assert.equal(z.team, 'toegang');
    const v = await o.p('/api/office/service/bevestiging/vraag',
      { id: z.id, capabilities: ['identiteit.openen'], reden: 'account recovery, het lid meldt zich aan de balie' }, o.balie);
    assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));
    const verzoek = (await o.p('/api/service/bevestigingen', {}, o.lid)).body.verzoeken[0];
    const ok = await o.p('/api/service/bevestig', { id: verzoek.id }, o.lid);
    assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));
    const m = ok.body.machtiging;
    assert.deepEqual(m.zwaar, ['identiteit.openen'], 'zwaar werk werd niet als zwaar herkend');
    assert.equal(m.tweedeMens, null);

    /* De aanvrager zelf: nee, met de reden. De controle staat in de kern en
       niet in de route, zodat een tweede ingang hem niet kan omzeilen -- maar
       hij hoort wel over DEZE route te werken. */
    const zelf = await o.p('/api/office/service/machtiging/tekenbij', { id: m.id, reden: 'ik teken zelf wel even' }, o.balie);
    assert.equal(zelf.status, 403, 'de aanvrager kon zijn eigen tweede handtekening zetten');
    assert.match(String(zelf.body.error), /eigen tweede handtekening/i);

    const tweede = await tweedeMens(o);
    const bij = await o.p('/api/office/service/machtiging/tekenbij', { id: m.id, reden: 'het lid staat voor mij aan de balie' }, tweede.token);
    assert.equal(bij.status, 200, JSON.stringify(bij.body).slice(0, 200));
    assert.equal(bij.body.machtiging.tweedeMens, tweede.key, 'de tweede handtekening staat niet op naam van de tweede mens');
    assert.equal(bij.body.machtiging.stand, 'geldig');

    const spook = await o.p('/api/office/service/machtiging/tekenbij', { id: 'MCH-BESTAATNIET' }, tweede.token);
    assert.equal(spook.status, 404);

    /* Na intrekking valt er niets meer bij te tekenen. */
    const weg = await o.p('/api/office/service/machtiging/intrek', { id: m.id }, o.balie);
    assert.equal(weg.body.machtiging.stand, 'ingetrokken');
    const laat = await o.p('/api/office/service/machtiging/tekenbij', { id: m.id }, tweede.token);
    assert.equal(laat.status, 400);
    assert.match(String(laat.body.error), /ingetrokken/);
  } finally { await stop(o.srv); }
});

/* ------------------------------------------------------- 5. de AI-onderzoeker -- */
test('de AI-onderzoeker zegt eerst wat hij niet kan, vraagt dan langs het lid, en opent niets', async () => {
  const o = await opzet();
  try {
    const z = (await o.p('/api/service/open', { onderwerp: 'betaling', titel: 'Waarom is mijn uitbetaling niet doorgekomen' }, o.lid)).body.zaak;
    assert.equal(z.team, 'betalingen');

    const mag = await o.p('/api/office/service/ai/mag',
      { id: z.id, capabilities: ['betaling.stand', 'bank.gegevens', 'lid.dossier'] }, o.balie);
    assert.equal(mag.status, 200, JSON.stringify(mag.body).slice(0, 200));
    assert.equal(mag.body.uitkomst.length, 3, 'niet elke gevraagde capability kreeg een uitkomst');
    const per = Object.fromEntries(mag.body.uitkomst.map(u => [u.capability, u]));
    assert.equal(per['betaling.stand'].kan, true);
    assert.equal(per['bank.gegevens'].kan, false, 'de AI kreeg zwaar werk in het vooruitzicht');
    assert.match(per['bank.gegevens'].waarom, /tweede MENS/);
    assert.equal(per['lid.dossier'].kan, false, 'de AI kreeg iets dat het team niet nodig heeft');
    assert.match(per['lid.dossier'].waarom, /niet nodig/);
    assert.deepEqual(mag.body.teVragen, ['betaling.stand']);
    const onbekend = await o.p('/api/office/service/ai/mag', { id: 'SUP-BESTAATNIET', capabilities: ['betaling.stand'] }, o.balie);
    assert.equal(onbekend.status, 404);

    /* Alleen zwaar werk gevraagd: dan valt er voor de AI niets te vragen, en
       dat staat er met de uitkomst erbij in plaats van als een lege lijst. */
    const niets = await o.p('/api/office/service/ai/vraag',
      { id: z.id, capabilities: ['bank.gegevens'], reden: 'om de rekening te controleren' }, o.balie);
    assert.equal(niets.status, 403);
    assert.match(String(niets.body.error), /niets te vragen/);
    assert.equal(niets.body.uitkomst.length, 1);

    const vraag = await o.p('/api/office/service/ai/vraag',
      { id: z.id, capabilities: ['betaling.stand', 'bank.gegevens', 'lid.dossier'], reden: 'om te zien waar de uitbetaling bleef steken' }, o.balie);
    assert.equal(vraag.status, 200, JSON.stringify(vraag.body).slice(0, 200));
    assert.equal(vraag.body.machine, true, 'de aanvraag noemt zichzelf geen machine');
    assert.equal(vraag.body.aanvrager, 'RTG AI (onderzoeker)');
    assert.deepEqual(vraag.body.bevestiging.capabilities, ['betaling.stand'], 'er werd meer gevraagd dan de AI mag');
    assert.equal(vraag.body.bevestiging.machtiging, null, 'er ontstond een machtiging voordat het lid drukte');
    assert.equal(vraag.body.nietGevraagd.length, 2, 'wat niet gevraagd werd, wordt niet gemeld');
    assert.equal(JSON.stringify(vraag.body).includes('"code"'), false, 'de terugvalcode lekte naar de kantoorkant');

    /* Het lid ziet dat er een machine vraagt -- als vlag, afgeleid uit het
       voorvoegsel dat niemand zelf kan zetten. */
    const wacht = await o.p('/api/service/bevestigingen', {}, o.lid);
    assert.equal(wacht.body.verzoeken.length, 1, 'er stond niets klaar in de app van het lid');
    assert.equal(wacht.body.verzoeken[0].machine, true, 'het lid ziet niet dat er een machine vraagt');
    assert.match(wacht.body.verzoeken[0].reden, /RTG AI/);

    /* Twee keer vragen is een verzoek. */
    const nog = await o.p('/api/office/service/ai/vraag',
      { id: z.id, capabilities: ['betaling.stand'], reden: 'om te zien waar de uitbetaling bleef steken' }, o.balie);
    assert.equal(nog.body.hergebruikt, true, 'er ontstond een tweede verzoek voor dezelfde vraag');
    assert.equal((await o.p('/api/service/bevestigingen', {}, o.lid)).body.verzoeken.length, 1);

    /* En pas als het lid drukt, staat er een machtiging -- op naam van de AI. */
    const ok = await o.p('/api/service/bevestig', { id: wacht.body.verzoeken[0].id }, o.lid);
    assert.equal(ok.status, 200, JSON.stringify(ok.body).slice(0, 200));
    assert.deepEqual(
      { mens: ok.body.machtiging.mens, capabilities: ok.body.machtiging.capabilities, zwaar: ok.body.machtiging.zwaar },
      { mens: 'ai:onderzoeker', capabilities: ['betaling.stand'], zwaar: [] },
      'de machtiging van de AI staat niet op naam van de machine, of draagt iets anders dan het lid las');
  } finally { await stop(o.srv); }
});

/* ------------------------------------------------------------- 6. de borden -- */
test('de borden: kwaliteit zonder verzonnen getal, een foutsignaal aan een zaak, en de ingangen', async () => {
  const o = await opzet();
  try {
    const open = (onderwerp, titel, extra) => o.p('/api/service/open', Object.assign({ onderwerp, titel }, extra || {}), o.lid);
    await open('betaling', 'Mijn uitbetaling ontbreekt');
    await open('betaling', 'Mijn tweede uitbetaling ontbreekt ook');
    const scherm = (await open('app', 'Het scherm blijft leeg', { betrokken: { soort: 'scherm', code: '/apps/geld.html' } })).body.zaak;
    assert.equal(scherm.team, 'techniek');

    /* KWALITEIT. Drie zaken, dus onder de drempel: er staat een reden en geen
       percentage. En wat er met opzet niet gemeten wordt, staat in het antwoord. */
    const kw = await o.p('/api/office/service/kwaliteit', {}, o.balie);
    assert.equal(kw.status, 200, JSON.stringify(kw.body).slice(0, 200));
    assert.equal(kw.body.zaken, 3);
    assert.equal(kw.body.zonderOpnieuwUitleggen.nietTeZeggen, true, 'er staat een verhouding over te weinig zaken');
    assert.match(kw.body.zonderOpnieuwUitleggen.waarom, /menselijke overdracht/);
    assert.equal(kw.body.herstelMediaanMinuten.nietTeZeggen, true);
    assert.match(kw.body.nietGemeten.tevredenheid, /niets gevraagd/);
    assert.match(kw.body.nietGemeten.afhandeltijdPerMedewerker, /ranglijst/);
    const techniek = await o.p('/api/office/service/kwaliteit', { team: 'techniek' }, o.balie);
    assert.equal(techniek.body.zaken, 1, 'het teamfilter werkt niet');
    const betalingen = await o.p('/api/office/service/kwaliteit', { team: 'betalingen' }, o.balie);
    assert.equal(betalingen.body.zaken, 2);
    const morgen = await o.p('/api/office/service/kwaliteit', { sinds: new Date(Date.now() + 86400000).toISOString() }, o.balie);
    assert.equal(morgen.body.zaken, 0, 'het sinds-filter werkt niet');

    /* HET FOUTSIGNAAL. Twee meldingen van hetzelfde scherm zijn een signaal;
       koppelen hangt de zaak eraan, en een tweede keer koppelen niet nog eens. */
    for (const n of [1, 2]) {
      const r = await fetch(o.srv.base + '/api/fout/client', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soort: 'js', melding: 'kan ' + (1000 + n) + ' niet laden', bestand: 'app.js', regel: 12, pad: '/apps/geld.html' }) });
      assert.equal(r.status, 204);
    }
    const signalen = await o.p('/api/office/service/foutsignalen', {}, o.balie);
    assert.equal(signalen.body.signalen.length, 1, JSON.stringify(signalen.body).slice(0, 200));
    const sig = signalen.body.signalen[0];
    assert.equal(sig.aantal, 2);
    const half = await o.p('/api/office/service/foutsignaal/koppel', { signaal: sig.id }, o.balie);
    assert.equal(half.status, 400, 'een koppeling zonder zaak ging door');
    const spook = await o.p('/api/office/service/foutsignaal/koppel', { signaal: 'ERR-00000000', zaak: scherm.id }, o.balie);
    assert.equal(spook.status, 404);
    const k = await o.p('/api/office/service/foutsignaal/koppel', { signaal: sig.id, zaak: scherm.id }, o.balie);
    assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 200));
    assert.deepEqual(k.body.signaal.zaken, [scherm.id]);
    const nog = await o.p('/api/office/service/foutsignaal/koppel', { signaal: sig.id, zaak: scherm.id.toLowerCase() }, o.balie);
    assert.deepEqual(nog.body.signaal.zaken, [scherm.id], 'dezelfde zaak hing er twee keer aan');
    const dossier = await o.p('/api/office/service/zaak', { id: scherm.id }, o.balie);
    assert.equal(dossier.body.foutsignalen.length, 1, 'de medewerker ziet niet dat er op dit scherm iets kapot is');
    assert.deepEqual(dossier.body.foutsignalen[0].zaken, [scherm.id]);

    /* DE INGANGEN. Het bord zegt van elke deur ook wat het NIET weet. De post
       is gemonteerd, maar of er post aankomt hangt van DNS en een provider af;
       en zonder lokaal spraakmodel is ondertitelen niet beschikbaar, met wat
       dat voor een dove deelnemer betekent. */
    const kan = await o.p('/api/office/service/kanalen', {}, o.balie);
    assert.equal(kan.status, 200, JSON.stringify(kan.body).slice(0, 200));
    assert.equal(kan.body.kanalen.length, 2);
    const mail = kan.body.kanalen.find(x => x.id === 'mail');
    assert.match(String(mail.adres), /^hulp@/);
    assert.equal(mail.graad, 'gemeten');
    assert.equal(mail.nietVastgesteld.length, 2, 'de post beweert meer zekerheid dan deze server kan hebben');
    assert.match(mail.nietVastgesteld[0], /DNS/);
    const ond = kan.body.kanalen.find(x => x.id === 'ondertiteling');
    assert.equal(ond.stand, 'niet beschikbaar');
    assert.match(String(ond.wat), /LOCAL_AI_URL/);
    assert.match(String(ond.gevolg), /MEETYPEN/, 'de uitsluiting van wie doof is staat niet in gewone woorden op het bord');
    assert.equal(kan.body.nogNiet.length, 3, 'de niet-gebouwde kanalen ontbreken op het bord');
    assert.deepEqual(kan.body.nogNiet.map(n => n.id).sort(), ['api', 'telefoon', 'terugbel']);
    assert.ok(kan.body.nogNiet.every(n => n.waarom), 'een niet-gebouwd kanaal zonder reden');
  } finally { await stop(o.srv); }
});

/* -------------------------------------------------------------- 7. de zaak -- */
test('de zaak: keuzes met een zakelijke mens, weigeren op naam, en een stand die zegt wat WIJ meldden', async () => {
  const o = await opzet();
  try {
    const zaakTok = await alsZaak(o.p, 'KIKUNOI');
    const k = await o.p('/api/supplier/service/keuzes', {}, zaakTok);
    assert.equal(k.status, 200, JSON.stringify(k.body).slice(0, 200));
    assert.equal(k.body.mens.team, 'zakelijk', 'een zaak wordt niet naar het zakelijke team doorgezet');
    assert.equal(k.body.mens.rechtstreeks, true);
    assert.doesNotMatch(String(k.body.mens.heet), /Rechterhand/, 'een zaak kreeg De Rechterhand toegezegd');
    assert.ok(k.body.onderwerpen.some(s => s.id === 'zaak'), 'het onderwerp "mijn zaak" ontbreekt');

    const z = (await o.p('/api/supplier/service/open', { onderwerp: 'zaak', titel: 'Onze werkruimte doet raar' }, zaakTok)).body.zaak;
    assert.equal(z.team, 'zakelijk');

    /* MIJN ZAKEN, en waarom deze regel hier staat.

       /api/supplier/service/mijn was alleen door een playwright-toets bereikt.
       Daardoor kon niemand zonder browser DEKKING.json meer bijwerken: die
       recorder eist 100%, en deze ene route hield dat tegen -- een blokkade die
       niets met de route zelf te maken had. Hij hoort ook gewoon hier, naast
       /open en /stand, want dit is dezelfde sessie en dezelfde vraag: wat heb
       IK gemeld. De browsertoets blijft staan en meet het scherm; deze meet de
       deur. */
    const mijn = await o.p('/api/supplier/service/mijn', {}, zaakTok);
    assert.equal(mijn.status, 200, JSON.stringify(mijn.body).slice(0, 200));
    assert.ok(mijn.body.zaken.some(x => x.id === z.id), 'de zojuist geopende zaak staat in de eigen lijst');
    const zonderSessie = await o.p('/api/supplier/service/mijn', {});
    assert.notEqual(zonderSessie.status, 200, 'en zonder zaaksessie komt die lijst er niet uit');

    /* De stand VOOR er iets speelt: geen groen vinkje, maar de zin dat "niets
       bekend" iets anders is dan "alles werkt". */
    const voor = await o.p('/api/supplier/service/stand', {}, zaakTok);
    assert.equal(voor.status, 200, JSON.stringify(voor.body).slice(0, 200));
    assert.equal(voor.body.zaken, 1);
    assert.equal(voor.body.raakt.length, 0);
    assert.match(voor.body.kop, /geen storing/);
    assert.match(String(voor.body.let), /niet per lid/);

    /* Weigeren: op naam, dus een andere zaak kan het niet. */
    const v = await o.p('/api/office/service/bevestiging/vraag',
      { id: z.id, capabilities: ['organisatie.stand'], reden: 'de werkruimte reageert niet sinds vanmorgen' }, o.balie);
    assert.equal(v.status, 200, JSON.stringify(v.body).slice(0, 200));
    const wacht = await o.p('/api/supplier/service/bevestigingen', {}, zaakTok);
    assert.equal(wacht.body.verzoeken.length, 1, 'er stond niets klaar op de werkplek van de zaak');
    const ander = await alsZaak(o.p, 'ESVEDRA');
    const vreemd = await o.p('/api/supplier/service/weiger', { id: wacht.body.verzoeken[0].id }, ander);
    assert.equal(vreemd.status, 403, 'een andere zaak kon dit verzoek weigeren');
    const w = await o.p('/api/supplier/service/weiger', { id: wacht.body.verzoeken[0].id }, zaakTok);
    assert.equal(w.status, 200, JSON.stringify(w.body).slice(0, 200));
    assert.equal(w.body.bevestiging.stand, 'geweigerd');
    const alsnog = await o.p('/api/supplier/service/bevestig', { id: wacht.body.verzoeken[0].id }, zaakTok);
    assert.equal(alsnog.status, 400, 'een geweigerd verzoek was alsnog te bevestigen');
    const dicht = await o.p('/api/office/service/zaak', { id: z.id }, o.balie);
    assert.equal(dicht.body.zaakstand.open, false, 'de operationele stand ging open na een weigering');

    /* De stand NA een koppeling aan een storing: "onbekend", want Service weet
       alleen wat zij zelf heeft gemeld. En na de herstelmelding: dat wij dat
       meldden -- niet dat een meter het bevestigt. */
    const kop = await o.p('/api/office/service/koppel', { id: z.id, soort: 'incident', code: 'RTG-0077' }, o.balie);
    assert.equal(kop.status, 200, JSON.stringify(kop.body).slice(0, 200));
    const raakt = await o.p('/api/supplier/service/stand', {}, zaakTok);
    assert.equal(raakt.body.raakt.length, 1, 'de zaak ziet de storing niet die zijn melding raakt');
    assert.equal(raakt.body.raakt[0].incident, 'RTG-0077');
    assert.equal(raakt.body.raakt[0].zaak, z.id);
    assert.equal(raakt.body.raakt[0].wij, 'onbekend', 'Service beweerde iets over een storing die zij niet meet');
    assert.match(raakt.body.kop, /storing die uw melding raakt/);
    assert.equal(raakt.body.let, null);

    const hersteld = await o.p('/api/office/service/incident/hersteld', { incident: 'RTG-0077' }, o.balie);
    assert.equal(hersteld.status, 200, JSON.stringify(hersteld.body).slice(0, 200));
    const na = await o.p('/api/supplier/service/stand', {}, zaakTok);
    assert.equal(na.body.raakt[0].wij, 'gemeld-hersteld');
    assert.match(na.body.raakt[0].zin, /Wij hebben gemeld/, 'de zaak leest "hersteld" als een meting in plaats van als iets dat wij meldden');

    /* En een zaak ziet alleen zijn eigen zaken in de stand. */
    const vanAnder = await o.p('/api/supplier/service/stand', {}, ander);
    assert.equal(vanAnder.body.zaken, 0, 'een andere zaak zag de zaken van KIKUNOI in zijn stand');
  } finally { await stop(o.srv); }
});

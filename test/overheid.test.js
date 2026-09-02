/* De Overheid (kern/overheid.js): de landelijke laag naast de gemeente. Zes
   pijlers voor inwoners, ondernemers en rijksambtenaren. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function bevestigAi(voorstel, token) {
  assert.equal(voorstel.body.did, false, 'de assistent stelt alleen voor');
  const g = (voorstel.body.goedkeuringen || [])[0];
  assert.ok(g && g.id, 'het voorstel heeft een servergoedkeuring');
  return api(base, '/api/supplier/doe/bevestig', { goedkeuringId: g.id, akkoord: true }, token);
}

let srv, base, lid, lidCode, rijk, partner;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-overheid-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString().slice(-8);
  const reg = await api(base, '/api/auth/register', { name: 'Inwoner', email: 'o' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1988-03-03', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  lidCode = (await api(base, '/api/state', {}, lid)).body.state.user.codename;
  // rijksambtenaar: log in als de rijks-partner (manager, PIN 1234)
  const roster = await api(base, '/api/supplier/roster', { code: 'RIJK' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  const rlog = await api(base, '/api/supplier/login', { code: 'RIJK', staffId: man.id, pin: '1234' });
  rijk = rlog.body.token;
  // een gewone RTG-partner (het demo-restaurant), om te tonen dat die niet mag behandelen
  const kik = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
  partner = kik.body.token;
});
test.after(() => stop(srv && srv.child));

test('1. Belastingdienst: aangifte levert een aanslag, betalen kan, dubbel wordt geweigerd, opnieuw indienen overschrijft', async () => {
  assert.equal((await api(base, '/api/overheid/aangifte', { inkomen: 50000 }, null)).status, 401);
  const a = await api(base, '/api/overheid/aangifte', { inkomen: 90000, aftrek: 2000, ingehouden: 10000 }, lid);
  assert.equal(a.status, 200);
  assert.ok(a.body.aanslag.saldo > 0, 'weinig ingehouden -> bijbetalen');
  const ref = a.body.aanslag.ref;
  // een bericht landt in de Berichtenbox
  const bx = await api(base, '/api/overheid/berichten', {}, lid);
  assert.ok(bx.body.berichten.some(b => /aanslag/i.test(b.titel)), 'de aanslag staat in de Berichtenbox');
  assert.ok(bx.body.ongelezen >= 1, 'er is een ongelezen bericht');
  // betalen
  const bet = await api(base, '/api/overheid/aanslag/betaal', { ref }, lid);
  assert.equal(bet.status, 200);
  assert.equal(bet.body.aanslag.betaald, true);
  assert.equal((await api(base, '/api/overheid/aanslag/betaal', { ref }, lid)).status, 409);
  // opnieuw indienen voor hetzelfde jaar overschrijft (nog steeds 1 aanslag)
  await api(base, '/api/overheid/aangifte', { inkomen: 30000, ingehouden: 20000 }, lid);
  const mijn = await api(base, '/api/overheid/aanslagen/mijn', {}, lid);
  assert.equal(mijn.body.aanslagen.length, 1, 'nog steeds een aanslag voor dit jaar');
  assert.ok(mijn.body.aanslagen[0].saldo < 0, 'nu teveel ingehouden -> teruggaaf');
});

test('2. Toeslagen: aanvragen, dubbel geweigerd, en de ambtenaar kent toe', async () => {
  const t = await api(base, '/api/overheid/toeslag', { soort: 'zorgtoeslag', inkomen: 22000 }, lid);
  assert.equal(t.status, 200);
  assert.ok(t.body.toeslag.maandbedrag > 0, 'bij laag inkomen is er recht');
  assert.equal((await api(base, '/api/overheid/toeslag', { soort: 'zorgtoeslag', inkomen: 22000 }, lid)).status, 409);
  // de ambtenaar ziet en beslist
  const lijst = await api(base, '/api/overheid/toeslagen', {}, rijk);
  assert.ok(lijst.body.toeslagen.some(x => x.ref === t.body.toeslag.ref));
  const bes = await api(base, '/api/overheid/toeslag/beslis', { ref: t.body.toeslag.ref, besluit: 'toegekend' }, rijk);
  assert.equal(bes.status, 200);
  assert.equal(bes.body.toeslag.status, 'toegekend');
  // een gewone partner mag niet behandelen
  assert.equal((await api(base, '/api/overheid/toeslagen', {}, partner)).status, 403);
  assert.equal((await api(base, '/api/overheid/regie', {}, lid)).status, 401);
});

test('3. RDW: voertuig registreren, dubbel geweigerd, en rijbewijs verlengen', async () => {
  const v = await api(base, '/api/overheid/voertuig/meld', { kenteken: 'RTG-01-A', merk: 'Land Rover' }, lid);
  assert.equal(v.status, 200);
  assert.ok(v.body.voertuig.apkTot, 'er is een APK-datum');
  assert.equal((await api(base, '/api/overheid/voertuig/meld', { kenteken: 'RTG01A', merk: 'x' }, lid)).status, 409);
  const lijst = await api(base, '/api/overheid/voertuigen', {}, lid);
  assert.ok(lijst.body.voertuigen.some(x => x.kenteken === 'RTG01A'));
  const rb = await api(base, '/api/overheid/rijbewijs', {}, lid);
  assert.ok(rb.body.rijbewijs.geldigTot);
  const verl = await api(base, '/api/overheid/rijbewijs/verleng', {}, lid);
  assert.equal(verl.status, 200);
  assert.ok(verl.body.rijbewijs.geldigTot > rb.body.rijbewijs.geldigTot, 'verlengen schuift de datum op');
  /* TWEE KEER VERLENGEN VERLENGT NIET TWEE KEER (het besluit in IDEMBESLUIT.json).
     De idemproef zag deze route aan de OPSLAG als onbeschermd -- er kwam bij
     beide oproepen een bericht bij. Waar het om gaat is of het RIJBEWIJS twee
     keer opschuift, en dat is de vraag die dit register beantwoordt: `geldigTot`
     wordt absoluut berekend (vandaag + 10 jaar) en niet opgeteld bij de vorige
     datum. Zou iemand dat naar `geldigTot + 10 jaar` veranderen, dan geeft een
     dubbeltik twintig jaar rijbewijs, en dan zakt deze regel. */
  const nog = await api(base, '/api/overheid/rijbewijs/verleng', {}, lid);
  assert.equal(nog.body.rijbewijs.geldigTot, verl.body.rijbewijs.geldigTot,
    'een tweede verlenging geeft dezelfde einddatum: de eindstand is idempotent');
});

test('4. KVK ondernemersloket: een lid schrijft een eenmanszaak in en vraagt zijn uittreksel op', async () => {
  const k = await api(base, '/api/overheid/kvk/inschrijven', { naam: 'Casa del Sol', rechtsvorm: 'eenmanszaak', sbi: '5610' }, lid);
  assert.equal(k.status, 200);
  assert.ok(/^\d{8}$/.test(k.body.inschrijving.kvkNummer), 'een 8-cijferig KVK-nummer');
  assert.equal((await api(base, '/api/overheid/kvk/inschrijven', { naam: 'Nog een' }, lid)).status, 409);
  const mijn = await api(base, '/api/overheid/kvk/mijn', {}, lid);
  assert.ok(mijn.body.inschrijvingen.some(x => x.naam === 'Casa del Sol'));
  // ook een onderneming zelf kan inschrijven
  const s = await api(base, '/api/supplier/overheid/kvk/inschrijven', { naam: 'Kikunoi Ibiza SL', rechtsvorm: 'bv' }, partner);
  assert.equal(s.status, 200);
});

test('5. Sociale zekerheid: aanvraag bij UWV en een besluit van de ambtenaar', async () => {
  const u = await api(base, '/api/overheid/uitkering', { soort: 'ww', toelichting: 'Contract afgelopen' }, lid);
  assert.equal(u.status, 200);
  assert.equal(u.body.aanvraag.status, 'aangevraagd');
  const lijst = await api(base, '/api/overheid/uitkeringen', {}, rijk);
  assert.ok(lijst.body.uitkeringen.some(x => x.ref === u.body.aanvraag.ref));
  const bes = await api(base, '/api/overheid/uitkering/beslis', { ref: u.body.aanvraag.ref, besluit: 'toegekend' }, rijk);
  assert.equal(bes.status, 200);
  const mijn = await api(base, '/api/overheid/uitkeringen/mijn', {}, lid);
  assert.equal(mijn.body.uitkeringen.find(x => x.ref === u.body.aanvraag.ref).status, 'toegekend');
});

test('6. Referendum: alleen wie aantoonbaar een volwassen mens is, stemt', async () => {
  /* DE POORT. Hiervoor was de enige eis "ingelogd en geen gast": een stemming
     stond dus open voor iedereen die een e-mailadres kon bedenken, en "een
     mens, een stem" was een aanname. Drie eisen vervangen die aanname --
     niveau A3 (RTG heeft het bewijs gezien), 18 jaar, en die leeftijd uit het
     DOCUMENT en niet uit het aanmeldformulier. Die laatste telt hier het
     zwaarst: een zelf ingetypte geboortedatum is precies zo hard als de wens om
     mee te doen. */
  const v0 = await api(base, '/api/overheid/verkiezing', {}, lid);
  assert.equal(v0.status, 200);
  assert.equal(v0.body.verkiezing.alGestemd, false);
  assert.equal(v0.body.verkiezing.stemrecht.ok, false, 'een ongekeurd lid mag nog niet stemmen');
  assert.match(v0.body.verkiezing.stemrecht.reden, /A3|identiteitsbewijs/i, 'en hoort waarom');
  assert.equal(v0.body.verkiezing.stemrecht.niveau.id, 'A1');

  const geweigerd = await api(base, '/api/overheid/stem', { keuze: 'voor' }, lid);
  assert.equal(geweigerd.status, 403, 'en de stem wordt geweigerd, niet stil genegeerd');
  const tussen = await api(base, '/api/overheid/verkiezing', {}, lid);
  assert.equal(tussen.body.verkiezing.totaal, 0, 'er is niets geteld');

  /* De weg erdoorheen: RTG keurt het bewijs en neemt de geboortedatum van het
     document over. Zonder die laatste stap blijft de poort dicht -- en dat is
     precies het punt van de eis. */
  const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAoHf3ZQAAAAASUVORK5CYII=';
  await api(base, '/api/verify/upload', { image: PNG }, lid);
  await api(base, '/api/verify/selfie', { image: PNG }, lid);
  const pend = await api(base, '/api/office/verifications', {}, office);
  const mij = (pend.body.pending || []).find(x => x.codename === lidCode);
  assert.ok(mij, 'het lid staat in de keuringsrij');

  // eerst goedkeuren ZONDER de datum van het document: de poort blijft dicht
  await api(base, '/api/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true }, office);
  const halverwege = await api(base, '/api/overheid/verkiezing', {}, lid);
  assert.equal(halverwege.body.verkiezing.stemrecht.niveau.id, 'A4', 'het bewijs is gezien');
  assert.equal(halverwege.body.verkiezing.stemrecht.ok, false, 'maar de geboortedatum is nog de zelf opgegeven');
  assert.match(halverwege.body.verkiezing.stemrecht.reden, /zelf opgaf|identiteitsbewijs/i);
  assert.equal((await api(base, '/api/overheid/stem', { keuze: 'voor' }, lid)).status, 403);

  // en nu mét de datum van het document
  await api(base, '/api/office/verify', { userId: mij.id, decision: 'approve', faceMatch: true,
    geboortedatum: '1988-03-03' }, office);
  const klaar = await api(base, '/api/overheid/verkiezing', {}, lid);
  assert.equal(klaar.body.verkiezing.stemrecht.ok, true, 'nu mag het');
  assert.equal(klaar.body.verkiezing.stemrecht.leeftijdBron, 'paspoort');

  const s = await api(base, '/api/overheid/stem', { keuze: 'voor' }, lid);
  assert.equal(s.status, 200);
  assert.equal(s.body.verkiezing.alGestemd, true);
  assert.ok(s.body.verkiezing.totaal >= 1);
  assert.equal((await api(base, '/api/overheid/stem', { keuze: 'tegen' }, lid)).status, 409);
  // de ambtenaar sluit de stemming; daarna kan niemand meer stemmen
  const sl = await api(base, '/api/overheid/verkiezing/sluit', { open: false }, rijk);
  assert.equal(sl.status, 200);
  assert.equal(sl.body.verkiezing.open, false);
});

test('6b. het stembriefje blijft geheim, ook voor wie de database leest', async () => {
  /* Dit stond er al goed en moet zo blijven: het register weet DAT u stemde, de
     teller weet WAT er is gekozen, en ze worden nergens aan elkaar geknoopt.
     Een poort die bijhoudt wie er mag stemmen, is precies het moment waarop
     iemand in de verleiding komt om er ook de keuze bij te zetten. */
  const v = await api(base, '/api/overheid/verkiezing', {}, lid);
  const alles = JSON.stringify(v.body);
  assert.ok(!/"keuze"/.test(alles), 'geen enkele keuze reist mee met een stemmer');
  assert.equal(v.body.verkiezing.alGestemd, true, 'wel dat DIT lid heeft gestemd');
});

test('6c. een ingetrokken verificatie trekt ook het stemrecht in', async () => {
  /* DIT IS HET GEVAL WAARIN DE NIVEAU-EIS ALS ENIGE OVERBLIJFT, en zonder dit
     scenario leek die eis overbodig: normaal komt een documentdatum alleen
     samen met een goedkeuring, dus blokkeerde de herkomst-eis altijd al.

     Maar een afwijzing wist het bewijs en zet de stand terug op 'rejected' --
     terwijl de eerder overgenomen geboortedatum gewoon blijft staan. Precies
     wat je wilt als een document later vals blijkt: de datum die ooit is
     gelezen verdwijnt niet uit het dossier, maar het vertrouwen erin wel. Dan
     mag er niet meer gestemd worden, en alleen de niveau-eis houdt dat tegen. */
  const u = Date.now().toString().slice(-7);
  const reg = await api(base, '/api/auth/register', { name: 'Twijfel', email: 'tw' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg', pasApp: 'rtg' });
  const twijfel = reg.body.token;
  const code = (await api(base, '/api/state', {}, twijfel)).body.state.user.codename;
  const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAoHf3ZQAAAAASUVORK5CYII=';
  await api(base, '/api/verify/upload', { image: PNG }, twijfel);
  await api(base, '/api/verify/selfie', { image: PNG }, twijfel);
  const pend = await api(base, '/api/office/verifications', {}, office);
  const mij = (pend.body.pending || []).find(x => x.codename === code);
  assert.ok(mij);

  await api(base, '/api/overheid/verkiezing/sluit', { open: true }, rijk);
  await api(base, '/api/office/verify', { userId: mij.id, decision: 'approve',
    faceMatch: true, geboortedatum: '1985-05-05' }, office);
  const mag = await api(base, '/api/overheid/verkiezing', {}, twijfel);
  assert.equal(mag.body.verkiezing.stemrecht.ok, true, 'na goedkeuring mag het');

  // en dan blijkt het document niet te deugen
  await api(base, '/api/office/verify', { userId: mij.id, decision: 'reject' }, office);
  const na = await api(base, '/api/overheid/verkiezing', {}, twijfel);
  assert.equal(na.body.verkiezing.stemrecht.leeftijdBron, 'paspoort',
    'de eerder gelezen datum staat er nog -- die is niet ongelezen te maken');
  assert.equal(na.body.verkiezing.stemrecht.niveau.id, 'A1', 'maar het vertrouwen is weg');
  assert.equal(na.body.verkiezing.stemrecht.ok, false, 'dus het stemrecht ook');
  assert.equal((await api(base, '/api/overheid/stem', { keuze: 'voor' }, twijfel)).status, 403);
  await api(base, '/api/overheid/verkiezing/sluit', { open: false }, rijk);
});

test('6d. een gekeurde zestienjarige stemt niet', async () => {
  /* En dit is het geval waarin de LEEFTIJDSEIS als enige overblijft. Het
     lidmaatschap kan vanaf 15, dus een volledig gekeurd lid met een
     document-geboortedatum kan gewoon minderjarig zijn: niveau A4, herkomst
     'paspoort', en toch geen stem. Zonder dit scenario zou het weghalen van de
     leeftijdsgrens door geen enkele toets worden opgemerkt. */
  const jaar = new Date().getFullYear() - 16;
  const u = (Date.now() + 1).toString().slice(-7);
  const reg = await api(base, '/api/auth/register', { name: 'Jong', email: 'jo' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: jaar + '-01-01', tier: 'rtg', pasApp: 'rtg' });
  const jong = reg.body.token;
  assert.ok(jong, 'het lidmaatschap kan vanaf 15');
  const code = (await api(base, '/api/state', {}, jong)).body.state.user.codename;
  const office = await kantoorAlsPersoon(base, 'RTG-OFFICE');
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAoHf3ZQAAAAASUVORK5CYII=';
  await api(base, '/api/verify/upload', { image: PNG }, jong);
  await api(base, '/api/verify/selfie', { image: PNG }, jong);
  const pend = await api(base, '/api/office/verifications', {}, office);
  const mij = (pend.body.pending || []).find(x => x.codename === code);
  await api(base, '/api/office/verify', { userId: mij.id, decision: 'approve',
    faceMatch: true, geboortedatum: jaar + '-01-01' }, office);

  await api(base, '/api/overheid/verkiezing/sluit', { open: true }, rijk);
  const v = await api(base, '/api/overheid/verkiezing', {}, jong);
  assert.equal(v.body.verkiezing.stemrecht.niveau.id, 'A4', 'volledig gekeurd');
  assert.equal(v.body.verkiezing.stemrecht.leeftijdBron, 'paspoort', 'en de datum komt van het document');
  assert.equal(v.body.verkiezing.stemrecht.ok, false, 'maar zestien is zestien');
  assert.match(v.body.verkiezing.stemrecht.reden, /18 jaar/);
  assert.equal((await api(base, '/api/overheid/stem', { keuze: 'voor' }, jong)).status, 403);
  await api(base, '/api/overheid/verkiezing/sluit', { open: false }, rijk);
});

test('7. Bezwaar & bekendmakingen: een lid maakt bezwaar, de ambtenaar beslist, en er zijn rijksbekendmakingen', async () => {
  const bk = await api(base, '/api/overheid/bekendmakingen', {}, lid);
  assert.ok(bk.body.bekendmakingen.length >= 1, 'er staan rijksbekendmakingen klaar');
  const bz = await api(base, '/api/overheid/bezwaar', { tegen: 'Aanslag IB ' + new Date().getFullYear(), reden: 'De aftrek is niet meegenomen' }, lid);
  assert.equal(bz.status, 200);
  const lijst = await api(base, '/api/overheid/bezwaren', {}, rijk);
  assert.ok(lijst.body.bezwaren.some(x => x.ref === bz.body.bezwaar.ref));
  const bes = await api(base, '/api/overheid/bezwaar/beslis', { ref: bz.body.bezwaar.ref, besluit: 'gegrond', motivatie: 'Aftrek alsnog verwerkt' }, rijk);
  assert.equal(bes.status, 200);
  assert.equal(bes.body.bezwaar.status, 'gegrond');
  const mijn = await api(base, '/api/overheid/bezwaren/mijn', {}, lid);
  assert.equal(mijn.body.bezwaren.find(x => x.ref === bz.body.bezwaar.ref).status, 'gegrond');
});

test('8. Belasting-rekenhulp geeft dezelfde uitkomst zonder in te dienen', async () => {
  const r = await api(base, '/api/overheid/belasting/bereken', { inkomen: 60000, aftrek: 0, ingehouden: 15000 }, lid);
  assert.equal(r.status, 200);
  assert.equal(r.body.uitkomst.belastbaar, 60000);
  assert.ok(r.body.uitkomst.saldo > 0, '15000 ingehouden op 60000 -> nog bijbetalen');
});

test('9. Provincie: subsidie aanvragen (gecapt op het maximum) en de ambtenaar kent een bedrag toe', async () => {
  const reg = await api(base, '/api/overheid/subsidies', {}, lid);
  assert.ok(reg.body.regelingen.some(r => r.id === 'verduurzaming'));
  // meer vragen dan het maximum wordt gecapt
  const s = await api(base, '/api/overheid/subsidie', { regeling: 'verduurzaming', project: 'Zonnepanelen op het dak', bedrag: 99999 }, lid);
  assert.equal(s.status, 200);
  assert.equal(s.body.subsidie.gevraagd, 4000, 'gecapt op het maximum van de regeling');
  const lijst = await api(base, '/api/overheid/subsidies/lijst', {}, rijk);
  assert.ok(lijst.body.subsidies.some(x => x.ref === s.body.subsidie.ref));
  const bes = await api(base, '/api/overheid/subsidie/beslis', { ref: s.body.subsidie.ref, besluit: 'toegekend', bedrag: 3000 }, rijk);
  assert.equal(bes.status, 200);
  assert.equal(bes.body.subsidie.toegekend, 3000);
  // een gewone partner mag niet behandelen
  assert.equal((await api(base, '/api/overheid/subsidies/lijst', {}, partner)).status, 403);
});

test('10. Waterschap: aanslagen verschijnen en zijn te betalen; een watermelding wordt door de ambtenaar afgehandeld', async () => {
  assert.equal((await api(base, '/api/overheid/waterschap/betaal', { ref: 'x' }, null)).status, 401);
  const mijn = await api(base, '/api/overheid/waterschap/mijn', {}, lid);
  assert.equal(mijn.status, 200);
  assert.ok(mijn.body.aanslagen.length >= 2, 'watersysteem- en zuiveringsheffing staan klaar');
  const open = mijn.body.aanslagen.find(a => !a.betaald);
  const bet = await api(base, '/api/overheid/waterschap/betaal', { ref: open.ref }, lid);
  assert.equal(bet.status, 200);
  assert.equal(bet.body.aanslag.betaald, true);
  assert.equal((await api(base, '/api/overheid/waterschap/betaal', { ref: open.ref }, lid)).status, 409);
  // een melding aan het waterschap
  const m = await api(base, '/api/overheid/water/meld', { soort: 'wateroverlast', tekst: 'Ondergelopen fietstunnel na de bui', locatie: 'Tunnel Vara de Rey' }, lid);
  assert.equal(m.status, 200);
  const lijst = await api(base, '/api/overheid/water/meldingen', {}, rijk);
  assert.ok(lijst.body.meldingen.some(x => x.ref === m.body.melding.ref));
  const zet = await api(base, '/api/overheid/water/melding/zet', { ref: m.body.melding.ref, status: 'in behandeling', update: 'Gemaal opgeschaald' }, rijk);
  assert.equal(zet.status, 200);
  assert.equal(zet.body.melding.status, 'in behandeling');
  const na = await api(base, '/api/overheid/water/meldingen/mijn', {}, lid);
  const mine = na.body.meldingen.find(x => x.ref === m.body.melding.ref);
  assert.equal(mine.status, 'in behandeling');
  assert.ok(mine.updates.some(u => /opgeschaald/.test(u.tekst)), 'de update reist mee naar de melder');
});

test('11. Koppeling KVK: een onderneming schrijft zich in één tik in (idempotent) en de ambtenaar ziet het handelsregister', async () => {
  const z1 = await api(base, '/api/supplier/overheid/kvk/zorg', {}, partner);
  assert.equal(z1.status, 200);
  assert.ok(z1.body.inschrijving.kvkNummer, 'er is een KVK-nummer');
  // nog een keer levert dezelfde inschrijving, geen dubbele
  const z2 = await api(base, '/api/supplier/overheid/kvk/zorg', {}, partner);
  assert.equal(z2.status, 200);
  assert.equal(z2.body.nieuw, false);
  assert.equal(z2.body.inschrijving.kvkNummer, z1.body.inschrijving.kvkNummer);
  // de ambtenaar ziet het in het handelsregister
  const lijst = await api(base, '/api/overheid/kvk/lijst', {}, rijk);
  assert.ok(lijst.body.inschrijvingen.some(k => k.kvkNummer === z1.body.inschrijving.kvkNummer));
  // een gewoon lid mag het register niet inzien
  assert.equal((await api(base, '/api/overheid/kvk/lijst', {}, lid)).status, 401);
});

test('12. Koppeling RDW: een geregistreerd kenteken is bekend met APK-status, een onbekend kenteken niet', async () => {
  // in test 3 registreerde het lid RTG01A
  const ok = await api(base, '/api/overheid/rdw/check', { kenteken: 'rtg-01-a' }, lid);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.bekend, true);
  assert.equal(ok.body.kenteken, 'RTG01A');
  assert.equal(typeof ok.body.apkGeldig, 'boolean');
  const onbekend = await api(base, '/api/overheid/rdw/check', { kenteken: 'ZZ-999-Z' }, lid);
  assert.equal(onbekend.body.bekend, false);
  // te kort kenteken wordt geweigerd
  assert.equal((await api(base, '/api/overheid/rdw/check', { kenteken: 'AB' }, lid)).status, 400);
});

test('13. RDW-vloot: een huurauto uit het aanbod is bij de RDW bekend met APK-status', async () => {
  const aanbod = await api(base, '/api/verhuur/aanbod', {}, lid);
  assert.equal(aanbod.status, 200);
  const autos = (aanbod.body.partners || []).flatMap(p => p.autos || []);
  assert.ok(autos.length, 'er is verhuuraanbod');
  const metApk = autos.find(a => a.apk && a.apk.bekend);
  assert.ok(metApk, 'minstens één huurauto is in het RDW-register gezet (registreerVloot)');
  assert.ok('geldig' in metApk.apk && metApk.apk.apkTot, 'de APK-status komt mee');
  // en de losse RDW-check op datzelfde kenteken bevestigt het
  const chk = await api(base, '/api/overheid/rdw/check', { kenteken: metApk.plate }, lid);
  assert.equal(chk.body.bekend, true);
});

test('14. Rahul-aangiftehulp: uit een omschrijving haalt de AI inkomen en aftrek', async () => {
  const d = await api(base, '/api/overheid/aangifte/advies', { tekst: 'Ik verdien 48000 bruto en had 3200 aftrek' }, lid);
  assert.equal(d.status, 200);
  assert.equal(d.body.inkomen, 48000);
  assert.equal(d.body.aftrek, 3200);
});

test('15. De AI-assistent van de rijksbalie antwoordt (backoffice-Rahul)', async () => {
  const d = await api(base, '/api/supplier/ai', { q: 'Geef me een korte briefing van vandaag' }, rijk);
  assert.equal(d.status, 200);
  assert.ok(typeof d.body.reply === 'string' && d.body.reply.length, 'er komt een antwoord terug');
});

test('16. De rijksbalie-AI behandelt een toeslag op referentie (ken toe)', async () => {
  // een lid vraagt een toeslag aan
  const t = await api(base, '/api/overheid/toeslag', { soort: 'huurtoeslag', inkomen: 20000 }, lid);
  assert.equal(t.status, 200);
  const ref = t.body.toeslag.ref;
  // de ambtenaar zegt tegen Rahul: ken die toe
  const d = await api(base, '/api/supplier/ai', { q: 'ken ' + ref + ' toe' }, rijk);
  assert.equal(d.status, 200);
  const bevestigd = await bevestigAi(d, rijk);
  assert.equal(bevestigd.body.ok, true, 'de ambtenaar heeft zelf het exacte voorstel bevestigd');
  // controle: de toeslag staat nu op toegekend
  const mijn = await api(base, '/api/overheid/toeslagen/mijn', {}, lid);
  assert.equal(mijn.body.toeslagen.find(x => x.ref === ref).status, 'toegekend');
  // een gewone partner mag dit niet (geen rijksambtenaar) -> geen actie
  const p = await api(base, '/api/supplier/ai', { q: 'ken ' + ref + ' toe' }, partner);
  assert.notEqual(p.body.did, true);
});

test('17. De rijksbalie-AI pakt "de eerste subsidie" zonder referentie', async () => {
  const s = await api(base, '/api/supplier/overheid/subsidie', { regeling: 'innovatie', project: 'Slimme haven-sensoren', bedrag: 10000 }, partner);
  assert.equal(s.status, 200);
  const d = await api(base, '/api/supplier/ai', { q: 'wijs de eerste subsidie af' }, rijk);
  assert.equal((await bevestigAi(d, rijk)).body.ok, true);
  const lijst = await api(base, '/api/supplier/overheid/subsidies', {}, partner);
  assert.ok(lijst.body.subsidies.some(x => x.status === 'afgewezen'), 'een subsidie is afgewezen door de AI');
});

test('18. De gemeentebalie-AI verleent de eerste vergunning', async () => {
  const g = await api(base, '/api/gemeente/vergunning', { soort: 'terras', omschrijving: 'Terras voor de zaak aan het plein' }, lid);
  assert.equal(g.status, 200);
  // log in als gemeente-medewerker
  const roster = await api(base, '/api/supplier/roster', { code: 'GEMEENTE' });
  const man = roster.body.staff.find(m => m.role === 'manager');
  const glog = await api(base, '/api/supplier/login', { code: 'GEMEENTE', staffId: man.id, pin: '1234' });
  const gem = glog.body.token;
  const d = await api(base, '/api/supplier/ai', { q: 'verleen de eerste vergunning' }, gem);
  assert.equal((await bevestigAi(d, gem)).body.ok, true);
  const mijn = await api(base, '/api/gemeente/vergunningen/mijn', {}, lid);
  assert.ok(mijn.body.vergunningen.some(v => v.status === 'verleend'), 'een vergunning is verleend door de AI');
});

/* Zelfde venster-afspraak als bij de gemeente (TAKEN.md 4.61): dezelfde melder,
   dezelfde soort en dezelfde tekst binnen een minuut is EEN melding aan het
   waterschap, geen tweede dossier voor de behandelaar. */
test('19. dezelfde watermelding binnen een minuut geeft hetzelfde meldnummer', async () => {
  const eerste = await api(base, '/api/overheid/water/meld',
    { soort: 'wateroverlast', tekst: 'Duiker verstopt bij de molen' }, lid);
  assert.equal(eerste.status, 200);
  const ref = eerste.body.melding.ref;

  const nogmaals = await api(base, '/api/overheid/water/meld',
    { soort: 'wateroverlast', tekst: 'Duiker verstopt bij de molen' }, lid);
  assert.equal(nogmaals.body.melding.ref, ref, 'hetzelfde meldnummer terug');
  assert.equal(nogmaals.body.herhaald, true, 'gemerkt als herhaling');

  const mijn = await api(base, '/api/overheid/water/meldingen/mijn', {}, lid);
  const zelfde = (mijn.body.meldingen || []).filter(m => m.tekst === 'Duiker verstopt bij de molen');
  assert.equal(zelfde.length, 1, 'de melder heeft er zelf ook maar een');

  const ander = await api(base, '/api/overheid/water/meld',
    { soort: 'wateroverlast', tekst: 'En het riool bij de brug ruikt' }, lid);
  assert.notEqual(ander.body.melding.ref, ref, 'een andere melding komt gewoon binnen');
});

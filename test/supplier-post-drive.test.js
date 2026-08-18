/* ============================================================================
   DE POST EN DE TEAM-DRIVE VAN EEN ZAAK -- de grens tussen twee bedrijven.

   Zestien endpoints die de waargenomen dekkingsmeting (scripts/dekking.js) als
   NOOIT AANGEROEPEN aanwees. Ze zijn met opzet samen genomen, want het is een
   en dezelfde vraag: twee bedrijven op hetzelfde platform, en het ene mag niet
   in de papieren van het andere kunnen kijken.

     RTMAIL          inbox, verzonden, ongelezen, lees, stuur, assist,
                     inkoop, btw-herinner
     KANTOORPAKKET   deel, ster, versies, terug, vul, uitslag, weg, ai

   WAAROM DIT DE SCHERPE HOEK IS

   Een postvak en een documentmap zijn precies de twee plekken waar een bedrijf
   dingen bewaart die het niet met een concurrent deelt: offertes, personeels-
   post, de btw-aangifte, het contract in wording. De adressering loopt hier
   over de ZAAKCODE, en dat is een korte, raadbare string ("KIKUNOI"). Wie die
   code in een verzoek mag meesturen, leest andermans post. Deze test bewijst
   dat de code uit de SESSIE komt en nergens anders vandaan.

   TWEE ECHTE BEDRIJVEN, GEEN DEMO-INLOG

   /api/supplier/login met gebruikersnaam+wachtwoord komt altijd uit bij
   DEMO_SUPPLIER -- twee zo ingelogde "zaken" zijn dezelfde zaak, en dan toetst
   de grens hieronder niets. Daarom logt elk bedrijf in op de persoonlijke
   pincode van zijn eigen manager (Sal de Mar en Aguamarina, twee losse zaken
   uit de seed).

   Draai los: node --test test/supplier-post-drive.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-post-drive-'));
let srv, base, A, B;

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Inloggen als de manager van een bepaalde zaak. De roster is publiek (dat is
   het scherm waarop je jezelf aanwijst), de pincode is dat niet -- de seed geeft
   de eerste persoon van elke zaak 1234. */
async function zaak(code) {
  const rooster = await api('supplier/roster', { code });
  assert.equal(rooster.status, 200, 'roster van ' + code);
  const manager = (rooster.body.staff || []).find(x => x.role === 'manager');
  assert.ok(manager, 'zaak ' + code + ' heeft een manager in de seed');
  const inlog = await api('supplier/login', { code, staffId: manager.id, pin: '1234' });
  assert.equal(inlog.status, 200, 'manager van ' + code + ' logt in: ' + JSON.stringify(inlog.body));
  return { code, token: inlog.body.token };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-POSTDRIVE' } });
  base = srv.base;
  A = await zaak('KIKUNOI');   // het restaurant
  B = await zaak('HOSHI');     // het hotel
  assert.notEqual(A.token, B.token, 'twee zaken, twee sessies');
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ================= 1. RTMAIL: het postvak hangt aan de sessie ================= */

test('1. het adres komt uit de sessie, niet uit het verzoek', async () => {
  /* De eerste en belangrijkste eigenschap. Als een van deze endpoints ook maar
     naar een code in de body zou kijken, is elk postvak op het platform met een
     enkel verzoek te openen -- zaakcodes zijn kort en staan op elke bon. */
  const eigen = await api('supplier/rtmail/inbox', {}, A.token);
  assert.equal(eigen.status, 200);
  assert.ok(eigen.body.adres, 'de zaak krijgt een adres terug');

  const gestolen = await api('supplier/rtmail/inbox', { code: B.code, adres: 'HOSHI@rtmail' }, A.token);
  assert.equal(gestolen.status, 200, 'het verzoek slaagt...');
  assert.equal(gestolen.body.adres, eigen.body.adres,
    '...maar op het EIGEN adres; de code uit de body wordt genegeerd');
});

test('2. post van A komt aan bij B, en B kan hem niet op naam van A versturen', async () => {
  const onderwerp = 'Levering zaterdag ' + Math.random().toString(36).slice(2, 8);
  const verstuurd = await api('supplier/rtmail/stuur',
    { naar: B.code, onderwerp, tekst: 'Kunnen jullie zaterdag om 9u leveren?' }, A.token);
  assert.equal(verstuurd.status, 200, JSON.stringify(verstuurd.body));

  // bij A staat hij in Verzonden
  const uit = await api('supplier/rtmail/verzonden', {}, A.token);
  assert.equal(uit.status, 200);
  assert.ok((uit.body.berichten || []).some(m => m.onderwerp === onderwerp), 'A ziet zijn eigen verzonden post');

  // en bij B in de inbox, met A als afzender
  const in_ = await api('supplier/rtmail/inbox', {}, B.token);
  const bij_b = (in_.body.berichten || []).find(m => m.onderwerp === onderwerp);
  assert.ok(bij_b, 'B heeft het bericht ontvangen');
  assert.match(String(bij_b.van || ''), /KIKUNOI/i, 'de afzender is de zaak die het stuurde');

  /* En nu de vervalsing: B stuurt met "van" in de body ingevuld als A. De
     afzender hoort bij de geverifieerde inlog vandaan te komen, want anders is
     het vertrouwensstempel op een bericht een bewering van de client. */
  const ond2 = 'Vervalst ' + Math.random().toString(36).slice(2, 8);
  await api('supplier/rtmail/stuur',
    { van: 'KIKUNOI@rtmail', naar: B.code, onderwerp: ond2, tekst: 'namens de ander' }, B.token);
  const na = await api('supplier/rtmail/inbox', {}, B.token);
  const vervalst = (na.body.berichten || []).find(m => m.onderwerp === ond2);
  if (vervalst) assert.equal(/KIKUNOI/i.test(String(vervalst.van || '')), false,
    'de afzender mag nooit uit de body komen: dit bericht is van B, niet van A');
});

test('3. B kan een bericht uit het postvak van A niet lezen', async () => {
  /* De klassieke fout: het id komt uit het verzoek, dus wie er een van een
     ander invult, leest andermans post. rtmail.lees() krijgt het adres uit de
     sessie mee, dus dit hoort stuk te lopen op "niet gevonden". */
  const onderwerp = 'Vertrouwelijk ' + Math.random().toString(36).slice(2, 8);
  await api('supplier/rtmail/stuur', { naar: A.code, onderwerp, tekst: 'Alleen voor A.' }, A.token);
  const inbox = await api('supplier/rtmail/inbox', {}, A.token);
  const mijn = (inbox.body.berichten || []).find(m => m.onderwerp === onderwerp);
  assert.ok(mijn, 'A heeft het bericht in zijn eigen postvak');

  const eigen = await api('supplier/rtmail/lees', { id: mijn.id }, A.token);
  assert.equal(eigen.status, 200, 'de eigenaar leest hem wel');

  const inbraak = await api('supplier/rtmail/lees', { id: mijn.id }, B.token);
  assert.equal(inbraak.status, 404, 'voor B bestaat dit bericht niet');
  assert.equal(JSON.stringify(inbraak.body).includes('Vertrouwelijk'), false,
    'en de inhoud lekt ook niet via de foutmelding');
});

test('4. de ongelezen-teller telt alleen de eigen post', async () => {
  const voorB = (await api('supplier/rtmail/ongelezen', {}, B.token)).body.ongelezen;
  const onderwerp = 'Teller ' + Math.random().toString(36).slice(2, 8);
  await api('supplier/rtmail/stuur', { naar: A.code, onderwerp, tekst: 'voor A' }, A.token);
  const naB = (await api('supplier/rtmail/ongelezen', {}, B.token)).body.ongelezen;
  assert.equal(naB, voorB, 'post aan A verandert niets aan de teller van B');
});

test('5. Rahul vat alleen het eigen postvak samen, en verstuurt nooit zelf', async () => {
  /* De AI-baan is een leesbril op je eigen post. Twee eisen: hij werkt op het
     postvak van de ingelogde zaak, en een "antwoord" is een VOORSTEL -- er mag
     niets de deur uit gaan zonder dat een mens op verzenden drukt. */
  const samen = await api('supplier/rtmail/assist', {}, B.token);
  assert.equal(samen.status, 200);
  assert.ok(typeof samen.body.samenvatting === 'string' && samen.body.samenvatting.length > 5);

  const inbox = await api('supplier/rtmail/inbox', {}, B.token);
  const eersteVanB = (inbox.body.berichten || [])[0];
  if (eersteVanB) {
    const voorstel = await api('supplier/rtmail/assist', { actie: 'antwoord', id: eersteVanB.id }, B.token);
    assert.equal(voorstel.status, 200);
    assert.ok(voorstel.body.voorstel && voorstel.body.voorstel.tekst, 'een concept, geen verzending');
    const naVoorstel = await api('supplier/rtmail/verzonden', {}, B.token);
    assert.equal((naVoorstel.body.berichten || []).some(m => m.onderwerp === voorstel.body.voorstel.onderwerp),
      false, 'het voorstel is NIET verstuurd');
  }
  // een bericht van een ander postvak kan de AI ook niet als antwoord opdiepen
  const inboxA = await api('supplier/rtmail/inbox', {}, A.token);
  const vanA = (inboxA.body.berichten || [])[0];
  if (vanA) assert.equal((await api('supplier/rtmail/assist', { actie: 'antwoord', id: vanA.id }, B.token)).status, 404);
});

test('6. de draaiboeken lopen op de eigen zaakcode', async () => {
  /* Inkoopvoorstel en btw-herinnering zetten post klaar NAMENS de zaak. Beide
     halen de zaakcode uit de sessie; wat er in de body staat mag daar niets aan
     veranderen, anders bestelt de een op naam van de ander. */
  const inkoop = await api('supplier/rtmail/inkoop',
    { groothandel: 'GROOT', zaakCode: B.code, regels: [{ naam: 'Zeezout', aantal: 4 }] }, A.token);
  assert.ok([200, 400, 503].includes(inkoop.status), 'nette afhandeling: ' + inkoop.status);

  const btw = await api('supplier/rtmail/btw-herinner',
    { periode: 'Q3', bedrag: 1250, deadline: '2026-10-31', zaakCode: B.code }, A.token);
  assert.ok([200, 400, 503].includes(btw.status), 'nette afhandeling: ' + btw.status);

  /* Wat er ook gebeurde, het mag niet in het postvak van B geland zijn: de
     zaakCode in de body is een poging, geen instructie. */
  if (btw.status === 200) {
    const postB = await api('supplier/rtmail/inbox', {}, B.token);
    const btwBijB = (postB.body.berichten || []).filter(m => /btw|aangifte/i.test(m.onderwerp || ''));
    const postA = await api('supplier/rtmail/inbox', {}, A.token);
    const btwBijA = (postA.body.berichten || []).filter(m => /btw|aangifte/i.test(m.onderwerp || ''));
    assert.ok(btwBijA.length >= btwBijB.length,
      'de herinnering hoort bij de zaak die hem aanvroeg, niet bij de code uit de body');
  }
});

/* ================= 2. DE TEAM-DRIVE: documenten per zaak ================= */

async function documentVan(z, titel) {
  const r = await api('supplier/kantoorpakket/maak', { soort: 'tekst', titel }, z.token);
  assert.equal(r.status, 200, 'document aanmaken: ' + JSON.stringify(r.body));
  return r.body.id || (r.body.doc && r.body.doc.id);
}

test('7. B kan het document van A niet openen, bewaren of verwijderen', async () => {
  const GEHEIM = 'MARGE-ONDERHANDELING-' + Math.random().toString(36).slice(2, 8);
  const id = await documentVan(A, 'Contract in wording');
  assert.ok(id, 'A heeft een document');
  assert.equal((await api('supplier/kantoorpakket/bewaar',
    { id, inhoud: { tekst: GEHEIM } }, A.token)).status, 200, 'A schrijft er iets vertrouwelijks in');

  const open = await api('supplier/kantoorpakket/open', { id }, B.token);
  assert.equal(open.status, 403, 'B mag er niet in');
  assert.equal(JSON.stringify(open.body).includes(GEHEIM), false, 'en de inhoud lekt niet mee');

  assert.equal((await api('supplier/kantoorpakket/bewaar', { id, inhoud: { tekst: 'overschreven' } }, B.token)).status,
    403, 'B mag er ook niet in schrijven');
  assert.equal((await api('supplier/kantoorpakket/weg', { id }, B.token)).status, 403,
    'en al helemaal niet weggooien');

  // en na drie mislukte pogingen staat er bij A nog precies wat er stond
  const na = await api('supplier/kantoorpakket/open', { id }, A.token);
  assert.equal(na.status, 200);
  assert.equal(na.body.inhoud.tekst, GEHEIM, 'het document van A is ongeschonden');
});

test('8. versies en terugzetten blijven binnen de eigen zaak', async () => {
  const id = await documentVan(A, 'Menu-ontwerp');
  await api('supplier/kantoorpakket/bewaar', { id, inhoud: { tekst: 'eerste versie' } }, A.token);
  await api('supplier/kantoorpakket/bewaar', { id, inhoud: { tekst: 'tweede versie' } }, A.token);

  const mijn = await api('supplier/kantoorpakket/versies', { id }, A.token);
  assert.equal(mijn.status, 200);
  assert.ok((mijn.body.versies || []).length >= 1, 'de vorige stand is bewaard');

  assert.equal((await api('supplier/kantoorpakket/versies', { id }, B.token)).status, 403,
    'B mag de geschiedenis niet inzien -- die verklapt wat er stond');
  assert.equal((await api('supplier/kantoorpakket/terug', { id, nr: 0 }, B.token)).status, 403,
    'en al helemaal niet terugzetten');

  const terug = await api('supplier/kantoorpakket/terug', { id, nr: 0 }, A.token);
  assert.equal(terug.status, 200, 'de eigenaar zet wel terug');
  assert.equal(terug.body.inhoud.tekst, 'eerste versie');
});

test('9. een ster en het delen zijn voorbehouden aan de eigenaar', async () => {
  const id = await documentVan(A, 'Personeelsplanning');

  assert.equal((await api('supplier/kantoorpakket/ster', { id, aan: true }, B.token)).status, 403);
  assert.equal((await api('supplier/kantoorpakket/ster', { id, aan: true }, A.token)).status, 200);

  /* Delen gaat op codenaam, en een niet-bestaande codenaam hoort een nette 404
     te geven -- geen 500, en geen lijst met bestaande codenamen om te raden. */
  const vreemd = await api('supplier/kantoorpakket/deel',
    { id, codenaam: 'Bestaat-Niet-' + Date.now(), rechten: 'lezen' }, A.token);
  assert.equal(vreemd.status, 404);
  assert.equal((await api('supplier/kantoorpakket/deel', { id, codenaam: 'Wie dan ook' }, B.token)).status, 403,
    'B deelt andermans document niet met zichzelf of met derden');
});

test('10. een formulier: invullen mag alleen wie het gedeeld kreeg, de uitslag alleen de eigenaar', async () => {
  const maak = await api('supplier/kantoorpakket/maak',
    { soort: 'formulier', titel: 'Leveranciersenquete' }, A.token);
  assert.equal(maak.status, 200);
  const id = maak.body.id || (maak.body.doc && maak.body.doc.id);
  await api('supplier/kantoorpakket/bewaar',
    { id, inhoud: { vragen: [{ soort: 'open', tekst: 'Wat kan beter?' }] } }, A.token);

  assert.equal((await api('supplier/kantoorpakket/vul', { id, antwoorden: ['van buiten'] }, B.token)).status, 403,
    'een niet-gedeeld formulier is voor B geen formulier');
  assert.equal((await api('supplier/kantoorpakket/uitslag', { id }, B.token)).status, 403,
    'en de uitslag al helemaal niet');

  const eigen = await api('supplier/kantoorpakket/vul', { id, antwoorden: ['scherpere prijzen'] }, A.token);
  assert.equal(eigen.status, 200, JSON.stringify(eigen.body));
  const uitslag = await api('supplier/kantoorpakket/uitslag', { id }, A.token);
  assert.equal(uitslag.status, 200);
  assert.ok(JSON.stringify(uitslag.body).includes('scherpere prijzen'), 'de eigenaar ziet de inzending');
});

test('11. de schrijfhulp werkt alleen op een document dat je mag lezen', async () => {
  const id = await documentVan(A, 'Persbericht');
  await api('supplier/kantoorpakket/bewaar', { id, inhoud: { tekst: 'Wij openen in het voorjaar.' } }, A.token);

  const vreemd = await api('supplier/kantoorpakket/ai', { id, opdracht: 'samenvatten' }, B.token);
  assert.equal(vreemd.status, 403, 'de AI is geen achterdeur naar andermans tekst');
  assert.equal(JSON.stringify(vreemd.body).includes('voorjaar'), false, 'en citeert dus ook niets');

  /* De volgorde van de controles doet ertoe. Met een opdracht die niet bestaat
     hoort B nog steeds op de POORT te stranden (403) en niet op de invoer
     (400): zou de opdrachtcontrole eerst komen, dan verklapt het antwoord of
     het document uberhaupt bestaat, en dat is al informatie over een ander. */
  assert.equal((await api('supplier/kantoorpakket/ai', { id, opdracht: 'bestaat-niet' }, B.token)).status, 403,
    'de rechtencontrole komt voor de invoercontrole');

  const eigen = await api('supplier/kantoorpakket/ai', { id, opdracht: 'samenvatten' }, A.token);
  assert.equal(eigen.status, 200, 'de eigenaar krijgt hulp (demostand zonder AI-sleutel)');
  assert.ok(eigen.body.voorstel, 'en het is een VOORSTEL; de AI schrijft niets in het document');

  // wat er daarna in het document staat, is nog steeds wat A erin zette
  const na = await api('supplier/kantoorpakket/open', { id }, A.token);
  assert.equal(na.body.inhoud.tekst, 'Wij openen in het voorjaar.', 'de AI heeft niets zelf opgeslagen');

  // en een onbekende opdracht is voor de eigenaar een nette 400, geen 500
  assert.equal((await api('supplier/kantoorpakket/ai', { id, opdracht: 'bestaat-niet' }, A.token)).status, 400);
});

/* ================= 3. zonder inlog komt er niets doorheen ================= */

test('12. alle zestien endpoints zitten dicht zonder geldige zaaksessie', async () => {
  const paden = [
    'supplier/rtmail/inbox', 'supplier/rtmail/verzonden', 'supplier/rtmail/ongelezen',
    'supplier/rtmail/lees', 'supplier/rtmail/stuur', 'supplier/rtmail/assist',
    'supplier/rtmail/inkoop', 'supplier/rtmail/btw-herinner',
    'supplier/kantoorpakket/deel', 'supplier/kantoorpakket/ster', 'supplier/kantoorpakket/versies',
    'supplier/kantoorpakket/terug', 'supplier/kantoorpakket/vul', 'supplier/kantoorpakket/uitslag',
    'supplier/kantoorpakket/weg', 'supplier/kantoorpakket/ai'
  ];
  for (const pad of paden) {
    const zonder = await api(pad, { id: 'x', code: A.code });
    assert.ok(zonder.status === 401 || zonder.status === 403, pad + ' zonder token: ' + zonder.status);
    const onzin = await api(pad, { id: 'x', code: A.code }, 'niet-een-echt-token');
    assert.ok(onzin.status === 401 || onzin.status === 403, pad + ' met een vals token: ' + onzin.status);
  }
});

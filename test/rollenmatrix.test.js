/* ============================================================================
   DE ROLLENMATRIX -- drieënveertig endpoints uit acht torens, een vraag.

   Deze endpoints wees de waargenomen dekkingsmeting als nooit aangeroepen aan.
   Ze gaan over totaal verschillende dingen -- een sportclub, de vertrouwens-
   lijn van personeel, het RTF-kantoor, het onderzoekslab, de boardroom, een
   gezondheidsdossier -- en toch is het een test, want ze delen precies een
   eigenschap: ze hangen elk aan EEN rol, en er is geen tweede slot.

   WAT DE PROEF CORRIGEERDE AAN MIJN EERSTE OPZET

   Ik schreef eerst "ze hangen elk aan EEN rol en er is geen tweede slot". Dat
   klopte twee keer niet, en allebei de correcties staan hieronder vast:

     1. TWAALF VAN DE DRIEENTWINTIG ZAAK-ENDPOINTS HEBBEN WEL EEN TWEEDE SLOT:
        een GENREPOORT. Een restaurant komt met een geldige zaaksessie niet in
        sport/* ("Alleen voor de sportclub"), kmar ("Alleen voor de
        marechaussee") of overheid/rb ("Alleen voor het rijk"). Dat is de goede
        bouw en het is het toetsen waard: de twee sloten weigeren om een
        VERSCHILLENDE reden, en dat verschil hoort zichtbaar te blijven.
     2. DE TWEE GEZONDHEIDSROUTES HEBBEN OOK EEN TWEEDE SLOT, maar van een
        andere soort: een PASPOORT. Een gewoon RTG-lid komt er niet in; de
        gezondheidskaart hoort bij de Lifestyle Pass. Dezelfde vorm als de
        genrepoort, andere as.
     3. HET EIGENAARSACCOUNT IS EEN ACCOUNT MET MEERDERE ROLLEN. Hij is lid en
        hij is kantoor. Dat is met opzet zo gebouwd (een account voor alles), en
        dus hoort hij op de kantoor- en ledenroutes gewoon binnen te komen.
        Alleen andersom niet: kantoor is geen eigenaar.

   VIER SOORTEN SESSIE, EN NIEMAND MAG IN DE VERKEERDE DEUR

     lid          Bearer-token van een RTG-account
     zaak         Bearer-token van een ingelogde medewerker van een bedrijf
     kantoor      Bearer-token van de RTG-backoffice
     eigenaar     het account van de eigenaar (techAuth + eigenaarAlleen)

   De klassieke fout is niet "iemand zonder token komt binnen" -- dat vangt
   iedereen -- maar "een ECHTE sessie van het verkeerde soort komt binnen". Een
   zaaktoken op een kantoorroute, een ledentoken op een zaakroute. Daar toetst
   deel 1 op, voor alle drieënveertig.

   Deel 2 gaat de diepte in op de drie waar de inhoud er het meest toe doet:
   een vertrouwensmelding van een medewerker, het team van een geheim
   labproject, en het wissen van een medisch dossier.

   Draai los: node --experimental-sqlite --test test/rollenmatrix.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, elevateTier } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rollen-'));
const CODE = 'KANTOOR-ROLLEN';
let srv, base, lid, lidB, lidRtg, zaakA, zaakB, kantoor, eigenaar;

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => { const t = await r.text(); let b = {}; try { b = JSON.parse(t); } catch (e) {}
  return { status: r.status, body: b, tekst: t }; });

let teller = 0;
async function nieuwLid(naam) {
  const u = (Date.now() + (++teller) * 7919).toString().slice(-9);
  const r = await api('auth/register', { name: naam, email: 'rm' + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, 'lid ' + naam);
  return { token: r.body.token, naam };
}
async function zaakVan(code) {
  const rooster = await api('supplier/roster', { code });
  const man = (rooster.body.staff || []).find(x => x.role === 'manager');
  const r = await api('supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(r.body.token, 'zaak ' + code);
  return { code, token: r.body.token, staffId: man.id };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE, RTG_OWNER_EMAIL: '' } });
  base = srv.base;
  lid = await nieuwLid('Matrix Lid A');
  lidB = await nieuwLid('Matrix Lid B');
  lidRtg = await nieuwLid('Matrix Lid RTG');   // blijft met opzet op de RTG Pass
  zaakA = await zaakVan('KIKUNOI');
  zaakB = await zaakVan('HOSHI');
  kantoor = (await api('office/login', { code: CODE })).body.token;
  eigenaar = (await api('auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' })).body.token;
  assert.ok(kantoor && eigenaar, 'kantoor en eigenaar zijn binnen');
  // lid A en B krijgen de Lifestyle Pass; lidRtg met opzet niet
  await elevateTier(base, lid.token, 'lifestyle', kantoor);
  await elevateTier(base, lidB.token, 'lifestyle', kantoor);
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* Per rol de endpoints die ALLEEN die rol hoort te openen. */
/* Elke zaak komt hier binnen (het genre doet niet ter zake). */
const ZAAK = ['staff/doe', 'staff/doe/kaart', 'staff/flits/rond', 'staff/fluister/focus',
  'staff/fluister/vergeet', 'staff/leave/request', 'staff/trust/send', 'staff/trust/thread',
  'werkvloer/koppel/annuleer', 'werkvloer/tafel/weg', 'werkvloer/tafels'];
/* Twee sloten: een zaaksessie EN het juiste genre. Het restaurant hieronder is
   geen sportclub, geen marechaussee en geen rijksdienst, dus hij strandt op het
   tweede slot -- met een andere melding dan wie op het eerste strandt. */
const ZAAK_GENRE = [
  ['sport/ai', /sportclub/i], ['sport/kampen', /sportclub/i], ['sport/momenten', /sportclub/i],
  ['sport/programma', /sportclub/i], ['sport/speler', /sportclub/i], ['sport/sponsor/maak', /sportclub/i],
  ['sport/team/maak', /sportclub/i], ['sport/teams', /sportclub/i],
  ['kmar/incidenten', /marechaussee/i],
  ['overheid/pda/bezoekers', /rijk/i], ['overheid/rb/rol', /rijk/i], ['overheid/rb/zaken', /rijk/i]];
const KANTOOR = ['rtfkantoor/advies', 'rtfkantoor/club/afspraak-zet', 'rtfkantoor/club/programma-zet',
  'rtfkantoor/kamer/advies', 'rtfkantoor/stadsraad', 'rtfkantoor/stadsraad/besluit-start',
  'rtfkantoor/stadsraad/partner-stop', 'aanmelding/betalingen', 'aanmelding/een', 'aanmelding/lijst',
  'lab/project/team', 'labfonds/boardroom'];
const EIGENAAR = ['boardroom/onboarding', 'boardroom/onboarding/ai', 'boardroom/persoon'];
const LID = ['member/pulse/profiel', 'member/spel/klasgenoten', 'member/spel/rahul'];
/* Twee sloten: een ledensessie EN de Lifestyle Pass. */
const LID_PAS = ['member/lifestyle/gezondheid/afspraak/weg', 'member/lifestyle/gezondheid/dossier/weg'];

/* ================= 1. de matrix ================= */

/* mogen = de rollen die WEL door de deur horen te komen. */
async function matrix(paden, mogen) {
  const alle = { lid: () => lid.token, zaak: () => zaakA.token, kantoor: () => kantoor, eigenaar: () => eigenaar };
  for (const pad of paden) {
    // niemand komt binnen zonder token of met onzin
    for (const t of [undefined, 'geen-echt-token'])
      assert.ok([401, 403].includes((await api(pad, { id: 'x' }, t)).status),
        pad + ' zonder geldige sessie');

    for (const [rol, geef] of Object.entries(alle)) {
      const r = await api(pad, { id: 'x', code: 'x', tekst: 'x' }, geef());
      assert.notEqual(r.status, 500, pad + ' met een ' + rol + '-sessie valt om');
      if (mogen.includes(rol)) {
        assert.ok(![401, 403].includes(r.status),
          pad + ' hoort open te gaan voor ' + rol + ', kreeg ' + r.status + ' ' + r.tekst.slice(0, 100));
      } else {
        assert.ok([401, 403].includes(r.status),
          pad + ' hoort DICHT te zitten voor een ' + rol + '-sessie, kreeg ' + r.status);
      }
    }
  }
}

test('1. de 11 algemene zaak-endpoints openen alleen met een zaaksessie', async () => {
  await matrix(ZAAK, ['zaak']);
});

test('2. de 12 genre-endpoints hebben TWEE sloten, en ze weigeren om verschillende redenen', async () => {
  /* Het onderscheid dat deze test bewaakt: wie geen zaak is strandt op de
     AUTHENTICATIE, wie wel een zaak is maar het verkeerde genre heeft strandt
     op de GENREPOORT. Zouden die ooit samenvallen in een generieke 403, dan is
     het van buiten niet meer te zien of het tweede slot er nog is. */
  for (const [pad, genre] of ZAAK_GENRE) {
    for (const t of [undefined, 'geen-echt-token', lid.token, kantoor]) {
      const r = await api(pad, { id: 'x' }, t);
      assert.ok([401, 403].includes(r.status), pad + ' zonder zaaksessie: ' + r.status);
      assert.equal(genre.test(r.tekst), false,
        pad + ' verklapt het genre niet aan wie niet eens een zaak is: ' + r.tekst.slice(0, 90));
    }
    const alsZaak = await api(pad, { id: 'x' }, zaakA.token);
    assert.equal(alsZaak.status, 403, pad + ' met een zaak van het verkeerde genre: ' + alsZaak.status);
    assert.match(alsZaak.tekst, genre, pad + ' meldt op welk genre het wel mag');
  }
});

test('3. de 12 kantoor-endpoints openen voor kantoor en voor de eigenaar', async () => {
  /* De eigenaar hoort hier binnen te komen: zijn account draagt de kantoorrol.
     Een lid en een zaak niet. */
  await matrix(KANTOOR, ['kantoor', 'eigenaar']);
});

test('4. de 3 boardroom-endpoints openen ALLEEN voor de eigenaar', async () => {
  /* Strenger dan kantoor, en dat is het verschil dat stilletjes kan wegvallen
     als iemand ooit officeAuth hergebruikt: een geldige kantoorsessie is hier
     expliciet niet genoeg. */
  await matrix(EIGENAAR, ['eigenaar']);
});

test('5. de 3 algemene leden-endpoints openen voor een lid en voor de eigenaar', async () => {
  /* De eigenaar is zelf ook lid (Business Pass), dus hij komt er ook in. Een
     zaak en het kantoor niet -- die hebben geen ledendossier. */
  await matrix(LID, ['lid', 'eigenaar']);
});

test('6. de 2 gezondheidsroutes vragen om een ledensessie EN de Lifestyle Pass', async () => {
  /* Dezelfde vorm als de genrepoort bij de zaken, andere as: hier is het
     tweede slot de PAS. Een gewoon RTG-lid heeft een geldige sessie en komt er
     toch niet in -- met een melding die over de pas gaat en niet over inloggen.
     Dat onderscheid is precies wat je kwijtraakt als iemand de twee sloten ooit
     samenvouwt tot een generieke 403. */
  for (const pad of LID_PAS) {
    for (const t of [undefined, 'geen-echt-token', zaakA.token, kantoor])
      assert.ok([401, 403].includes((await api(pad, { id: 'x' }, t)).status), pad + ' zonder ledensessie');

    const zonderPas = await api(pad, { id: 'x' }, lidRtg.token);
    assert.equal(zonderPas.status, 403, pad + ' voor een RTG-lid: ' + zonderPas.status);
    assert.match(zonderPas.tekst, /Lifestyle/i, pad + ' meldt dat het om de pas gaat, niet om de inlog');

    const metPas = await api(pad, { id: 'bestaat-niet' }, lid.token);
    assert.ok(![401, 403].includes(metPas.status),
      pad + ' gaat open met de Lifestyle Pass: ' + metPas.status + ' ' + metPas.tekst.slice(0, 90));
  }
});

/* ================= 2. de diepte, waar de inhoud telt ================= */

test('7. de vertrouwenslijn: een melding hoort bij een PERSOON, niet bij een bedrijf', async () => {
  /* De vertrouwenslijn is waar een medewerker meldt wat hij niet aan zijn
     leidinggevende durft te vertellen. De draad hangt daarom aan de
     persoonlijke inlog (staffId) en niet aan de bedrijfssessie -- anders leest
     de volgende die op dezelfde kassa inlogt gewoon mee. */
  const MELDING = 'VERTROUWELIJK-' + Math.random().toString(36).slice(2, 8);
  const stuur = await api('staff/trust/send', { text: MELDING, anon: true }, zaakA.token);
  assert.equal(stuur.status, 200, stuur.tekst.slice(0, 200));

  const eigen = await api('staff/trust/thread', {}, zaakA.token);
  assert.equal(eigen.status, 200);
  assert.ok(eigen.tekst.includes(MELDING), 'de melder ziet zijn eigen draad terug');

  // een medewerker van een ANDER bedrijf ziet er niets van
  const ander = await api('staff/trust/thread', {}, zaakB.token);
  assert.equal(ander.status, 200);
  assert.equal(ander.tekst.includes(MELDING), false,
    'een medewerker van een ander bedrijf leest de melding niet');

  // en een leeg bericht is geen melding
  assert.equal((await api('staff/trust/send', { text: '' }, zaakA.token)).status, 400);
});

test('8. het labproject: een team is zichtbaar voor het kantoor, niet voor een zaak of een lid', async () => {
  const team = await api('lab/project/team', { id: 'bestaat-niet' }, kantoor);
  assert.notEqual(team.status, 500, 'een onbekend project valt niet om: ' + team.status);
  assert.ok([200, 400, 404].includes(team.status), 'en geeft een nette uitslag: ' + team.status);

  for (const [rol, t] of [['zaak', zaakA.token], ['lid', lid.token]]) {
    const r = await api('lab/project/team', { id: 'bestaat-niet' }, t);
    assert.ok([401, 403].includes(r.status), 'het labteam is dicht voor een ' + rol + ': ' + r.status);
  }
});

test('9. een medisch dossier wissen kan alleen de eigenaar ervan', async () => {
  /* De gezondheidskaart van de Lifestyle Pass. Twee eisen die elkaar aanvullen:
     lid B kan het dossier van lid A niet wissen, en na zijn poging staat het er
     bij A nog. De status zegt hier weer weinig -- de weg-functies filteren
     binnen het eigen dossier -- dus we kijken naar wat er overblijft. */
  /* DE TWEE ALS-EN DIE HIER STONDEN. Het aanmaken werd geaccepteerd met
     [200, 400], en de hele poging van lid B zat daarna in `if (dossier bevat
     MERK)` en `if (id && id.id)`. Alle drie klopten ze altijd -- gzDossier()
     weigert alleen een LEGE titel -- maar dat is precies het probleem: brak het
     aanmaken, dan viel de IDOR-controle er geruisloos uit en bleef de toets
     groen. De grendel die hier bewaakt wordt was dan niet zwakker geworden;
     alleen de bewaking. Nu is elke stap een bewering. */
  const MERK = 'DOSSIER-' + Math.random().toString(36).slice(2, 8);
  const maak = await api('member/lifestyle/gezondheid/dossier', { titel: MERK, soort: 'uitslag', tekst: 'vertrouwelijk' }, lid.token);
  assert.equal(maak.status, 200, 'dossier aanmaken: ' + maak.status + ' ' + maak.tekst.slice(0, 150));

  const mijn = await api('member/lifestyle/gezondheid', {}, lid.token);
  assert.equal(mijn.status, 200, 'de gezondheidskaart is op te vragen');
  const notitie = (mijn.body.dossiers || mijn.body.dossier || []).find(d => (d.titel || '').includes(MERK));
  assert.ok(notitie && notitie.id, 'het verse dossier staat in de kaart van lid A: ' + JSON.stringify(mijn.body).slice(0, 160));

  // lid B probeert het te wissen
  await api('member/lifestyle/gezondheid/dossier/weg', { id: notitie.id }, lidB.token);
  const na = await api('member/lifestyle/gezondheid', {}, lid.token);
  assert.ok(JSON.stringify(na.body).includes(MERK),
    'het dossier van lid A staat er nog na de poging van lid B');
  // en de eigenaar wist het wel
  assert.equal((await api('member/lifestyle/gezondheid/dossier/weg', { id: notitie.id }, lid.token)).status, 200);
  const weg = await api('member/lifestyle/gezondheid', {}, lid.token);
  assert.equal(JSON.stringify(weg.body).includes(MERK), false, 'en daarna is het echt weg');
  // niets van lid A staat in de kaart van lid B
  const kaartB = await api('member/lifestyle/gezondheid', {}, lidB.token);
  assert.equal(JSON.stringify(kaartB.body).includes(MERK), false,
    'het dossier van A duikt niet op bij B');
});

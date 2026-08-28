/* DE OPLOSSER (kern/reisoplosser.js) -- REIZEN.md fase 5: "Los het op".

   De gevaarlijkste belofte van deze knop is dat hij dingen REGELT. Dat doet
   hij met opzet bijna niet, en dat is wat hier bewezen wordt:

   1. `los` voert NIETS uit -- na het opvragen van voorstellen is de agenda
      even leeg als ervoor;
   2. het enige uitvoerbare voorstel is een TAAK in de eigen agenda, na een
      klik, en idempotent: twee keer drukken zet geen tweede taak;
   3. een alternatief is een verwijzing naar het domein -- de oplosser zegt
      nergens dat er iets geboekt of gereserveerd is, en `doe` weigert een
      alternatief uit te voeren (409, met de verwijzing);
   4. het voorstel-id is een verwijzing, geen inhoud: `doe` herberekent
      server-side en een verzonnen of verouderd id doet niets;
   5. soms valt er niets te doen, en dan staat dat er ("afwachten is geen
      taak"), in plaats van een nepknop.

   De alternatieven zelf: uit de eigen catalogus (afgewezen reisaanvraag) en
   van het eigen vluchtbord (vertraagde vlucht), met de vertraagde en de
   geannuleerde vluchten eruit gefilterd.

   Puur op nagebootste kernen; de laatste toets bewijst de echte deur en de
   hele keten wacht -> oplosser -> taak -> wacht.

   Draai los: node --experimental-sqlite --test test/reisoplosser.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { maakReisoplosser } = require('../server/kern/reisoplosser');
const { startServer, stop } = require('./helper');

const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

/* Een nagebootste kern rond EEN reis met opgegeven signalen. De agenda houdt
   echt bij wat erin wordt gezet, zodat toets 1 en 2 kunnen meten. */
function oplosserMet({ signalen, onderdelen, catalogus, bord, agendaRij }) {
  const rij = agendaRij || [];
  const reis = { id: 'R-x', bestemming: 'Dubai', venster: { van: dag(20), tot: dag(25) },
    signalen: signalen || [], gereed: !(signalen || []).length };
  const kern = {
    reiswacht: { wacht: () => ({ ok: true, reizen: [reis], stil: [] }) },
    mijnReizen: () => ({ ok: true, reizen: [{ id: 'R-x', bestemming: 'Dubai',
      venster: reis.venster, onderdelen: onderdelen || [] }], los: [] }),
    reisbureau: { reizen: () => catalogus || [] },
    lucht: { bord: () => ({ vluchten: bord || [] }) },
    agenda: { lijst: () => rij, voegToe: async (eig, t) => { rij.push({ ...t, id: 't' + rij.length }); return { ok: true, item: rij[rij.length - 1] }; } },
    visumtaak: { bijBoeking: async (key, { ref }) => {
      if (rij.some(i => i.bron === 'reis:' + ref)) return { taak: null };
      rij.push({ titel: 'Visum aanvragen', bron: 'reis:' + ref, id: 't' + rij.length });
      return { taak: rij[rij.length - 1] };
    } }
  };
  return { o: maakReisoplosser({ kern }).reisoplosser, rij };
}
const sig = (ernst, tekst, bron, grond) => ({ ernst, tekst, bron, grond: grond || 'toets' });

test('1. los() voert niets uit, en zegt zijn grens hardop', () => {
  const { o, rij } = oplosserMet({
    signalen: [sig('aandacht', 'Dubai vraagt vooraf een e-visum; wij zien daarvoor geen taak in uw agenda. Al geregeld? Dan is dit signaal klaar.', 'landregels')],
    onderdelen: [{ soort: 'reis', titel: 'Woestijn', kenmerk: 'R1', bestemming: 'Dubai' }]
  });
  const r = o.los('k', 'R-x');
  assert.equal(r.ok, true);
  assert.equal(r.blokken.length, 1);
  assert.equal(r.blokken[0].voorstellen[0].soort, 'taak');
  assert.deepEqual(rij, [], 'voorstellen opvragen zet niets in de agenda');
  assert.match(r.grens, /voert hier niets uit/i, 'de grens staat in het antwoord zelf');
  assert.equal(r.momentopname, true);
});

test('2. de taak: een klik, idempotent, en de wacht ziet hem daarna', async () => {
  const { o, rij } = oplosserMet({
    signalen: [sig('aandacht', 'Dubai vraagt vooraf een e-visum; wij zien daarvoor geen taak in uw agenda. Al geregeld? Dan is dit signaal klaar.', 'landregels')],
    onderdelen: [{ soort: 'reis', titel: 'Woestijn', kenmerk: 'R1', bestemming: 'Dubai' }]
  });
  const v = o.los('k', 'R-x').blokken[0].voorstellen[0];
  const een = await o.doe('k', 'R-x', v.id);
  assert.equal(een.ok, true);
  assert.ok(een.taak, 'de taak staat er');
  assert.equal(rij.length, 1);
  const twee = await o.doe('k', 'R-x', v.id);
  assert.equal(twee.ok, true);
  assert.equal(twee.al, true, 'de tweede klik zegt dat hij er al staat');
  assert.equal(rij.length, 1, 'en zet geen tweede taak');
});

test('3. een afgewezen reisaanvraag krijgt alternatieven uit de catalogus -- als verwijzing, nooit als boeking', async () => {
  const { o } = oplosserMet({
    signalen: [sig('incident', 'Woestijn: afgewezen', 'Reisbureau')],
    onderdelen: [{ soort: 'reis', titel: 'Woestijn', kenmerk: 'R1', bestemming: 'Dubai' }],
    catalogus: [
      { id: 'dubai-luxe', titel: 'Dubai Deluxe', bestemming: 'Dubai', prijs: 2400 },
      { id: 'gstaad', titel: 'Alpen', bestemming: 'Gstaad', prijs: 3000 },
      { id: 'dubai-strand', titel: 'Strand & Marina', bestemming: 'Dubai', prijs: 1800 }
    ]
  });
  const r = o.los('k', 'R-x');
  const alt = r.blokken[0].voorstellen;
  assert.equal(alt.length, 2, 'dezelfde bestemming eerst: alleen de twee Dubai-reizen');
  assert.ok(alt.every(a => a.soort === 'alternatief' && a.link === '/apps/reisbureau.html'));
  assert.equal(alt[0].kosten.bedrag, 2400, 'met de nettoprijs van nu erbij');
  assert.ok(!JSON.stringify(r).match(/geboekt|gereserveerd/i), 'nergens wordt een boeking beweerd');
  // en doe() weigert een alternatief uit te voeren
  const weiger = await o.doe('k', 'R-x', alt[0].id);
  assert.equal(weiger.status, 409);
  assert.match(weiger.error, /Reisbureau/, 'met de verwijzing naar waar het wel kan');
});

test('4. een vertraagde vlucht krijgt het bord van nu -- zonder de vertraagde en de geannuleerde', () => {
  const { o } = oplosserMet({
    signalen: [sig('aandacht', 'RT101: vertraagd', 'Vluchten')],
    onderdelen: [{ soort: 'vlucht', titel: 'RT101', kenmerk: 'B1', bestemming: 'Dubai' }],
    bord: [
      { id: 'v1', nummer: 'RT101', bestemming: 'Dubai', datum: dag(20), tijd: '10:00', status: 'vertraagd' },
      { id: 'v2', nummer: 'RT205', bestemming: 'Dubai', datum: dag(20), tijd: '14:30', status: 'gepland' },
      { id: 'v3', nummer: 'RT300', bestemming: 'Dubai', datum: dag(20), tijd: '18:00', status: 'geannuleerd' },
      { id: 'v4', nummer: 'RT400', bestemming: 'Parijs', datum: dag(20), tijd: '12:00', status: 'gepland' }
    ]
  });
  const alt = o.los('k', 'R-x').blokken[0].voorstellen;
  assert.equal(alt.length, 1, 'alleen RT205: niet de vertraagde zelf, niet de geannuleerde, niet Parijs');
  assert.match(alt[0].tekst, /RT205/);
  assert.match(alt[0].uitleg, /van dit moment/i, 'het bord van nu, geen belofte');
});

test('5. afwachten is geen taak, en zonder oplossing staat dat er eerlijk', () => {
  const { o } = oplosserMet({
    signalen: [
      sig('aandacht', 'Woestijn: aangevraagd (wacht op de zaak)', 'Tickets'),
      sig('aandacht', 'iets onbekends dat nergens op lijkt', 'onbekend')
    ],
    onderdelen: [{ soort: 'activiteit', titel: 'Woestijn', kenmerk: 'T1', bestemming: 'Dubai' }]
  });
  const [wachtBlok, onbekendBlok] = o.los('k', 'R-x').blokken;
  assert.equal(wachtBlok.voorstellen[0].soort, 'afwachten');
  assert.match(wachtBlok.voorstellen[0].tekst, /afwachten is geen taak/i);
  assert.equal(onbekendBlok.voorstellen[0].soort, 'geen');
  assert.match(onbekendBlok.voorstellen[0].tekst, /geen oplossing/i);
});

test('6. het voorstel-id is een verwijzing: verzonnen of verouderd doet niets', async () => {
  const { o, rij } = oplosserMet({
    signalen: [sig('aandacht', 'Verloopt voor het einde van deze reis: paspoort van Sam (geldig tot ' + dag(22) + ')', 'documenten')],
    onderdelen: [{ soort: 'reis', titel: 'Woestijn', kenmerk: 'R1', bestemming: 'Dubai' }]
  });
  assert.equal((await o.doe('k', 'R-x', 'taak-visum:verzonnen')).status, 404);
  assert.deepEqual(rij, [], 'en er is niets uitgevoerd');
  // het echte documentvoorstel werkt wel, en ook idempotent
  const v = o.los('k', 'R-x').blokken[0].voorstellen[0];
  assert.equal(v.soort, 'taak');
  assert.match(v.tekst, /paspoort van Sam/);
  const een = await o.doe('k', 'R-x', v.id);
  assert.equal(een.ok, true);
  assert.match(rij[0].titel, /Verleng paspoort van Sam/);
  const twee = await o.doe('k', 'R-x', v.id);
  assert.equal(twee.al, true);
  assert.equal(rij.length, 1);
});

test('7. valt de wacht om, dan is de oplosser stuk -- geen lege voorstellen', () => {
  const { o } = (() => {
    const kern = { reiswacht: { wacht: () => ({ ok: false, status: 503, error: 'plat' }) } };
    return { o: maakReisoplosser({ kern }).reisoplosser };
  })();
  const r = o.los('k', 'R-x');
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
});

/* De echte deur, met de hele keten: wacht -> los -> taak -> wacht. */
test('8. /api/reis/los: de visumvraag wordt met een klik een taak, en de wacht ziet hem', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-oplosser-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    assert.equal((await post('/api/reis/los', {}, null)).status, 401);
    const u = Date.now().toString().slice(-8);
    const lid = (await post('/api/auth/register', { name: 'Reiziger', email: 'op' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
    // een ingevoerde reis naar India: visumplichtig, en zonder taak (geen boeking)
    const lees = await post('/api/reis/invoer/lees', { tekst: 'Rondreis India, vertrek ' + dag(20) }, lid);
    await post('/api/reis/invoer/bevestig', { id: lees.body.voorstel.id,
      velden: { titel: 'Rondreis India', soort: 'activiteit', bestemming: 'India', van_datum: dag(20) } }, lid);

    const wacht = await post('/api/reis/wacht', {}, lid);
    const reis = wacht.body.reizen.find(x => /india/i.test(x.bestemming));
    assert.ok(reis.signalen.some(s => s.bron === 'landregels'), 'de visumvraag staat er');

    const los = await post('/api/reis/los', { reisId: reis.id }, lid);
    assert.equal(los.status, 200);
    const taak = los.body.blokken.flatMap(b => b.voorstellen).find(v => v.soort === 'taak');
    assert.ok(taak, 'er ligt een taak-voorstel klaar');

    const doe = await post('/api/reis/los/doe', { reisId: reis.id, voorstel: taak.id }, lid);
    assert.equal(doe.status, 200);
    assert.ok(doe.body.taak, 'de taak staat in de agenda');

    // en de keten sluit: de wacht ziet nu een OPEN taak in plaats van een vraag
    const na = await post('/api/reis/wacht', {}, lid);
    const reisNa = na.body.reizen.find(x => /india/i.test(x.bestemming));
    assert.ok(reisNa.signalen.some(s => s.bron === 'visumtaken' && /staat nog open/.test(s.tekst)),
      'de vraag is een open taak geworden: ' + JSON.stringify(reisNa.signalen));
    assert.ok(!reisNa.signalen.some(s => s.bron === 'landregels'), 'en de vraag zelf is weg');
  } finally {
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

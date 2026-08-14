/* De Supplier OS-koppeling: wat de ondernemer in zijn eigen systeem verandert,
   verandert in de Mall mee. Geen tweede administratie, en geen stand die de
   Mall zelf verzint.

   De kern van dit bestand is toets 3: de ondernemer blokkeert vandaag in zijn
   agenda, en de Mall zegt daarna "Vandaag gesloten". Dat is de hele belofte,
   end to end gemeten en niet uit een eenheidstoets afgeleid.

   Elke toets is met een mutatie nagetrokken (LAT-regel 2); wat er is omgezet en
   welke toets zakte staat in het commit-bericht.
   Draai los: node --experimental-sqlite --test test/mall-supplieros.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { WAAROM_NULL } = require('../server/kern/mall/stand');
const { lokaal } = require('../server/kern/tijdzone');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mallos-'));
let srv, base, lid;
const tok = {};

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
async function login(code) {
  const roster = await api('/api/supplier/roster', { code });
  const chef = (roster.body.staff || []).find(m => m.role === 'manager');
  if (!chef) return null;
  const r = await api('/api/supplier/login', { code, staffId: chef.id, pin: '1234' });
  return r.body.token || null;
}
// het aanbod van een zaak zoals de Mall het toont
async function mallVan(code, extra) {
  const r = await api('/api/mall/zoek', { per: 60, ...(extra || {}) }, lid);
  assert.equal(r.status, 200);
  return { alles: r.body, mijn: r.body.items.filter(a => a.aanbieder.code === code) };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const reg = await api('/api/auth/register', { name: 'Stand Kijker', email: 'stand@x.nl', phone: '0612345676',
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'lifestyle', pasApp: 'lifestyle' });
  lid = reg.body.token;
  assert.ok(lid, 'lid-registratie geeft een token');
  for (const c of ['SERENA', 'KIKUNOI']) tok[c] = await login(c);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de koppeling hangt er echt: alle drie de bronnen zijn aangesloten', async () => {
  /* Zonder deze toets kan de hele koppeling stilvallen zonder dat iets klaagt:
     alle standen worden dan null en de Mall ziet er precies zo uit als ervoor
     (LAT-regel 3). */
  const r = await api('/api/mall/zoek', {}, lid);
  assert.deepEqual(r.body.standbron, { vakwerk: true, foodcourt: true, zaak: true },
    'vakwerk (agenda), foodcourt (tafels) en zaak (schakelaars) hangen alle drie aan de Mall');
});

test('2. een dienstverlener draagt zijn eigen openingstijden de Mall in', async () => {
  assert.ok(tok.SERENA, 'de wellness-zaak kan inloggen');
  const uren = await api('/api/supplier/vak/uren', {}, tok.SERENA);
  assert.equal(uren.status, 200);
  assert.ok(uren.body.uren.van && uren.body.uren.tot, 'de zaak heeft uren in haar eigen agenda');

  const { mijn } = await mallVan('SERENA');
  assert.ok(mijn.length >= 1, 'haar diensten staan in de Mall');
  for (const a of mijn) {
    assert.ok(a.open, a.titel + ' draagt een stand');
    assert.ok(a.open.open === true || a.open.open === false, 'en die is bekend, want de agenda is ingevuld');
    assert.equal(a.open.bron, 'agenda', 'de stand komt uit haar agenda en niet uit een aanname');
  }
});

test('3. de ondernemer blokkeert vandaag, en de Mall zegt het', async () => {
  /* Eerst vandaag tot een werkdag maken. Zonder deze stap hing de toets aan de
     weekdag waarop hij toevallig draaide: op een zondag stond de zaak al dicht
     en bewees het blokkeren daarna niets (LAT-regel 9). De oorspronkelijke
     dagen worden aan het eind teruggezet. */
  const begin = (await api('/api/supplier/vak/uren', {}, tok.SERENA)).body.uren;
  /* "Vandaag" is de kalenderdag bij de zaak, niet de UTC-dag van de
     testrunner. Rond middernacht kunnen die verschillen. Lees daarom dezelfde
     zaakzone als de Mall en laat de gedeelde tijdzonehulp de datum bepalen. */
  const spiegel = await api('/api/supplier/mall', {}, tok.SERENA);
  const vandaag = lokaal(spiegel.body.tijdzone.zone).datum;
  const alleDagen = await api('/api/supplier/vak/uren-zet', { dagen: [true, true, true, true, true, true, true] }, tok.SERENA);
  assert.equal(alleDagen.status, 200);

  // vooraf: de Mall kent een stand die niet "vandaag gesloten" is
  const voor = (await mallVan('SERENA')).mijn[0];
  assert.ok(voor, 'er is een dienst om over te oordelen');
  assert.notEqual(voor.open.tekst, 'Vandaag gesloten', 'vandaag is nu een werkdag');

  // de ondernemer blokkeert vandaag in zijn EIGEN scherm
  const zet = await api('/api/supplier/vak/uren-zet', { blokkeer: vandaag }, tok.SERENA);
  assert.equal(zet.status, 200);
  assert.ok(zet.body.uren.geblokkeerd.includes(vandaag), 'de blokkade staat in zijn agenda');

  // en de Mall volgt, zonder dat er iets is overgezet
  const na = (await mallVan('SERENA')).mijn[0];
  assert.equal(na.open.open, false, 'de Mall zegt nu: dicht');
  assert.equal(na.open.tekst, 'Vandaag gesloten');
  /* En er wordt geen tijdvak van VANDAAG meer aangeboden. Wel een van morgen:
     "dicht vandaag, eerste plek morgen om 09:00" is precies wat een gesloten
     dag hoort op te leveren, en die eerste versie van deze toets eiste ten
     onrechte helemaal geen beschikbaarheid meer. */
  if (na.beschikbaar) {
    assert.notEqual(na.beschikbaar.datum, vandaag, 'geen tijdvak op de geblokkeerde dag');
    assert.match(na.beschikbaar.tekst, /Eerste plek/, 'maar wel het eerstvolgende moment daarna');
  }

  // het filter "Nu open" laat hem daarmee ook vallen
  const open = await mallVan('SERENA', { openNu: true });
  assert.equal(open.mijn.length, 0, 'een geblokkeerde dag komt niet in "Nu open"');

  // terugdraaien, zodat de volgende toetsen op een normale zaak kijken
  const terug = await api('/api/supplier/vak/uren-zet', { deblokkeer: vandaag }, tok.SERENA);
  assert.ok(!terug.body.uren.geblokkeerd.includes(vandaag), 'de blokkade is er weer af');
  const herstel = (await mallVan('SERENA')).mijn[0];
  assert.notEqual(herstel.open.tekst, 'Vandaag gesloten', 'en de Mall is meteen weer bij');

  await api('/api/supplier/vak/uren-zet', { dagen: begin.dagen }, tok.SERENA);
});

test('4. de schakelaar van de zaak sluit de Mall-kant net zo goed', async () => {
  assert.ok(tok.KIKUNOI, 'het restaurant kan inloggen');
  const voor = (await mallVan('KIKUNOI')).mijn.find(a => a.type === 'eten');
  assert.ok(voor, 'het restaurant staat in de Mall');
  assert.ok(voor.beschikbaar, 'en neemt nu reserveringen aan');

  const uit = await api('/api/supplier/zaak/functie', { id: 'reserveren', aan: false }, tok.KIKUNOI);
  assert.equal(uit.status, 200);

  const na = (await mallVan('KIKUNOI')).mijn.find(a => a.type === 'eten');
  assert.equal(na.beschikbaar, null, 'de Mall biedt geen reservering meer aan');
  assert.equal(na.open.open, false, 'en zegt dat de zaak nu dicht is');
  assert.equal(na.open.bron, 'schakelaar', 'met de reden erbij: de zaak zette hem zelf uit');

  await api('/api/supplier/zaak/functie', { id: 'reserveren', aan: true }, tok.KIKUNOI);
  const terug = (await mallVan('KIKUNOI')).mijn.find(a => a.type === 'eten');
  assert.ok(terug.beschikbaar, 'en na het omzetten staat hij er meteen weer');
});

test('5. "Nu open" laat nooit een zaak door waarvan we het niet weten', async () => {
  /* Eerst een zaak maken waarvan we ZEKER weten dat ze nu open is: alle dagen,
     de klok rond. Zonder die stap hing deze toets aan het uur waarop hij
     draaide -- viel hij buiten lunch en diner, dan was "Nu open" leeg en
     slaagde alles hieronder over een lege lijst (LAT-regel 9). */
  const begin = (await api('/api/supplier/vak/uren', {}, tok.SERENA)).body.uren;
  await api('/api/supplier/vak/uren-zet', { dagen: [true, true, true, true, true, true, true], van: '00:00', tot: '23:59' }, tok.SERENA);

  const alles = await api('/api/mall/zoek', { per: 60 }, lid);
  const open = await api('/api/mall/zoek', { per: 60, openNu: true }, lid);
  assert.ok(open.body.totaal >= 1, 'de zaak die de klok rond open staat, staat in "Nu open"');
  assert.ok(open.body.items.some(a => a.aanbieder.code === 'SERENA'), 'en het is de zaak die we net open zetten');
  assert.ok(open.body.totaal < alles.body.totaal, 'het filter doet werkelijk iets');
  for (const a of open.body.items) {
    assert.equal(a.open.open, true, a.titel + ' staat er alleen omdat de zaak zelf zegt dat ze open is');
  }
  /* En een zaak zonder uren draagt de reden, niet een gok. Dit stond eerst
     achter `if (zonder)`, en toen bewees het niets: de mutatie "behandel
     onbekend als open" liet geen enkele toets zakken, want zonder null-standen
     werd de hele controle overgeslagen (LAT-regel 9). De boutieks in de Mall
     dragen geen openingstijden, dus die er MOETEN zijn is zelf een bewering. */
  const zonder = alles.body.items.filter(a => a.open && a.open.open === null);
  assert.ok(zonder.length >= 1, 'er is aanbod van een zaak zonder vastgelegde uren, anders meet deze toets niets');
  for (const a of zonder) {
    assert.equal(a.open.tekst, WAAROM_NULL, a.titel + ': een onbekende stand zegt waarom hij onbekend is');
    assert.equal(a.open.bron, 'geen', 'en draagt geen bron die er niet is');
    assert.ok(!open.body.items.some(x => x.id === a.id), a.titel + ' komt niet in "Nu open"');
  }

  await api('/api/supplier/vak/uren-zet', { dagen: begin.dagen, van: begin.van, tot: begin.tot }, tok.SERENA);
});

test('6. voorraad nul is een antwoord, geen leegte', () => {
  /* Een artikel dat op is blijft zichtbaar met "Uitverkocht" erbij; stil
     verdwijnen laat de klant zoeken naar iets wat er gisteren nog was. Met een
     eigen db, zodat de toets niet afhangt van wat de demozaken toevallig op
     voorraad hebben. */
  const { maakMall } = require('../server/kern/mall');
  const db = { data: {
    suppliers: [{ code: 'VOOR', name: 'Voorraadzaak', type: 'retail', city: 'Testdorp',
      loc: { lat: 52.38, lng: 4.63 },
      artikelen: [
        { id: 'op', naam: 'Laatste sjaal', publiekePrijs: 40, varianten: [{ voorraad: 2 }] },
        { id: 'leeg', naam: 'Uitverkochte sjaal', publiekePrijs: 40, varianten: [{ voorraad: 0 }] }
      ] }],
    supplierTypes: { retail: { label: 'Retail', caps: ['retail'] } },
    partnerTrips: [], markt: { ads: [] }
  } };
  require('../server/kern/werkvormen').haakAan(db);
  const mall = maakMall({ db, save() {}, crypto: require('crypto'),
    isRetail: (s) => s.type === 'retail', haalThuis: () => null, haalLandVind: () => null }).mall;

  const alles = mall.mallZoek({ per: 60 }).items;
  const op = alles.find(a => a.titel === 'Laatste sjaal');
  const leeg = alles.find(a => a.titel === 'Uitverkochte sjaal');
  assert.ok(op && leeg, 'allebei de artikelen staan in de Mall');
  assert.equal(op.beschikbaar.tekst, 'Nog 2 op voorraad', 'een kleine voorraad wordt genoemd, want dat is waar');
  assert.equal(leeg.beschikbaar.tekst, 'Uitverkocht');
  assert.equal(leeg.beschikbaar.uit, true, 'en is als uitverkocht gemarkeerd');

  const teKoop = mall.mallZoek({ per: 60, opVoorraad: true }).items;
  assert.ok(teKoop.some(a => a.titel === 'Laatste sjaal'), 'wat er ligt blijft koopbaar');
  assert.ok(!teKoop.some(a => a.titel === 'Uitverkochte sjaal'), 'en wat op is valt uit de koop-lijst');
});

test('7. de zichtbare pagina draagt het eerstvolgende vrije tijdvak', async () => {
  const { mijn } = await mallVan('SERENA');
  const metTijd = mijn.filter(a => a.beschikbaar && /Eerste plek/.test(a.beschikbaar.tekst));
  assert.ok(metTijd.length >= 1, 'minstens een dienst toont wanneer je terecht kunt');
  for (const a of metTijd) {
    assert.match(a.beschikbaar.tekst, /om \d{2}:\d{2}$/, a.titel + ' noemt een echt tijdstip');
    assert.equal(a.beschikbaar.hard, true, 'en dat is een harde beschikbaarheid');
  }
});

test('8. de zaak ziet hoe zij in de Mall staat, en alleen zichzelf', async () => {
  const r = await api('/api/supplier/mall', {}, tok.SERENA);
  assert.equal(r.status, 200);
  assert.equal(r.body.zaak.code, 'SERENA');
  assert.ok(r.body.aantal >= 1, 'haar aanbod staat erin');
  for (const a of r.body.aanbod) assert.ok(a.titel && a.pagina, 'met titel en de plek waar de klant landt');
  assert.deepEqual(r.body.bron, { vakwerk: true, foodcourt: true, zaak: true }, 'de bronnen staan erbij');
  assert.ok(r.body.stand.open, 'en de stand die de Mall van haar leest');

  // niemand kan via deze route bij een andere zaak kijken: er is geen code-parameter
  const ander = await api('/api/supplier/mall', { code: 'KIKUNOI', supplierCode: 'KIKUNOI' }, tok.SERENA);
  assert.equal(ander.body.zaak.code, 'SERENA', 'een meegestuurde code wordt genegeerd');

  // en zonder inlog gaat de deur niet open
  const zonder = await api('/api/supplier/mall', {});
  assert.ok(zonder.status === 401 || zonder.status === 403, 'zonder leverancier-sessie geen toegang (' + zonder.status + ')');
});

test('9. wat de zaak nog mist, staat er met de reden bij', async () => {
  const r = await api('/api/supplier/mall', {}, tok.KIKUNOI);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.ontbreekt), 'er is een lijst met wat er nog mist');
  // het restaurant heeft geen eigen werkgebied ingesteld: dat hoort erin te staan
  const bereik = r.body.ontbreekt.find(x => x.wat === 'werkgebied');
  assert.ok(bereik, 'een niet-ingesteld werkgebied wordt gemeld');
  assert.ok(bereik.gevolg && bereik.waar, 'met het gevolg en waar je het oplost');
  for (const o of r.body.ontbreekt) {
    assert.ok(o.wat && o.gevolg && o.waar, JSON.stringify(o) + ' noemt wat, wat het kost en waar je het doet');
  }
});

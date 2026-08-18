/* De zakelijke laag van het Mobility OS: wie er op rekening van een bedrijf
   mag rijden, binnen welke grenzen, en wie daar ja tegen zegt. Draai los:
   node --test test/zakelijkvervoer.test.js

   Wat deze toetsen bewaken, en waarom juist dat:

   1. HET GAT DAT HIER ZAT. De rittenmotor nam de organisatiecode aan uit het
      verzoek. Elk lid dat de code van een bedrijf kende, kon op diens rekening
      rijden. De dienstverbandcontrole hoort op EEN plek te staan -- in de
      motor, waar elke weg naar een zakelijke rit langskomt -- en niet per
      ingang herhaald te worden, want de volgende ingang vergeet hem.
   2. ELKE AFWIJZING NOEMT DE REGEL EN HET GETAL. "Niet toegestaan" laat een
      medewerker raden of het aan het bedrag, het tijdstip of de kostenplaats
      lag, en dan belt hij zijn manager -- precies wat een beleid voorkomt.
   3. EEN DREMPEL IS GEEN VERBOD. Boven het bedrag mag de rit best, maar er
      kijkt eerst een mens naar. Die twee door elkaar halen is waarom mensen om
      een beleid heen gaan werken.
   4. EEN RIT DIE OP AKKOORD WACHT, RIJDT NIET. Niet op een planbord, niet in
      beweging te krijgen. Zou de wagen alvast rijden, dan is de goedkeuring een
      formaliteit achteraf.
   5. HET MAANDOVERZICHT TELT WAT ER ECHT STAAT: de opdrachten uit de
      rittenmotor, niet een tweede administratie ernaast. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, werker, vreemde, werkerMail, baas, taxi, noraId, kantoor;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zak-'));
const WERKGEVER = 'HOSHI';                  // Aguamarina Ibiza: een hotel, geen vervoerder
const VAN = { lat: 38.908, lng: 1.432, label: 'Kantoor' };
const NAAR = { lat: 38.978, lng: 1.536, label: 'Santa Eularia' };
const OFFICE_CODE = 'KANTOOR-ZAK-1';

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const mail = 'zak' + u + '@x.nl';
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: mail, phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  return { token: reg.body.token, mail };
}
async function managerVan(code) {
  const roster = await api('/api/supplier/roster', { code });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  return (await api('/api/supplier/login', { code, staffId: m.id, pin: '1234' })).body.token;
}
// een zakelijke rit vragen; standaard eentje die overal binnen past
const zakelijkeRit = (token, extra) => api('/api/mob/vraag', Object.assign(
  { ritsoort: 'direct', categorie: 'taxi', van: VAN, naar: NAAR, stad: 'Ibiza',
    namensOrganisatie: WERKGEVER, betaler: 'organisatie' }, extra || {}), token);
// het beleid schoonvegen tussen de toetsen door, zodat ze niet op volgorde leunen
const beleidZet = (velden) => api('/api/supplier/mob/beleid',
  Object.assign({ zet: true, maxPrijs: 0, goedkeuringVanaf: 0, budgetPerMaand: 0,
    dagen: [], van: null, tot: null, steden: [], kostenplaatsen: [],
    kostenplaatsVerplicht: false, ritsoorten: [] }, velden || {}), baas);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
  base = srv.base;
  const a = await lid(); werker = a.token; werkerMail = a.mail;
  vreemde = (await lid()).token;
  baas = await managerVan(WERKGEVER);
  taxi = await managerVan('MKKX');
  assert.ok(baas && taxi, 'beide managers loggen in');

  // de medewerker echt in dienst nemen: uitnodiging + aanmelden met eigen RTG-account
  const inv = await api('/api/supplier/staff/invite', { name: 'Nora Vermeer', role: 'staff', func: 'Sales' }, baas);
  assert.ok(inv.body.invite, 'de manager kan een uitnodiging maken');
  const join = await api('/api/supplier/staff/join', { bedrijf: 'Aguamarina Ibiza',
    kassacode: inv.body.invite.kassacode, login: werkerMail, password: 'geheim123', pin: '4321' });
  assert.equal(join.status, 200, 'de medewerker meldt zich aan bij zijn werkgever');
  noraId = join.body.staffId;

  /* Een inzetbare taxi bij de vervoerder. Zonder wagen strandt een toewijzing
     al bij de matcher, en dan bewijst toets 8 niet dat de rit tegengehouden
     wordt OMDAT hij op akkoord wacht. */
  const wagen = await api('/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Zakenwagen',
    loc: { lat: 38.909, lng: 1.433 },
    papieren: { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
      taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' } }, taxi);
  assert.equal(wagen.body.asset.inzetbaar, true, 'de vervoerder heeft een inzetbare wagen');

  /* Echte OV-kaartverkoop aanzetten. Zonder overeenkomst bevat een reis nooit
     een BETAALD kaartje, en dan bewijst toets 13 niet waar hij over gaat: het
     verschil tussen een rit die naar de werkgever kan en een kaartje dat dat
     niet kan. */
  kantoor = (await api('/api/office/login', { code: OFFICE_CODE })).body.token;
  for (const m of ['partner_contracts', 'public_transport_ticketing'])
    await api('/api/office/mob/module/zet', { id: m, aan: true }, kantoor);
  const ovk = await api('/api/office/mob/overeenkomst', { vervoerder: 'TRANSIT',
    van: '2020-01-01', tot: '2099-12-31', producten: ['enkel'], lijnen: ['L1', 'T1'],
    getekendDoor: 'J. Directeur' }, kantoor);
  assert.ok(ovk.body.overeenkomst, 'de overeenkomst met de OV-vervoerder staat');
});
test.after(async () => { await stop(srv); fs.rmSync(TMP, { recursive: true, force: true }); });

/* ---- 1. het gat zelf ---- */
test('1. een lid dat er niet werkt kan niet op rekening van een bedrijf rijden', async () => {
  const r = await zakelijkeRit(vreemde);
  assert.equal(r.status, 403, 'een vreemde wordt geweigerd');
  assert.match(r.body.error, /niet als medewerker/i, 'en hoort waarom');
  // en er staat ook geen rit klaar die het "toch even probeerde"
  const mijn = await api('/api/mob/mijn', {}, vreemde);
  assert.equal((mijn.body.ritten || []).length, 0, 'er is niets aangemaakt');
});

test('2. een medewerker mag wel, en de rit draagt zijn personeelsnaam', async () => {
  await beleidZet({});
  const r = await zakelijkeRit(werker);
  assert.equal(r.status, 200, 'de medewerker mag rijden');
  assert.equal(r.body.opdracht.organisatie, WERKGEVER);
  assert.equal(r.body.opdracht.betaler.soort, 'organisatie');
  /* De werkgever ziet de naam die hij al kent, de vervoerder de codenaam. Dat
     is geen dubbele administratie maar de scheiding uit accounts.js: de
     chauffeur hoeft niet te weten wie hij ophaalt. */
  assert.equal(r.body.opdracht.medewerker, 'Nora Vermeer');
  assert.notEqual(r.body.opdracht.reizigerCodenaam, 'Nora Vermeer');
  await api('/api/mob/annuleer', { ref: r.body.opdracht.ref }, werker);
});

test('3. prive boeken blijft gewoon prive: geen werkgever, geen beleid', async () => {
  await beleidZet({ maxPrijs: 1 });   // een beleid dat alles zou weigeren
  const r = await api('/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
    van: VAN, naar: NAAR, stad: 'Ibiza' }, werker);
  assert.equal(r.status, 200, 'zijn eigen rit gaat het beleid niet aan');
  assert.equal(r.body.opdracht.organisatie, null);
  assert.equal(r.body.opdracht.betaler.soort, 'reiziger');
  await api('/api/mob/annuleer', { ref: r.body.opdracht.ref }, werker);
});

/* ---- 2. de grenzen, elk met de regel en het getal erbij ---- */
test('4. een maximum per rit wijst af met het bedrag erbij', async () => {
  await beleidZet({ maxPrijs: 500 });
  const r = await zakelijkeRit(werker);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /maximum per rit is € 5,00/, 'het getal staat er letterlijk bij, met een komma');
  assert.match(r.body.error, /Deze rit kost € \d+,\d\d/, 'en wat de rit dan wel kost');
});

test('5. het maandbudget telt de ritten mee die er al staan', async () => {
  await beleidZet({});
  const eerste = await zakelijkeRit(werker);
  assert.equal(eerste.status, 200);
  const prijs = eerste.body.opdracht.prijs;

  // een budget dat de eerste rit net dekt en de tweede niet meer
  await beleidZet({ budgetPerMaand: prijs + 100 });
  const tweede = await zakelijkeRit(werker);
  assert.equal(tweede.status, 403);
  assert.match(tweede.body.error, /uw budget is/, 'de afwijzing noemt het budget');
  assert.match(tweede.body.error, /nu besteed/, 'en wat er al op staat');

  // wat de medewerker vooraf te zien krijgt, is hetzelfde getal
  const zicht = await api('/api/mob/beleid', { werkgever: WERKGEVER }, werker);
  assert.equal(zicht.status, 200);
  assert.equal(zicht.body.besteed, prijs, 'hij ziet vooraf wat hij deze maand al besteedde');
  assert.equal(zicht.body.beleid.budgetPerMaand, prijs + 100);

  /* Annuleren telt niet mee: wie een rit afzegt heeft niets besteed. */
  await api('/api/mob/annuleer', { ref: eerste.body.opdracht.ref }, werker);
  const na = await api('/api/mob/beleid', { werkgever: WERKGEVER }, werker);
  assert.equal(na.body.besteed, 0, 'een geannuleerde rit valt uit het budget');
});

test('6. kostenplaats: verplicht, en alleen een die bestaat', async () => {
  await beleidZet({ kostenplaatsVerplicht: true, kostenplaatsen: ['Sales', 'Inkoop'] });
  const zonder = await zakelijkeRit(werker);
  assert.equal(zonder.status, 403);
  assert.match(zonder.body.error, /kostenplaats verplicht/i);

  const fout = await zakelijkeRit(werker, { kostenplaats: 'Feestje' });
  assert.equal(fout.status, 403);
  assert.match(fout.body.error, /kies uit Sales, Inkoop/, 'de afwijzing noemt de geldige keuzes');

  const goed = await zakelijkeRit(werker, { kostenplaats: 'Sales' });
  assert.equal(goed.status, 200);
  assert.equal(goed.body.opdracht.kostenplaats, 'Sales');
  await api('/api/mob/annuleer', { ref: goed.body.opdracht.ref }, werker);
});

test('7. tijden, dagen, steden en ritsoorten: elk met hun eigen zin', async () => {
  // een moment dat gegarandeerd BUITEN het venster valt, in de tijdzone van de server
  const nacht = new Date(); nacht.setHours(3, 30, 0, 0);
  await beleidZet({ van: '08:00', tot: '18:00' });
  const laat = await zakelijkeRit(werker, { vertrek: nacht.toISOString() });
  assert.equal(laat.status, 403);
  assert.match(laat.body.error, /tussen 08:00 en 18:00; het is nu 03:30/);

  // alleen de dag van vandaag NIET toestaan, zodat de toets niet op de kalender leunt
  const vandaag = new Date().getDay();
  await beleidZet({ dagen: [0, 1, 2, 3, 4, 5, 6].filter(d => d !== vandaag) });
  const dag = await zakelijkeRit(werker);
  assert.equal(dag.status, 403);
  assert.match(dag.body.error, /Zakelijk reizen mag op /);

  await beleidZet({ steden: ['Amsterdam'] });
  const stad = await zakelijkeRit(werker);
  assert.equal(stad.status, 403);
  assert.match(stad.body.error, /toegestaan in Amsterdam; deze rit is in Ibiza/);

  await beleidZet({ ritsoorten: ['gedeeld'] });
  const soort = await zakelijkeRit(werker);
  assert.equal(soort.status, 403);
  assert.match(soort.body.error, /alleen gedeeld; dit is een rit van soort direct/);
});

/* ---- 3. de drempel: geen verbod, wel een mens ---- */
test('8. boven de drempel ontstaat de rit wel, maar hij wacht op akkoord', async () => {
  await beleidZet({ goedkeuringVanaf: 100 });
  const r = await zakelijkeRit(werker, { kostenplaats: 'Sales' });
  assert.equal(r.status, 200, 'een drempel is geen afwijzing');
  assert.equal(r.body.opdracht.goedkeuring.status, 'wacht');
  assert.equal(r.body.opdracht.goedkeuring.drempel, 100);

  // hij staat op GEEN planbord, ook niet op de markt van een andere vervoerder
  const bord = await api('/api/supplier/mob/dispatch', {}, taxi);
  assert.ok(!(bord.body.open || []).some(o => o.ref === r.body.opdracht.ref),
    'een rit die op akkoord wacht ligt niet op de markt');

  // en hij is niet in beweging te krijgen
  const toewijzen = await api('/api/supplier/mob/toewijzen', { ref: r.body.opdracht.ref }, taxi);
  assert.equal(toewijzen.status, 409);
  assert.match(toewijzen.body.error, /wacht op akkoord/);
  /* De mislukte toewijzing mag ook geen sporen achterlaten: zou de vervoerder
     zijn code er toch op zetten, dan zag geen enkele andere planner deze rit
     ooit nog op de markt. */
  const na = await api('/api/mob/volg', { ref: r.body.opdracht.ref }, werker);
  assert.equal(na.body.opdracht.vervoerder, null, 'de rit blijft onbeclaimd');
  assert.equal(na.body.opdracht.status, 'aangevraagd');
});

test('9. de werkgever geeft akkoord en pas dan komt de rit los', async () => {
  await beleidZet({ goedkeuringVanaf: 100 });
  const r = await zakelijkeRit(werker, { kostenplaats: 'Sales' });
  const ref = r.body.opdracht.ref;

  const wacht = await api('/api/supplier/mob/akkoord', {}, baas);
  assert.ok((wacht.body.wachtend || []).some(w => w.ref === ref), 'de manager ziet de aanvraag');
  assert.equal(wacht.body.wachtend.find(w => w.ref === ref).medewerker, 'Nora Vermeer');

  // een medewerker keurt zijn eigen rit niet goed
  const zelf = await api('/api/supplier/mob/akkoord', { ref, akkoord: true }, taxi);
  assert.equal(zelf.status, 403, 'een andere zaak beslist er niet over');

  const ja = await api('/api/supplier/mob/akkoord', { ref, akkoord: true }, baas);
  assert.equal(ja.status, 200);
  assert.equal(ja.body.opdracht.goedkeuring.status, 'akkoord');
  assert.ok(ja.body.opdracht.goedkeuring.door, 'het besluit draagt een naam');

  const bord = await api('/api/supplier/mob/dispatch', {}, taxi);
  assert.ok((bord.body.open || []).some(o => o.ref === ref), 'nu staat hij wel op de markt');
  // en twee keer beslissen kan niet
  const nog = await api('/api/supplier/mob/akkoord', { ref, akkoord: false }, baas);
  assert.equal(nog.status, 409);
  await api('/api/mob/annuleer', { ref }, werker);
});

test('10. weigeren annuleert de rit, want een geweigerde rit die blijft staan wordt gereden', async () => {
  await beleidZet({ goedkeuringVanaf: 100 });
  const r = await zakelijkeRit(werker, { kostenplaats: 'Inkoop' });
  const ref = r.body.opdracht.ref;
  const nee = await api('/api/supplier/mob/akkoord', { ref, akkoord: false, toelichting: 'neem de bus' }, baas);
  assert.equal(nee.status, 200);
  const volg = await api('/api/mob/volg', { ref }, werker);
  assert.equal(volg.body.opdracht.status, 'geannuleerd', 'de rit is weg, niet alleen afgekeurd');
});

/* ---- 4. het overzicht en wie erbij mag ---- */
test('11. het maandoverzicht telt de rittenmotor, per kostenplaats en per medewerker', async () => {
  await beleidZet({});
  const a = await zakelijkeRit(werker, { kostenplaats: 'Sales' });
  const b = await zakelijkeRit(werker, { kostenplaats: 'Inkoop' });
  assert.equal(a.status, 200); assert.equal(b.status, 200);

  const o = await api('/api/supplier/mob/zakelijk', {}, baas);
  assert.equal(o.status, 200);
  const sales = o.body.perKostenplaats.find(k => k.kostenplaats === 'Sales');
  const inkoop = o.body.perKostenplaats.find(k => k.kostenplaats === 'Inkoop');
  assert.ok(sales && inkoop, 'beide kostenplaatsen staan erin');
  assert.equal(sales.centen + inkoop.centen <= o.body.totaal.centen, true);
  const nora = o.body.perMedewerker.find(m => m.medewerker === 'Nora Vermeer');
  assert.ok(nora && nora.aantal >= 2, 'de medewerker staat er met zijn ritten');
  assert.ok(o.body.totaal.co2Gram > 0 && /schatting/i.test(o.body.co2Uitleg),
    'de uitstoot staat er als schatting, niet als meting');

  await api('/api/mob/annuleer', { ref: a.body.opdracht.ref }, werker);
  await api('/api/mob/annuleer', { ref: b.body.opdracht.ref }, werker);
});

test('12. het beleid is van de werkgever, niet van iedereen die de code kent', async () => {
  const vreemd = await api('/api/mob/beleid', { werkgever: WERKGEVER }, vreemde);
  assert.equal(vreemd.status, 403, 'een lid leest het beleid van een vreemd bedrijf niet');
  const zonder = await api('/api/mob/beleid', {}, werker);
  assert.equal(zonder.status, 400, 'zonder werkgever is de vraag niet te beantwoorden');

  /* Wie zijn eigen maximum kan zetten, heeft geen maximum: alleen een manager
     wijzigt het beleid. Lezen mag iedereen met een bedrijfsinlog -- een
     medewerker die de grenzen niet mag weten, loopt er blind tegenaan. */
  const tok = (await api('/api/supplier/login', { code: WERKGEVER, staffId: noraId, pin: '4321' })).body.token;
  assert.ok(tok, 'de medewerker logt in op de bedrijfskant');
  const lees = await api('/api/supplier/mob/beleid', {}, tok);
  assert.equal(lees.status, 200, 'een medewerker mag het beleid lezen');
  const zet = await api('/api/supplier/mob/beleid', { zet: true, maxPrijs: 100000 }, tok);
  assert.equal(zet.status, 403, 'maar niet wijzigen');
  const akkoord = await api('/api/supplier/mob/akkoord', {}, tok);
  assert.equal(akkoord.status, 403, 'en hij keurt zijn eigen ritten niet goed');
});

/* ---- 5. de reis: ritten op de rekening, kaartjes persoonlijk ---- */
test('13. een zakelijke reis zet de rit op de werkgever en het kaartje op de reiziger', async () => {
  await beleidZet({});
  const plan = await api('/api/mob/reis/plan', { van: VAN, naar: NAAR, reizigers: 1 }, werker);
  assert.equal(plan.status, 200, 'de planner geeft opties');
  /* Bewust de GEMENGDE optie: taxi en OV in een reis. Juist daar valt de vraag
     wie wat betaalt uit elkaar, en een pure taxi-optie zou er langs lopen. */
  const optie = (plan.body.opties || []).find(o => (o.etappes || []).some(e => e.wijze === 'ov') &&
    (o.etappes || []).some(e => e.wijze === 'taxi'));
  assert.ok(optie, 'er is een reisoptie met taxi en OV: ' +
    (plan.body.opties || []).map(o => o.naam).join(' | '));

  const r = await api('/api/mob/reis/boek', { van: VAN, naar: NAAR, optie: optie.id,
    namensOrganisatie: WERKGEVER, kostenplaats: 'Sales' }, werker);
  assert.equal(r.status, 200, 'de reis is geboekt: ' + JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.reis.organisatie, WERKGEVER);

  const taxi = r.body.reis.etappes.filter(e => e.wijze === 'taxi');
  for (const e of taxi) {
    const volg = await api('/api/mob/volg', { ref: e.ref }, werker);
    assert.equal(volg.body.opdracht.organisatie, WERKGEVER, 'de rit staat op de werkgever');
    assert.equal(volg.body.opdracht.betaler.soort, 'organisatie');
    assert.equal(volg.body.opdracht.kostenplaats, 'Sales');
  }
  /* Het verschil dat er echt toe doet: een kaartje is HIER EN NU uit de
     portemonnee van de reiziger betaald en kan dus niet met terugwerkende
     kracht op de rekening van een bedrijf. Als er kaartjes in zitten, zegt
     het overzicht dat ook. */
  assert.ok(r.body.reis.betaald > 0,
    'deze reis bevat een BETAALD kaartje; anders bewijst de volgende regel niets');
  assert.match(r.body.reis.uitleg, /vervoerbewijzen blijven persoonlijk/,
    'de reis zegt erbij wie wat betaalt, kreeg: ' + r.body.reis.uitleg);
  await api('/api/mob/reis/annuleer', { id: r.body.reis.id }, werker);
});

test('14. wie er niet werkt, boekt ook geen zakelijke REIS -- en er blijft niets van staan', async () => {
  const plan = await api('/api/mob/reis/plan', { van: VAN, naar: NAAR }, vreemde);
  const optie = (plan.body.opties || [])[0];
  const voor = (await api('/api/mob/mijn', {}, vreemde)).body.ritten.length;
  const r = await api('/api/mob/reis/boek', { van: VAN, naar: NAAR, optie: optie.id,
    namensOrganisatie: WERKGEVER }, vreemde);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /niet als medewerker/i);
  /* Wat dit precies bewijst: de weigering valt VOORDAT er iets is aangemaakt.
     Het terugdraaien van een reis die halverwege strandt is een ander pad
     (draaiTerug in ./reis) en wordt hier NIET geraakt -- die volgorde is
     opzettelijk, want zo hoeft er nooit iets teruggedraaid te worden. */
  const na = await api('/api/mob/mijn', {}, vreemde);
  assert.equal(na.body.ritten.length, voor, 'er is geen rit aangemaakt');
  assert.equal((await api('/api/mob/reis/mijn', {}, vreemde)).body.reizen.length, 0);
});

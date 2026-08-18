/* DE ZAKENWERELD VAN HET PODIUM -- de town hall die alleen het eigen personeel
   ziet.

   Zone 'zaak' (kern/podium/zones.js) hangt aan iets dat dit huis al had: de
   personeelsadministratie. Wie ergens werkt, staat als supplier_staff-rij aan
   zijn RTG-account gekoppeld (accounts.staffPositions) -- diezelfde koppeling
   waarmee de werk-app meekomt bij het inloggen. Daar is niets naast gebouwd:
   er is geen tweede ledenlijst per bedrijf, en dus ook geen lijst die kan gaan
   afwijken (LAT.md regel 4).

   WAT HIER BEWEZEN MOET WORDEN zijn drie verschillende weigeringen, want als
   die op elkaar lijken is de deur in de praktijk niet te repareren:
     - wie NERGENS werkt komt de wereld niet eens in;
     - wie ERGENS ANDERS werkt komt de wereld wel in, maar deze uitzending niet;
     - wie er werkt maar geen leiding heeft, mag kijken en niet zenden.
   En daarnaast: een town hall neemt geen geld aan, en staat in geen enkele
   gedeelde lijst.

   Draai los: node --test test/podiumzaak.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-podiumzaak-'));
let srv, base, office;
let baas, collega, vreemde, buiten;        // vier soorten mensen
let zaakA, zaakB;                          // twee echte demo-bedrijven
let kanaalId;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid(naam) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const email = 'pw' + u + '@x.nl';
  const wachtwoord = 'geheim12345';
  const reg = await api('/api/auth/register', { name: naam, email, phone: '06' + u,
    password: wachtwoord, geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, naam + ' is aangemeld: ' + JSON.stringify(reg.body).slice(0, 120));
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, email, wachtwoord, naam, codenaam: st.body.state.user.codename };
}
/* Een echte werkplek maken langs de weg die het huis daarvoor heeft: de manager
   van de zaak nodigt uit met een kassacode, en het lid meldt zich aan met zijn
   EIGEN RTG-inlog. Daarna kent accounts.staffPositions die plek. */
async function zaakVan(code) {
  const roster = (await api('/api/supplier/roster', { code })).body;
  const man = roster.staff.find(x => x.role === 'manager');
  const login = await api('/api/supplier/login', { code, staffId: man.id, pin: '1234' });
  assert.ok(login.body.token, 'de manager van ' + code + ' is ingelogd');
  return { code: roster.supplier.code, naam: roster.supplier.name, token: login.body.token };
}
async function werkBij(zaak, persoon, rol) {
  const inv = await api('/api/supplier/staff/invite', { name: persoon.naam, role: rol, func: 'demo' }, zaak.token);
  assert.ok(inv.body.invite, 'de uitnodiging is er: ' + JSON.stringify(inv.body).slice(0, 120));
  const join = await api('/api/supplier/staff/join', { bedrijf: zaak.naam, kassacode: inv.body.invite.kassacode,
    login: persoon.email, password: persoon.wachtwoord });
  assert.equal(join.status, 200, persoon.naam + ' werkt nu bij ' + zaak.naam + ': ' + JSON.stringify(join.body).slice(0, 160));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'het kantoor is ingelogd');
  zaakA = await zaakVan('KIKUNOI');
  zaakB = await zaakVan('HOSHI');
  baas = await lid('Baas van A');
  collega = await lid('Collega van A');
  vreemde = await lid('Baas van B');
  buiten = await lid('Werkt nergens');
  await werkBij(zaakA, baas, 'manager');
  await werkBij(zaakA, collega, 'staff');
  await werkBij(zaakB, vreemde, 'manager');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de zonelijst zegt per persoon of de zakenwereld opengaat', async () => {
  const zoneVan = async (p) => (await api('/api/podium/kanalen', { zone: 'open' }, p.token))
    .body.zones.find(z => z.id === 'zaak');

  const z1 = await zoneVan(buiten);
  assert.equal(z1.kijken, false, 'wie nergens werkt komt er niet in');
  assert.match(z1.kijkReden, /organisaties/);

  const z2 = await zoneVan(collega);
  assert.equal(z2.kijken, true, 'wie ergens werkt komt er wel in');
  assert.equal(z2.zenden, false, 'maar begint geen town hall');
  assert.match(z2.zendReden, /leiding/);

  const z3 = await zoneVan(baas);
  assert.equal(z3.zenden, true, 'de leiding mag zenden');
  assert.deepEqual(z3.geld, [], 'en er loopt geen geld in deze wereld');
});

test('2. een medewerker kan geen interne uitzending beginnen, de leiding wel', async () => {
  const niet = await api('/api/podium/kanaal/aanmeld', { naam: 'Zelfbenoemde town hall', zone: 'zaak' }, collega.token);
  assert.equal(niet.status, 403);
  assert.match(niet.body.error, /leiding/);

  /* En de leiding kiest niet zomaar EEN zaak: alleen een zaak waar hij ook
     werkelijk de leiding heeft. Zonder deze controle zou iedere manager een
     uitzending kunnen openen op naam van een willekeurig ander bedrijf, en dan
     kijkt dat hele bedrijf mee. */
  const vreemd = await api('/api/podium/kanaal/aanmeld', { naam: 'Op naam van B', zone: 'zaak', zaakCode: zaakB.code }, baas.token);
  assert.equal(vreemd.status, 403, 'niet op naam van een zaak waar u niets bent');
  assert.match(vreemd.body.error, /leiding/);

  const aan = await api('/api/podium/kanaal/aanmeld', { naam: 'Town hall maandag', zone: 'zaak', bio: 'Intern.' }, baas.token);
  assert.equal(aan.status, 200, JSON.stringify(aan.body).slice(0, 160));
  kanaalId = aan.body.kanaal.id;
  assert.equal(aan.body.kanaal.zone, 'zaak');
  assert.equal(aan.body.kanaal.zaakCode, zaakA.code, 'het kanaal draagt de zaak waar het van is');

  // ook een interne uitzending gaat pas open na een mens van RTG-kantoor
  const rij = await api('/api/office/podium', { zone: 'zaak' }, office);
  assert.ok((rij.body.wacht || []).some(k => k.id === kanaalId), 'hij staat in de wachtrij van DEZE wereld');
  assert.equal((await api('/api/office/podium/beslis', { id: kanaalId, besluit: 'goedgekeurd' }, office)).status, 200);
  assert.equal((await api('/api/podium/live', { aan: true, titel: 'Kwartaalcijfers' }, baas.token)).status, 200);
});

test('3. de collega komt binnen, de buitenstaander niet -- en dat zijn twee verschillende deuren', async () => {
  const mee = await api('/api/podium/kijk', { id: kanaalId }, collega.token);
  assert.equal(mee.status, 200, 'wie er werkt kijkt gewoon mee: ' + JSON.stringify(mee.body).slice(0, 160));

  /* Deze is de kern. Iemand die WEL ergens werkt komt de zakenwereld in -- de
     zonelijst gaat voor hem open -- en moet toch bij DEZE uitzending buiten
     blijven. Zit de controle alleen op de zone en niet op het kanaal, dan
     zakt precies dit geval en niets anders. */
  const ander = await api('/api/podium/kijk', { id: kanaalId }, vreemde.token);
  assert.equal(ander.status, 403);
  assert.match(ander.body.error, /organisatie waar u niet werkt/);

  const geen = await api('/api/podium/kijk', { id: kanaalId }, buiten.token);
  assert.equal(geen.status, 403);
  assert.match(geen.body.error, /werkt nergens/, 'en wie nergens werkt krijgt een andere reden');
});

test('4. een town hall neemt geen geld aan', async () => {
  /* De maker zet WEL prijzen; anders zou een weigering ook kunnen betekenen
     "er staat nog geen prijs" en bewijst deze toets niets over de zone.
     (Beproefd: geldMag uit interactie.js halen -- dan wordt dit 200.) */
  await api('/api/podium/kanaal/zet', { abbCenten: 900, kaartCenten: 900 }, baas.token);

  const cadeau = await api('/api/podium/cadeau', { id: kanaalId, cadeau: 'roos' }, collega.token);
  assert.equal(cadeau.status, 409, 'geen fooien van het eigen personeel');
  assert.match(cadeau.body.error, /In deze zone gaan geen cadeaus/);
  const abb = await api('/api/podium/abonneer', { id: kanaalId }, collega.token);
  assert.equal(abb.status, 409, 'en geen abonnement op je eigen werkgever');
  const kaartje = await api('/api/podium/kaartje', { id: kanaalId }, collega.token);
  assert.equal(kaartje.status, 409, 'en geen kaartjes: een training met kaartverkoop is een evenement');
  const koop = await api('/api/podium/koop', { id: kanaalId, waarId: 'x' }, collega.token);
  assert.equal(koop.status, 409, 'en er staat geen kraam in de kantine');
});

test('5. de interne uitzending staat in geen enkele gedeelde lijst', async () => {
  const open = await api('/api/podium/kanalen', { zone: 'open' }, collega.token);
  assert.ok(!(open.body.kanalen || []).some(k => k.id === kanaalId), 'niet in een andere wereld');

  const eigen = await api('/api/podium/kanalen', { zone: 'zaak' }, collega.token);
  assert.ok((eigen.body.kanalen || []).some(k => k.id === kanaalId), 'wel in de zaal van de eigen zaak');
  const anders = await api('/api/podium/kanalen', { zone: 'zaak' }, vreemde.token);
  assert.equal(anders.status, 200, 'de zakenwereld gaat voor hem open');
  assert.ok(!(anders.body.kanalen || []).some(k => k.id === kanaalId), 'maar de uitzending van een ander bedrijf staat er niet in');

  /* En de Media OS: die toont makers over alle vormen heen, maar leest alleen
     de zones met een GEDEELDE index. Een town hall hoort daar niet tussen de
     muziek en de video's te staan -- ook niet bij een collega. */
  const wereld = await api('/api/mediaos/wereld', { modus: 'kijk' }, collega.token);
  assert.ok(!(wereld.body.stukken || []).some(s => s.id === 'live:' + kanaalId),
    'de town hall staat niet in de gedeelde mediawereld');
  const profiel = await api('/api/mediaos/maker', { codenaam: baas.codenaam }, collega.token);
  assert.equal(profiel.body.aantallen.live, 0, 'en niet op de profielkaart van de baas');
});

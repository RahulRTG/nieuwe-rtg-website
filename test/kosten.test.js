/* RTG KOSTPRIJS: wat kost elke gebruiker, en wie betaalt dat.

   Getoetst over het routecontract heen -- de schermen bouwen blind op deze
   routes, dus deze toetsen praten er net zo blind tegen: alleen fetch met een
   Authorization-kop, nooit een token in een URL (huisregel).

   Elke toets hieronder is tegen een tijdelijk kapotgemaakte kern gezien zakken
   (LAT.md regel 2: een toets die je niet hebt zien zakken is geen toets); de
   geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/kosten.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, kantoorAlsPersoon, elevateTier } = require('./helper');

let srv, base, kantoor;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een VERS lid per toets. De kostenmeter leeft per drager en telt op; een
   gedeeld lid zou de toetsen via die tellers aan elkaar knopen, en dan toetst de
   tweede stilzwijgend de restjes van de eerste. */
let teller = 0;
async function versLid() {
  const t = Date.now() + '-' + (teller++);
  const r = await api('/api/auth/register', {
    name: 'Kosten Toets', email: 'kosten-' + t + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registratie gaf geen token: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

/* De maand waarin de server nu rekent. Niet zelf uitrekenen met new Date():
   dan zou deze toets op de laatste seconde van een maand een andere maand
   bevragen dan de server heeft geteld. */
async function nu() {
  const r = await api('/api/office/kosten/overzicht', {}, kantoor);
  return r.body.periode;
}

/* DE ECONOMISCHE RELATIE die doorbelasten mogelijk maakt. Sinds de
   economielaag is dit geen formaliteit: RTG en zijn leden zijn twee partijen, en
   de firewall weigert standaard elke doorbelasting tussen twee werelden. Wie
   deze regel weglaat, ziet de doorbelastingstoetsen zakken op "geen relatie" --
   en dat is precies de bedoeling van die grens. */
async function relatieNaarConsument(plafondCenten) {
  return api('/api/office/economie/relatie/zet', {
    van: 'rtg-intern', naar: 'consument',
    grondslag: 'Toets: algemene voorwaarden, artikel verbruik boven de bundel',
    plafondCenten: plafondCenten || 100000000
  }, kantoor);
}

/* Een tarief zetten dat GROOT genoeg is om in hele centen zichtbaar te zijn.
   Duizend verzoeken kosten in het echt een fractie van een cent; met een echt
   tarief zou elke toets hieronder op 0 uitkomen en niets bewijzen. */
async function verzoektarief(millicentenPer1000) {
  return api('/api/office/kosten/tarief/zet',
    { soort: 'verzoek', perEenheid: millicentenPer1000, bron: 'Toetstarief, hostingcontract 2026' }, kantoor);
}

test.before(async () => {
  srv = await startServer(); base = srv.base;
  kantoor = await kantoorAlsPersoon(base);
  assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier niets te toetsen');
});
test.after(() => stop(srv));

/* MUTATIE: in tarieven.js de bron-eis (`b.length < 4`) weggehaald -- deze toets
   zakt dan op de eerste helft, want dan wordt een tarief zonder herkomst
   gewoon aangenomen. */
test('een tarief zonder bron bestaat niet, en met bron staat het er met bron bij', async () => {
  const zonder = await api('/api/office/kosten/tarief/zet', { soort: 'ai-invoer', perEenheid: 300 }, kantoor);
  assert.equal(zonder.status, 400);
  assert.match(zonder.body.error, /bron/i);

  const met = await api('/api/office/kosten/tarief/zet',
    { soort: 'ai-invoer', perEenheid: 300, bron: 'Prijslijst modelaanbieder, augustus 2026' }, kantoor);
  assert.equal(met.status, 200);
  const lijst = await api('/api/office/kosten/tarieven', {}, kantoor);
  const t = lijst.body.tarieven.find(x => x.soort === 'ai-invoer');
  assert.equal(t.perEenheid, 300);
  assert.match(t.bron, /Prijslijst/);
  assert.equal(t.ontbreekt, false);
});

/* MUTATIE: in soorten.js het PLAFOND van 'toegerekend' op 'gemeten' gezet --
   deze toets zakt dan, want dan noemt een verdeling zich een meting. Diezelfde
   mutatie beet EERST NIET, en dat was de vondst: het plafond stond per regel én
   de toerekening schreef zijn eigen 'vermoed'. Nu volgt het plafond uit de
   meetweg en leest de toerekening het daar. */
test('stroom wordt verdeeld uit de nota, telt exact op, en heet nooit gemeten', async () => {
  const p = await nu();
  await verzoektarief(100000); // 100 cent per verzoek: zichtbaar in hele centen

  /* TWEE gebruikers met een ONGELIJK verbruik, en dat is geen decoratie. Met
     één gebruiker krijgt hij vanzelf de hele nota en bewijst de optelling
     hieronder niets; de restverdeling in toerekening.js zou dan weggehaald
     kunnen worden zonder dat deze toets iets merkt. Dat is precies wat er bij
     de eerste mutatieronde gebeurde. Drie tegen vijf verzoeken op een nota van
     123,45 euro laat een cent over die iemand moet krijgen. */
  const a = await versLid(); const b = await versLid();
  for (let i = 0; i < 3; i++) await api('/api/kosten/mij', {}, a);
  for (let i = 0; i < 5; i++) await api('/api/kosten/mij', {}, b);

  const zonderNota = await api('/api/office/kosten/overzicht', { periode: p }, kantoor);
  const stroomLeeg = zonderNota.body.verdeling.find(r => r.soort === 'stroom');
  if (stroomLeeg && stroomLeeg.centen == null) assert.match(stroomLeeg.waarom, /nota/i);

  const nota = await api('/api/office/kosten/nota/zet',
    { periode: p, soort: 'stroom', centen: 12345, bron: 'Nota energieleverancier' }, kantoor);
  assert.equal(nota.status, 200);

  /* Vanaf hier alleen nog kantoorroutes: die lopen niet langs de ledenpoort en
     tellen dus niet mee als verbruik. Zou deze toets hierna nog /api/kosten/mij
     aanroepen, dan verschoof hij zijn eigen verdeelsleutel tijdens het meten. */
  const alle = await api('/api/office/kosten/overzicht', { periode: p }, kantoor);
  assert.ok(alle.body.gebruikers.length >= 2, 'minder dan twee gebruikers: dan bewijst de optelling niets');

  let opgeteld = 0; let gezien = null;
  for (const g of alle.body.gebruikers) {
    const beeld = await api('/api/office/kosten/gebruiker', { periode: p, drager: g.drager }, kantoor);
    const s = beeld.body.overzicht.toegerekend.find(x => x.soort === 'stroom');
    if (s) { opgeteld += s.centen; gezien = s; }
  }
  assert.equal(opgeteld, 12345, 'de verdeelde stroom telt niet op tot de nota');
  assert.ok(gezien, 'geen enkele gebruiker kreeg een toegerekende stroomregel');
  assert.equal(gezien.graad, 'vermoed');
  assert.match(gezien.bron, /energieleverancier/);
  assert.ok(gezien.sleutel && gezien.sleutel.uitleg, 'een verdeling zonder sleutel is een getal zonder herkomst');
});

/* MUTATIE: in overzicht.js `graad: plafond(soortId, 'gemeten')` vervangen door
   `graad: 'bewezen'` -- deze toets zakt dan, want een teller bewijst niets. */
test('een verzoek van een lid wordt gemeten en verschijnt op zijn eigen overzicht', async () => {
  await verzoektarief(100000);
  const lid = await versLid();
  for (let i = 0; i < 4; i++) await api('/api/kosten/mij', {}, lid);
  const r = await api('/api/kosten/mij', {}, lid);
  assert.equal(r.status, 200);
  const regel = r.body.overzicht.regels.find(x => x.soort === 'verzoek');
  assert.ok(regel, 'geen verzoekregel; dan telt de poort niets');
  assert.ok(regel.aantal >= 4, 'te weinig verzoeken geteld: ' + regel.aantal);
  assert.equal(regel.graad, 'gemeten');
  assert.equal(regel.ruw, 'verzoeken');
  assert.ok(r.body.zegtNiet.toegerekend.length > 20, 'het overzicht zegt niet wat het NIET weet');
});

/* MUTATIE: in routes/kosten.js de drager uit `req.body.drager` gehaald in plaats
   van uit de sessie -- deze toets zakt dan, want dan leest lid B het verbruik
   van lid A. */
test('een lid ziet alleen zijn eigen kosten, ook als het om die van een ander vraagt', async () => {
  await verzoektarief(100000);
  const a = await versLid(); const b = await versLid();
  for (let i = 0; i < 5; i++) await api('/api/kosten/mij', {}, a);
  const vanA = await api('/api/kosten/mij', {}, a);
  const vanB = await api('/api/kosten/mij', {}, b);
  const gluur = await api('/api/kosten/mij', { drager: vanA.body.overzicht.drager }, b);
  assert.notEqual(gluur.body.overzicht.drager, vanA.body.overzicht.drager);
  assert.equal(gluur.body.overzicht.drager, vanB.body.overzicht.drager);
});

/* MUTATIE: in routes/kosten.js boardroomAuth vervangen door auth op
   /tarief/zet -- deze toets zakt dan op de eerste bewering. */
test('een gewoon lid komt niet bij de tarieven, de nota of het vrijgeven', async () => {
  const lid = await versLid();
  for (const pad of ['/api/office/kosten/tarief/zet', '/api/office/kosten/nota/zet',
    '/api/office/kosten/vrijgeven', '/api/office/kosten/overzicht']) {
    const r = await api(pad, { soort: 'verzoek', perEenheid: 1, bron: 'poging', centen: 1 }, lid);
    assert.ok(r.status === 401 || r.status === 403, pad + ' liet een lid binnen met ' + r.status);
  }
});

/* MUTATIE: in beleidkaart.js 'gezin' uit VAST gehaald -- deze toets zakt dan,
   want dan is "gratis voor elk gezin" een schakelaar geworden. */
test('de RTFoundation-stand is geen instelling en de reden staat erbij', async () => {
  const r = await api('/api/office/kosten/beleid/zet',
    { pas: 'gezin', stand: 'doorbelasten', reden: 'omdat het kan' }, kantoor);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /gratis voor elk gezin/i);
  const b = await api('/api/office/kosten/beleid', {}, kantoor);
  const gezin = b.body.beleid.find(x => x.pas === 'gezin');
  assert.equal(gezin.stand, 'rtfoundation');
  assert.equal(gezin.vast, true);
});

/* MUTATIE: in beleidkaart.js `bestaatNog: false` van rtg-lite weggehaald --
   deze toets zakt dan, want dan doet een pas die niet bestaat alsof hij bestaat. */
test('RTG Lite en Business Lite staan in het beleid en zeggen dat ze nog niet bestaan', async () => {
  const b = await api('/api/office/kosten/beleid', {}, kantoor);
  for (const pas of ['rtg-lite', 'business-lite']) {
    const rij = b.body.beleid.find(x => x.pas === pas);
    assert.ok(rij, pas + ' ontbreekt in het beleid');
    assert.equal(rij.stand, 'doorbelasten');
    assert.equal(rij.bestaatNog, false);
  }
});

/* MUTATIE: in doorbelasting.js de drempel op 0 gezet -- deze toets zakt dan op
   de eerste helft, want dan gaat een regel van een paar cent de deur uit. */
test('onder de drempel gaat er niets naar de rekening, erboven wel, en maar een keer', async () => {
  const p = await nu();
  await verzoektarief(100);              // 0,1 cent per verzoek: ver onder de drempel
  const klein = await versLid();
  await api('/api/kosten/mij', {}, klein);
  await api('/api/office/kosten/beleid/zet',
    { pas: 'rtg', stand: 'doorbelasten', reden: 'Toets: RTG Pass rekent verbruik af' }, kantoor);
  const rel = await relatieNaarConsument();
  assert.equal(rel.status, 200, 'de relatie kwam er niet: ' + JSON.stringify(rel.body).slice(0, 160));
  const kleinBeeld = await api('/api/kosten/mij', {}, klein);
  assert.equal(kleinBeeld.body.wieBetaalt.stand, 'doorbelasten');
  assert.equal(kleinBeeld.body.wieBetaalt.opDeRekening, false, 'een paar cent hoort niet op een rekening');
  assert.match(kleinBeeld.body.wieBetaalt.waaromNiet, /drempel/i);

  await verzoektarief(100000);           // 100 cent per verzoek: ruim boven de drempel
  const groot = await versLid();
  for (let i = 0; i < 12; i++) await api('/api/kosten/mij', {}, groot);
  const mij = await api('/api/kosten/mij', {}, groot);
  assert.equal(mij.body.wieBetaalt.stand, 'doorbelasten');
  assert.equal(mij.body.wieBetaalt.opDeRekening, true);

  const vrij = await api('/api/office/kosten/vrijgeven', { periode: p }, kantoor);
  assert.equal(vrij.status, 200);
  /* Alleen de POSITIEVE helft. "de foutenlijst is leeg" slaagt ook als hij
     altijd leeg is (scripts/tandeloos.js); dat er echt iets geboekt is, niet. */
  assert.ok(vrij.body.geboekt >= 1, 'er is niets geboekt terwijl er wel wat te factureren was');

  const nogmaals = await api('/api/office/kosten/vrijgeven', { periode: p }, kantoor);
  assert.equal(nogmaals.status, 409, 'een tweede vrijgave hoort te weigeren');

  const staat = await api('/api/state', {}, groot);
  const inv = (((staat.body.state || {}).invoices) || []).find(i => /VERBRUIK/.test(i.id || ''));
  assert.ok(inv, 'de doorbelasting staat niet op de factuurlijst van het lid');
  assert.ok(inv.bijdrage > 0);
  assert.match(inv.desc, /verbruik/i);
  // terug naar de huisstand, zodat een volgende toets niet op deze schakelaar leunt
  await api('/api/office/kosten/beleid/zet',
    { pas: 'rtg', stand: 'inbegrepen', reden: 'Toets afgelopen: terug naar inbegrepen' }, kantoor);
});

/* MUTATIE: in dekking.js `bijdrageVan('business')` een 0 laten geven in plaats
   van null -- deze toets zakt dan, want dan leest "op maat" als "betaalt niets".
   Die mutatie beet EERST NIET: er zat geen enkel business-lid in de meting, dus
   er viel niets fout te rekenen. Vandaar dat deze toets er nu zelf een maakt --
   een toets die zijn eigen geval niet neerzet, toetst niets. */
test('het huisbeeld zegt wat het niet weet in plaats van er nul van te maken', async () => {
  const p = await nu();
  await verzoektarief(100000);
  const lid = await versLid();
  const op = await elevateTier(base, lid, 'business', kantoor);
  assert.ok(op, 'het lid kwam niet op de Business Pass; dan valt "op maat" niet te toetsen');
  for (let i = 0; i < 3; i++) await api('/api/kosten/mij', {}, lid);

  const r = await api('/api/office/kosten/overzicht', { periode: p }, kantoor);
  assert.equal(r.status, 200);
  const d = r.body.dekking;
  assert.ok(d.zonderBekendeBijdrage.aantal >= 1,
    'een Business Pass heeft geen maandprijs; die hoort bij "bijdrage onbekend" te staan en niet bij nul');
  assert.ok(d.zonderBekendeBijdrage.kostenCenten > 0,
    'de kosten van die gebruikers tellen wel mee in de noemer; dat hoort zichtbaar te zijn');
  assert.match(d.zonderBekendeBijdrage.waarom, /op maat|leverancierscontract/i);

  const eigen = await api('/api/kosten/mij', {}, lid);
  assert.equal(eigen.body.dekking.bijdrageCenten, null);
  assert.match(eigen.body.dekking.waaromGeenBijdrage, /op maat/i);
  assert.equal(eigen.body.dekking.uitkomst, 'onbekend');

  assert.ok(Array.isArray(r.body.afstemming), 'geen afstemming: dan kan niemand zien of de optelsom klopt');
  for (const a of r.body.afstemming.filter(x => x.notaCenten == null)) assert.match(a.waarom, /nota/i);
});

/* MUTATIE: in foundation/kostenpoort.js de meld()-regel weggehaald -- deze
   toets zakt dan, want dan is een gezin onzichtbaar in de kosten en kan niemand
   zeggen wat de RTFoundation draagt. En: in beleidkaart.js de stand van 'gezin'
   op 'doorbelasten' gezet -- dan zakt hij op factureren. */
test('een gezin wordt gemeten, ziet wat het kost, en krijgt nooit een rekening', async () => {
  const p = await nu();
  await verzoektarief(100000);
  const gemaakt = await api('/api/foundation/gezin/maak',
    { gezinsnaam: 'Toetsgezin', naam: 'Beheerder', pin: '1234' });
  assert.ok(gemaakt.body.code, 'geen gezin gemaakt: ' + JSON.stringify(gemaakt.body).slice(0, 160));
  const code = gemaakt.body.code; const tok = gemaakt.body.token;

  // een paar gewone foundation-verzoeken: die horen als verbruik geteld te worden
  for (let i = 0; i < 3; i++) await api('/api/foundation/gezin/inloggen', { code });

  const mijn = await api('/api/foundation/kosten', { code }, tok);
  assert.equal(mijn.status, 200, JSON.stringify(mijn.body).slice(0, 200));
  assert.equal(mijn.body.betaald.rekening, false);
  assert.match(mijn.body.betaald.zin, /nooit een rekening/i);
  const regel = mijn.body.overzicht.regels.find(x => x.soort === 'verzoek');
  assert.ok(regel && regel.aantal >= 3, 'de verzoeken van het gezin zijn niet geteld');

  /* En in het huisbeeld staat het gezin met de stand die niet te verzetten is,
     zodat het bedrag wel MEETELT in wat RTG draagt en nooit in wat er te
     factureren valt. */
  const v = await api('/api/office/kosten/voorstel', { periode: p }, kantoor);
  const rij = v.body.rijen.find(r => r.drager === 'gezin:' + code);
  assert.ok(rij, 'het gezin staat niet in het voorstel');
  assert.equal(rij.stand, 'rtfoundation');
  assert.equal(rij.factureren, false);
  assert.ok(v.body.totalen.rtfoundation >= rij.centen);

  const dek = await api('/api/office/kosten/overzicht', { periode: p }, kantoor);
  assert.ok(dek.body.dekking.rtfoundation.gezinnen >= 1);
  assert.match(dek.body.dekking.rtfoundation.wieBetaalt, /RTFoundation/);
});

/* MUTATIE: in foundation/kosten.js de beheerderVan-controle weggehaald -- deze
   toets zakt dan, want dan legt de app een bedrag naast een kind neer.

   EN HIJ STAPTE ER EERST STIL UIT. De eerste versie haalde de kindsessie uit het
   antwoord van /gezin/profiel/maak, en dat antwoord draagt geen token
   (pubProfiel geeft hem niet mee). Met een `if (!token) return` erin liep de
   toets groen zonder ook maar iets te beweren -- de gevaarlijkste soort. De weg
   loopt nu langs /gezin/profiel/kies, precies zoals een kind in het echt
   inlogt, en het ontbreken van een token is hier nu een ZAKKENDE toets. */
test('een kind in het gezin komt niet bij het kostenoverzicht', async () => {
  const gemaakt = await api('/api/foundation/gezin/maak',
    { gezinsnaam: 'Kindtoets', naam: 'Ouder', pin: '4321' });
  const code = gemaakt.body.code;
  assert.ok(code, 'geen gezin gemaakt');
  const kind = await api('/api/foundation/gezin/profiel/maak',
    { code, naam: 'Kind', rol: 'kind', groep: 'bovenbouw' }, gemaakt.body.token);
  const pid = kind.body.profiel && kind.body.profiel.id;
  assert.ok(pid, 'geen kindprofiel: ' + JSON.stringify(kind.body).slice(0, 160));

  const kies = await api('/api/foundation/gezin/profiel/kies', { code, profielId: pid });
  assert.ok(kies.body.token, 'het kind kreeg geen sessie; dan toetst de rest hieronder niets');

  const r = await api('/api/foundation/kosten', { code }, kies.body.token);
  assert.equal(r.status, 403, 'een kind kreeg het kostenoverzicht van het gezin te zien');

  // en de beheerder komt er wel bij, zodat dit geen dichte deur voor iedereen is
  const ouder = await api('/api/foundation/kosten', { code }, gemaakt.body.token);
  assert.equal(ouder.status, 200);
});

/* DE NOTA'S LEZEN, EN NIET ALLEEN ZETTEN.

   Er zijn twee routes rond de huisrekening en de toetsen raakten er maar een:
   `/api/office/kosten/nota/zet` staat acht keer in deze suite,
   `/api/office/kosten/nota` geen enkele keer. Dat viel niet op door de tekst --
   het langere pad bevat het kortere -- maar wel door het routejournaal, dat
   telt wat er ECHT langskomt (scripts/dekking.js). Precies waar die meter voor
   bestaat.

   Wat hij hoort te bewijzen is niet dat de route antwoordt maar dat de twee
   helften van zijn antwoord over dezelfde maand gaan: wat in `posten` staat,
   hoort niet in `ontbreekt` te staan, en andersom. Een bord dat een maand
   compleet noemt terwijl er een nota mist, stuurt een mens de
   maandafsluiting in met een gat.

   EEN EIGEN, OUDE MAAND. De andere toetsen in dit bestand boeken stroom in de
   huidige maand; deze zou dan meeliften op wat een buur al had gezet en zijn
   eigen beginstand niet kennen.

   MUTATIE: in huisrekening.js `ontbrekend()` de filter weghalen
   (`.filter(s => !r[s.id])`), zodat een geboekte soort toch als ontbrekend
   blijft gelden -- dan zakt deze toets op de laatste assertie. */
test('het notaoverzicht en de ontbrekende nota zeggen hetzelfde over dezelfde maand', async () => {
  const maand = '2019-07';

  const leeg = await api('/api/office/kosten/nota', { periode: maand }, kantoor);
  assert.equal(leeg.status, 200);
  assert.equal(leeg.body.periode, maand, 'de route antwoordt over een andere maand dan gevraagd');
  /* De ontbrekendenlijst draagt de bewering, en die is POSITIEF: allebei de
     toegerekende soorten staan erin. Een tweede regel die zegt dat `posten`
     leeg is, zou hetzelfde beweren in een vorm die ook slaagt als er nooit iets
     in komt (scripts/tandeloos.js). */
  assert.deepEqual((leeg.body.ontbreekt || []).slice().sort(), ['hosting', 'stroom'],
    'zonder nota horen beide toegerekende soorten als ontbrekend te gelden');

  const gezet = await api('/api/office/kosten/nota/zet',
    { periode: maand, soort: 'stroom', centen: 45678, bron: 'Nota energieleverancier, juli 2019' }, kantoor);
  assert.equal(gezet.status, 200, JSON.stringify(gezet.body).slice(0, 200));

  const na = await api('/api/office/kosten/nota', { periode: maand }, kantoor);
  const stroom = (na.body.posten || []).find(x => x.soort === 'stroom');
  assert.ok(stroom, 'de geboekte nota staat niet in het overzicht');
  assert.equal(stroom.centen, 45678);
  assert.match(stroom.bron, /energieleverancier/, 'een bedrag zonder bron is een getal zonder herkomst');
  assert.deepEqual(na.body.ontbreekt, ['hosting'],
    'wat geboekt is hoort uit de ontbrekendenlijst te verdwijnen, en wat niet geboekt is erin te blijven');
});

/* En de deur zit dicht: dit is de huisrekening van RTG en geen openbaar bord.
   MUTATIE: `boardroomAuth` van deze route vervangen door de ledenpoort -- dan
   antwoordt hij een lid met 200 en zakt deze toets. */
test('het notaoverzicht is niet te lezen zonder de boardroom', async () => {
  const zonder = await api('/api/office/kosten/nota', { periode: '2019-07' });
  assert.notEqual(zonder.status, 200, 'de huisrekening kwam eruit zonder enige sleutel');
  const lid = await api('/api/office/kosten/nota', { periode: '2019-07' }, await versLid());
  assert.notEqual(lid.status, 200, 'een gewoon lid kon de huisrekening van RTG lezen');
});

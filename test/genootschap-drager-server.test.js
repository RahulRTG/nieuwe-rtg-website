/* De drager en de gezinsdeur van het genootschap tegen een ECHTE server (B1,
   GEMEENSCHAP-FASE0.md par. 4.1). Elke nieuwe route minstens een keer, in een
   gewone CI-toets (LAT.md regel 17: een nagemaakte app bewijst het
   handlergedrag, niet de montage of de deur).

   Nieuwe routes, alle tien hieronder geraakt:
     POST /api/genootschap/drager/vraag, /drager/los                (ledendeur)
     POST /api/rtfos/portaal/partner/genootschap, .../erken         (partnercode)
     POST /api/rtf/genootschap/mijn, /zoek, /binnen, /vertrek,
          /prikbord, /agenda                                        (gezinsdeur)

   Wat dit toevoegt boven test/genootschap-drager.test.js: de erkenning komt uit
   het ECHTE partnerregister (kantoor zet de status, landelijk), de actor komt
   over HTTP uit de sessie (een meegestuurde sleutel doet niets), een
   minderjarige is een echt lid met een gekeurd paspoort, en de gezinsdeur geeft
   byte voor byte hetzelfde antwoord als de ledendeur.

   Bij elke toets staat de MUTATIE die hem moet laten zakken; elk daarvan is een
   keer gedraaid en zakte.
   Draai los: node --test test/genootschap-drager-server.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, kantoorAlsPersoon, keurLidGoed } = require('./helper');

let srv, BASE, LAND;
const P = {};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-drager-'));
const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, tekst: await r.clone().text(), body: await r.json().catch(() => ({})) }));
const os_ = (pad, body) => post('/api/rtfos/' + pad, body, LAND);

let teller = 0;
async function lid(geboren, keuren) {
  const u = String(Date.now()).slice(-7) + String(++teller).padStart(3, '0');
  const r = await post('/api/auth/register', { name: 'Lid ' + u, email: 'dr' + u + '@drager.test',
    phone: '06' + u.slice(0, 8), password: 'geheim123', geboortedatum: geboren || '1988-04-04', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body.token, JSON.stringify(r.body).slice(0, 160));
  // via Metier, zoals test/verbond-server.test.js: dan staat het lid ook in de gids
  const codenaam = (await post('/api/metier/ik', {}, r.body.token)).body.profiel.codenaam;
  if (keuren !== false) await keurLidGoed(BASE, r.body.token, codenaam, geboren || '1988-04-04');
  return { token: r.body.token, codenaam };
}
async function gezin(geboortedatum) {
  const lijf = { gezinsnaam: 'Gezin ' + (++teller), naam: 'Ouder', pin: '1234', bevoegdGezin: true, privacyAkkoord: true };
  if (geboortedatum) lijf.geboortedatum = geboortedatum;
  const g = await post('/api/foundation/gezin/maak', lijf);
  assert.ok(g.body.code && g.body.token, 'geen gezinssessie: ' + JSON.stringify(g.body).slice(0, 160));
  return { code: g.body.code, token: g.body.token };
}
async function partner(naam, status) {
  const pt = await os_('partner/maak', { stad: P.stad, naam, kvk: '87654321', doel: 'buurtwerk' });
  assert.equal(pt.status, 200, JSON.stringify(pt.body));
  for (const s of status) assert.equal((await os_('partner/status', { id: pt.body.partner.id, status: s })).status, 200);
  return { id: pt.body.partner.id, code: pt.body.partner.code };
}
const groep = async (w, naam, soort) => (await post('/api/genootschap/richt-op', { naam, soort: soort || 'besloten' }, w.token)).body.groep;
const ledenlijst = async (w, id) =>
  JSON.stringify(((await post('/api/genootschap/mijn', {}, w.token)).body.groepen.find(g => g.id === id) || {}).ledenlijst);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  BASE = srv.base;
  LAND = await kantoorAlsPersoon(BASE);
  assert.ok(LAND, 'geen kantoorsessie voor de eigenaar');
  P.stad = (await os_('stad/maak', { naam: 'Utrecht' })).body.stad.id;
  await os_('stad/status', { id: P.stad, status: 'actief' });
  P.een = await partner('Stichting Buurt Een', ['in_toetsing', 'goedgekeurd']);
  P.twee = await partner('Stichting Buurt Twee', ['in_toetsing', 'goedgekeurd']);
  P.drie = await partner('Stichting Nog Niet', []);  // aangemeld: niet erkend
  P.beh = await lid();
  P.a = await lid();
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

// Zakt bij de mutatie: in routes/rtfos/portalen.js de route /api/rtfos/portaal/partner/genootschap/erken weghalen -> 404, zakt.
// Zakt bij de mutatie: in routes/member/genootschap.js `req.session` -> `req.body` bij /drager/vraag -> de vraag weigert (geen beheerder), zakt.
// Zakt bij de mutatie: in drager.js voorPartner() de map vervangen door `gr` (hele groep) -> de ledencodenamen staan in het partnerantwoord, zakt.
test('1. de keten over HTTP: vragen, de partner ziet naam en stand, erkennen, en de leden blijven waar ze zijn', async () => {
  const gr = await groep(P.beh, 'Leesclub Oost');
  await post('/api/genootschap/nodig-uit', { groep: gr.id, wie: P.a.codenaam }, P.beh.token);
  assert.ok((await post('/api/genootschap/binnen', { groep: gr.id }, P.a.token)).body.ok);
  const leden = await ledenlijst(P.beh, gr.id);

  // de partner kent zijn eigen verwijzing uit zijn portaal; de beheerder krijgt die, niet de code
  const zicht0 = await post('/api/rtfos/portaal/partner/genootschap', { code: P.een.code });
  assert.equal(zicht0.status, 200, JSON.stringify(zicht0.body));
  assert.equal(zicht0.body.ref, P.een.id);

  // een gewoon lid kan niet vragen; een meegestuurde sleutel maakt hem geen beheerder
  const nietBeh = await post('/api/genootschap/drager/vraag', { groep: gr.id, ref: P.een.id, key: 'x', sess: { key: 'x' } }, P.a.token);
  assert.equal(nietBeh.status, 403, JSON.stringify(nietBeh.body));

  const vraag = await post('/api/genootschap/drager/vraag', { groep: gr.id, ref: P.een.id, gevraagdDoor: 'iemand-anders' }, P.beh.token);
  assert.equal(vraag.status, 200, JSON.stringify(vraag.body));
  assert.equal(vraag.body.drager.stand, 'gevraagd');
  assert.equal(vraag.body.partner, 'Stichting Buurt Een');
  const nog = await post('/api/genootschap/drager/vraag', { groep: gr.id, ref: P.een.id }, P.beh.token);
  assert.equal(nog.body.al, true, 'een herhaalde vraag is geen herhaling');

  const zicht = await post('/api/rtfos/portaal/partner/genootschap', { code: P.een.code });
  const rij = zicht.body.groepen.find(g => g.groep === gr.id);
  assert.deepEqual(Object.keys(rij).sort(), ['at', 'groep', 'naam', 'stand']);
  assert.equal(rij.stand, 'gevraagd');
  assert.ok(!zicht.tekst.includes(P.a.codenaam) && !zicht.tekst.includes(P.beh.codenaam), 'de partner ziet een codenaam van een lid');

  // de andere stichting ziet hem niet en kan hem niet erkennen
  assert.equal((await post('/api/rtfos/portaal/partner/genootschap', { code: P.twee.code })).body.groepen.length, 0);
  assert.equal((await post('/api/rtfos/portaal/partner/genootschap/erken', { code: P.twee.code, groep: gr.id })).status, 404);

  const meldVoor = (await post('/api/notifications', {}, P.beh.token)).body.notifications.length;
  const erken = await post('/api/rtfos/portaal/partner/genootschap/erken', { code: P.een.code, groep: gr.id });
  assert.equal(erken.status, 200, JSON.stringify(erken.body));
  assert.equal(erken.body.stand, 'erkend');
  assert.equal((await post('/api/rtfos/portaal/partner/genootschap/erken', { code: P.een.code, groep: gr.id })).body.al, true);
  const meld = (await post('/api/notifications', {}, P.beh.token)).body.notifications;
  assert.equal(meld.length, meldVoor + 1, 'de beheerder hoort het een keer');

  const mijn = (await post('/api/genootschap/mijn', {}, P.a.token)).body.groepen.find(g => g.id === gr.id);
  assert.deepEqual(mijn.drager, { soort: 'rtfpartner', stand: 'erkend' });
  assert.equal(await ledenlijst(P.beh, gr.id), leden, 'de drager veranderde de ledenlijst');
});

// Zakt bij de mutatie: in kern/rtfos/partners-portaal.js erkend() `ERKEND.includes(p.status)` -> `true` -> de aangemelde stichting komt door, zakt.
test('2. een stichting die de RTFoundation niet erkende, kan niet dragen en ziet niets', async () => {
  const gr = await groep(P.beh, 'Tuinclub West');
  const r = await post('/api/genootschap/drager/vraag', { groep: gr.id, ref: P.drie.id }, P.beh.token);
  assert.equal(r.status, 403);
  assert.match(r.body.error, /niet door de RTFoundation erkend/);
  assert.equal((await post('/api/genootschap/drager/vraag', { groep: gr.id, ref: 'bestaat-niet' }, P.beh.token)).status, 404);
  assert.equal((await post('/api/rtfos/portaal/partner/genootschap', { code: P.drie.code })).status, 403);
  assert.equal((await post('/api/rtfos/portaal/partner/genootschap', { code: 'RTFP-VERZONNEN' })).status, 404);
});

// Zakt bij de mutatie: in opzet/kernlaag4.js `toelating: ...` weghalen -> de minderjarige wordt uitgenodigd, zakt.
// Zakt bij de mutatie: in drager.js vraag() de lus over `gr.leden` met beschermdeReden weghalen -> de vraag gaat door, zakt.
// Zakt bij de mutatie: in index.js nodigUit de echte reden teruggeven in plaats van de neutrale -> de beheerder leert iets over de persoon, zakt.
test('3. een minderjarige gaat niet door een ander een gedragen genootschap in, en een groep met een minderjarige wacht', async () => {
  const jong = await lid('2009-09-09');            // zeventien, paspoort gekeurd
  const ongekeurd = await lid('1980-01-01', false); // volwassen op papier, niet gezien
  const gr = await groep(P.beh, 'Schaakclub Noord', 'openbaar');
  assert.ok((await post('/api/genootschap/binnen', { groep: gr.id }, jong.token)).body.ok);
  const wacht = await post('/api/genootschap/drager/vraag', { groep: gr.id, ref: P.een.id }, P.beh.token);
  assert.equal(wacht.status, 409);
  assert.equal(wacht.body.wacht, 'G5');
  assert.doesNotMatch(wacht.body.error, /18|minderjarig|gezien|geverifieerd/i, 'de beheerder hoort iets over een lid');
  assert.equal((await post('/api/genootschap/vertrek', { groep: gr.id }, jong.token)).status, 200);

  assert.equal((await post('/api/genootschap/drager/vraag', { groep: gr.id, ref: P.een.id }, P.beh.token)).status, 200);
  for (const w of [jong, ongekeurd]) {
    const nu = await post('/api/genootschap/nodig-uit', { groep: gr.id, wie: w.codenaam }, P.beh.token);
    assert.equal(nu.status, 400);
    // neutraal naar de beheerder: niets over leeftijd of verificatie van deze persoon
    assert.match(nu.body.error, /kan niet worden toegevoegd/, w.codenaam);
    assert.doesNotMatch(nu.body.error, /18|minderjarig|gezien|geverifieerd/i, 'de weigering verraadt iets over ' + w.codenaam);
    const zelf = await post('/api/genootschap/binnen', { groep: gr.id }, w.token);
    assert.match(String(zelf.body.error), /18 jaar of ouder/);
  }
  assert.ok((await post('/api/genootschap/binnen', { groep: gr.id }, P.a.token)).body.ok, 'een gekeurde volwassene kan wel');
});

// Zakt bij de mutatie: in drager-regels.js gevoeligeReden() altijd null -> de gebedsgroep krijgt een drager, zakt.
test('4. geloof en zorg krijgen geen drager, met de reden dat het op besluit 6 wacht', async () => {
  const kerk = await groep(P.beh, 'Gebedsgroep De Kerk');
  const r = await post('/api/genootschap/drager/vraag', { groep: kerk.id, ref: P.een.id }, P.beh.token);
  assert.equal(r.status, 409);
  assert.equal(r.body.wacht, 'besluit-6');
  assert.match(r.body.error, /juridische en privacyvragen/);
  const anders = await groep(P.beh, 'Dinsdagavond');
  const z = await post('/api/genootschap/drager/vraag', { groep: anders.id, ref: P.een.id, onderwerp: 'zorg' }, P.beh.token);
  assert.equal(z.status, 409);
  const mijn = (await post('/api/genootschap/mijn', {}, P.beh.token)).body.groepen;
  assert.equal(mijn.find(g => g.id === kerk.id).drager, null, 'de weigering liet toch een drager achter');
});

// Zakt bij de mutatie: in routes/member/genootschap.js de route /drager/los weghalen -> 404, zakt.
// Zakt bij de mutatie: in drager.js los() `stand = 'ingetrokken'` weghalen -> de partner ziet hem nog, zakt.
test('5. losmaken mag altijd, de groep blijft, en daarna is er voor de partner niets meer te erkennen', async () => {
  const gr = await groep(P.beh, 'Fietsclub Zuid');
  await post('/api/genootschap/drager/vraag', { groep: gr.id, ref: P.twee.id }, P.beh.token);
  const los = await post('/api/genootschap/drager/los', { groep: gr.id }, P.beh.token);
  assert.equal(los.status, 200, JSON.stringify(los.body));
  assert.equal(los.body.drager.stand, 'ingetrokken');
  assert.equal((await post('/api/genootschap/drager/los', { groep: gr.id }, P.beh.token)).body.al, true);
  assert.equal((await post('/api/rtfos/portaal/partner/genootschap/erken', { code: P.twee.code, groep: gr.id })).status, 404);
  assert.ok((await post('/api/genootschap/mijn', {}, P.beh.token)).body.groepen.some(g => g.id === gr.id), 'de groep verdween');
  assert.equal((await post('/api/genootschap/drager/los', { groep: gr.id }, P.a.token)).status, 404, 'een niet-lid hoort hier niets');
});

// Zakt bij de mutatie: in routes/member/genootschap-gezin.js `{ key: g.handle }` -> `{ key: req.body.key || g.handle }` -> het gezinslid treedt binnen als iemand anders, zakt.
// Zakt bij de mutatie: in genootschap-gezin.js /zoek `genootschap.zoek(sess, lijf(req))` -> `genootschap.zoek(sess, {})` -> het antwoord wijkt af van de ledendeur, zakt.
// Zakt bij de mutatie: de leeftijdstoets in alsGezinslid weghalen -> het zestienjarige gezinslid komt binnen, zakt.
// Zakt bij de mutatie: in teJong `!VOLWASSEN_ROL.includes(...)` -> `false` -> het gezinslid zonder geboortedatum komt binnen, zakt.
test('6. de gezinsdeur: dezelfde kern, hetzelfde antwoord, en alleen voor een volwassen gezinslid', async () => {
  const gr = await groep(P.beh, 'Wandelclub Kromme Rijn ' + teller, 'openbaar');
  await post('/api/genootschap/roep-bijeen', { groep: gr.id, wat: 'Rondje Amelisweerd', datum: '2099-05-05', tijd: '10:00' }, P.beh.token);
  const vreemde = await lid(null, false);
  const fam = await gezin('1985-03-03');
  // het pad staat LETTERLIJK bij elke oproep: de dekkingsmeter van de keuring leest de toetstekst
  const g = (pad, b) => post(pad, Object.assign({ code: fam.code, token: fam.token }, b || {}));

  // ZOEK: als niet-lid, byte voor byte gelijk aan de ledendeur
  const q = { zoek: 'Kromme Rijn ' + teller };
  const alsLid = await post('/api/genootschap/zoek', q, vreemde.token);
  const alsGezin = await g('/api/rtf/genootschap/zoek', q);
  assert.equal(alsGezin.status, 200, alsGezin.tekst);
  assert.equal(alsGezin.tekst, alsLid.tekst, 'de gezinsdeur gaf een ander antwoord dan de ledendeur');

  // BINNEN met een verzonnen sleutel in het lijf: het lidmaatschap komt op het gezinsprofiel
  const binnen = await g('/api/rtf/genootschap/binnen', { groep: gr.id, key: P.a.codenaam });
  assert.equal(binnen.status, 200, binnen.tekst);
  assert.equal((await g('/api/rtf/genootschap/binnen', { groep: gr.id })).body.al, true, 'een tweede keer binnen is geen herhaling');
  assert.ok((await post('/api/genootschap/binnen', { groep: gr.id }, vreemde.token)).body.ok);
  const lijst = JSON.parse(await ledenlijst(P.beh, gr.id));
  assert.equal(lijst.length, 3, 'beheerder, gezinslid en lid');
  assert.ok(!lijst.some(l => l.codenaam === P.a.codenaam), 'het lijf maakte P.a lid');
  assert.equal((await g('/api/rtf/genootschap/mijn')).body.groepen.filter(x => x.id === gr.id).length, 1);

  // AGENDA: als lid van dezelfde groep, byte voor byte gelijk
  const agLid = await post('/api/genootschap/agenda', { groep: gr.id }, vreemde.token);
  const agGezin = await g('/api/rtf/genootschap/agenda', { groep: gr.id });
  assert.equal(agGezin.status, 200, agGezin.tekst);
  assert.equal(agGezin.body.komt.length, 1);
  assert.equal(agGezin.tekst, agLid.tekst, 'de agenda via de gezinsdeur wijkt af');
  assert.equal((await g('/api/rtf/genootschap/prikbord', { groep: gr.id })).status, 200);
  assert.equal((await g('/api/rtf/genootschap/vertrek', { groep: gr.id })).status, 200);
  assert.equal((await g('/api/rtf/genootschap/vertrek', { groep: gr.id })).status, 400, 'een tweede vertrek is een toestandscontrole');
  assert.equal((await g('/api/rtf/genootschap/mijn')).body.groepen.filter(x => x.id === gr.id).length, 0);

  // een gedragen groep: een gezinsprofiel komt er niet in, ook niet zelf
  const gedragen = await groep(P.beh, 'Hardloopclub ' + teller, 'openbaar');
  await post('/api/genootschap/drager/vraag', { groep: gedragen.id, ref: P.een.id }, P.beh.token);
  const geweigerd = await g('/api/rtf/genootschap/binnen', { groep: gedragen.id });
  assert.equal(geweigerd.status, 400);
  assert.match(geweigerd.body.error, /gezinsprofielen/);

  // minderjarig, een kind, of zonder leeftijd in een rol die niet volwassen is: dicht, met de reden
  const jongeOuder = await gezin('2010-02-02');
  const sessies = [{ wie: 'zestien', code: jongeOuder.code, token: jongeOuder.token }];
  for (const rol of ['kind', 'gezinslid']) {
    const m = await post('/api/foundation/gezin/profiel/maak', { code: fam.code, token: fam.token, naam: 'Een ' + rol, rol });
    assert.equal(m.status, 200, m.tekst);
    const k = await post('/api/foundation/gezin/profiel/kies', { code: fam.code, token: fam.token, profielId: m.body.profiel.id });
    assert.ok(k.body.token, k.tekst);
    sessies.push({ wie: rol, code: fam.code, token: k.body.token });
  }
  for (const s of sessies) {
    const r = await post('/api/rtf/genootschap/zoek', { code: s.code, token: s.token, zoek: 'x' });
    assert.equal(r.status, 403, s.wie + ': ' + r.tekst);
    assert.equal(r.body.wacht, 'G5');
  }
  // en een beheerder zonder geboortedatum is volwassen naar zijn rol
  const zonder = await gezin(null);
  assert.equal((await post('/api/rtf/genootschap/zoek', { code: zonder.code, token: zonder.token, zoek: 'x' })).status, 200);
  assert.equal((await post('/api/rtf/genootschap/mijn', { code: fam.code, token: 'nep' })).status, 403);
});

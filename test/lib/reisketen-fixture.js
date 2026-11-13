/* Echte lokale HTTP-/SQLite-proef, geen externe leveranciersacceptatie.
   De registercontroles en providerreferenties zijn expliciet testverklaringen.
   Alleen bestaande partner-, tenant-, account- en Pay-deuren worden gebruikt. */
'use strict';
const assert = require('node:assert/strict');
const { kantoorAlsPersoon, zaakMensOpNaam, keurLidGoed } = require('../helper');

function maakApi(baseVan) {
  return async (pad, body = {}, token, extraHeaders = {}) => {
    const base = typeof baseVan === 'function' ? baseVan() : baseVan;
    const r = await fetch(base + pad, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...extraHeaders
    }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
}
function goed(r, naam) { assert.equal(r.status, 200, naam + ': ' + JSON.stringify(r.body)); return r.body; }

async function maakReisketenFixture(baseVan) {
  const base = typeof baseVan === 'function' ? baseVan() : baseVan;
  const api = maakApi(baseVan);
  const office = await kantoorAlsPersoon(base);
  assert.ok(office, 'persoonlijke kantoorsessie');
  const tech = goed(await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }), 'techniek').token;
  const business = goed(await api('/api/login', { username: 'Rahul', password: 'Imran' }), 'zakelijke fixture').token;
  const gedeeld = goed(await api('/api/office/login', { code: 'RTG-OFFICE' }), 'gedeelde kantoordeur').token;

  async function maakZaak(naam, nummer) {
    const a = goed(await api('/api/partner/apply', { company: naam, type: 'reisbureau', city: 'Haarlem',
      contactName: 'Proefcontact', email: 'reis-' + nummer + '@voorbeeld.test', akkoord: true,
      bevoegd: true, waarheidsgetrouw: true, kvkNummer: String(nummer),
      vestigingsnummer: '0000' + nummer, passToken: business }), 'partneraanvraag');
    const s = goed(await api('/api/office/state', {}, office), 'aanvraag lezen');
    const aanvraag = s.state.partnerApplications.find(x => x.id === a.id);
    assert.ok(aanvraag);
    for (const eis of aanvraag.toelating.eisen) {
      const uitkomst = eis.id === 'vergunningenscan' ? 'niet_van_toepassing' : 'geverifieerd';
      goed(await api('/api/office/partner/controle', { id: a.id, onderdeel: eis.id, uitkomst,
        referentie: 'UITSLUITEND GESIMULEERDE TESTCONTROLE ' + eis.id }, office), 'toelatingsfixture ' + eis.id);
    }
    const d = goed(await api('/api/office/partner/decide', { id: a.id, action: 'goedkeuren' }, office), 'partnerbesluit');
    return { code: d.code, pin: d.pin, naam };
  }
  async function activeer(zaak, org) {
    goed(await api('/api/techniek/tenant', { org, naam: zaak.naam || zaak.code }, tech), 'tenant');
    goed(await api('/api/techniek/tenant/bind', { org, soort: 'zaak', code: zaak.code }, tech), 'tenantbinding');
    const roster = goed(await api('/api/supplier/roster', { code: zaak.code }), 'personeel');
    const manager = roster.staff.find(x => x.role === 'manager');
    assert.ok(manager, 'manager');
    const sessie = goed(await api('/api/supplier/login', { code: zaak.code, staffId: manager.id,
      pin: zaak.pin || '1234' }), 'fixturemanager').token;
    const token = await zaakMensOpNaam(base, sessie, zaak.code);
    return { ...zaak, org, token, gedeeldeManager: sessie };
  }
  const bureau = await activeer(await maakZaak('Onafhankelijke Reizen Proef', 78123401), 'O-REIS-PROEF-A');
  const anderBureau = await activeer(await maakZaak('Tweede Reisorganisatie Proef', 78123402), 'O-REIS-PROEF-B');
  const fiets = await activeer(await maakZaak('Fietsreizen Uitvoering Proef', 78123403), 'O-REIS-PROEF-FIETS');
  const hotel = await activeer({ code: 'HOSHI', naam: 'Fictief proefhotel' }, 'O-REIS-PROEF-HOTEL');
  const transfer = await activeer({ code: 'MKKX', naam: 'Fictieve proeftransfer' }, 'O-REIS-PROEF-TRANSFER');
  async function lid(n) {
    const d = goed(await api('/api/auth/register', { name: 'Reisketen Proef ' + n,
      email: 'reisketen-' + n + '@voorbeeld.test', phone: '06123456' + n, password: 'Geheim123!',
      geboortedatum: '1990-01-01', pasApp: 'rtg' }), 'lidregistratie');
    const codenaam = d.state.user.codename;
    await keurLidGoed(base, d.token, codenaam, '1990-01-01');
    goed(await api('/api/pay/oplaad', { centen: 300000, idem: 'reisketen-fixture-' + n }, d.token), 'testsaldo');
    return { token: d.token, codenaam };
  }
  const reiziger = await lid('81'), anderLid = await lid('82');
  function offerte(reis, extra = {}) {
    return { ref: reis.ref, versie: reis.versie, idem: 'offerte-' + reis.ref,
      geldigTot: new Date(Date.now() + 86400000).toISOString(), valuta: 'EUR',
      voorwaarden: 'Lokale contractproef; geen echte reservering of leverancierbetaling.',
      rollen: { hoedanigheid: 'touroperator', contractpartij: 'Verkopend proefbureau',
        factureert: 'Verkopend proefbureau', aansprakelijk: 'Verklaring in deze lokale proef; niet juridisch gekwalificeerd.' },
      onderdelen: [
        { id: 'hotel', wat: 'Proefverblijf', soort: 'verblijf', productRef: 'TEST-KAMER', supplierCode: hotel.code, centen: 50000, verschuldigdCenten: 45000 },
        { id: 'transfer', wat: 'Proeftransfer', soort: 'vervoer', productRef: 'TEST-RIT', supplierCode: transfer.code, centen: 10000, verschuldigdCenten: 8000 },
        { id: 'fiets', wat: 'Proeffietsdag', soort: 'activiteit', productRef: 'TEST-FIETSDAG', supplierCode: fiets.code, centen: 20000, verschuldigdCenten: 17000 }
      ], ...extra };
  }
  return { api, office, tech, gedeeld, bureau, anderBureau, hotel, transfer, fiets, reiziger, anderLid, offerte };
}
module.exports = { maakReisketenFixture, maakApi, goed };

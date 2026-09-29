'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const crypto = require('node:crypto');
function wereld() {
  const db = { data: {} }; let stuk = false, opgeslagen;
  const ctx = { db, crypto, save() { if (stuk) throw Error('schrijfproef'); opgeslagen = structuredClone(db.data); },
    plek: { plekVan: x => ({ stad: x.stad }), bereikVan: () => ({}), bedient: (s, p) => s.plek.stad === p.stad } };
  const open = () => require('../server/kern/mall/aanvragen')(ctx).mallAanvragen;
  return { db, api: open(), herstart() { db.data = structuredClone(opgeslagen); return open(); }, fout: v => { stuk = v; } };
}
const zaak = { code: 'ZAAK', name: 'Proefzaak', type: 'beauty', city: 'Ibiza' };
const vraag = { sleutel: 'eerste', wat: 'Een behandeling op zaterdag', plek: 'Ibiza', verdieping: 'beauty' };
const maak = w => w.api.plaats('lid', 'Codenaam', vraag).aanvraag;
const reageer = (w, a) => w.api.reageer(zaak, a.id, { versie: a.versie, tekst: 'Zaterdag om 14 uur', prijs: 90 }).aanvraag;
test('de gekozen aanvraag bereikt de zaak, het antwoord bereikt het lid en overleeft herladen', () => {
  const w = wereld(); let a = reageer(w, maak(w));
  a = w.api.kies('lid', a.id, zaak.code, { versie: a.versie }).aanvraag;
  assert.equal(w.api.voorZaak(zaak).aanvragen.find(x => x.id === a.id).status, 'gegund', 'HANDOFF: gekozen werk verdwijnt niet');
  assert.deepEqual(w.api.voorZaak(zaak).aanvragen[0].acties.map(x => x.id), ['aanvaard', 'teruggeven']);
  a = w.api.zaakActie(zaak, a.id, 'aanvaard', { versie: a.versie }).aanvraag;
  a = w.api.zaakActie(zaak, a.id, 'afronden', { versie: a.versie, tekst: 'Afgesproken: zaterdag om 14 uur. Neem zelf contact op voor een boeking.' }).aanvraag;
  assert.equal(a.status, 'afgerond'); assert.ok(a.resultaat.tekst);
  const r = w.herstart().mijn('lid').aanvragen[0];
  assert.deepEqual(r.resultaat, a.resultaat); assert.equal(r.verloop.at(-1).actie, 'afronden');
});
test('versies en verzendsleutels voorkomen dubbele of achterhaalde gevolgen', () => {
  const w = wereld(); let a = maak(w);
  assert.equal(maak(w).id, a.id); assert.equal(w.db.data.mallAanvragen.length, 1);
  assert.equal(w.api.plaats('lid', 'Codenaam', { ...vraag, wat: 'Andere inhoud' }).status, 409);
  a = reageer(w, a); const opdracht = { versie: a.versie, code: zaak.code };
  a = w.api.kies('lid', a.id, zaak.code, opdracht).aanvraag;
  assert.equal(w.api.kies('lid', a.id, zaak.code, opdracht).aanvraag.versie, a.versie);
  const gesloten = w.api.sluit('lid', a.id, { versie: a.versie }).aanvraag;
  assert.equal(w.api.kies('lid', a.id, zaak.code, opdracht).status, 409);
  assert.deepEqual(w.api.voorZaak(zaak).aanvragen[0].acties, []);
  assert.equal(w.api.zaakActie(zaak, a.id, 'aanvaard', { versie: gesloten.versie }).status, 409);
});
test('wijzigen en heropenen trekken oude aanbiedingen in; teruggeven laat een menselijke reden achter', () => {
  const w = wereld(); let a = reageer(w, maak(w));
  a = w.api.lidActie('lid', a.id, 'wijzig', { ...vraag, wat: 'Behandeling op zondag', versie: a.versie }).aanvraag;
  assert.equal(a.reacties[0].ingetrokken, true);
  assert.equal(w.api.kies('lid', a.id, zaak.code, { versie: a.versie }).status, 409);
  a = reageer(w, a); a = w.api.kies('lid', a.id, zaak.code, { versie: a.versie }).aanvraag;
  a = w.api.zaakActie(zaak, a.id, 'teruggeven', { versie: a.versie, tekst: 'Geen medewerker beschikbaar. Kies een andere aanbieder.' }).aanvraag;
  assert.equal(a.status, 'open'); assert.equal(a.eigenaar, null);
  assert.match(w.api.mijn('lid').aanvragen[0].verloop.at(-1).tekst, /Geen medewerker/);
  a = w.api.sluit('lid', a.id, { versie: a.versie }).aanvraag;
  a = w.api.lidActie('lid', a.id, 'heropen', { versie: a.versie }).aanvraag;
  assert.equal(a.status, 'open'); assert.ok(a.reacties.every(r => r.ingetrokken));
});
test('vreemde leden, verkeerde zaken en verlopen vragen kunnen geen opdracht krijgen', () => {
  const w = wereld(); const a = reageer(w, maak(w));
  assert.equal(w.api.sluit('ander', a.id).status, 404); assert.deepEqual(w.api.mijn('ander').aanvragen, []);
  assert.equal(w.api.reageer({ ...zaak, code: 'VER', city: 'Parijs' }, a.id, { tekst: 'Toch reageren' }).status, 403);
  const tweede = { ...zaak, code: 'TWEE', name: 'Tweede' };
  w.api.reageer(tweede, a.id, { versie: a.versie, tekst: 'Privé voorstel twee' });
  const zicht = w.api.voorZaak(zaak).aanvragen[0];
  assert.equal(zicht.reacties.length, 1); assert.ok(!JSON.stringify(zicht).includes('Privé voorstel twee'));
  w.db.data.mallAanvragen[0].at = '2000-01-01T00:00:00Z';
  assert.equal(w.api.kies('lid', a.id, zaak.code).status, 409);
  assert.equal(w.api.mijn('lid').aanvragen[0].status, 'verlopen');
});
test('een waargenomen opslagfout bevestigt niets, herstelt de bron en kan opnieuw worden uitgevoerd', () => {
  const w = wereld(); const a = reageer(w, maak(w)), voor = structuredClone(w.db.data);
  w.fout(true);
  assert.throws(() => w.api.kies('lid', a.id, zaak.code, { versie: a.versie }), /schrijfproef/);
  assert.deepEqual(w.db.data, voor, 'geen schijnsucces in geheugen');
  w.fout(false); assert.equal(w.api.kies('lid', a.id, zaak.code, { versie: a.versie }).ok, true);
  assert.equal(w.herstart().mijn('lid').aanvragen[0].status, 'gegund');
  require('./operationeel-journaal')('mall-failure', ['FAILURE', 'RECOVERY'], { grens: 'Synchrone save-fout in bronproef; geen procescrash of storing in productieopslag.' });
});
test('oude afgeronde vragen verlopen niet en bewaren verdringt geen bestaand werk', () => {
  const w = wereld(); const a = maak(w), record = w.db.data.mallAanvragen[0];
  record.status = 'afgerond'; record.at = '2000-01-01T00:00:00Z';
  assert.equal(w.api.mijn('lid').aanvragen[0].status, 'afgerond');
  w.db.data.mallAanvragen = Array.from({ length: 5000 }, (_, n) => ({ ...record, id: String(n), key: 'oud' }));
  assert.equal(w.api.plaats('lid', 'Codenaam', { ...vraag, sleutel: 'nieuw' }).status, 503);
  assert.equal(w.db.data.mallAanvragen.at(-1).id, '4999'); assert.ok(a.id);
});

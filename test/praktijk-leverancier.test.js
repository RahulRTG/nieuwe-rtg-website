'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const V = require('../server/bedrijf/praktijk-vorm');
function setup() {
  const db = { data: { werkruimtes: {} } };
  const ctx = { db, crypto, save() {}, app: { post() {} }, log() {},
    rid: n => crypto.randomBytes(n).toString('hex'), nu: () => new Date().toISOString(),
    dag: () => '2026-10-01', rechtenVan: l => l.rechten };
  const w = { code: 'WTEST1', naam: 'Testorganisatie', leden: {}, journaal: [],
    praktijkProfiel: { land: 'NL', valuta: 'EUR', decimalen: 2, tijdzone: 'Europe/Amsterdam' },
    praktijkAanbod: { a: { id: 'a', versie: 1, actief: true, prijswijze: 'vast', bedragMinor: 25000, locatie: 'Haarlem' } } };
  db.data.werkruimtes[w.code] = w;
  const l = { id: 'directie', naam: 'Organisator', status: 'actief', rechten: ['werkruimte', 'project', 'klant', 'geld', 'geld.goedkeuren'] };
  w.leden[l.id] = l; const g = { w, l, rechten: l.rechten };
  const werk = require('../server/bedrijf/praktijk-werk')(ctx), api = require('../server/bedrijf/praktijk-leverancier')(ctx);
  const p = werk.vraag(w, l, { aanbodId: 'a', klant: 'Privéklant', vraag: 'Onze klantopdracht' }).projectId;
  const x = V.details(w, V.project(w, p));
  werk.stap(w, l, { projectId: p, versie: x.versie, stap: 'voorstel', bedragMinor: 25000, toelichting: 'Totale klantprijs' });
  werk.stap(w, l, { projectId: p, versie: x.versie, stap: 'akkoord', toelichting: 'Bevestigd' });
  const doe = b => api.handeling(g, { projectId: p, versie: x.versie, ...b });
  const aanvraag = () => doe({ actie: 'aanvragen', leverancier: 'Vervoerder', onderdeel: 'Transfer naar luchthaven',
    datum: '2026-12-01', locatie: 'Afgesproken vertrekpunt', voorwaarden: 'Drie personen; geen extra kosten zonder akkoord', bedragMinor: 8000 });
  const open = link => api.gast({ sleutel: link.split('#leverancier=')[1] });
  const antwoord = (link, keuze) => { const gast = open(link); return api.besluit(gast, { versie: gast.t.externeAfspraak.versie,
    keuze, naam: 'Planner vervoerder', referentie: 'Boeking V-123' }); };
  return { w, l, g, p, x, werk, ctx, api, doe, aanvraag, open, antwoord };
}
test('leverancier bevestigt de exacte opdracht; klantprijs en overige gegevens blijven privé', () => {
  const s = setup(), r = s.aanvraag(); assert.equal(r.ok, true);
  const gast = s.open(r.link), view = s.api.beeld(gast);
  assert.equal(view.bedragMinor, 8000); assert.equal(view.stand, 'aangevraagd');
  assert.equal(JSON.stringify(view).includes('Privéklant'), false);
  assert.equal(JSON.stringify(view).includes('25000'), false);
  assert.equal(s.antwoord(r.link, 'bevestigen').stand, 'bevestigd');
  assert.equal(s.antwoord(r.link, 'bevestigen').status, 409);
  assert.equal(s.w.taken[r.taakId].kolom, 'te doen', 'bevestiging bewijst nog geen uitvoering');
  assert.equal(s.werk.stap(s.w, s.l, { projectId: s.p, versie: s.x.versie, stap: 'annuleren', toelichting: 'Klant zegt af' }).status, 409);
});
test('annulering vraagt leveranciersakkoord; weigering laat de boeking bestaan', () => {
  const s = setup(), r = s.aanvraag(); s.antwoord(r.link, 'bevestigen');
  const c = s.doe({ actie: 'annuleren', taakId: r.taakId, toelichting: 'Klant wil een andere datum' });
  assert.equal(s.open(r.link), null, 'oude link is ingetrokken');
  assert.equal(s.w.taken[r.taakId].externeAfspraak.stand, 'annulering-gevraagd');
  assert.equal(s.antwoord(c.link, 'weigeren').stand, 'bevestigd');
  const c2 = s.doe({ actie: 'annuleren', taakId: r.taakId, toelichting: 'Opnieuw afgestemd' });
  assert.equal(s.antwoord(c2.link, 'bevestigen').stand, 'geannuleerd');
  assert.equal(s.w.taken[r.taakId].geannuleerd, true);
  assert.equal(s.werk.stap(s.w, s.l, { projectId: s.p, versie: s.x.versie, stap: 'annuleren', toelichting: 'Alles geannuleerd' }).ok, true);
});
test('linkdoel, huidige rechten, tijd en rotatie begrenzen toegang', () => {
  const s = setup(), r = s.aanvraag();
  const d = s.open(r.link).d; d.doel = 'werk.voorstel@1'; assert.equal(s.open(r.link), null); d.doel = 'werk.leverancier@1';
  s.l.rechten = ['project']; assert.equal(s.open(r.link), null); s.l.rechten = s.g.rechten;
  d.verloopt = Date.now() - 1; assert.equal(s.open(r.link), null);
  const vers = s.doe({ actie: 'link', taakId: r.taakId }); assert.ok(s.open(vers.link));
  s.doe({ actie: 'intrekken', taakId: r.taakId }); assert.equal(s.open(vers.link), null);
  assert.equal(s.w.taken[r.taakId].geannuleerd, true);
});
test('onbevoegd, verouderd en onvolledig schrijven heeft geen effect; handmatige route kan niet overschrijven', () => {
  const s = setup(); s.g.rechten = ['project', 'klant']; assert.equal(s.aanvraag().status, 403);
  s.g.rechten = s.l.rechten; assert.equal(s.doe({ actie: 'aanvragen' }).status, 400);
  assert.equal(s.doe({ actie: 'aanvragen', versie: -1 }).status, 409);
  const r = s.aanvraag();
  assert.equal(s.werk.stap(s.w, s.l, { projectId: s.p, versie: s.x.versie, stap: 'extern', taakId: r.taakId,
    externeStand: 'uitgevoerd', bron: 'Eigen opgave', leverancier: 'Andere partij', onderdeel: 'Andere opdracht' }).status, 409);
  s.antwoord(r.link, 'bevestigen');
  assert.equal(s.doe({ actie: 'uitgevoerd', taakId: r.taakId }).status, 400);
  assert.equal(s.doe({ actie: 'uitgevoerd', taakId: r.taakId, toelichting: 'Aangekomen op luchthaven' }).ok, true);
  assert.equal(s.w.taken[r.taakId].kolom, 'klaar');
});

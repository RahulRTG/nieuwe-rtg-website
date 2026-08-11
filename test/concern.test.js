/* ============================================================================
   RTG CONCERN: HET BEDRIJF BOVEN DE ZAAK.

   WAAROM DIT BESTAAT

   Een bedrijf was hier een rij in `suppliers`: een code, een naam en een genre.
   PLATFORM.md benoemt dat gat zelf ("een expliciete organisatie-entiteit"). Wat
   er niet in past: een holding met dochters, twee registraties, drie
   vestigingen, en een mens die bij twee werkgevers in dienst is.

   Deze toets legt de doctrine uit CONCERN.md vast op de plekken waar zij
   machinaal te handhaven is. De vijf ontwerpwetten zijn geen commentaar: wet 4
   (bron en geschiedenis) en wet 5 (bevestiging bij de mens) staan hieronder als
   toetsen die zakken.

   WAT ER WORDT VASTGELEGD

   1. Een juridisch gegeven zonder bron bestaat niet.
   2. Een feit wordt nooit overschreven -- de tijdmachine kent het verleden.
   3. Een tweede bestuurder ontslaat de eerste niet (meervoud versus enkelvoud).
   4. De UBO wordt gerekend, ook door een holding heen, en een kring stopt.
   5. Reikwijdte begrenst een rol; een rol elders geeft hier niets.
   6. Een uitnodiging maakt pas een dienstverband als iemand accepteert.
   7. Een werknemer heeft geen betaalde pas nodig.
   8. Readiness geeft geen cijfer waar niets te meten valt.
   9. Een blokkade zit op de capability en niet op het bedrijf.
  10. Een fusie vernietigt geen geschiedenis.

   DE MUTATIES DIE ZIJN GEDAAN staan onderaan dit bestand.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

/* Een kale kern, zonder server: deze laag praat alleen met db, save en
   findSupplier. Dat is met opzet -- een module die een hele server nodig heeft
   om getoetst te worden, is een module die te veel weet. */
function bouw(zaken, vandaag) {
  const db = { data: {} };
  db.capsVan = (s) => (s && s.caps) || [];
  const suppliers = {};
  for (const s of (zaken || [])) suppliers[s.code] = s;
  return require('../server/kern/concern')({
    db, save: () => {}, crypto,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n),
    findSupplier: (c) => suppliers[String(c || '').toUpperCase()] || null,
    vandaag: () => vandaag || '2027-06-14'
  });
}
const maakEnt = (K, naam, extra) => K.entiteitVind(
  K.entiteitNieuw('lid_a', Object.assign({ naam, land: 'NL', rechtsvorm: 'bv' }, extra)).entiteit.id);

test('een juridisch gegeven zonder bron bestaat niet', () => {
  const K = bouw();
  const e = maakEnt(K, 'Hotel BV');

  const zonder = K.tijdZet(e.id, 'bestuurder', { waarde: 'directeur', sleutel: 'marco' });
  assert.equal(zonder.ok, undefined, 'een feit zonder bron hoort te stuiten');
  assert.match(zonder.error, /bron/i);

  // een bronsoort die niet bestaat telt niet als bron
  assert.equal(K.tijdZet(e.id, 'bestuurder',
    { waarde: 'directeur', sleutel: 'marco', bronSoort: 'weetikveel' }).ok, undefined);

  // en een register-bron zonder herkomst ook niet: dan is het een woord
  assert.equal(K.tijdZet(e.id, 'bestuurder',
    { waarde: 'directeur', sleutel: 'marco', bronSoort: 'register' }).ok, undefined,
    'een register-bron zonder detail hoort te stuiten');

  const met = K.tijdZet(e.id, 'bestuurder',
    { waarde: 'directeur', sleutel: 'marco', bronSoort: 'register', bronDetail: 'KvK' });
  assert.equal(met.ok, true);
  assert.equal(met.feit.bron.soort, 'register');
  assert.ok(met.feit.bron.uitleg, 'een bron hoort zijn uitleg mee te dragen, anders leest het label als keurmerk');
});

test('de tijdmachine kent het verleden: een feit wordt nooit overschreven', () => {
  const K = bouw(null, '2027-06-14');
  const e = maakEnt(K, 'Hotel BV');
  const B = { bronSoort: 'register', bronDetail: 'KvK' };

  K.tijdZet(e.id, 'bestuurder', Object.assign({ waarde: 'directeur', sleutel: 'marco', van: '2026-01-01', tot: '2027-08-31' }, B));
  K.tijdZet(e.id, 'bestuurder', Object.assign({ waarde: 'directeur', sleutel: 'lisa', van: '2027-09-01' }, B));

  const op = (d) => K.tijdOpDatumVan(e.id, 'bestuurder', d).map(x => x.sleutel).sort().join(',');
  assert.equal(op('2027-06-14'), 'marco', 'op 14 juni 2027 was Marco bevoegd');
  assert.equal(op('2027-10-01'), 'lisa', 'na 1 september is Lisa het');
  assert.equal(op('2025-01-01'), '', 'daarvoor was er niemand');

  /* De hele lijn blijft leesbaar -- dat is het punt van de tijdmachine. */
  assert.equal(K.tijdGeschiedenis(e.id, 'bestuurder').length, 2,
    'beide bestuurders horen in de geschiedenis te staan');

  /* De statutaire naam is ENKELVOUDIG: een nieuwe sluit de vorige. De eerste
     naam krijgt hier een `van` in het verleden, want dat is wat een echte
     ondernemer invult -- zijn bedrijf heette vorig jaar ook al zo. */
  const e2 = K.entiteitVind(K.entiteitNieuw('lid_a',
    { naam: 'Hotel BV', land: 'NL', rechtsvorm: 'bv', van: '2024-01-01' }).entiteit.id);
  K.tijdZet(e2.id, 'naam', Object.assign({ waarde: 'Hotel Noordzee BV', van: '2027-01-01' }, B));
  assert.equal(K.entiteitBeeld(e2, '2026-06-01').naam, 'Hotel BV', 'de oude naam hoort te blijven staan');
  assert.equal(K.entiteitBeeld(e2, '2027-06-14').naam, 'Hotel Noordzee BV');

  /* En vragen naar een dag waarop er nog niets gold, geeft geen naamloze
     entiteit maar een antwoord dat zegt dat er toen nog niets was. Die twee
     horen niet hetzelfde te lezen. */
  const voor = K.entiteitBeeld(e2, '2020-01-01');
  assert.equal(voor.bestondNog, false);
  assert.ok(voor.leeguitleg, 'een leeg beeld hoort te zeggen waarom het leeg is');
  assert.equal(K.entiteitBeeld(e2, '2026-06-01').bestondNog, true);
});

test('een tweede bestuurder ontslaat de eerste niet', () => {
  const K = bouw();
  const e = maakEnt(K, 'Hotel BV');
  const B = { bronSoort: 'register', bronDetail: 'KvK', van: '2026-01-01' };
  K.tijdZet(e.id, 'bestuurder', Object.assign({ waarde: 'directeur', sleutel: 'marco' }, B));
  K.tijdZet(e.id, 'bestuurder', Object.assign({ waarde: 'directeur', sleutel: 'lisa' }, B));
  const nu = K.tijdOpDatumVan(e.id, 'bestuurder').map(x => x.sleutel).sort();
  assert.deepEqual(nu, ['lisa', 'marco'],
    'een meervoudig gegeven hoort naast elkaar te bestaan; anders ontslaat elke benoeming stil de vorige');
});

test('de UBO wordt gerekend, ook door een holding heen, en een kring stopt', () => {
  const K = bouw();
  const B = { bronSoort: 'document', bronDetail: 'aandeelhoudersregister', van: '2026-01-01' };
  const h = maakEnt(K, 'Holding BV', { rechtsvorm: 'holding' });
  const d = maakEnt(K, 'Hotel BV');

  K.tijdZet(h.id, 'aandeelhouder', Object.assign({ waarde: 60, sleutel: 'lid_x' }, B));
  K.tijdZet(h.id, 'aandeelhouder', Object.assign({ waarde: 40, sleutel: 'lid_y' }, B));
  K.tijdZet(d.id, 'aandeelhouder', Object.assign({ waarde: 100, sleutel: h.id }, B));

  const u = K.concernUbo(d.id);
  assert.equal(u.soort, 'belang');
  const x = u.ubos.find(z => z.wie === 'lid_x');
  assert.equal(x.percentage, 60, 'via 100% van de holding houdt lid_x 60% van de dochter');
  assert.ok(x.paden.length, 'het pad hoort erbij: een percentage zonder lijn is niet na te rekenen');
  assert.equal(u.bron.soort, 'afgeleid', 'de UBO wordt gerekend, niet ingevuld');

  /* DE GRENS ZELF, want die is het hele getal waar het om draait. Een
     belanghouder van 20% is GEEN UBO en een van 30% wel; zou de grens
     verschuiven, dan verschuift precies dat antwoord mee. Zonder deze twee
     regels pint niets de 25 vast -- een mutatie naar 0 liet elke andere toets
     hier gewoon slagen. */
  const g = maakEnt(K, 'Grens BV');
  K.tijdZet(g.id, 'aandeelhouder', Object.assign({ waarde: 20, sleutel: 'klein' }, B));
  K.tijdZet(g.id, 'aandeelhouder', Object.assign({ waarde: 30, sleutel: 'groot' }, B));
  K.tijdZet(g.id, 'aandeelhouder', Object.assign({ waarde: 50, sleutel: 'grootst' }, B));
  const ug = K.concernUbo(g.id);
  assert.equal(ug.grens, 25, 'de grens hoort 25% te zijn');
  const namen = ug.ubos.map(x => x.wie).sort();
  assert.deepEqual(namen, ['groot', 'grootst'], 'boven de 25% wel, eronder niet');
  assert.equal(namen.includes('klein'), false, '20% maakt van iemand geen UBO');

  /* Zonder aandelen valt hij terug op het bestuur, en dat verschil hoort in het
     antwoord te staan: "eigenaar" en "bij gebrek aan eigenaar" is juridisch
     niet hetzelfde. */
  const leeg = maakEnt(K, 'Lege BV');
  K.tijdZet(leeg.id, 'bestuurder', Object.assign({ waarde: 'directeur', sleutel: 'lid_z' }, B));
  const u2 = K.concernUbo(leeg.id);
  assert.equal(u2.soort, 'bestuur');
  assert.equal(u2.ubos[0].wie, 'lid_z');

  // een kring loopt niet oneindig door en wordt benoemd
  const a = maakEnt(K, 'A BV'), b2 = maakEnt(K, 'B BV');
  K.tijdZet(a.id, 'aandeelhouder', Object.assign({ waarde: 100, sleutel: b2.id }, B));
  K.tijdZet(b2.id, 'aandeelhouder', Object.assign({ waarde: 100, sleutel: a.id }, B));
  const u3 = K.concernUbo(a.id);
  assert.ok(u3.ringen.length, 'een kring hoort benoemd te worden en niet stil te worden afgekapt');
});

test('wie mag tekenen: de limiet telt, en gezamenlijk met z’n eenen is niemand', () => {
  const K = bouw();
  const e = maakEnt(K, 'Hotel BV');
  const B = { bronSoort: 'register', bronDetail: 'KvK', van: '2026-01-01' };
  K.tijdZet(e.id, 'bestuurder', Object.assign({ waarde: 'directeur', sleutel: 'marco',
    extra: { bevoegd: 'alleen', tekenlimiet: 100000 } }, B));

  assert.equal(K.concernMagTekenen(e.id, 50000).alleen.length, 1, 'onder de limiet mag Marco alleen tekenen');
  const hoog = K.concernMagTekenen(e.id, 250000);
  assert.equal(hoog.alleen.length, 0, 'boven zijn limiet is hij niet bevoegd');
  assert.equal(hoog.teLaag[0].wie, 'marco', 'en dan hoort te staan WIE er te weinig ruimte heeft');

  const e2 = maakEnt(K, 'Twee BV');
  K.tijdZet(e2.id, 'bestuurder', Object.assign({ waarde: 'bestuurder', sleutel: 'a', extra: { bevoegd: 'gezamenlijk' } }, B));
  assert.equal(K.concernMagTekenen(e2.id, null).samenGenoeg, false,
    'een gezamenlijk bevoegde bestuurder in zijn eentje kan niet tekenen');
  K.tijdZet(e2.id, 'bestuurder', Object.assign({ waarde: 'bestuurder', sleutel: 'b', extra: { bevoegd: 'gezamenlijk' } }, B));
  assert.equal(K.concernMagTekenen(e2.id, null).samenGenoeg, true);
});

test('reikwijdte begrenst een rol: dezelfde rol geeft elders niets', () => {
  const K = bouw();
  const e = maakEnt(K, 'Hotel BV');
  const ander = maakEnt(K, 'Andere BV');
  const v1 = K.vestigingNieuw(e, { naam: 'Amsterdam' }).vestiging;
  const v2 = K.vestigingNieuw(e, { naam: 'Ibiza' }).vestiging;

  K.employmentNieuw({ persoon: 'lid_m', entiteit: e.id, vestiging: v1.id, rol: 'directie' });

  const mag = (doel) => K.scopeMag('lid_m', 'mens', doel).ok;
  assert.equal(mag({ soort: 'vestiging', id: v1.id }), true, 'op de eigen vestiging wel');
  assert.equal(mag({ soort: 'vestiging', id: v2.id }), false, 'op een andere vestiging niet');
  assert.equal(mag({ soort: 'entiteit', id: ander.id }), false, 'bij een andere entiteit al helemaal niet');

  /* Een entiteitsbrede rol dekt de vestigingen eronder -- dat is de hele reden
     dat de niveaus een volgorde hebben. */
  K.employmentNieuw({ persoon: 'lid_c', entiteit: e.id, rol: 'directie',
    scope: { soort: 'entiteit', id: e.id } });
  assert.equal(K.scopeMag('lid_c', 'mens', { soort: 'vestiging', id: v2.id }).ok, true);

  // en de weigering hoort te zeggen waarom
  const nee = K.scopeMag('lid_m', 'mens', { soort: 'vestiging', id: v2.id });
  assert.ok(nee.uitleg, 'een weigering zonder uitleg leert mensen rechten stapelen tot het werkt');
  assert.ok((nee.bijna || []).some(b => b.reden === 'reikwijdte'));
});

test('een kwalificatie is een filter voor de rol, geen rol', () => {
  const K = bouw();
  const e = maakEnt(K, 'Vervoer BV');
  K.employmentNieuw({ persoon: 'lid_r', entiteit: e.id, rol: 'directie' });
  const doel = { soort: 'entiteit', id: e.id };

  assert.equal(K.scopeMag('lid_r', 'mens', doel, { kwalificatie: 'rijbewijs-C' }).ok, false,
    'zonder de vereiste kwalificatie geen toegang');
  K.kwalificatieZet({ persoon: 'lid_r', wat: 'rijbewijs-C', tot: '2030-01-01' });
  assert.equal(K.scopeMag('lid_r', 'mens', doel, { kwalificatie: 'rijbewijs-C' }).ok, true);

  /* Verlopen: het werk valt weg, de ROL blijft staan. Dat verschil is het hele
     punt -- "u bent geen chauffeur meer" en "uw rijbewijs is verlopen" vragen
     om een ander gesprek. */
  K.kwalificatieZet({ persoon: 'lid_r', wat: 'rijbewijs-C', tot: '2026-01-01' });
  assert.equal(K.scopeMag('lid_r', 'mens', doel, { kwalificatie: 'rijbewijs-C' }).ok, false);
  assert.equal(K.scopeMag('lid_r', 'mens', doel).ok, true, 'de rol zelf hoort ongemoeid te blijven');
});

test('een uitnodiging maakt pas een dienstverband als iemand accepteert', () => {
  const K = bouw();
  const e = maakEnt(K, 'Hotel Noordzee BV');
  const v = K.vestigingNieuw(e, { naam: 'Amsterdam', plaats: 'Amsterdam' }).vestiging;
  const u = K.uitnodigingNieuw('lid_a', { entiteit: e.id, vestiging: v.id, rol: 'receptie' });

  assert.equal(K.employmentVanEntiteit(e.id, true).length, 0,
    'een openstaande uitnodiging hoort NIET als medewerker mee te tellen');

  /* De tekst draagt geen techniek: geen entiteit-id, geen zaakcode. */
  const t = u.tonen;
  assert.match(t.kop, /Hotel Noordzee BV/);
  assert.equal(JSON.stringify(t).includes(e.id), false, 'er hoort geen id in de uitnodigingstekst te staan');
  assert.match(t.voet, /gratis/i, 'een werknemer hoort te lezen dat werken hier geen pas kost');

  const acc = K.uitnodigingAccepteer(u.uitnodiging.code, 'lid_n');
  assert.equal(acc.ok, true);
  assert.equal(K.employmentVanEntiteit(e.id, false).length, 1);

  // eenmalig: een doorgestuurde uitnodiging laat geen tweede mens binnen
  assert.equal(K.uitnodigingAccepteer(u.uitnodiging.code, 'lid_o').ok, undefined);
  assert.equal(K.employmentVanEntiteit(e.id, false).length, 1);
});

test('een mens werkt bij meerdere werkgevers, en een mandaat telt niet als personeel', () => {
  const K = bouw();
  const a = maakEnt(K, 'Hotels BV'), b = maakEnt(K, 'Restaurants BV');
  K.employmentNieuw({ persoon: 'lid_p', entiteit: a.id, rol: 'directie' });
  K.employmentNieuw({ persoon: 'lid_p', entiteit: b.id, rol: 'adviseur' });
  K.employmentNieuw({ persoon: 'lid_acc', entiteit: a.id, rol: 'boekhouder', soort: 'mandaat' });

  assert.equal(K.employmentVanPersoon('lid_p', false).length, 2, 'één identiteit, twee werkrelaties');
  const bij_a = K.employmentVanEntiteit(a.id, false);
  assert.equal(bij_a.length, 2);
  assert.equal(bij_a.filter(x => x.telt).length, 1,
    'een mandaat is geen dienstverband en hoort niet als personeel te tellen');
});

test('readiness geeft geen cijfer waar niets te meten valt, en blokkeert per capability', () => {
  const zaak = { code: 'ZAAK1', name: 'Cafe Vidal', type: 'restaurant', city: 'Ibiza', menu: [], caps: ['orders'] };
  const K = bouw([zaak]);
  const e = maakEnt(K, 'Horeca BV');

  const kaal = K.concernReadiness(e);
  const ops = kaal.delen.find(d => d.id === 'operations');
  assert.equal(ops.nvt, true, 'zonder vestigingen valt er aan operations niets te meten');
  assert.equal(ops.score, undefined, 'en dan hoort er GEEN cijfer te staan -- een 0 leest als een fout');

  const v = K.vestigingNieuw(e, { naam: 'Ibiza' }).vestiging;
  K.vestigingUnit(K.vestigingVind(v.id), 'ZAAK1', () => true);

  const l = K.concernLaunch(e);
  const orders = l.capabilities.find(c => c.capability === 'orders');
  assert.equal(orders.mag, false, 'online bestellen zonder menu hoort geblokkeerd te zijn');
  assert.equal(orders.ernst, 'blokkerend');

  /* DE BLOKKADE ZIT OP DE CAPABILITY EN NIET OP HET BEDRIJF. Zou zij op het
     bedrijf zitten, dan houdt één ontbrekend menu een heel concern tegen -- en
     dan vult iemand het veld met onwaarheid om verder te kunnen. */
  zaak.menu = [{ naam: 'Paella' }];
  assert.equal(K.concernLaunch(e).capabilities.find(c => c.capability === 'orders').mag, true);

  // en elk punt draagt een handeling: een score zonder afwijking is decoratie
  for (const p of K.concernReadiness(e).blokkerend) assert.ok(p.doe, 'elk punt hoort te zeggen wat je eraan doet');
});

test('een fusie verhuist mensen zonder hun geschiedenis te vernietigen', () => {
  const K = bouw();
  const van = maakEnt(K, 'Oude BV'), naar = maakEnt(K, 'Nieuwe BV');
  const v = K.vestigingNieuw(van, { naam: 'Haarlem' }).vestiging;
  K.employmentNieuw({ persoon: 'lid_f', entiteit: van.id, vestiging: v.id, rol: 'directie', van: '2024-03-01' });
  K.tijdZet(van.id, 'bestuurder', { waarde: 'directeur', sleutel: 'lid_f', van: '2024-03-01',
    bronSoort: 'register', bronDetail: 'KvK' });

  const beeld = K.concernFusieBeeld(van, naar);
  assert.equal(beeld.verhuist.mensen, 1);
  assert.equal(K.employmentVanEntiteit(naar.id, false).length, 0, 'het beeld hoort nog niets te doen');

  K.concernFusieDoe(van, naar, '2027-01-01');
  const over = K.employmentVanEntiteit(naar.id, false);
  assert.equal(over.length, 1);
  assert.equal(over[0].van, '2024-03-01',
    'de begindatum hoort te blijven staan; niemand is opnieuw aangenomen');
  assert.equal(K.tijdGeschiedenis(van.id, 'bestuurder').length, 1,
    'de juridische geschiedenis van de verdwijnende entiteit hoort te blijven staan');
});

test('uit dienst inventariseert eerst en regelt niets stilzwijgend', () => {
  const K = bouw();
  const e = maakEnt(K, 'Hotel BV');
  K.employmentNieuw({ persoon: 'lid_u', entiteit: e.id, rol: 'directie' });
  K.tijdZet(e.id, 'bestuurder', { waarde: 'directeur', sleutel: 'lid_u', van: '2026-01-01',
    bronSoort: 'register', bronDetail: 'KvK' });

  const b = K.concernOffboardingBeeld('lid_u', e.id);
  assert.ok(b.aandacht.some(a => /bestuurder/i.test(a)),
    'dat iemand bestuurder is hoort genoemd te worden: uit dienst gaan beëindigt die bevoegdheid niet');

  /* Uit dienst per een datum in de TOEKOMST beëindigt vandaag nog niets, en dat
     is precies goed: wie op 30 juni weggaat, werkt op 14 juni gewoon. Een
     systeem dat hem meteen buitensluit, sluit iemand buiten die er nog is. */
  const later = K.concernOffboardingDoe('lid_u', e.id, '2027-06-30');
  assert.equal(later.beeindigd, 1);
  assert.equal(K.employmentVanEntiteit(e.id, false).length, 1,
    'een einddatum in de toekomst hoort vandaag nog niets te veranderen');
  assert.equal(K.employmentOpDatum(e.id, '2027-07-01').length, 0, 'en op 1 juli is hij weg');

  assert.equal(K.tijdOpDatumVan(e.id, 'bestuurder').length, 1,
    'de bestuursbevoegdheid hoort NIET stil te zijn meebeëindigd');
  assert.match(later.grens, /NIET beëindigd/,
    'en dat hoort in het antwoord te staan, niet alleen in de code');
});

test('een momentopname zet de structuur terug en zegt eerlijk wat hij niet terugdraait', () => {
  const K = bouw();
  const e = maakEnt(K, 'Hotel BV');
  K.vestigingNieuw(e, { naam: 'Amsterdam' });
  const opn = K.concernOpnameMaak('lid_a', 'voor de reorganisatie');
  assert.equal(opn.ok, true);

  K.vestigingNieuw(e, { naam: 'Ibiza' });
  maakEnt(K, 'Er Tussendoor BV');
  assert.equal(K.vestigingAlleVanEntiteit(e.id).length, 2);

  const h = K.concernOpnameHerstel('lid_a', opn.opname.id);
  assert.equal(h.ok, true);
  assert.equal(K.vestigingAlleVanEntiteit(e.id).length, 1, 'de structuur hoort terug te staan');
  assert.equal(K.entiteitVanEigenaar('lid_a').length, 1, 'en de entiteit die erna kwam ook');
  assert.match(h.grens, /geen tijdreis/i,
    'een herstelknop waarvan de reikwijdte onduidelijk is, is gevaarlijker dan geen herstelknop');
});

test('de twee eindervaringen zijn één zin, geen stappenteller', () => {
  const K = bouw();
  const e = maakEnt(K, 'Hotel BV');
  const v = K.vestigingNieuw(e, { naam: 'Amsterdam' }).vestiging;
  const u = K.uitnodigingNieuw('lid_a', { entiteit: e.id, vestiging: v.id, rol: 'receptie' });
  K.uitnodigingAccepteer(u.uitnodiging.code, 'lid_w');

  const o = K.concernOverzicht('lid_a');
  assert.equal(o.kop, 'Uw concern is opgebouwd.');
  assert.equal(o.telling.entiteiten, 1);
  assert.equal(o.telling.mensen, 1);
  assert.match(o.regel, /aandacht vragen|geen openstaande punten/);
  assert.equal(/stap \d+ van \d+/i.test(JSON.stringify(o)), false, 'geen stappenteller');

  const w = K.werkOverzicht('lid_w');
  assert.equal(w.werkplekken.length, 1);
  assert.equal(w.werkplekken[0].bedrijf, 'Hotel BV');
  assert.match(w.regel, /klaar/i);
  assert.match(K.werkOverzicht('lid_niemand').regel, /gratis/i,
    'wie nog geen werkplek heeft hoort te lezen dat uitgenodigd worden gratis is');
});

/* ----------------------------------------------------------------------------
   DE MUTATIES DIE ZIJN GEDAAN (LAT-regel 2)

   1. bron-eis uit tijdZet()                      -> toets 1 zakt
   2. tijdZet() de vorige regel laten overschrijven -> toets 2 zakt
   3. `meervoud: false` op bestuurder             -> toets 3 zakt
   4. UBO-grens van 25 naar 0                     -> toets 4 zakt
   5. scopeDekt() altijd true laten geven         -> toets 6 zakt
   6. uitnodigingNieuw() meteen employmentNieuw() -> toets 8 zakt
   7. readiness zonder nvt (0% i.p.v. geen cijfer) -> toets 10 zakt
   8. fusieDoe() de begindatum op vandaag zetten  -> toets 11 zakt
   -------------------------------------------------------------------------- */

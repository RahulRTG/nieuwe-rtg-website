/* ============================================================================
   EEN LEESPAD SCHRIJFT NIET.

   /api/supplier/backoffice is een dashboard: het kijkt naar de dag, de week en
   de openstaande signalen en verandert niets. Toch gaf het in de 100M-ronde van
   9 september 2026 acht serverfouten, en 95 in de 200k-ronde -- élke 5xx van die
   rondes kwam van deze ene route. De oorzaak stond op drie plekken tegelijk en
   was er telkens een van "even een leeg doosje klaarzetten":

     1. eigencollectie.bak('zaakCommand') MAAKT de collectie aan als zij
        ontbreekt. Dat is zelf al een mutatie, ook als er niets in komt.
     2. vakVan() zette er `vakken[code] = {}` in, bij het eerste KIJKEN.
     3. beleid.reg() schreef de startregels in dat vak zodra iemand een waarde
        OPVROEG.

   In PostgreSQL-modus weigert de requestcommit dat terecht: een gewijzigde
   collectie zonder save() is PG_SAVE_ONTBREEKT, en dat is een 500. In sqlite
   bewaakt niets die grens, dus daar stond het jarenlang groen. Het was dus geen
   postgres-BUG maar een postgres-DETECTIE, en dat verschil is de reden dat deze
   toets op de kern staat en niet op de route.

   WAT DEZE TOETS VASTHOUDT, en waarom de tweede helft er even hard bij hoort:
   lezen mag niets aanmaken, EN schrijven moet nog gewoon landen. Een reparatie
   die het schrijven ook stilzet, lost de 500 op en breekt het product.

   Draai los: node --test test/leespad-schrijft-niet.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

function maak(commGast) {
  const zaak = { code: 'MIJN', name: 'Sal de Mar', type: 'restaurant', city: 'Ibiza', rooms: [], tables: [] };
  const db = { data: { suppliers: [zaak], orders: [], boekingen: [], rides: [] } };
  let bewaard = 0;
  const zc = require('../server/kern/zaakcommand').maakZaakCommand({
    db, save: () => { bewaard++; }, crypto, anthropic: null,
    findSupplier: (c) => db.data.suppliers.find(x => x.code === c), commGast
  });
  return { db, zaak, zc, laag: zc.voor(zaak, { leiding: true }), saves: () => bewaard };
}

test('een beleidswaarde opvragen maakt geen collectie en geen vak aan', () => {
  const { db, laag } = maak();
  assert.equal(db.data.zaakCommand, undefined, 'vooraf bestaat de collectie niet');

  const v = laag.beleid.waarde('zaak.reactieMinuten');
  assert.equal(v, 10, 'de startwaarde hoort gewoon gelezen te worden');

  assert.equal(db.data.zaakCommand, undefined,
    'het LEZEN van een beleidswaarde maakte de collectie zaakCommand aan (PG_SAVE_ONTBREEKT)');
});

test('de hele beleidslijst en de geschiedenis lezen schrijft ook niet', () => {
  const { db, laag } = maak();
  const alles = laag.beleid.alles();
  assert.ok(alles.length >= 8, 'alle startregels horen zichtbaar te zijn zonder ze op te slaan');
  assert.ok(alles.every(b => b.versie === 1));
  laag.beleid.geschiedenis('zaak.reactieMinuten');
  laag.beleid.openVoorstellen();
  laag.beleid.voorstellen();
  assert.equal(db.data.zaakCommand, undefined,
    'een leespad legde beleid vast zonder dat er iets veranderde');
});

test('de signalen van het dashboard lezen schrijft niet', () => {
  const { db, laag, zaak } = maak();
  const alerts = laag.signalen.alerts(zaak, false, { leiding: true });
  assert.ok(Array.isArray(alerts));
  assert.equal(db.data.zaakCommand, undefined,
    'het opbouwen van het actiecentrum schreef in zaakCommand');
});

test('vier orders worden door tijd alerts zonder bronmutatie of schrijfactie', (t) => {
  const { db, laag, zaak, saves } = maak();
  const begin = Date.parse('2026-11-11T23:14:50Z');
  db.data.orders = Array.from({ length: 4 }, (_, i) => ({ ref: 'O-' + i,
    supplierCode: zaak.code, paid: true, status: 'nieuw', paidAt: new Date(begin).toISOString() }));
  const opgeslagen = structuredClone(db.data);
  let nu = begin + 569999;
  t.mock.method(Date, 'now', () => nu);
  const voor = laag.signalen.bronstempel(zaak, { leiding: true });
  assert.equal(laag.signalen.alerts(zaak, false, { leiding: true }).length, 0);
  nu++;
  assert.equal(laag.signalen.alerts(zaak, false, { leiding: true }).length, 4);
  assert.deepEqual(laag.signalen.bronstempel(zaak, { leiding: true }), voor);
  assert.equal(voor.schema, 1);
  assert.equal(voor.bereik, 'zaakcommand-signalen');
  assert.match(voor.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(db.data, opgeslagen);
  assert.equal(saves(), 0);
});

test('de signalenbron ziet inhoud en beleid, ook zonder gewijzigde aantallen', () => {
  const chats = [{ key: 'G-1', unread: 1, lastAt: '2026-11-11T23:14:50Z' }];
  const { db, zaak, laag } = maak({ voorZaak: () => chats });
  db.data.orders = Array.from({ length: 90 }, (_, i) => ({ ref: 'O-' + i,
    supplierCode: zaak.code, paid: true, status: 'nieuw', at: '2026-11-11T23:14:50Z' }));
  db.data.rides = [{ ref: 'R-1', supplierCode: zaak.code, driver: null }];
  db.data.boekingen = [{ ref: 'B-1', supplierCode: zaak.code, status: 'aangevraagd' }];
  db.data.verlof = { MIJN: [{ id: 'V-1', status: 'nieuw' }] };
  db.data.applications = { MIJN: [{ id: 'A-1', status: 'nieuw' }] };
  db.data.tickets = { MIJN: [{ id: 'T-1', status: 'open' }] };
  zaak.rooms.push({ id: 'K-1', hk: { status: 'vuil' } });
  const stempel = () => laag.signalen.bronstempel(zaak, { leiding: true });
  for (const wijzig of [
    () => { db.data.orders[89].status = 'in bereiding'; },
    () => { db.data.orders[0].ref = 'O-VERVANGEN'; },
    () => { db.data.rides[0].driver = 'chauffeur'; },
    () => { db.data.boekingen[0].status = 'bevestigd'; },
    () => { db.data.verlof.MIJN[0].status = 'toegestaan'; },
    () => { db.data.applications.MIJN[0].status = 'uitgenodigd'; },
    () => { db.data.tickets.MIJN[0].status = 'klaar'; },
    () => { zaak.rooms[0].hk.status = 'schoon'; },
    () => { chats[0].unread = 0; },
    () => { laag.beleid.zet('zaak.reactieMinuten', 11, 'toets', 'andere termijn'); },
    () => { laag.beleid.zet('zaak.boekingMinuten', 31, 'toets', 'andere termijn'); }
  ]) {
    const voor = stempel(); wijzig();
    assert.notEqual(stempel().sha256, voor.sha256, String(wijzig));
  }
  const voor = stempel();
  db.data.orders.push({ ref: 'O-BUUR', supplierCode: 'BUUR', status: 'nieuw' });
  db.data.verlof.BUUR = [{ status: 'nieuw' }];
  assert.deepEqual(stempel(), voor, 'andere zaken horen niet bij deze bron');
  db.data.orders[0].notitie = 'CANARY-GEHEIME-BODY-783';
  assert.equal(JSON.stringify(stempel()).includes('CANARY-GEHEIME-BODY-783'), false);
});

test('alleen een expliciet managerverzoek berekent de backoffice-bronstempel', () => {
  let handler, berekend = 0;
  const zaak = { code: 'MIJN', rooms: [] };
  const signalen = { alerts: () => [], bronstempel: () => {
    berekend++; return { schema: 1, bereik: 'zaakcommand-signalen', sha256: 'a'.repeat(64) };
  } };
  require('../server/routes/supplier/backoffice')({
    app: { post: (_pad, _auth, fn) => { handler = fn; } }, supplierAuth() {},
    db: { data: { rides: [], posSales: {}, klok: {} } },
    ordersVanZaak: () => [], boekingenVanZaak: () => [], zaakcommand: { voor: () => ({ signalen }) }
  });
  const lees = (body, manager = true) => {
    let status = 200, data;
    handler({ supplier: zaak, actor: { manager }, body }, {
      status(n) { status = n; return this; }, json(v) { data = v; }
    });
    return { status, data };
  };
  for (const body of [{}, { bronstempel: false }, { bronstempel: 'true' }]) {
    assert.equal(lees(body).data.alertBron, undefined);
  }
  assert.equal(berekend, 0, 'gewone scherm- en sessiecontroles serialiseren de bron niet');
  assert.equal(lees({ bronstempel: true }, false).status, 403);
  assert.equal(berekend, 0, 'een medewerker kan de berekening niet opvragen');
  assert.equal(lees({ bronstempel: true }).data.alertBron.sha256, 'a'.repeat(64));
  assert.equal(berekend, 1);
});

/* DE ANDERE HELFT. Zonder deze toets is de reparatie hierboven te "halen" door
   het schrijven ook stil te zetten, en dan is de 500 weg en het product stuk. */
test('een beleidsregel zetten legt hem WEL vast, en slaat op', () => {
  const { db, laag, saves } = maak();
  const uit = laag.beleid.zet('zaak.reactieMinuten', 25, 'toets', 'omdat het sneller moet');
  assert.equal(uit.error, undefined, uit.error || '');
  assert.ok(db.data.zaakCommand, 'een echte wijziging hoort de collectie wel aan te maken');
  assert.ok(db.data.zaakCommand.MIJN, 'en het vak van deze zaak');
  assert.equal(laag.beleid.waarde('zaak.reactieMinuten'), 25, 'de nieuwe waarde wordt teruggelezen');
  assert.ok(saves() > 0, 'een schrijfpad hoort save() aan te roepen');
});

test('het vak van de ene zaak blijft van die zaak', () => {
  const { db, zc } = maak();
  const buur = { code: 'BUUR', name: 'Buurzaak', type: 'restaurant', city: 'Ibiza', rooms: [], tables: [] };
  db.data.suppliers.push(buur);
  zc.voor(db.data.suppliers[0], { leiding: true })
    .beleid.zet('zaak.reactieMinuten', 25, 'toets', 'omdat het sneller moet');
  assert.equal(zc.voor(buur, { leiding: true }).beleid.waarde('zaak.reactieMinuten'), 10,
    'de buurzaak kreeg de regel van een andere zaak te zien');
  assert.equal(db.data.zaakCommand.BUUR, undefined,
    'alleen kijken bij de buurzaak maakte daar toch een vak aan');
});

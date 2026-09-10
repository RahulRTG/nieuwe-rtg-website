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

function maak() {
  const zaak = { code: 'MIJN', name: 'Sal de Mar', type: 'restaurant', city: 'Ibiza', rooms: [], tables: [] };
  const db = { data: { suppliers: [zaak], orders: [], boekingen: [], rides: [] } };
  let bewaard = 0;
  const zc = require('../server/kern/zaakcommand').maakZaakCommand({
    db, save: () => { bewaard++; }, crypto, anthropic: null,
    findSupplier: (c) => db.data.suppliers.find(x => x.code === c)
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

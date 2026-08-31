/* ============================================================================
   DE SLEUTELBOS VAN DE PROEVEN -- scripts/lib/proefsleutels.js

   Deze toets bestaat om een fout te vangen die hier echt is gemaakt en die
   NIEMAND zag, omdat hij groen kleurde: de bewakerskaart kreeg vier eigenrollen
   (boardroom, techniek, werkplekbaas, scim) en geen enkel proefinstrument had
   er een sleutel voor. De routes met zo'n rol werden daarna netjes overgeslagen
   met een keurige reden in het uitslagbestand -- 111 stuks. Geen enkele meter
   ging omlaag, geen enkele toets zakte, en de proeven bleven "geslaagd".

   De regel die dat had moeten afdwingen staat hieronder als eerste toets:
   ELKE EIGENROL OP DE BEWAKERSKAART HEEFT EEN MUNTER. Komt er een deur bij
   waar dit huis geen sleutel voor kan maken, dan hoort de bouw te zakken --
   niet het uitslagbestand een regel rijker te worden.
   ========================================================================== */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');

const bos = require('../scripts/lib/proefsleutels');
const bewakers = require('../scripts/lib/bewakers');

const munterNamen = bos.MUNTERS.map(m => m[0]);

test('elke eigenrol op de bewakerskaart heeft een munter', () => {
  const eigenrollen = [...new Set(bewakers.namenVan('eigenrol').map(n => bewakers.rolBij(n)))];
  assert.ok(eigenrollen.length >= 4, 'de kaart hoort eigenrollen te kennen; nu: ' + eigenrollen.join(', '));
  const zonder = eigenrollen.filter(r => !munterNamen.includes(r));
  assert.deepStrictEqual(zonder, [],
    'eigenrol(len) zonder sleutel in scripts/lib/proefsleutels.js: ' + zonder.join(', ') +
    ' -- routes met die rol worden dan stil overgeslagen als ONGEMETEN, en dat leest als geslaagd.');
});

test('elke gemodelleerde rol op de kaart heeft ook een munter', () => {
  const rollen = [...new Set(bewakers.namenVan('rol').map(n => bewakers.rolBij(n)))];
  const zonder = rollen.filter(r => !munterNamen.includes(r));
  assert.deepStrictEqual(zonder, [], 'rol(len) zonder sleutel: ' + zonder.join(', '));
});

test('elke munter zegt waarom zijn weg de juiste is', () => {
  for (const [rol, waarom, munt] of bos.MUNTERS) {
    assert.strictEqual(typeof munt, 'function', rol + ' heeft geen munter');
    assert.ok(waarom && waarom.length > 20,
      rol + ' heeft geen (of een te korte) reden; juist die verdwijnt als eerste bij een kopie');
  }
});

/* Een nep-server: hij geeft elke inlog een token, zodat de bos-logica zelf te
   toetsen is zonder een echte RTG te starten. */
function nepPost(mislukt = new Set()) {
  const gezien = [];
  return {
    gezien,
    post: async (pad, lijf, tok) => {
      gezien.push({ pad, tok: tok || null });
      if (mislukt.has(pad)) return { status: 403, data: { error: 'nee' } };
      if (pad === '/api/techniek/sso') return { status: 200, data: { ok: true } };
      if (pad === '/api/techniek/sso/scimsleutel') return { status: 200, data: { sleutel: 'rtgscim_' + 'x'.repeat(30) } };
      return { status: 200, data: { token: 't:' + pad } };
    }
  };
}

test('een geslaagde ronde munt alle zeven rollen en meldt niets ontbrekends', async () => {
  const { post } = nepPost();
  const b = await bos.haalSleutels({ post });
  assert.deepStrictEqual(b.ontbreekt, []);
  for (const rol of munterNamen) assert.ok(b.tokens[rol], 'geen token voor ' + rol);
  // eigenaar is een opstapje en geen deur: hij hoort niet in de rollenlijst
  assert.ok(!b.rollen.includes('eigenaar'),
    'eigenaar is geen bewakersrol; zou hij in de lijst staan, dan gingen proeven routes verdelen op een rol die geen enkele route draagt');
  assert.ok(b.rollen.includes('boardroom') && b.rollen.includes('scim'));
});

/* DE KERNINVARIANT, met een mutatie: valt de eigenaarsinlog weg, dan mogen
   boardroom, techniek en werkplekbaas NIET in de rollenlijst staan. Ze zonder
   sleutel toch meenemen geeft een 401 die eruitziet als "geweigerd, er bleef
   niets staan" -- groen dat niets bewijst. */
test('een rol zonder sleutel komt NIET in de rollenlijst, maar wel in ontbreekt', async () => {
  const { post } = nepPost(new Set(['/api/auth/login']));
  const b = await bos.haalSleutels({ post });
  for (const rol of ['eigenaar', 'techniek', 'boardroom', 'werkplekbaas', 'scim']) {
    assert.ok(!b.tokens[rol], rol + ' heeft een token terwijl de eigenaarsinlog faalde');
    assert.ok(!b.rollen.includes(rol), rol + ' staat in de rollenlijst zonder sleutel');
    assert.ok(b.ontbreekt.some(o => o.rol === rol), rol + ' ontbreekt maar wordt niet gemeld');
  }
  // en de drie basisrollen blijven gewoon staan
  for (const rol of bos.BASISROLLEN) assert.ok(b.tokens[rol], rol + ' zou gewoon moeten lukken');
});

test('een ontbrekende rol draagt de reden waarom zijn weg zou moeten werken', async () => {
  const { post } = nepPost(new Set(['/api/auth/login']));
  const b = await bos.haalSleutels({ post });
  for (const o of b.ontbreekt) {
    assert.ok(o.waarom && o.waarom.length > 20,
      o.rol + ' ontbreekt zonder uitleg; dan is een storing niet te onderscheiden van een rol die deze opstelling nooit kan hebben');
  }
});

test('de boardroom loopt via het ene account en NIET via de kantoorcode', async () => {
  const { post, gezien } = nepPost();
  await bos.haalSleutels({ post });
  const start = gezien.find(g => g.pad === '/api/account/start');
  assert.ok(start, 'de boardroom-sleutel hoort via /api/account/start te lopen');
  assert.strictEqual(start.tok, 't:/api/auth/login',
    'die oproep hoort het EIGENAARSTOKEN te dragen; met een kantoorcode-sessie zet ' +
    'server/routes/office/toegang.js geen lidKey en komt boardroomWie() nooit verder dan null');
});

test('de scim-sleutel wordt gedraaid en niet verzonnen', async () => {
  const { post, gezien } = nepPost();
  const b = await bos.haalSleutels({ post });
  assert.ok(gezien.some(g => g.pad === '/api/techniek/sso'), 'eerst de SSO-koppeling: een SCIM-sleutel hoort bij een organisatie');
  assert.ok(gezien.some(g => g.pad === '/api/techniek/sso/scimsleutel'));
  assert.ok(String(b.tokens.scim).startsWith('rtgscim_'), 'de scim-sleutel draagt het voorvoegsel uit server/scim/sleutels.js');
});

test('de basisrollen zijn de drie zonder welke een proef niets meet', () => {
  assert.deepStrictEqual(bos.BASISROLLEN, ['member', 'office', 'supplier']);
});

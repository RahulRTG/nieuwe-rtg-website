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
  let nr = 0;
  return {
    gezien,
    post: async (pad, lijf, tok) => {
      gezien.push({ pad, tok: tok || null });
      if (mislukt.has(pad)) return { status: 403, data: { error: 'nee' } };
      if (pad === '/api/techniek/sso') return { status: 200, data: { ok: true } };
      /* DE VORM VAN HET REGISTRATIE-ANTWOORD IS ECHT NAGEKEKEN, en dat is hier
         geen overdaad. De munter van kantoor-a/-b leest het account-id uit
         `state.user.id`; gaf deze nep-server alleen een token terug, dan zou de
         zetelstap stil worden overgeslagen en zou deze toets groen staan over
         iets dat op een echte server nooit gebeurt. Precies de fixture-val uit
         CARRIERE.md par. 5: de fixture houdt zich aan de vorm die de code
         AANNEEMT in plaats van aan de vorm die de server geeft.
         Nagemeten tegen een draaiende server op 13 september 2026. */
      if (pad === '/api/auth/register') {
        nr += 1;
        return { status: 200, data: { token: 't:register:' + nr, state: { user: { id: 1000 + nr } } } };
      }
      if (pad === '/api/techniek/sso/scimsleutel') return { status: 200, data: { sleutel: 'rtgscim_' + 'x'.repeat(30) } };
      /* EEN SESSIE HOORT BIJ EEN ACCOUNT, ook in een nep-server. Gaf deze regel
         voor /api/account/start altijd hetzelfde token terug, dan kregen twee
         VERSCHILLENDE kantoormensen dezelfde sleutel -- en dan staat er groen
         over een opstelling die in werkelijkheid een mens is. Het token van de
         aanroeper gaat daarom mee in het antwoord. */
      if (pad === '/api/account/start' && tok) return { status: 200, data: { token: 't:' + pad + ':' + tok } };
      return { status: 200, data: { token: 't:' + pad } };
    }
  };
}

test('een geslaagde ronde munt alle zeven rollen en meldt niets ontbrekends', async () => {
  const { post } = nepPost();
  const b = await bos.haalSleutels({ post });
  assert.deepStrictEqual(b.ontbreekt, []);
  /* `!= null` en niet `assert.ok`: drie rollen (openbaar, omgeving, eigen-poort)
     hebben met opzet de LEGE STRING als sleutel -- geen Authorization-kop is voor
     een openbare route de juiste invoer en geen tekort. Een waarheidstoets leest
     die drie als 'geen token', en dat is precies hoe 107 openbare routes als
     ongemeten konden tellen. Wat deze regel moet vastzetten is dat er een sleutel
     IS, niet dat hij niet leeg is. */
  for (const rol of munterNamen) {
    assert.ok(b.tokens[rol] != null, 'geen token voor ' + rol);
    assert.equal(typeof b.tokens[rol], 'string', 'een sleutel is een tekenreeks: ' + rol);
  }
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

/* ============================================================================
   TWEE KANTOORMENSEN, EN ZE MOGEN NOOIT EEN WORDEN.

   Tot 13 september 2026 had deze sleutelbos precies EEN mens aan het kantoor:
   de eigenaar. Dat opent elke deur en bewijst daarom niets over WIE er doorheen
   kwam. Het scherpst bij server/routes/uitgifte.js, dat twee PERSONEN onder een
   document eist: met een sleutelbos van een mens is die eis niet te beproeven,
   en een eis die niet beproefd kan worden is een vormvereiste.

   Gemeten met de verse sleutelbos tegen een echte server (13 september 2026):
   A start een uitgifte en tekent -> 409 "dezelfde ogen tellen niet dubbel";
   B tekent -> 200. Dat was voor deze stap niet te draaien.

   DE MUTATIE: laat `kantoor-b` hetzelfde token teruggeven als `kantoor-a`
   (bijvoorbeeld `bos['kantoor-a']`) -> deze toets zakt.
   ========================================================================== */
test('kantoor A en kantoor B zijn twee VERSCHILLENDE mensen', async () => {
  const { post, gezien } = nepPost();
  const b = await bos.haalSleutels({ post });
  for (const rol of ['kantoor-a', 'kantoor-b']) {
    assert.ok(b.tokens[rol], 'geen sleutel voor ' + rol);
  }
  assert.notStrictEqual(b.tokens['kantoor-a'], b.tokens['kantoor-b'],
    'A en B dragen dezelfde sleutel; dan is het EEN mens met twee namen');
  /* En de sleutel is het gevolg, niet de oorzaak: twee TOKENS uit een gedeelde
     registratie zijn nog steeds een gedeelde mens. Dus ook de weg ernaartoe. */
  const registraties = gezien.filter(g => g.pad === '/api/auth/register');
  assert.ok(registraties.length >= 2,
    'A en B horen elk hun eigen account te registreren; nu ' + registraties.length +
    ' registratie(s). Delen ze er een, dan is het vier-ogenprincipe niet te beproeven.');
});

test('kantoor-op-naam is een MEDEWERKER, met de boardroom alleen als terugval', async () => {
  const { post } = nepPost();
  const b = await bos.haalSleutels({ post });
  assert.strictEqual(b.tokens['kantoor-op-naam'], b.tokens['kantoor-a'],
    'kantoor-op-naam hoort kantoor-a te zijn: de eigenaar komt overal door en bewijst dus niets over de deur');

  /* EN DE TERUGVAL MOET WERKEN, want een reparatie die dekking KOST is geen
     reparatie. Valt de registratieweg weg, dan hoort kantoor-op-naam terug te
     vallen op de boardroom in plaats van te verdwijnen -- anders verliezen de
     routes achter kluisAuth en naamAuth in een uitgeklede omgeving hun sleutel. */
  const kaal = nepPost(new Set(['/api/auth/register']));
  const b2 = await bos.haalSleutels({ post: kaal.post });
  assert.ok(!b2.tokens['kantoor-a'], 'zonder registratie hoort kantoor-a te ontbreken');
  assert.strictEqual(b2.tokens['kantoor-op-naam'], b2.tokens.boardroom,
    'zonder medewerker hoort kantoor-op-naam op de boardroom terug te vallen');
});

/* De zetel is geen bijzaak: kern/ledenbalie-zetels.js laat iedereen behalve de
   boardroom alleen met een zetel toe, dus zonder deze stap staat er een
   medewerker voor een deur die dicht blijft -- en dat leest als een uitslag
   over de ROUTE terwijl het een uitslag over de opstelling is. */
test('een kantoormedewerker krijgt zijn baliezetel van de boardroom', async () => {
  const { post, gezien } = nepPost();
  const b = await bos.haalSleutels({ post });
  const zetels = gezien.filter(g => g.pad === '/api/office/balie/zetel');
  assert.ok(zetels.length >= 1,
    'geen enkele zetel uitgedeeld; dan blijven de 31 baliewegen achter een 403 die de proef zelf uitlokte');
  assert.ok(zetels.every(z => z.tok === b.tokens.boardroom),
    'de zetel hoort door de BOARDROOM gezet te worden; /api/office/balie/zetel hangt aan boardroomAuth, ' +
    'en met de sleutel van de medewerker zelf zou hij zichzelf toelaten');
});

test('de basisrollen zijn de drie zonder welke een proef niets meet', () => {
  assert.deepStrictEqual(bos.BASISROLLEN, ['member', 'office', 'supplier']);
});

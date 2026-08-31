/* WAT DE GEDEELDE CONTEXT BELOOFT -- en wat 47 modules eruit halen.

   DEZE TOETS KOMT UIT EEN FOUT DIE GROEN BLEEF. Bij het hernoemen van `centen`
   werd de omzetter in kern/rtfos/basis.js over het hoofd gezien, terwijl de
   modules die hem gebruiken WEL waren hernoemd. Ze stonden daarna te
   destructureren op een naam die de context niet gaf:

     const { ..., rondEuro, ... } = ctx;    // ctx gaf `centen`
     const bedrag = rondEuro(b.bedrag);     // TypeError, pas bij aanroep

   Dat is stil in JavaScript: `rondEuro` wordt `undefined` en klapt pas als die
   regel echt draait. De veertig rtfos-toetsen bleven groen -- die paden waren
   niet gedekt. Een fout die je niet ziet zakken, ziet de gebruiker het eerst.

   DUS: EEN TOETS DIE DE CONTEXT NIET GELOOFT MAAR BOUWT. Hij zet de echte
   ./basis op met een lege database, plakt erop wat kern/rtfos/index.js erop
   plakt, en leest daarna van elke module wat die eruit haalt. Elke naam die
   niet bestaat, is een aanroep die ooit klapt.

   Dit is een STATISCHE lezing van een DRAAIENDE context -- met opzet: de
   modules zelf aanroepen zou elke route moeten raken om iets te bewijzen, en
   dat is precies wat de bestaande toetsen niet doen.

   WAAROM DIT GEEN KOPIE IS VAN KEURINGSREGEL 50. Die regel zoekt namen die het
   bestand NERGENS bindt -- een blok dat na een knip zijn omringende bereik
   kwijt is. Hier is de naam wel gebonden: de destructurering zelf bindt hem. Wat
   ontbreekt is de WAARDE aan de andere kant. Regel 50 leest een bestand, deze
   toets legt twee kanten naast elkaar. Ze vangen allebei stille fouten en het
   zijn niet dezelfde.

   Draai los: node --test test/rtfos-context.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MAP = path.join(__dirname, '..', 'server', 'kern', 'rtfos');

/* De context zoals kern/rtfos/index.js hem opbouwt: ./basis met de vier dingen
   die de server meegeeft, plus wat index.js er daarna bij zet. Staat er in
   index.js iets nieuws bij, dan hoort het hier ook -- en zolang dat niet zo is,
   meldt deze toets die naam als ontbrekend. Dat is de bedoelde richting: liever
   een valse melding dan een gemiste. */
function bouwContext() {
  const db = { data: {} };
  const crypto = require('crypto');
  const ctx = require(path.join(MAP, 'basis'))({
    db, save: () => {}, crypto,
    boardroomWie: () => null, magBoardroom: () => false
  });
  Object.assign(ctx, { db, save: () => {}, crypto, kluis: require('../server/kluis'),
    /* `pay` komt uit de state die index.js meekrijgt (regel 58) en staat er dus
       vanaf het begin op; gift-betalen.js en winkel.js lezen hem. */
    pay: { partnerIn: async () => ({ ok: true }) } });

  /* WAT ER NA HET OPBOUWEN VAN DE DELEN OP DE CONTEXT WORDT GEZET -- late
     binding, want de module die het levert bestaat op dat moment nog niet.

     DEZE LIJST GROEIDE VAN TWEE NAAR ZEVEN, en dat is zelf een bevinding. Late
     binding is handig en verbergt een afhankelijkheid: je ziet aan de kop van
     een module niet meer wat hij nodig heeft. Waar het kon is er dan ook
     EXPLICIET doorgegeven in plaats van via de context (gift.js geeft
     `planVan`, `standVan` en `bronUitGift` als argument mee aan zijn delen);
     wat hier staat is wat over meer dan een stap heen moet reizen, of wat een
     kring zou maken. Komt er een achtste bij, dan is dat een moment om te
     vragen of de opbouwvolgorde nog klopt.

     Elke regel met de plek waar hij wordt gezet, zodat je hem kunt narekenen. */
  ctx.herkomstBepaal = () => {};                 // index.js, na herkomst.js
  ctx.magInStad = () => false;                   // index.js
  ctx.bronUitGift = () => ({});                  // index.js: geld.bronUitGift
  ctx.winkelOntvanger = () => null;              // index.js: de walletcode uit de giftstand
  ctx.giftAnbi = () => 'onbekend';               // gift.js, voor donateur-kantoor.js
  ctx.giftRsin = () => '';                       // gift.js, idem
  ctx.giftMachtigingWeg = () => [];              // gift.js: gift-periodiek.js trekt hiermee de machtiging in
  return ctx;
}

/* Elke naam die een rtfos-module uit de context haalt. TWEE VORMEN, en de
   tweede is er bij gekomen omdat de eerste hem miste:

     const { nu, naarCenten } = ctx;   uitpakken -- die vorm stond hier al
     ctx.naarCenten(bedrag)            rechtstreeks -- die stond hier NIET

   Bij het hernoemen van `centen` bleef `ctx.centen(bedrag)` in steden.js staan:
   een hernoemer die punten overslaat (terecht, anders sneuvelt elk veld dat zo
   heet) ziet die niet, en deze toets zag hem ook niet. Gevolg: een 500 op
   /api/rtfos/stad/limiet. Twee vormen, dus twee lezingen.

   Hernoemingen (`a: b`) en standaardwaarden (`a = x`) horen erbij: de naam
   LINKS is wat er uit de context wordt gehaald. */
function gevraagd() {
  const uit = [];
  for (const n of fs.readdirSync(MAP)) {
    if (!n.endsWith('.js') || n === 'basis.js') continue;
    const bron = fs.readFileSync(path.join(MAP, n), 'utf8');
    for (const d of bron.matchAll(/const\s*\{([^}]*)\}\s*=\s*ctx\s*;/g)) {
      for (const stuk of d[1].split(',')) {
        const naam = stuk.trim().split(':')[0].split('=')[0].trim();
        if (naam) uit.push({ bestand: n, naam, vorm: 'uitgepakt' });
      }
    }
    /* ctx.naam -- maar niet `ctx.naam =`, want dat ZET er iets op (index.js doet
       dat met herkomstBepaal en magInStad) in plaats van het te lezen. */
    for (const d of bron.matchAll(/\bctx\.([A-Za-z_$][A-Za-z0-9_$]*)\s*(?!=[^=])/g)) {
      if (/^\s*=[^=]/.test(bron.slice(d.index + d[0].length))) continue;
      uit.push({ bestand: n, naam: d[1], vorm: 'rechtstreeks' });
    }
  }
  return uit;
}

test('1. de context geeft alles wat de modules eruit halen', () => {
  const ctx = bouwContext();
  const vragen = gevraagd();
  /* 47 modules halen er samen 412 uit. De ondergrens staat ruim lager: hij is
     er om te merken dat de LEZING stukging (een gewijzigde vorm, een verplaatste
     map), niet om het getal vast te zetten. Een toets die op nul namen groen
     staat, bewijst niets. */
  assert.ok(vragen.length > 300, 'er horen honderden namen gelezen te worden, gevonden: ' + vragen.length);
  const mist = vragen.filter(v => ctx[v.naam] === undefined)
    .map(v => 'kern/rtfos/' + v.bestand + ' haalt `' + v.naam + '` ' + v.vorm + ' uit ctx');
  assert.deepEqual([...new Set(mist)], [],
    'Deze namen bestaan niet op de gedeelde context. In JavaScript is dat geen\n' +
    'fout maar `undefined`, en het klapt pas als die regel draait -- precies hoe\n' +
    'de hernoeming van `centen` groen bleef terwijl hij kapot was.');
});

test('2. wat een bedrag omzet, heet naarCenten en zet ook echt om', () => {
  const ctx = bouwContext();
  assert.equal(typeof ctx.naarCenten, 'function');
  assert.equal(ctx.centen, undefined, 'de oude naam hoort weg te zijn, niet ernaast te staan');
  assert.equal(ctx.naarCenten(10), 1000, 'euro in, cent uit');
  assert.equal(ctx.naarCenten(12.345), 1235);
  assert.equal(ctx.naarCenten('geen bedrag'), null, 'onleesbaar is null en geen 0');
  assert.equal(ctx.naarCenten(-5), null, 'deze laag boekt geen negatieve bedragen');
  assert.equal(ctx.euro(1235), 12.35, 'en terug, om te tonen');
});

test('3. de meter zelf slaat uit op een naam die er niet is', () => {
  /* Een toets die je niet hebt zien zakken is geen toets (LAT-regel 10). Hier
     staat de fout van vorige week nagebouwd: een module die een naam vraagt die
     de context niet geeft. */
  const ctx = bouwContext();
  const nep = [{ bestand: 'verzonnen.js', naam: 'rondEuro' }];
  const mist = nep.filter(v => ctx[v.naam] === undefined);
  assert.equal(mist.length, 1, 'de lezing hoort een ontbrekende naam te zien');
  /* En de lezer zelf: haalt hij de namen uit een echte destructurering? */
  const proef = 'const { nu, rid, naarCenten, euro } = ctx;';
  const m = [...proef.matchAll(/const\s*\{([^}]*)\}\s*=\s*ctx\s*;/g)];
  assert.equal(m.length, 1);
  assert.deepEqual(m[0][1].split(',').map(s => s.trim()), ['nu', 'rid', 'naarCenten', 'euro']);
});

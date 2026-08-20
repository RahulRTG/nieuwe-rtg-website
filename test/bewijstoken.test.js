/* ============================================================================
   HET BEWIJSTOKEN -- een bevoegdheid die je kunt meedragen.

   WAT ER OP HET SPEL STAAT. Een sessie is vandaag een sleutel tot ALLES wat de
   houder mag; wie hem steelt, krijgt de hele bevoegdheid mee. Een bewijstoken is
   het omgekeerde: een handeling, een doel, een bedrag, een paar minuten. Dat is
   alleen waar als een reeks dingen HARD is, en dit bestand houdt die vast.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 2   een token kan nooit ruimer zijn dan de bevoegdheid eronder
     toets 3   er is geen token zonder vervaltijd, en langer dan het maximum
               wordt GEWEIGERD en niet stil afgekapt
     toets 4   een gewijzigd token verifieert niet -- geen enkel veld uitgezonderd
     toets 6   eenmalig is eenmalig: afluisteren levert geen tweede betaling
     toets 8   de ondertekensleutel is NIET de sessiesleutel

   Draai los: node --experimental-sqlite --test test/bewijstoken.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const bev = require('../server/kern/commercie/bevoegdheid');
const { maakBewijstoken, geheugenGezien, afgeleideSleutel,
  MAX_GELDIG_SECONDEN } = require('../server/kern/commercie/bewijstoken');
const { maakBesluit, UITKOMST } = require('../server/kern/commercie/besluit');

let T0 = 1_700_000_000_000;
const nu = () => T0;
const SLEUTEL = 'een-geheim-dat-lang-genoeg-is';

function opstelling(opties) {
  const o = opties || {};
  const gezien = geheugenGezien(nu);
  const token = maakBewijstoken({ sleutel: o.sleutel || SLEUTEL, nu, gezien });
  const bevoegd = bev.maakBevoegdheid({ capability: 'money.refund', scope: o.scope || '*',
    grenzen: o.grenzen || { maxCenten: 25000 }, door: 'manager', nu });
  return { token, bevoegd, gezien };
}

test('1. een gemunt token draagt de handeling, het doel en de grens', () => {
  const { token, bevoegd } = opstelling();
  const m = token.munt(bevoegd, { actor: 'ai-agent', doel: 'zaak:KIKUNOI', waardeCenten: 8240, beleid: 'v1-2026' });
  assert.equal(m.ok, true);
  assert.equal(m.claim.capability, 'money.refund');
  assert.equal(m.claim.scope, 'zaak:KIKUNOI');
  assert.equal(m.claim.waardeCenten, 8240);
  assert.equal(m.claim.beleid, 'v1-2026');
  assert.ok(m.claim.nonce, 'zonder nonce is een token herbruikbaar bij afluisteren');
  assert.ok(m.claim.vervalt > nu());
  assert.equal(token.lees(m.token, { beleid: 'v1-2026' }).ok, true);
});

/* DE BEWERING. Een token die meer mag dan de bevoegdheid waaruit hij komt, is
   geen token maar een achterdeur. */
test('2. een token kan nooit ruimer zijn dan de bevoegdheid eronder', () => {
  const { token, bevoegd } = opstelling({ grenzen: { maxCenten: 25000, apparaatVertrouwd: true } });

  const ruimer = token.munt(bevoegd, { actor: 'x', grenzen: { maxCenten: 9_999_999 } });
  assert.equal(ruimer.claim.grenzen.maxCenten, 25000, 'meer vragen levert op wat er is');
  assert.equal(ruimer.claim.grenzen.apparaatVertrouwd, true, 'een niet-genoemde grens blijft staan');

  const smaller = token.munt(bevoegd, { actor: 'x', grenzen: { maxCenten: 500 } });
  assert.equal(smaller.claim.grenzen.maxCenten, 500, 'smaller mag wel');

  // en de scope kan alleen smaller, net als bij delegatie
  const opEen = opstelling({ scope: 'zaak:A' });
  const elders = opEen.token.munt(opEen.bevoegd, { actor: 'x', doel: 'zaak:B' });
  assert.ok(elders.error);
  assert.match(elders.error, /valt daarbuiten/);
});

/* DE TWEEDE BEWERING. Kort is hier geen voorzichtigheid maar de hele
   constructie: tussen munten en gebruiken kan een bevoegdheid worden
   ingetrokken, en die intrekking bereikt een token pas als hij verloopt. */
test('3. er is geen token zonder vervaltijd, en te lang wordt geweigerd', () => {
  const { token, bevoegd } = opstelling();
  assert.ok(token.munt(bevoegd, { geldigSeconden: 0 }).error);
  assert.ok(token.munt(bevoegd, { geldigSeconden: -1 }).error);

  const telang = token.munt(bevoegd, { geldigSeconden: MAX_GELDIG_SECONDEN + 1 });
  assert.ok(telang.error, 'te lang hoort te WEIGEREN');
  assert.match(telang.error, /hoogstens/);
  assert.equal(telang.token, undefined,
    'niet stil afkappen: wie denkt een uur te hebben, bouwt iets dat op het verkeerde moment stopt');

  // en verlopen is verlopen
  const m = token.munt(bevoegd, { actor: 'x', geldigSeconden: 60 });
  const was = T0;
  T0 = was + 61_000;
  const r = token.lees(m.token);
  assert.equal(r.ok, undefined);
  assert.equal(r.verlopen, true);
  T0 = was;
});

/* DE DERDE BEWERING. Elk veld zit onder de handtekening. */
test('4. een gewijzigd token verifieert niet, welk veld je ook aanraakt', () => {
  const { token, bevoegd } = opstelling();
  const m = token.munt(bevoegd, { actor: 'x', waardeCenten: 100 });
  const [payload, sig] = m.token.split('.');
  const claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

  for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const anders = claim.slice();
    anders[i] = i === 4 ? { maxCenten: 99_999_999 }
      : (typeof anders[i] === 'number' ? anders[i] + 1_000_000
        : (typeof anders[i] === 'boolean' ? !anders[i] : String(anders[i]) + 'x'));
    const nieuw = Buffer.from(JSON.stringify(anders), 'utf8').toString('base64url') + '.' + sig;
    const r = token.lees(nieuw);
    assert.ok(r.error, 'veld ' + i + ' hoort onder de handtekening te vallen');
    assert.match(r.error, /handtekening klopt niet/);
  }

  assert.match(token.lees(payload + '.' + 'x'.repeat(sig.length)).error, /handtekening/);
  assert.match(token.lees('geen-token').error, /geen bewijstoken/);

  /* DE HELE HANDTEKENING, EN NIET HET BEGIN ERVAN. Deze regel stond er niet en
     een mutatie liep er dwars doorheen: een vergelijking op alleen de eerste
     vier tekens weigert alles wat je willekeurig verandert -- dus elke toets
     hierboven bleef groen -- terwijl een forceerder juist niet willekeurig
     probeert maar teken voor teken opbouwt. Een handtekening die je half
     nakijkt, is 64^4 keer makkelijker te raden dan een die je heel nakijkt. */
  const halfGoed = sig.slice(0, 4) + 'A'.repeat(sig.length - 4);
  assert.notEqual(halfGoed, sig);
  assert.match(token.lees(payload + '.' + halfGoed).error, /handtekening klopt niet/,
    'een kloppend BEGIN van de handtekening is geen kloppende handtekening');

  // en een te korte handtekening hoort niet stil te matchen op wat er wel is
  assert.match(token.lees(payload + '.' + sig.slice(0, 8)).error, /handtekening klopt niet/);
});

/* EEN CORRECT ONDERTEKEND TOKEN VAN EEN ANDERE VORM. Dit kan alleen met onze
   eigen sleutel, dus het is geen aanvalsscenario maar een TOEKOMSTscenario: de
   dag dat er een versie 2 bijkomt, mag een lezer van versie 1 hem niet half
   begrijpen. Een mutatie die de vormcontrole weghaalde overleefde de eerste
   ronde -- want elk echt token heeft nu eenmaal de goede vorm. */
test('4b. een correct ondertekend token van een andere vorm wordt geweigerd', () => {
  const { token } = opstelling();
  const k = afgeleideSleutel(SLEUTEL);
  const zelfGetekend = (rij) => {
    const payload = Buffer.from(JSON.stringify(rij), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', k).update(payload).digest().toString('base64url');
    return payload + '.' + sig;
  };

  const v2 = zelfGetekend([2, 'x', 'money.refund', '*', {}, null, nu() + 60000, 'v1-2026', 'n', true]);
  const r = token.lees(v2);
  assert.ok(r.error, 'een versie die deze lezer niet kent, mag hij niet half begrijpen');
  assert.match(r.error, /niet de vorm die wij tekenen/);

  // een rij met een veld erbij of eraf: ook niet
  assert.match(token.lees(zelfGetekend([1, 'x', 'money.refund', '*', {}, null, nu() + 60000, 'v', 'n', true, 'extra'])).error,
    /niet de vorm/);
  assert.match(token.lees(zelfGetekend([1, 'x', 'money.refund'])).error, /niet de vorm/);

  // en een geldig ondertekend NIET-token (een gewoon object) evenmin
  assert.match(token.lees(zelfGetekend({ capability: 'money.refund' })).error, /niet de vorm/);
});

test('5. de grenzen worden met dezelfde functie getoetst als een gewone bevoegdheid', () => {
  const { token, bevoegd } = opstelling({ grenzen: { maxCenten: 25000, apparaatVertrouwd: true } });
  const m = token.munt(bevoegd, { actor: 'x' });

  const opOnvertrouwd = token.verbruik(m.token, { waardeCenten: 100, context: { apparaatVertrouwd: false } });
  assert.ok(opOnvertrouwd.error);
  assert.match(opOnvertrouwd.error, /vertrouwd apparaat/);

  const teVeel = token.verbruik(m.token, { waardeCenten: 37000, context: { apparaatVertrouwd: true } });
  assert.match(teVeel.error, /hoger dan de bevoegdheid/);

  // een token voor een ander soort handeling doet hier niets
  const ander = token.verbruik(m.token, { capability: 'money.payout', waardeCenten: 1, context: { apparaatVertrouwd: true } });
  assert.match(ander.error, /is voor money.refund/);
});

/* DE GEMUNTE WAARDE IS EEN BOVENGRENS EN GEEN RICHTBEDRAG. Zonder deze regel
   munt je een token voor een euro en betaal je er duizend mee -- en de
   bevoegdheidsgrens erboven merkt daar niets van, want die staat veel hoger.
   Deze toets stond er niet en een mutatie liep er dwars doorheen. */
test('5b. een token voor een bedrag laat geen groter bedrag door', () => {
  const { token, bevoegd } = opstelling({ grenzen: { maxCenten: 25000 } });
  const klein = token.munt(bevoegd, { actor: 'x', waardeCenten: 100 });

  const teVeel = token.verbruik(klein.token, { waardeCenten: 5000 });
  assert.ok(teVeel.error, 'ruim binnen de bevoegdheid, maar niet binnen dit token');
  assert.match(teVeel.error, /gemunt voor/);

  // precies het bedrag mag wel, en minder ook
  assert.equal(token.verbruik(token.munt(bevoegd, { actor: 'x', waardeCenten: 100 }).token,
    { waardeCenten: 100 }).ok, true);
  assert.equal(token.verbruik(token.munt(bevoegd, { actor: 'x', waardeCenten: 100 }).token,
    { waardeCenten: 40 }).ok, true);

  // een token ZONDER bedrag valt terug op de bevoegdheidsgrens en niet op nul
  const open = token.munt(bevoegd, { actor: 'x' });
  assert.equal(open.claim.waardeCenten, null);
  assert.equal(token.verbruik(open.token, { waardeCenten: 20000 }).ok, true);
  assert.match(token.verbruik(token.munt(bevoegd, { actor: 'x' }).token, { waardeCenten: 30000 }).error,
    /hoger dan de bevoegdheid/);
});

/* DE VIERDE BEWERING. Zonder dit is afluisteren genoeg om dezelfde betaling
   twee keer te doen. */
test('6. eenmalig is eenmalig, en zonder geheugen gaat het niet door', () => {
  const { token, bevoegd } = opstelling();
  const m = token.munt(bevoegd, { actor: 'x', waardeCenten: 5000 });

  assert.equal(token.verbruik(m.token, { waardeCenten: 5000 }).ok, true);
  const tweede = token.verbruik(m.token, { waardeCenten: 5000 });
  assert.equal(tweede.herhaling, true);
  assert.match(tweede.error, /al gebruikt/);

  // een leesvraag mag herbruikbaar zijn -- maar dan met zoveel woorden
  const leesbaar = token.munt(bevoegd, { actor: 'x', eenmalig: false });
  assert.equal(leesbaar.claim.eenmalig, false);
  assert.equal(token.verbruik(leesbaar.token, { waardeCenten: 1 }).ok, true);
  assert.equal(token.verbruik(leesbaar.token, { waardeCenten: 1 }).ok, true);

  // zonder plek om gebruikte tokens te onthouden gaat een eenmalig token NIET door
  const zonderGeheugen = maakBewijstoken({ sleutel: SLEUTEL, nu });
  const m2 = zonderGeheugen.munt(bevoegd, { actor: 'x' });
  assert.match(zonderGeheugen.verbruik(m2.token, { waardeCenten: 1 }).error, /plek om gebruikte tokens/);
});

test('7. een token onder een ander beleid wordt geweigerd en niet doorgelaten', () => {
  const { token, bevoegd } = opstelling();
  const m = token.munt(bevoegd, { actor: 'x', beleid: 'v1-2026' });
  const r = token.lees(m.token, { beleid: 'v2-2027' });
  assert.equal(r.beleidVerouderd, true);
  assert.match(r.error, /vraag een nieuw/);
  assert.equal(token.lees(m.token, { beleid: 'v1-2026' }).ok, true);
});

/* DE VIJFDE BEWERING. Domeinscheiding kost een regel en is later niet meer in te
   bouwen: wie een handtekening onder een bewijstoken kan krijgen, mag daarmee
   geen sessietoken kunnen maken. */
test('8. de ondertekensleutel is afgeleid en niet de sessiesleutel zelf', () => {
  const basis = crypto.randomBytes(32);
  const afgeleid = afgeleideSleutel(basis);
  assert.ok(Buffer.isBuffer(afgeleid));
  assert.equal(afgeleid.length, 32);
  assert.notEqual(afgeleid.toString('hex'), basis.toString('hex'),
    'de tokensleutel mag niet gelijk zijn aan de sessiesleutel');
  assert.equal(afgeleideSleutel(basis).toString('hex'), afgeleid.toString('hex'), 'wel stabiel');
  assert.equal(afgeleideSleutel(''), null, 'geen sleutel is geen sleutel');

  // en een token van het ene huis geldt niet in het andere
  const a = opstelling({ sleutel: 'huis-a' });
  const b = opstelling({ sleutel: 'huis-b' });
  const m = a.token.munt(a.bevoegd, { actor: 'x' });
  assert.match(b.token.lees(m.token).error, /handtekening klopt niet/);

  // zonder sleutel wordt er niets gemunt en niets nagekeken
  const leeg = maakBewijstoken({ sleutel: '', nu, gezien: geheugenGezien(nu) });
  assert.match(leeg.munt(a.bevoegd, { actor: 'x' }).error, /geen ondertekensleutel/);
  assert.match(leeg.lees(m.token).error, /geen ondertekensleutel/);
});

/* De koppeling die dit token een producent geeft: het besluit dat ja zegt, geeft
   het bewijs mee. Zonder die koppeling is dit een module die niemand aanroept --
   precies de fout die CONTROLPLANE.md par. 1 als tweede regel noemt. */
test('9. een besluit dat ja zegt, geeft het bewijs mee', () => {
  const { token, bevoegd } = opstelling({ grenzen: { maxCenten: 1000000 } });
  const motor = maakBesluit({ zoekBevoegdheid: () => bevoegd, nu, munt: token.munt });

  const r = motor.beslis({ actor: 'ai-agent', handeling: 'money.refund', waardeCenten: 8240 });
  assert.equal(r.uitkomst, UITKOMST.TOESTAAN);
  assert.ok(r.bewijstoken, 'een ja dat alleen in het besluit bestaat, moet elke stap opnieuw gevraagd worden');
  assert.equal(token.verbruik(r.bewijstoken,
    { capability: 'money.refund', waardeCenten: 8240 }, { beleid: 'v1-2026' }).ok, true);

  /* ALLES WAT GEEN VOLMONDIG JA IS, GEEFT GEEN BEWIJS MEE. Ook BEPERKT niet:
     daar is de GEVRAAGDE handeling juist niet goedgekeurd, en een token voor het
     lagere bedrag zou een besluit dragen dat niemand heeft genomen. */
  const nee = motor.beslis({ actor: 'x', handeling: 'money.refund', waardeCenten: 150000 });
  assert.equal(nee.uitkomst, UITKOMST.GOEDKEURING);
  assert.equal(nee.bewijstoken, undefined);

  const beperkt = motor.beslis({ actor: 'x', handeling: 'money.refund', waardeCenten: 2000000 });
  assert.equal(beperkt.uitkomst, UITKOMST.BEPERKT);
  assert.equal(beperkt.bewijstoken, undefined);

  // en zonder munt is het besluit gewoon het besluit, niet stilzwijgend zwakker
  const kaal = maakBesluit({ zoekBevoegdheid: () => bevoegd, nu });
  const k = kaal.beslis({ actor: 'x', handeling: 'money.refund', waardeCenten: 100 });
  assert.equal(k.uitkomst, UITKOMST.TOESTAAN);
  assert.equal(k.bewijstoken, undefined);
});

test('10. het noncegeheugen groeit niet met alles wat ooit is gebruikt', () => {
  const g = geheugenGezien(nu);
  g.onthoud('a', nu() + 1000);
  assert.equal(g.zag('a'), true);
  assert.equal(g.zag('b'), false);

  const was = T0;
  T0 = was + 2000;
  assert.equal(g.zag('a'), false, 'een verlopen nonce is geen herhaling meer');
  assert.equal(g.aantal(), 0, 'en hij wordt ook opgeruimd');
  T0 = was;
});

/* ============================================================================
   DE SLEUTEL KOMT UIT DE KLUIS, EN DE RUWE VERLAAT HAAR NOOIT.

   In par. 5.2 stond dit als open punt: het bewijstoken had een producent en een
   verbruiker in de laag zelf, maar de sleutel kwam nog nergens vandaan. Sinds de
   voornemenslaag is gemount komt hij uit server/accounts (kluis.sleutelVoor),
   en die geeft een AFGELEIDE en niet S.SECRET zelf.
   ========================================================================== */
test('11. de kluis leidt per doel een eigen sleutel af, en geeft de ruwe nooit terug', () => {
  const kluis = require('../server/accounts/kluis');
  const accounts = require('../server/accounts');
  assert.equal(typeof accounts.sleutelVoor, 'function', 'de kern komt er via accounts bij');

  /* De AFLEIDING wordt hier los getoetst en niet via S.SECRET. Dat was de vorige
     versie, en die sloeg zichzelf stil over: in een toetsproces is de kluis niet
     geinitialiseerd, dus gaf sleutelVoor() null en liep elke mutatie er dwars
     doorheen. Een zuivere functie is te toetsen; een die op modulestaat leunt,
     doet alsof. */
  const ruw = crypto.randomBytes(32);
  const a = kluis.afleidSleutel(ruw, 'bewijstoken');
  const b = kluis.afleidSleutel(ruw, 'iets-anders');

  assert.equal(a.length, 32);
  assert.notEqual(a.toString('hex'), ruw.toString('hex'),
    'de ruwe sessiesleutel verlaat de kluis nooit');
  assert.notEqual(a.toString('hex'), b.toString('hex'),
    'twee doelen horen twee sleutels te geven, anders is de scheiding een naam');
  assert.equal(kluis.afleidSleutel(ruw, 'bewijstoken').toString('hex'), a.toString('hex'), 'wel stabiel');

  /* EEN LEEG DOEL GEEFT NIETS. Anders is sleutelVoor() zonder argument
     stilzwijgend een vaste sleutel voor alles, en dan is de scheiding weg zonder
     dat iemand het merkt. */
  assert.equal(kluis.afleidSleutel(ruw, ''), null);
  assert.equal(kluis.afleidSleutel(ruw, null), null);
  assert.equal(kluis.afleidSleutel(ruw, '   '), null);
  assert.equal(kluis.afleidSleutel(null, 'bewijstoken'), null, 'en zonder bron ook niets');
});

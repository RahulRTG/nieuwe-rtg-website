/* ============================================================================
   DE TRUST RECEIPT -- laag 5 van de Trust Fabric (VERTROUWEN.md par. 6).

   Een compacte bon per kritieke handeling: waarom dit mocht, welke keten van
   bevoegdheid eronder ligt, en waar het bewijs staat.

   DIT IS GEEN TWEEDE AUDITLOG, en dat verschil is de bestaansreden. Het
   inzagejournaal (server/inzagelog.js) en het tenantjournaal noteren WAT er
   gebeurde; die vraag is al beantwoord. Een bon beantwoordt een andere: op
   grond waarvan mocht het. Daarom staat er per bon geen verhaal maar een RIJTJE
   BEWERINGEN, en draagt elke bewering zijn bron.

   ELKE REGEL HEEFT EEN BRON OF HIJ BESTAAT NIET. De verleiding bij een bon is
   het lijstje mooi te maken -- "actor sterk geverifieerd, bevoegdheid geldig,
   impact binnen limiet, resultaat gereconcilieerd" leest prachtig en is
   grotendeels onwaar zodra niemand die dingen meet. Wat hier NIET gemeten is,
   komt in `nietVastgesteld` te staan MET de reden, en niet als een regel die
   ontbreekt: een ontbrekende regel leest als "niet van toepassing", en dat is
   iets anders dan "wij weten het niet".

   DE KETEN IS DIE VAN server/lib/keten.js, dezelfde die het inzagejournaal
   gebruikt. Elke bon draagt de hash van de vorige, dus een bon wegnemen of
   bijstellen breekt de keten op een aanwijsbaar punt. Wat dat WEL en NIET
   tegenhoudt staat in de kop van die module en wordt hier niet mooier gemaakt:
   het betrapt stille wijziging, niet een vastberaden beheerder die de hele
   keten opnieuw uitrekent. Daarvoor moet de top naar buiten.

   EN ER STAAT GEEN NAAM IN. Een bon draagt de actor-sleutel, net als elk ander
   spoor in dit huis; wie daar een mens bij wil, vraagt dat via de
   identiteitskluis en dan staat die opvraging in het inzagejournaal. Een bon
   die de naam meteen meelevert, is een achterdeur om de kluis heen.
   ========================================================================== */
'use strict';

const keten = require('../../lib/keten');
const anker = require('../../lib/keten-anker');
const { nu: klokNu, datum: klokDatum } = require('../../lib/klok');

const MAX = 2000;

/* Wat deze bon NOOIT vaststelt, hoe verleidelijk het ook op een scherm staat.
   Dit is de lijst uit het oorspronkelijke ontwerp waar dit huis geen meting
   voor heeft; hij hoort te krimpen naarmate er wel metingen bij komen. */
const NOOIT_VASTGESTELD = [
  { wat: 'resultaat gereconcilieerd', reden: 'Er is geen verzoening tussen wat er gevraagd werd en wat er in de opslag terechtkwam. Deze bon zegt dat de handeling is uitgevoerd, niet dat het resultaat is nagerekend.' },
  { wat: 'de bevoegdheidsketen boven de aanroeper', reden: 'Wij zien de poort die deze aanroep doorliet, niet wie die persoon zijn recht heeft gegeven en op grond waarvan. Laag 4 controleert wel dat bevoegdheid niet GROEIT (kern/vertrouwen/insluiting.js, over de werkwoordentabel), maar dat is iets anders dan de keten omhoog kunnen laten zien.' }
];

/* Een bewering met zijn bron, of niets. Ontbreekt de meting, dan komt de
   bewering NIET in de lijst maar in nietVastgesteld -- zie de kop. */
const stel = (waar, wat, bron) => (waar ? { wat, bron } : null);

/* De bon zelf. Alle invoer komt van een meting; er wordt hier niets afgeleid
   wat de aanroeper niet heeft aangeleverd. */
function maak(bonnen, {
  soort, doel, aantal, actor, blootstelling, verificatie, stapop, bevestigd, poort, uitgevoerd
} = {}) {
  const b = blootstelling || {};
  const v = verificatie || null;
  const st = stapop || {};
  const beweringen = [];
  const niet = NOOIT_VASTGESTELD.slice();

  if (v && v.sterkte !== 'geen')
    beweringen.push({ wat: 'de actor is geverifieerd met ' + v.naam +
      (v.ouderdomMs === null ? '' : ', ' + Math.round(v.ouderdomMs / 60000) + ' minuten voor deze handeling'),
      bron: 'kern/vertrouwen/verificatie.js' });
  else niet.push({ wat: 'de sterkte van de verificatie',
    reden: v ? 'Achter deze deur staat geen geverifieerde persoon.' : 'Van deze sessie is niet vastgelegd hoe en wanneer hij is geverifieerd.' });

  const p = stel(poort, 'de aanroeper kwam binnen door ' + poort, 'de route die deze handeling draagt');
  if (p) beweringen.push(p); else niet.push({ wat: 'welke poort deze aanroep doorliet', reden: 'De aanroeper gaf het niet mee.' });

  if (b.gemeten) beweringen.push({ wat: 'de omvang is gemeten: ' + b.aantal + ' ' +
      b.eenheid + ', zwaarte ' + b.zwaarte + ' (drempel ' + b.drempel + ', grondslag ' + b.grondslag + ')',
    bron: 'kern/vertrouwen/blootstelling.js' });
  else niet.push({ wat: 'de omvang', reden: b.reden || 'Deze handeling is niet gewogen.' });

  if (st.nodig === false) beweringen.push({ wat: 'een tweede moment was niet nodig', bron: 'kern/vertrouwen/stapop.js' });
  else if (bevestigd) beweringen.push({ wat: 'een tweede moment is gevraagd en gegeven, gebonden aan deze handeling',
    bron: 'kern/vertrouwen/tweedemoment.js' });
  else niet.push({ wat: 'het tweede moment', reden: 'De poort achtte er een nodig, en deze bon is geschreven zonder dat er een is verzilverd.' });

  beweringen.push({ wat: uitgevoerd ? 'de handeling is uitgevoerd' : 'de handeling is NIET uitgevoerd',
    bron: 'de route die deze bon schreef' });

  return keten.hangAan(bonnen, {
    at: klokDatum().toISOString(), ms: klokNu(),
    soort: String(soort || ''), doel: String(doel || ''), aantal: Number(aantal) || 0,
    actor: String(actor || ''),          // een sleutel, nooit een naam
    uitgevoerd: !!uitgevoerd,
    beweringen, nietVastgesteld: niet
  });
}

/* Wegschrijven, begrensd, nieuwste vooraan -- dezelfde vorm als het
   inzagejournaal, zodat keten.verifieer() er zonder omweg overheen kan. */
function schrijf(bak, gegevens) {
  bak.bonnen = bak.bonnen || [];
  const bon = maak(bak.bonnen, gegevens);
  bak.bonnen.unshift(bon);
  if (bak.bonnen.length > MAX) bak.bonnen.length = MAX;
  return bon;
}

function lees(bak, hoeveel) {
  const l = (bak && bak.bonnen) || [];
  return l.slice(0, Math.min(Number(hoeveel) || 50, 200));
}

/* HET ANKER -- het enige dat KOPAFKNIPPING kan zien. keten.verifieer() vraagt
   of de overgebleven geschiedenis met zichzelf klopt; wie de nieuwste bonnen
   weggooit, houdt een keten over die perfect klopt. Sporen wissen van wat je
   zojuist deed, is dus precies waar de hashketen NIET tegen beschermt.

   Daarvoor moet er een getal naar buiten. `anker()` maakt de momentopname; die
   hoort weggezet te worden buiten deze database -- een gescheiden systeem, een
   tweede partij, desnoods een uitdraai. Een anker in dezelfde database is geen
   anker maar een tweede regel om te wijzigen, en dat staat ook zo in
   server/lib/keten-anker.js. Deze module maakt het en rekent ermee af; het
   wegzetten is met opzet geen taak van dit huis.

   Dezelfde voorziening die het inzagejournaal al gebruikt -- geen tweede
   implementatie voor dezelfde vraag. */
const ankerPunt = (bak) => anker.verankerPunt((bak && bak.bonnen) || []);
const tegenAnker = (bak, a) => anker.verifieerTegenAnker((bak && bak.bonnen) || [], a);

/* De keten nalopen. Levert wat keten.verifieer() levert, en niets erbij: deze
   module doet geen uitspraak over wat de uitslag BETEKENT. */
const controleer = (bak) => keten.verifieer((bak && bak.bonnen) || []);

module.exports = { maak, schrijf, lees, controleer, ankerPunt, tegenAnker, NOOIT_VASTGESTELD, MAX };

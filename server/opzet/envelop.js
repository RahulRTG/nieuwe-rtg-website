/* ============================================================================
   DE ENVELOP -- een handeling in EEN vorm.

   WAAROM DIT ER IS. De poortwachter weet WIE. De opslaglaag (server/db/index.js,
   een functie waar 2700 aanroepen doorheen gaan) weet WAT ER VERANDERT. Daar
   tussenin bestond geen enkel object dat allebei draagt, en zonder dat object is
   er geen risicobudget, geen blast radius en geen bewijsbonnetje te bouwen --
   hoe de rest ook wordt ingericht. ENVELOP.json meet dat gat; dit bestand is de
   eerste helft van de reparatie.

   EN HET TWEEDE PROBLEEM DAT HIJ OPLOST. "Wie handelt hier" stond op ZEVEN
   plekken op het verzoek, en dan kan er niets generieks op staan -- een teller,
   een rem of een bonnetje zou zeven keer geschreven moeten worden (LAT.md
   regel 4). Er zijn er nu ZES: `req.boardroomKey` droeg alleen een identiteit
   en is weg (TAKEN.md 4.72), de zes andere dragen domeindata die deze envelop
   met opzet NIET draagt -- overzetten zou hem een sessieobject maken.
   scripts/actorvormen.js meet dat verschil en ratelt het.

   ADDITIEF, EN DAT IS EEN BESLUIT. Deze module haalde niets weg: elke bestaande
   route bleef doen wat hij deed, er kwam alleen `req.envelop` bij. Een grote
   vervanging in het authenticatiepad van 3349 routes is precies het soort
   wijziging waarvan je pas maanden later merkt wat er stuk ging.

   WAT ER IN ZIT, EN WAT BEWUST NIET

     actor        wie, met een SOORT en een identiteitsoordeel
     tenant       binnen welk huis (zaak, werkplek, gezin) -- null als er geen is
     capability   welk begrensd recht, als de poortwachter dat weet
     gezag        waar de bevoegdheid vandaan komt (eigenaar, sleutelhouder)
     context      pad, methode, tijd
     correlatie   req.id, dat de logmiddleware al zet -- NIET een tweede id

   `doel`, `intent`, `wijzigingen`, `risicoklasse` en `omkeerbaarheid` staan er
   NIET in, en dat is geen vergetelheid. Die kent een poortwachter niet: ze
   ontstaan pas als de handeling bekend is en de opslaglaag weet wat er verandert.
   Ze verzinnen zou de envelop laten liegen, en een envelop die liegt is erger
   dan geen envelop -- dan gaat er beleid op.

   HET IDENTITEITSOORDEEL is het scherpste veld. `bewezen` betekent: er hangt een
   persoon of een geverifieerd huis aan, tegen te houden en terug te vinden.
   `anoniem` betekent: de sessie is geldig maar draagt geen persoon. Dat laatste
   is niet hypothetisch -- het kantoortoken kent geen personen (zie de kop van
   server/routes/uitgifte.js), en juist daar wordt met vier ogen ondertekend.
   Zolang dat zo is hoort het zichtbaar te zijn in plaats van weggemiddeld.

   DEZE MODULE GOOIT NOOIT. Een poortwachter die omvalt op zijn eigen boekhouding
   is erger dan een ontbrekende envelop; bij twijfel komt er een envelop met
   `identiteit: 'onbekend'` en gaat het verzoek gewoon door. Wat hij niet doet is
   ZWIJGEN: een envelop die niet gemaakt kon worden is er een met een reden erin,
   zodat het verderop te zien is (LAT.md regel 5).
   ========================================================================== */
'use strict';

/* De soorten actor die dit huis kent. Een nieuwe soort hoort hier bij te komen
   en niet als losse tekenreeks ergens in een route -- dat is precies de
   verspreiding waar deze module voor bestaat. */
const SOORTEN = Object.freeze([
  'lid',        // een RTG-lid met een ledensessie
  'medewerker', // iemand die namens een zaak werkt (leverancier/partner)
  'kantoor',    // de RTG-backoffice; kan anoniem zijn, zie identiteit
  'eigenaar',   // de eigenaar van RTG, op zijn eigen account
  'tafel',      // een gastsessie aan een tafel: geen persoon, en dat klopt hier
  'gezinslid',  // een profiel binnen een RTFoundation-gezin
  'techniek',   // een account met toegang tot de technische pagina
  'werkplek'    // iemand met een sleutel van een werkplek-bedrijf
]);

const IDENTITEITEN = Object.freeze(['bewezen', 'anoniem', 'onbekend']);

const tekst = (v, max) => {
  if (v == null) return null;
  const s = String(v);
  return s.length > (max || 200) ? s.slice(0, max || 200) : s;
};

/* Maak de envelop en hang hem aan het verzoek. Geeft hem ook terug, zodat een
   poortwachter er meteen iets mee kan zonder req opnieuw te lezen. */
function zet(req, gegevens) {
  let env;
  try { env = maak(req, gegevens); }
  catch (e) {
    /* Niets slaat stil over (LAT.md regel 5): een envelop die niet te maken was,
       is een envelop met de reden erin en niet een ontbrekende. */
    const fouten = [];
    env = { actor: { soort: null, id: null, identiteit: 'onbekend' }, tenant: null,
      capability: null, gezag: null, context: context(req, fouten),
      correlatie: leesVeilig(() => (req && req.id) || null, 'correlatie', fouten),
      fout: tekst([e && e.message].concat(fouten).filter(Boolean).join('; '), 240) };
  }
  try { if (req) req.enveloppe = env; } catch (e) { /* een bevroren req: dan alleen teruggeven */ }
  return env;
}

/* DEFENSIEF LEZEN, MAAR NIET ZWIJGEND -- en die twee eisen samen zijn de hele
   truc. Twee keer ging dit hier mis en beide keren wees een toets het aan:

   1. De eerste versie las req.path rechtstreeks. Het vangnet in zet() riep bij
      een fout dezelfde functie nog eens aan, dus op een verzoek waarvan de
      getter gooit gooide ook het vangnet. Een vangnet dat op dezelfde steen valt
      als waar het voor is, is geen vangnet.
   2. De reparatie daarvan ving de fout stil op en zette er null neer. Toen gooide
      hij niet meer, maar was er ook niets meer te zien -- precies de vorm uit
      LAT.md regel 5, en dat is de duurste van de twee: een envelop die keurig
      oogt terwijl er iets is misgegaan, wordt nooit meer nagekeken.

   Dus: elke mislukte lezing komt in `fouten`, en die belandt als `fout` in de
   envelop. Nooit een uitzondering, nooit stilte. */
function leesVeilig(doe, naam, fouten) {
  try { return doe(); }
  catch (e) { fouten.push(naam + ': ' + (e && e.message ? e.message : 'onleesbaar')); return null; }
}

function context(req, fouten) {
  const f = fouten || [];
  return {
    pad: leesVeilig(() => tekst(req && req.path, 300), 'pad', f),
    methode: leesVeilig(() => tekst(req && req.method, 10), 'methode', f),
    // de tijd via de klok van dit huis, zodat een tijdproef hem ook echt verzet
    tijd: klok.nu()
  };
}

/* GEEN TERUGVAL OP Date.now(), en dat is het hele punt van deze regel.

   Hier stond `try { klok.nu() } catch { Date.now() }`. Dat leek voorzichtig
   maar deed precies het tegenovergestelde van wat de regel erboven belooft:
   kon de klokmodule niet laden, dan pakte de envelop stilletjes de ECHTE tijd
   en zou een tijdproef groen staan terwijl hij iets anders mat dan hij dacht.
   Een terugval die een garantie ondermijnt is geen vangnet.

   scripts/klok.js telde die Date.now() dan ook gewoon mee -- terecht -- en dat
   is hoe hij gevonden is. server/lib/klok.js importeert zelf niets, dus er is
   geen kringloop en geen laadvolgorde die een luie require rechtvaardigt.
   Ontbreekt hij, dan hoort de server luid om te vallen en niet zachtjes een
   andere klok te lezen. */
const klok = require('../lib/klok');

function maak(req, g) {
  g = g || {};
  const fouten = [];
  const soort = g.soort && SOORTEN.includes(g.soort) ? g.soort : null;
  let identiteit = g.identiteit && IDENTITEITEN.includes(g.identiteit) ? g.identiteit : null;
  const id = tekst(g.id, 200);
  /* Geen opgegeven oordeel: dan is een id het bewijs en de afwezigheid ervan
     niet. Expliciet blijft altijd voorgaan -- het kantoor MOET 'anoniem' kunnen
     zeggen terwijl er wel een sessie is. */
  if (!identiteit) identiteit = id ? 'bewezen' : 'anoniem';
  return {
    actor: { soort, id, naam: tekst(g.naam, 200), rol: tekst(g.rol, 60), identiteit },
    tenant: g.tenantId ? { soort: tekst(g.tenantSoort, 40) || 'zaak', id: tekst(g.tenantId, 120) } : null,
    capability: tekst(g.capability, 120),
    gezag: g.gezagBron ? { bron: tekst(g.gezagBron, 60), baas: !!g.gezagBaas } : null,
    context: context(req, fouten),
    // GEEN tweede correlatie-id: server/log.js zet er al een op elk verzoek en
    // echoot hem als X-Request-Id. Er zelf een maken zou twee waarheden geven
    // die uiteenlopen zodra iemand er een gaat gebruiken (LAT.md regel 4).
    correlatie: leesVeilig(() => (req && req.id) || null, 'correlatie', fouten),
    // leeg blijft leeg: een `fout`-veld dat er altijd staat leest niemand meer
    ...(fouten.length ? { fout: tekst(fouten.join('; '), 240) } : {})
  };
}

/* Voor een lezer die niet weet welke poortwachter er langs is geweest: geef de
   envelop, of null. Bewust GEEN terugval op de zeven oude vormen -- dan zou dit
   een achtste lezer worden die zeven vormen kent, en precies dat lost de envelop
   op. Wie null krijgt, weet dat er nog geen envelop is en kan dat melden. */
function van(req) {
  return (req && req.envelop) || null;
}

/* WIE HANDELT HIER -- de generieke lezer (TAKEN.md 4.72), die niet weet welke
   poortwachter ervoor stond. Null en geen lege tekenreeks als er niemand is:
   "niemand" en "iemand zonder naam" zijn niet hetzelfde. */
function wie(req) {
  const e = van(req);
  return (e && e.actor && e.actor.id) || null;
}

module.exports = { zet, van, wie, SOORTEN, IDENTITEITEN };

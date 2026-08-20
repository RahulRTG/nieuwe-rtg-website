/* WELKE ROUTE VRAAGT WELKE CAPABILITY?

   DE METING DIE HIERONDER LIGT. `scripts/capabilities.js` telde op 20 augustus
   2026 vijf van de acht capabilities als STIL: kassa, Werk OS, personeel,
   governance en de vaste contactpersoon werden nergens gevraagd. Het
   productprofiel beschreef ze, drie toetsen vertelden de tabel na, vier
   bestanden legden in commentaar uit hoe `can_use_pos` werkt -- en niemand werd
   ooit tegengehouden.

   WAAROM DAT KON. Niet uit luiheid. Er was geen PLEK waar de vraag te stellen
   viel: `caps.mag(pas, cap)` wil een pas, en een route weet alleen wie er is
   ingelogd. kern/commercie/zaakabonnement.js legde het ontbrekende gegeven
   (welke trede heeft deze zaak), en dit bestand legt de laatste schakel: welke
   route hoort bij welke capability.

   EEN TABEL EN NIET EEN REGEL PER BESTAND. De verleiding is om in elk
   kassabestand een controle te zetten. Dat is dezelfde fout als de
   zevenenzeventig pas-id-controles die kern/commercie/capaciteiten.js juist
   opheft: bij de volgende kassaroute vergeet iemand hem, en dan is er een
   achterdeur die niemand heeft besloten. Deze tabel hangt aan het keelgat waar
   ELKE leveranciersroute doorheen moet (server/opzet/leverancierpoort.js), net
   als de persoonseis daar, en om dezelfde reden: een route die er later naast
   wordt gebouwd, valt er vanzelf onder.

   DE VOLGORDE IS LANGSTE-PAD-EERST. `/api/supplier/command/beleid` is
   governance en `/api/supplier/command/graaf` niet; wie op prefixlengte sorteert
   krijgt het specifieke antwoord en niet het eerste.

   WAT ER GEBEURT ALS DE LAAG ER NIET IS. Dan valt de vraag terug op de trede
   waarop een zaak zonder vastgelegd abonnement draait -- `business`, de ruimste
   zakelijke trede. Dat is met opzet GEEN dichte deur, en het verschilt van de
   persoonseis die er vlak naast staat: die beschermt kinderen en hoort dicht te
   vallen, deze bewaakt een productgrens. Een zaak die vandaag een kassa draait
   en morgen niet meer, omdat een laag niet gemount was, is een storing met een
   nette naam. Over-geven kost hier omzet; dicht-vallen kost een werkdag.

   WAT DIT NIET IS: een rechtenmodel. CONCERN.md blijft gelden -- WIE iemand is,
   blijft de rol, en die wordt in dezelfde poort al gecontroleerd. Deze laag zegt
   alleen of het ABONNEMENT van de zaak dit onderdeel bevat. Een manager met alle
   rollen kan geen kassa draaien als het abonnement die niet bevat. */
'use strict';

const caps = require('./capaciteiten');
const ladder = require('../pasladder');
const { TERUGVAL } = require('./zaakabonnement');

/* Pad-voorvoegsel -> capability. Elke regel zegt waarom hij er staat, want een
   route die stil dichtvalt zonder uitleg is precies wat we hier oplossen. */
const KAART = [
  // de kassa en het afrekenen ter plaatse
  ['/api/supplier/pos/', 'can_use_pos'],
  ['/api/supplier/kassa', 'can_use_pos'],
  ['/api/supplier/tafelticket', 'can_use_pos'],
  ['/api/supplier/giftcard/', 'can_use_pos'],

  // personeel: contracten, uren, salaris
  ['/api/supplier/staff/', 'can_manage_staff'],
  ['/api/supplier/payroll/', 'can_manage_staff'],
  ['/api/supplier/verzuim', 'can_manage_staff'],

  // het Werk OS: roosters, taken, werkplekken
  ['/api/supplier/rooster', 'can_use_workos'],
  ['/api/supplier/roster', 'can_use_workos'],
  ['/api/supplier/shift', 'can_use_workos'],
  ['/api/supplier/werkvenster', 'can_use_workos'],
  ['/api/supplier/werkbeleid', 'can_use_workos'],

  /* governance: vier-ogen, audit, beleidsregels per organisatie. Alleen deze
     twee takken van /command/ -- de rest daarvan (graaf, kwaliteit, herkomst) is
     gewoon de cockpit en hoort bij elke zakelijke trede. */
  ['/api/supplier/command/beleid', 'can_use_enterprise_governance'],
  ['/api/supplier/command/journaal', 'can_use_enterprise_governance']
];

/* Langste voorvoegsel eerst, zodat het specifieke antwoord wint. Een keer
   gesorteerd bij het laden en niet per verzoek: deze poort draait op elk
   leveranciersverzoek in het huis.

   IN DE HUIDIGE TABEL OVERLAPT GEEN ENKEL PAAR, dus vandaag verandert deze
   sortering niets. Ze staat er voor de regel die er morgen bij komt -- en omdat
   een eigenschap die je niet kunt aantonen geen eigenschap is, neemt
   `capabilityVoor` een tabel aan zodat de toets de overlap kan bouwen die de
   echte tabel (nog) niet heeft. */
function sorteer(kaart) {
  return kaart.slice().sort((a, b) => b[0].length - a[0].length);
}
const GESORTEERD = sorteer(KAART);

function capabilityVoor(pad, kaart) {
  const p = String(pad || '');
  for (const [voorvoegsel, cap] of (kaart ? sorteer(kaart) : GESORTEERD))
    if (p.startsWith(voorvoegsel)) return cap;
  return null;
}

/* WELKE REGELS PAKKEN IEMAND IETS AF, EN WELKE NIET?

   Dit wordt GEREKEND en niet beweerd. Een capability die op ELKE trede zit waar
   een zaak op kan staan, kan per definitie niemand iets afnemen -- daar is een
   schaduwperiode zinloos. Een capability die dat niet doet, hoort eerst mee te
   lopen voordat hij bijt (./schaduw.js), en dat geldt uitdrukkelijk ook voor de
   regel die hier op 20 augustus 2026 meteen is aangezet: governance pakt Business
   Lite wel degelijk iets af, en dat had eerst een week moeten meelopen.

   De vrijstelling is dus geen vinkje maar een SOM. Verandert het productprofiel
   zo dat een trede het onderdeel verliest, dan vervalt de vrijstelling vanzelf
   en valt de regel terug in de schaduw. */
function vrijstellingVoor(cap) {
  const zakelijk = Object.keys(caps.PROFIEL).filter(t => caps.mag(t, 'can_be_partner'));
  const missen = zakelijk.filter(t => !caps.mag(t, cap));
  if (missen.length) return null;
  return 'elke zakelijke trede (' + zakelijk.join(', ') + ') bevat dit onderdeel, ' +
    'dus deze regel kan geen enkele zaak iets afnemen';
}

/* De regels die deze tabel voortbrengt, met per stuk of hij vrijgesteld is. Een
   id per CAPABILITY en niet per pad: het is een productgrens, en vijf paden die
   dezelfde grens bewaken zijn een regel. */
function regels() {
  const gezien = new Set();
  const uit = [];
  for (const [, cap] of KAART) {
    if (gezien.has(cap)) continue;
    gezien.add(cap);
    uit.push({ id: 'abonnementspoort.' + cap, cap, vrijstelling: vrijstellingVoor(cap) });
  }
  return uit;
}

/* Het antwoord voor een verzoek. `trede` komt van de aanroeper omdat deze laag
   de leverancierstabel niet hoort te kennen; is hij er niet, dan de terugval.
   Zie de kop voor waarom dat hier open is en bij de persoonseis dicht. */
function beoordeel(pad, trede) {
  const cap = capabilityVoor(pad);
  if (!cap) return { ok: true, cap: null };
  const pas = trede || TERUGVAL;
  if (caps.mag(pas, cap)) return { ok: true, cap, pas };
  /* De namen en niet de sleutels: een zaak die te horen krijgt dat hij
     `business-lite` nodig heeft, moet dat zelf vertalen naar iets dat op een
     factuur staat. */
  const nodig = caps.tredenMet(cap);
  const namen = nodig.map(t => (ladder.trede(t) || {}).naam || t);
  return { ok: false, cap, pas, nodig,
    error: 'Dit onderdeel (' + caps.CAPS[cap] + ') hoort niet bij het abonnement van deze zaak.' +
      (namen.length ? ' Het zit in ' + namen.join(' en ') + '.' : '') };
}

/* De vraag zoals de leverancierspoort hem stelt: met de abonnementslaag zelf
   erbij, want die kan er nog niet zijn (late binding, zie
   server/opzet/leverancierpoort.js). Ontbreekt hij, dan de terugval -- zie de
   kop voor waarom dat hier open is en bij de persoonseis ernaast dicht. */
function voorZaak(zaakAbonnement, code, pad, schaduw) {
  let trede = null;
  try { if (zaakAbonnement) trede = zaakAbonnement.van(code).pas; } catch (e) { trede = null; }
  const r = beoordeel(pad, trede);

  /* DE SCHADUWSTAND. Zonder schaduwlaag doet deze poort wat hij altijd deed --
     niet stilzwijgend minder. Mét: een regel die nog meeloopt, telt wel en houdt
     niemand tegen. Zie ./schaduw.js voor waarom dat de enige weg naar afdwingen
     hoort te zijn. */
  if (!schaduw || r.ok || !r.cap) return r;
  const w = schaduw.weeg('abonnementspoort.' + r.cap, r.error, { wie: code, wat: pad });
  return w.door ? { ok: true, cap: r.cap, pas: r.pas, schaduw: true } : r;
}

module.exports = { KAART, capabilityVoor, beoordeel, voorZaak, regels, vrijstellingVoor };

/* DE BELEIDSMOTOR, DE REGELS -- de kantoordeuren als GEGEVENS.

   AUTHORITY.md fase 1, besluit A1 (23 september 2026): de motor VERVANGT de
   gezagsvocabulaires, geleidelijk, en elke vocabulaire die verhuist moet eerst
   in de schaduw bewijzen dat hij hetzelfde besluit neemt. Dit bestand is de
   eerste die verhuist: de vier kantoordeuren die vandaag als vier functies
   bestaan (officeAuth, kluisAuth/naamAuth, boardroomAuth, balieAuth) staan hier
   als EEN tabel.

   DE VORM IS EEN EN VAN OFS. Een deur is een lijst eisen die ALLEMAAL moeten
   kloppen; een eis is een lijst feiten waarvan er EEN genoeg is. Meer vorm is
   er niet, en dat is met opzet: een regeltaal met uitzonderingen en voorrang is
   een tweede programmeertaal die niemand kan nalezen.

   DRIE UITKOMSTEN, EN ONBEKEND IS GEEN WEIGEREN. Ontbreekt een feit omdat de bron
   niet kon antwoorden (`undefined`, niet `false`), dan zegt de motor ONBEKEND
   (CONTROLPLANE.md: een storing hoort niet te klinken als een overtreding). Hij
   zegt ook nooit TOESTAAN over een deur die hij niet kent -- dat is besluit A3
   in het klein: wat niet is verklaard, gaat niet open.

   WAT DIT NIET IS: de feiten. Die komen uit ./feiten.js en lezen dezelfde bronnen
   als de poorten (sessie, account, boardroomlijst, baliezetels). De schaduw
   bewijst dus dat de SAMENSTELLING klopt, niet dat de bronnen kloppen -- en dat
   staat zo in het antwoord van de stand. */
'use strict';

const UITKOMST = Object.freeze({ TOESTAAN: 'TOESTAAN', WEIGEREN: 'WEIGEREN', ONBEKEND: 'ONBEKEND' });

/* Wat elk feit betekent. Een feit zonder uitleg hoort hier niet. */
const FEITEN = Object.freeze({
  kantoorsessie: 'een kantoorsessie (de gedeelde code of een kantoorrol op een account)',
  eigenaar: 'het eigen account van de eigenaar',
  mensOpSessie: 'een kantoorsessie die aan een RTG-account hangt (er staat een mens achter)',
  boardroomZetel: 'de eigenaar, of wie van hem boardroomtoegang kreeg',
  balieZetel: 'een zetel aan de ledenbalie (de boardroom heeft er altijd een)',
  eigenaarMens: 'de eigenaar zelf, via zijn account of een kantoorsessie op zijn sleutel'
});

/* BESLUIT A2 (23 september 2026): de eigenaar is geen dagelijkse superuser.
   Gevoelige lezingen -- de deuren hieronder: de kluis (identiteit, HR) en de
   ledenbalie -- vragen ook van hem een stap-op en een reden. Nog in de SCHADUW:
   ./index.js telt hoe vaak de eigenaar er zonder stap-op doorheen gaat, en houdt
   niemand tegen. */
const STAPOP_DEUREN = Object.freeze(['op-naam', 'balie']);

/* De deuren. `poort` is de functie die vandaag afdwingt; de schaduw vergelijkt
   de motor met precies die functie. */
const DEUREN = Object.freeze({
  kantoor: { poort: 'officeAuth', eisen: [['kantoorsessie', 'eigenaar']],
    uitleg: 'de kantoordeur' },
  'op-naam': { poort: 'kluisAuth / naamAuth', eisen: [['kantoorsessie', 'eigenaar'], ['mensOpSessie', 'eigenaar']],
    uitleg: 'de kantoordeur, met een mens erachter' },
  boardroom: { poort: 'boardroomAuth', eisen: [['kantoorsessie', 'eigenaar'], ['boardroomZetel']],
    uitleg: 'de kamer van de eigenaar' },
  balie: { poort: 'balieAuth', eisen: [['balieZetel']],
    uitleg: 'de ledenbalie' }
});

/* HET BESLUIT, MET ZIJN OPBOUW. Een uitkomst zonder opbouw is een orakel
   (EXECUTIE.md); hier staat per eis welk feit hem haalde, of waarom niet. */
function kan(feiten, deur) {
  const d = DEUREN[deur];
  if (!d) {
    return { uitkomst: UITKOMST.ONBEKEND, deur, opbouw: [],
      reden: 'Deze deur is niet verklaard; wat niet is verklaard, gaat niet open (AUTHORITY.md A3).' };
  }
  const f = feiten || {};
  const opbouw = [];
  let onbekend = false, geweigerd = null;
  for (const eis of d.eisen) {
    const hit = eis.find(n => f[n] === true);
    const open = !hit && eis.some(n => f[n] === undefined);
    opbouw.push({ eis: eis.slice(), gehaald: !!hit, door: hit || null, onbekend: open });
    if (hit) continue;
    if (open) onbekend = true; else if (!geweigerd) geweigerd = eis;
  }
  if (geweigerd) {
    return { uitkomst: UITKOMST.WEIGEREN, deur, opbouw,
      reden: 'Geen van deze feiten klopt: ' + geweigerd.map(n => FEITEN[n] || n).join(', of ') + '.' };
  }
  if (onbekend) {
    return { uitkomst: UITKOMST.ONBEKEND, deur, opbouw,
      reden: 'Een bron kon niet antwoorden; dat is geen weigering en geen toestemming.' };
  }
  return { uitkomst: UITKOMST.TOESTAAN, deur, opbouw, reden: 'Elke eis van ' + d.uitleg + ' is gehaald.' };
}

module.exports = { kan, DEUREN, FEITEN, UITKOMST, STAPOP_DEUREN };

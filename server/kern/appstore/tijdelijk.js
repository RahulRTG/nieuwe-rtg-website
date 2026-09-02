/* ============================================================================
   EEN TIJDELIJKE CEL -- een app die er staat tot een datum die het LID koos.

   WAAROM DIT EEN EIGEN BESTANDJE IS, ZO KLEIN ALS HET IS. Dezelfde vraag ("is
   deze cel verlopen?") wordt op drie plekken gesteld: bij het openen
   (./uitgifte.js), op de winkelkaart (./etalage.js) en bij het opnieuw
   toevoegen (./winkel.js). Drie keer `tot < vandaag` overtypen is drie kansen
   om de vergelijking net anders te doen -- en dan verschilt de dag waarop een
   app verdwijnt van de dag waarop het scherm dat zegt.

   TWEE KEUZES DIE HIER VASTLIGGEN.

   De datum komt van het LID en niet van RTG. Een cel die verloopt omdat wij
   iets besloten -- een reis die volgens ons voorbij is, een abonnement dat wij
   lieten aflopen -- is een app die onder iemands handen verdwijnt.

   En hij wordt op de DAG gelezen en niet op de seconde: "tot 12 mei" betekent
   dat 12 mei nog telt. Een grens die midden op een dag dichtvalt, is een grens
   die niemand kan uitleggen -- en die in elke tijdzone ergens anders valt.
   ========================================================================== */
'use strict';

const DAG = /^\d{4}-\d{2}-\d{2}$/;
const dagVan = (iso) => String(iso || '').slice(0, 10);

/* Leest wat een lid opgaf. Geeft { tot } of { fout }; leeg is geldig en
   betekent BLIJVEND -- de meeste apps zijn dat, en dat is een keuze en geen
   ontbrekende waarde. */
function leesTot(waarde, vandaagISO) {
  const t = String(waarde == null ? '' : waarde).trim().slice(0, 10);
  if (!t) return { tot: null };
  if (!DAG.test(t)) return { fout: 'Een einddatum is jjjj-mm-dd, of leeg voor blijvend.' };
  if (!Number.isFinite(Date.parse(t + 'T12:00:00Z'))) return { fout: 'Die datum bestaat niet.' };
  if (t < dagVan(vandaagISO)) return { fout: 'Die datum is al geweest. Kies vandaag of later, of laat hem leeg voor blijvend.' };
  return { tot: t };
}

/* Verlopen is STRIKT ouder dan vandaag: op de einddatum zelf gaat de app nog
   open. Zonder datum verloopt er niets. */
const isVerlopen = (tot, vandaagISO) => !!(tot && String(tot) < dagVan(vandaagISO));

module.exports = { leesTot, isVerlopen, dagVan };

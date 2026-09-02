/* ============================================================================
   HET SOFTWAREPASPOORT -- elke app als een traceerbaar object, in vaste rijen.

   WAAROM DIT EEN EIGEN BESTAND IS. Deze rijen worden op drie plekken getoond --
   de winkelkaart, de cel en het inkoopdossier -- en ze zijn op alle drie
   hetzelfde. Drie schermen die elk zelf een paspoort samenstellen, is drie keer
   dezelfde waarheid, en dan zegt de cel over een half jaar iets anders dan de
   winkel (LAT-regel 4). Het wordt hier EEN keer gerekend en drie keer gelezen.

   DE REGEL DIE ELKE RIJ DRAAGT: er staat nooit een getal waar er geen is. Een
   veld dat niet is vastgesteld, draagt `waarde: null` met een REDEN -- en niet
   een streepje, een nul of een lege tekenreeks. Dat is de huisregel uit
   KOSTEN.md en BESTUUR.md, en hij geldt hier dubbel: een paspoort waarin een
   onbekende waarde eruitziet als een gemeten waarde, is erger dan geen paspoort.

   WAT ER MET OPZET NIET IN STAAT. Geen score, geen cijfer, geen samengesteld
   oordeel. BEWIJSMACHINE.md legt uit waarom: een getal boven eerlijke losse
   meters verbergt precies welke ervan bewoog. Wie de rijen leest, oordeelt zelf.
   ========================================================================== */
'use strict';

const { bereik, KANAALFEITEN } = require('./bereik');

/* Een rij: wat het heet, wat de waarde is, en waar hij vandaan komt. `bron` is
   het bestand of het besluit waar hij is vastgesteld -- niet de plek waar hij
   wordt getoond. */
const R = (veld, waarde, bron, reden) => ({ veld, waarde: waarde == null ? null : waarde, bron: bron || null, reden: reden || null });

const kB = (n) => (Number.isFinite(n) ? (Math.round(n / 102.4) / 10).toFixed(1) + ' kB' : null);

/* Het paspoort van EEN versie van EEN app. `verleend` is optioneel: staat hij
   erin, dan gaat het over wat dit lid gaf; anders over wat het manifest vraagt.
   De twee worden nooit vermengd -- dat is grens 4 -- en het paspoort zegt in
   `over` welke van de twee er staat. */
function paspoort({ app: a, versie: v, uitgever: u, verleend }) {
  const m = v.manifest;
  const over = verleend ? 'verleend' : 'gevraagd';
  const b = bereik(verleend ? verleend.machtigingen : m.machtigingen);
  const maten = v.maten || null;
  const tekenaar = v.besluit && v.besluit.door ? v.besluit.door : null;

  return {
    /* Het objectnummer. De sleutel draagt soms zelf al 'rtg-' (onze eigen apps
       doen dat), en dan stond er APP-RTG-RTG-REKENMACHINE. Een nummer dat
       stottert, leest als een fout in het systeem dat het uitgeeft. */
    object: 'APP-' + (/^RTG-/.test(String(m.sleutel).toUpperCase()) ? '' : 'RTG-') + String(m.sleutel).toUpperCase(),
    over,
    bereik: b,
    rijen: [
      R('uitgever', u ? u.naam : null, 'kern/appstore/uitgevers.js',
        u ? null : 'De uitgever is niet meer bekend; de app hoort niet in de winkel te staan.'),
      R('versie', m.versie, 'het manifest van deze bundel'),
      R('celprofiel', b.label, 'kern/appstore/bereik.js'),
      R('netwerk', '0 bestemmingen', 'server/routes/appstore/cel.js'),
      R('sensoren', 'geen', 'public/apps/appcel.html'),
      R('gegevens', b.bruggen ? b.label.toLowerCase() : 'geen', 'kern/appstore/brug.js'),
      R('uitvoerbare code', maten ? kB(maten.script) : null, 'kern/appstore/keuring.js',
        maten ? null : 'Deze versie is ingezonden voordat de poort maten bijhield.'),
      R('bundel', maten ? kB(maten.totaal) : null, 'kern/appstore/keuring.js',
        maten ? null : 'Deze versie is ingezonden voordat de poort maten bijhield.'),
      R('bytes', v.hash ? v.hash.slice(0, 16) : null, 'kern/appstore/bundel.js',
        v.hash ? null : 'Zonder hash hoort deze bundel niet uitgeleverd te worden.'),
      R('keuring', v.besluit ? v.besluit.at : null, 'kern/appstore/besluit.js',
        v.besluit ? null : 'Nog niet door een mens afgetekend.'),
      R('getekend door', tekenaar, 'kern/appstore/besluit.js',
        tekenaar ? null : 'Een besluit zonder naam wordt niet aangenomen; deze versie hoort niet live te staan.')
    ],
    kanaal: KANAALFEITEN,
    let: 'Dit paspoort zegt wat er DRAAIT en wat het kan bereiken. Het zegt niets over de kwaliteit van de app, en er staat met opzet geen cijfer onder.'
  };
}

module.exports = { paspoort };

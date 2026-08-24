/* DE HERSTELRECEPTEN VAN EEN ZAAK.

   EEN RUNBOOK MAG GEEN WERKELIJKHEID VERZINNEN, en dat is bij een zaak een
   scherpere eis dan bij het platform. Een bestelling op "in bereiding" zetten
   omdat hij te lang op "nieuw" staat, is niet herstellen maar liegen: er staat
   dan in het systeem dat de keuken begonnen is terwijl niemand iets deed. Een
   kamer op "schoon" zetten omdat hij te lang op "vuil" staat, is erger.

   Wat WEL mag, en dat is de hele lijst hieronder: administratieve drift
   rechtzetten. Een toestand die AFGELEID had moeten worden maar achterbleef,
   een oude statusnaam die nooit is meegegroeid, een boeking waarvan de datum
   allang voorbij is. Daar verandert de werkelijkheid niet; daar gaat de
   administratie eindelijk kloppen mét de werkelijkheid.

   Alles wat de zaak wél moet beslissen -- een boeking bevestigen, een rit aan
   een chauffeur hangen, verlof toekennen -- staat hier met opzet NIET in. Dat
   wordt een uitzondering in de rij, met een eigenaar en een termijn. De
   machine mag het zien en voorstellen; hij mag het niet doen.

   De voorwaarden en de statuswaarden komen uit de bestaande code en zijn niet
   verzonnen:
     orders   allowed = nieuw | in bereiding | klaar | geserveerd | geweigerd |
              onderweg | bezorgd | opgehaald   (routes/supplier/orders/afhandeling.js:69)
     ritten   RIT_KETEN + RIT_LEGACY { rijdt: 'aan-boord', gearriveerd: 'afgerond' }
              (kern/vervoer.js:7-8)
     boeking  BOEK_KETEN = aangevraagd | bevestigd | afgerond (server.js:1588) */
'use strict';

const s = (v) => (v == null ? '' : String(v));

/* De legacy-namen van de ritstatus, letterlijk uit kern/vervoer.js. Ze staan
   hier als KOPIE en dat is bewust geen dubbele waarheid: als vervoer.js ze ooit
   uitbreidt, hoort dit runbook niet stilzwijgend mee te veranderen -- een
   statusnaam hernoemen is een besluit, geen bijwerking. De toets pint af dat
   deze twee paren blijven kloppen met de bron. */
const RIT_OUD = { rijdt: 'aan-boord', gearriveerd: 'afgerond' };

/* HET CERTIFICAAT VAN EEN ZAAK-RECEPT, en waarom de getallen hier LAGER staan
   dan aan de RTG-kant. `maxObjecten` zegt hoe groot een recept ooit beproefd
   is, en de schaal van een zaak is de schaal van EEN onderneming: honderd
   bestellingen ineens rechtzetten is bij RTG een ronde over de hele vloot en
   bij een restaurant een halve maand omzet. Wie het getal wil verhogen, hoort
   dat te doen nadat hij het op die schaal heeft zien draaien -- niet omdat de
   voorcontrole in de weg zat.

   Alle vier krijgen `oorzaak-weg` erbij en niet alleen `veld-staat-op-doel`.
   Bij administratieve drift is dat juist de scherpe controle: staat het veld op
   de bedoelde waarde maar geldt de aanleiding nog steeds, dan was de afwijking
   geen drift maar iets wat zichzelf opnieuw maakt -- en dan zet dit recept elke
   ronde hetzelfde weer recht zonder dat iemand de oorzaak ziet.

   `terugweg: 'automatisch'` mag hier omdat alle vier terugDraaibaar zijn en
   alle vier alleen een STATUSVELD raken. Bij een recept dat een bedrag of een
   recht zou aanraken hoort dit niet -- maar die bestaan hier niet en mogen hier
   ook niet komen: command/runbooks.js/BEVROREN houdt dat tegen, en deze
   catalogus draait door diezelfde motor. */
const CERT = (max) => ({ versie: 1, maxObjecten: max, terugweg: 'automatisch',
  verificaties: ['veld-staat-op-doel', 'oorzaak-weg'] });

const RUNBOOKS = [
  { id: 'bestelling-stations-klaar', naam: 'Bestelling afronden die al klaar is',
    wat: 'Alle stations melden "klaar", maar de bestelling zelf staat nog op "nieuw" of "in bereiding". De status loopt achter op wat de keuken al heeft gedaan.',
    type: 'bestelling', veld: 'status', naar: 'klaar',
    past: r => {
      const st = r && r.stations;
      if (!st || typeof st !== 'object') return false;
      const namen = Object.keys(st);
      if (!namen.length) return false;
      if (!['nieuw', 'in bereiding'].includes(s(r.status))) return false;
      return namen.every(n => s(st[n]) === 'klaar');
    },
    actie: 'melding sluiten', oorzaak: 'status loopt achter op de stations',
    terugDraaibaar: true, klantImpact: false, certificaat: CERT(25) },

  { id: 'rit-oude-statusnaam', naam: 'Oude ritstatus omzetten',
    wat: 'Een rit draagt nog een statusnaam van vóór de huidige keten ("rijdt", "gearriveerd"). Hij wordt omgezet naar de naam die de keten nu gebruikt; er verandert niets aan de rit zelf.',
    type: 'rit', veld: 'status', naar: null,
    naarVoor: r => RIT_OUD[s(r.status)] || null,
    past: r => !!RIT_OUD[s(r && r.status)],
    actie: 'melding sluiten', oorzaak: 'statusnaam van vóór de huidige keten',
    /* 50 en niet meer: een oude statusnaam over honderden ritten omzetten is
       geen herstel maar een migratie, en die hoort een mens te plannen. */
    terugDraaibaar: true, klantImpact: false, certificaat: CERT(50) },

  { id: 'boeking-verlopen-afronden', naam: 'Verlopen boeking afronden',
    wat: 'Een bevestigde boeking waarvan de datum meer dan een dag voorbij is, staat nog open. Hij wordt afgerond zodat de lijst de werkelijkheid volgt.',
    type: 'boeking', veld: 'status', naar: 'afgerond',
    past: r => {
      if (s(r && r.status) !== 'bevestigd') return false;
      const d = r.date || r.datum || r.van || r.plannedFor;
      if (!d) return false;
      const t = new Date(d).getTime();
      return Number.isFinite(t) && t < Date.now() - 86400000;
    },
    actie: 'melding sluiten', oorzaak: 'boeking is verlopen maar nog open',
    terugDraaibaar: true, klantImpact: false, certificaat: CERT(50) },

  { id: 'klus-opgelost-sluiten', naam: 'Opgeloste klus sluiten',
    wat: 'Een klus die als opgelost is gemarkeerd maar nog niet is afgesloten.',
    type: 'klus', veld: 'status', naar: 'klaar',
    past: r => ['opgelost', 'afgehandeld', 'gereed'].includes(s(r && r.status)),
    actie: 'melding sluiten', oorzaak: 'klus is opgelost maar staat nog open',
    terugDraaibaar: true, klantImpact: false, certificaat: CERT(50) }
];

const OP_ID = new Map(RUNBOOKS.map(r => [r.id, r]));

module.exports = { RUNBOOKS, OP_ID, RIT_OUD };

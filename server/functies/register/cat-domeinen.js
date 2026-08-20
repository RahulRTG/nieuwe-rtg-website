/* Functiecatalogus, deel "domeinen": de domeinen die wel bestonden maar niet in
   de schakelkast stonden.

   WAAROM DIT BESTAND ER IS. De boardroom kan alleen schakelen wat in de
   catalogus staat. Wie een nieuw domein bouwt schrijft routes; de catalogus
   bijwerken is een tweede handeling, en tweede handelingen worden vergeten. Op
   2 augustus 2026 stond daardoor 41% van alle API-routes buiten de kast: niet
   door een besluit, maar door optelling. Onzichtbaar in de boardroom, niet uit
   te zetten, niet per stad te sluiten, en de storingswachter kwam er nooit aan.

   scripts/schakelbaar.js meet dat gat en scripts/norm.js ratelt erop, zodat het
   alleen nog kleiner kan worden. Dit bestand is de eerste grote stap: elk
   domein hieronder is nu een gewone functie met alle assen die de kast kent
   (globaal, per pas, per land, per stad of dorp, per persoon, storing, en de
   automaat van de storingswachter).

   ALLES STAAT STANDAARD AAN. Deze regels veranderen geen enkel gedrag; ze
   maken bestaand gedrag alleen bestuurbaar. Wie hier iets uitzet, doet dat
   voortaan bewust in plaats van dat het niet kon.

   GROF IS HIER GOED. Een domein is een schakelaar, niet elk endpoint apart:
   veertig knoppen voor een dienst maakt een kast die niemand meer leest. Wil
   je iets binnen een domein apart kunnen sluiten, dan zet je dat er als eigen
   functie met een langer pad bij -- de kast kiest altijd de langste treffer.

   Het tweede blok (foundation, media, identiteit, geld) staat in
   ./cat-domeinen2.js; samen zijn ze een lijst. */
const { LEDEN, LEDEN_RTF } = require('./doelgroepen');
const LEDEN_GAST = ['rtg', 'lifestyle', 'business', 'gast'];
const ZAAK = ['leverancier', 'personeel'];

module.exports = [
  // ---------- diensten voor leden ----------
  { id: 'dom-overheid', categorie: 'Diensten (leden)', naam: 'Overheidsloket', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Belasting, toeslagen, rijbewijs, voertuigen, KVK, uitkeringen, bezwaar, subsidies en waterschap in een loket.', paden: ['/api/overheid'] },
  { id: 'dom-gemeente', categorie: 'Diensten (leden)', naam: 'Gemeenteloket', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Meldingen, aanvragen en gemeentezaken.', paden: ['/api/gemeente'] },
  { id: 'dom-thuis', categorie: 'Diensten (leden)', naam: 'Thuis (verhuur en logeren)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Advertenties, reviews en boekingen tussen leden onderling.', paden: ['/api/thuis'] },
  { id: 'dom-residentie', categorie: 'Diensten (leden)', naam: 'Residentie', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het woon- en verblijfsdeel van het platform.', paden: ['/api/residentie'] },
  { id: 'dom-lucht', categorie: 'Diensten (leden)', naam: 'Luchtvaart en luchthaven', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Vluchten, boarding passes en de luchthavendiensten.', paden: ['/api/lucht'] },
  { id: 'dom-reisbureau', categorie: 'Diensten (leden)', naam: 'Reisbureau', standaard: true, doelgroepen: LEDEN_GAST,
    uitleg: 'Reisadvies en het samenstellen van een reis.', paden: ['/api/reisbureau'] },
  { id: 'dom-care', categorie: 'Diensten (leden)', naam: 'Zorg en welzijn', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De zorgkant: intakes, begeleiding en welzijnsdiensten.', paden: ['/api/care'] },
  { id: 'dom-agenda', categorie: 'Diensten (leden)', naam: 'Agenda', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De agenda: afspraken, uitnodigingen en planning.', paden: ['/api/agenda'] },
  { id: 'dom-meet', categorie: 'Diensten (leden)', naam: 'RTG Meet (vergaderkamers)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Vergaderkamers op codenaam; beeld en geluid lopen peer-to-peer.', paden: ['/api/meet'] },
  { id: 'dom-nav', categorie: 'Diensten (leden)', naam: 'Navigatie', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Routes en navigatie onderweg.', paden: ['/api/nav'] },
  /* De plaatslaag (PLAATS.md). Hoort hier net zo goed als elk ander domein: de
     boardroom moet hem per pas, per land of bij storing kunnen sluiten. Gaat
     hij uit, dan valt het huis terug op wat er voor deze laag was -- hekken en
     waarnemingen verdwijnen en elke uitspraak wordt "niet gemeten", en dat is
     precies de stand die overal als veilig antwoord is ingebouwd. */
  { id: 'dom-plaats', categorie: 'Diensten (leden)', naam: 'Plaats (aanwezigheid en nadering)', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Hekken, toestemmingsvensters en waarnemingen; de motor draait op het toestel.', paden: ['/api/plaats'] },

  // ---------- cultuur, sport en gezelschap ----------
  { id: 'dom-genootschap', categorie: 'Cultuur en gezelschap', naam: 'Het Genootschap', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Het besloten genootschap: kringen, bijeenkomsten en beheer.', paden: ['/api/genootschap'] },
  { id: 'dom-sport', categorie: 'Cultuur en gezelschap', naam: 'Sport', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'Sportprogramma\'s, teams en wedstrijden.', paden: ['/api/sport'] },
  { id: 'dom-muziek', categorie: 'Cultuur en gezelschap', naam: 'Muziek', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'Van lied tot zaal: maken, uitgeven en beluisteren.', paden: ['/api/muziek'] },
  { id: 'dom-galerij', categorie: 'Cultuur en gezelschap', naam: 'Galerij', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De beeldgalerij van leden en partners.', paden: ['/api/galerij'] },
  { id: 'dom-boeken', categorie: 'Cultuur en gezelschap', naam: 'Boeken', standaard: true, doelgroepen: LEDEN_RTF,
    uitleg: 'De bibliotheek en het lezen.', paden: ['/api/boeken'] },
  { id: 'dom-fluister', categorie: 'Cultuur en gezelschap', naam: 'Fluister', standaard: true, doelgroepen: LEDEN,
    uitleg: 'De fluisterlijn binnen de sociale laag.', paden: ['/api/fluister'] },

  // ---------- werk en zaken ----------
  { id: 'dom-werkvloer', categorie: 'Werk (zaken en personeel)', naam: 'De werkvloer', standaard: true, doelgroepen: ZAAK,
    uitleg: 'Tafels, keukenbord en bedieningskaart op de vloer van een zaak.', paden: ['/api/werkvloer'] },
  { id: 'dom-werkplek', categorie: 'Werk (zaken en personeel)', naam: 'De werkplek', standaard: true, doelgroepen: ZAAK,
    uitleg: 'Het persoonlijke werkstation van een medewerker.', paden: ['/api/werkplek'] },
  { id: 'dom-metier', categorie: 'Werk (zaken en personeel)', naam: 'Metier (vakwerk)', standaard: true, doelgroepen: ZAAK,
    uitleg: 'Het vakwerk van zelfstandigen en ambachtslieden.', paden: ['/api/metier'] },
  { id: 'dom-vak', categorie: 'Werk (zaken en personeel)', naam: 'Vakritmes', standaard: true, doelgroepen: ZAAK,
    uitleg: 'Werkritmes en tijdregistratie per vak.', paden: ['/api/vak'] },
  { id: 'dom-verkoop', categorie: 'Werk (zaken en personeel)', naam: 'Verkoop', standaard: true, doelgroepen: ZAAK,
    uitleg: 'De verkoopkant van een zaak, inclusief proefritten.', paden: ['/api/verkoop'] },
  { id: 'dom-doos', categorie: 'Werk (zaken en personeel)', naam: 'De zaakdoos', standaard: true, doelgroepen: ZAAK,
    uitleg: 'De doos op locatie: zaakserver, netwerk en updates.', paden: ['/api/doos'] },
  { id: 'dom-facturen', categorie: 'Werk (zaken en personeel)', naam: 'Facturen', standaard: true, doelgroepen: ZAAK,
    uitleg: 'De facturatie van en naar een zaak.', paden: ['/api/facturen'] }
];

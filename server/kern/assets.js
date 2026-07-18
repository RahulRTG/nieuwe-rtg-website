/* Toren 3: RTG Shared Assets. Jets, jachten en villa's in een besloten pool
   van altijd precies 300 tickets per object. Een ticket = 24 uur gebruik per
   jaar, tien jaar lang. Twee smaken, bewust verschillend gehouden en allebei
   juridisch op eigen leest geschoeid:

   - RTG Access (de consument): een meerjarige dienstenvoucher. Vaste prijs,
     de dagenteller reset elk jaar en na tien jaar is het klaar. Geen
     restwaarde, geen beleggingsregels; wel de wettelijke bedenktijd.
   - RTG Asset (de entrepreneur): een deelnemingsbewijs in een aparte
     entiteit per object. Zelfde gebruiksrecht, plus een aandeel in de reele
     restwaarde (waarde / 300). Koop kan alleen na een uitdrukkelijk
     risico-akkoord, met een essentiele-informatiedocument en veertien dagen
     bedenktijd met volledige terugbetaling.

   Uitstappen loopt langs een trap die een stormloop op de kas voorkomt:
   1. staat er een koper op de wachtlijst, dan draagt het lid het ticket
      direct over (verkoper ontvangt de ticketwaarde, de koper betaalt de
      ticketwaarde plus 5% overdrachtskosten die in de poolkas vallen);
   2. anders koopt RTG terug: het verzoek staat vast en het kantoor betaalt
      binnen dertig dagen uit via een Tik, uit de poolkas van het object.

   De exploitatie is gedekt: elke Asset-koop stort de 15%-premie in de
   poolkas, elk actief ticket betaalt een jaarlijkse servicefee (2% van de
   ticketwaarde) en de restdagen van het object zijn zichtbaar voor het
   kantoor om extern te verhuren. Alleen voor betalende leden. */
const TICKETS_PER_OBJECT = 300;
const UREN_PER_TICKET = 24;   // per jaar
const JAREN_GELDIG = 10;
const BETALENDE_PASSEN = ['rtg', 'lifestyle', 'business'];
const BEDENKTIJD_DAGEN = 14;        // herroeping met volledige terugbetaling
const TERUGKOOP_VENSTER_DAGEN = 30; // RTG betaalt een terugkoop uiterlijk dan uit
const SERVICE_FEE_PCT = 0.02;       // per ticket per jaar, dekt beheer en bemanning
const OVERDRACHT_FEE_PCT = 0.05;    // op een wachtlijst-overdracht, naar de poolkas
const ONDERHOUD_DAGEN = 15;         // per jaar gereserveerd voor onderhoud
const PIEK_MAANDEN = ['07', '08'];  // hooguit de helft van je dagen in juli/augustus
/* De prijzen van de twee smaken zijn een formule op de objectwaarde, zodat
   ze automatisch meebewegen als RTG-kantoor het object hertaxeert:
   - Access = 25% van de ticketwaarde: alleen het gebruik.
   - Asset = ticketwaarde + 15% pool-premie (beheer en onderhoud). */
const ACCESS_FACTOR = 0.25;
const ASSET_FACTOR = 1.15;
const netjes = n => Math.round(n / 100) * 100; // prijzen op honderden

module.exports = ({ db, save, crypto, schoon, notify, pay }) => {
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const lijsten = () => {
    if (!db.data.assetTickets) db.data.assetTickets = [];       // gekochte tickets, per lid en object
    if (!db.data.assetGebruik) db.data.assetGebruik = [];       // geboekte 24-uursblokken
    if (!db.data.assetWachtlijst) db.data.assetWachtlijst = []; // kopers die op een Asset-ticket wachten
    if (!db.data.assetTerugkoop) db.data.assetTerugkoop = [];   // uitstapverzoeken die op de kantoor-uitbetaling wachten
    if (!db.data.assetKas) db.data.assetKas = {};               // poolkas per object, in centen
    if (!Array.isArray(db.data.sharedAssets) || !db.data.sharedAssets.length) {
      db.data.sharedAssets = [
        { id: 'sa-jet', naam: 'Aria One, Gulfstream G650', soort: 'privejet', icon: '✈️', waar: 'Thuisbasis Schiphol Oost',
          entiteit: 'RTG Asset Pool Aria One B.V.',
          beschrijving: 'Volledig bemand, wereldwijd inzetbaar. Uw 24 uur is een retour binnen Europa of een enkele reis intercontinentaal.',
          waarde: 42000000 },
        { id: 'sa-jacht', naam: 'Azul Horizon, 34 meter', soort: 'jacht', icon: '🛥️', waar: 'Marina Botafoc, Ibiza',
          entiteit: 'RTG Asset Pool Azul Horizon B.V.',
          beschrijving: 'Met schipper en hostess. Uw 24 uur is een dag en een nacht op zee, Es Vedra bij zonsondergang inbegrepen.',
          waarde: 9000000 },
        { id: 'sa-villa', naam: 'Sunset Beach Villa', soort: 'villa', icon: '🏖️', waar: 'Cala Conta, Ibiza',
          entiteit: 'RTG Asset Pool Sunset Beach B.V.',
          beschrijving: 'Zes slaapkamers, eigen strandpad, dagelijkse housekeeping. Uw 24 uur is een volledige nacht met late check-out.',
          waarde: 6000000 }
      ];
    }
    // oudere pools: elk object hoort in een eigen entiteit
    for (const a of db.data.sharedAssets) if (!a.entiteit) a.entiteit = 'RTG Asset Pool ' + a.naam.split(',')[0] + ' B.V.';
  };
  const objectVan = id => (db.data.sharedAssets || []).find(a => a.id === String(id || ''));
  const ticketWaarde = a => Math.round(a.waarde / TICKETS_PER_OBJECT);
  const prijsAccessVan = a => netjes(ticketWaarde(a) * ACCESS_FACTOR);
  const prijsAssetVan = a => netjes(ticketWaarde(a) * ASSET_FACTOR);
  const serviceFeeVan = a => netjes(ticketWaarde(a) * SERVICE_FEE_PCT);
  const actieveVan = assetId => db.data.assetTickets.filter(t => t.assetId === assetId && t.status === 'actief');
  // bezet = actief plus alles wat op een terugkoop-uitbetaling wacht: pas na
  // de uitbetaling valt het ticket echt terug in de pool
  const bezetVan = assetId => db.data.assetTickets.filter(t => t.assetId === assetId && ['actief', 'uitstap-aangevraagd'].includes(t.status));
  const magKopen = sess => BETALENDE_PASSEN.includes(sess.tier);
  const kasAdd = (assetId, centen) => { db.data.assetKas[assetId] = (db.data.assetKas[assetId] || 0) + Math.round(centen); };
  const binnenBedenktijd = t => (Date.now() - new Date(t.at).getTime()) < BEDENKTIJD_DAGEN * 86400000;

  /* De drie lagen (winkel, gebruik, kantoor) draaien als submodules op een
     gedeelde context, een keer opgebouwd bij het opstarten. */
  const ctx = { db, save, crypto, schoon, notify, pay,
    TICKETS_PER_OBJECT, UREN_PER_TICKET, JAREN_GELDIG, BETALENDE_PASSEN, BEDENKTIJD_DAGEN,
    TERUGKOOP_VENSTER_DAGEN, SERVICE_FEE_PCT, OVERDRACHT_FEE_PCT, ONDERHOUD_DAGEN, PIEK_MAANDEN,
    ACCESS_FACTOR, ASSET_FACTOR, netjes,
    nu, vandaag, lijsten, objectVan, ticketWaarde, prijsAccessVan, prijsAssetVan, serviceFeeVan,
    actieveVan, bezetVan, magKopen, kasAdd, binnenBedenktijd };
  const deelWinkel = require('./assets/winkel')(ctx);
  Object.assign(ctx, deelWinkel);
  const deelGebruik = require('./assets/gebruik')(ctx);
  Object.assign(ctx, deelGebruik);
  const deelKantoor = require('./assets/kantoor')(ctx);
  const { assetsOverzicht, assetDocument, assetKoop, assetHerroep, assetWachtlijstZet } = deelWinkel;
  const { assetMijn, assetGebruik, assetUitstap } = deelGebruik;
  const { assetHertaxeer, assetKantoor, assetTerugkoopUit, assetFeesInnen } = deelKantoor;

  return { assetsOverzicht, assetDocument, assetKoop, assetHerroep, assetWachtlijstZet, assetMijn, assetGebruik, assetUitstap, assetHertaxeer, assetKantoor, assetTerugkoopUit, assetFeesInnen };
};

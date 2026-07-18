/* Kern-module "modebezorg": een slimme, veilige bezorgdienst die een modewinkel
   (retail) in een tik opzet. Veilig voor beide kanten:

   Voor de winkel:
   - een bezorgcode (pincode) die alleen de juiste ontvanger kent; de koerier
     rondt pas af als die klopt (bewijs van juiste levering),
   - een foto bij de overdracht (bewijs dat het is afgeleverd),
   - bij dure stukken een ID-controle aan de deur (RTG-geverifieerd),
   - alleen geverifieerd eigen personeel bezorgt.

   Voor de klant:
   - live volgen van de koerier (naam, positie, ETA),
   - een eigen bezorgcode die je alleen aan de echte koerier geeft,
   - pas-aan-de-deur: past het niet, dan neemt de koerier het meteen retour.

   Slim/efficient: de koerier krijgt de open bezorgingen op de kortste route
   (dichtstbijzijnde eerst). maakModebezorg(state) volgt het kern-patroon. */

const KETEN = { aangevraagd: 'klaargezet', klaargezet: 'onderweg', onderweg: 'afgeleverd' };
const KLAAR = { afgeleverd: true, retour: true, geannuleerd: true };

function maakModebezorg({ db, save, crypto, findSupplier, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, haversine, etaMinutes, leesUploadDataUrl }) {
  const id = (p) => (p || 'MB') + crypto.randomBytes(4).toString('hex').toUpperCase();
  const nu = () => new Date().toISOString();
  // crypto-random: de bezorgcode is een veiligheidscode aan de deur en mag
  // niet voorspelbaar zijn (Math.random is dat wel)
  const pin = () => String(crypto.randomInt(1000, 10000));
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const getal = (v, min, max, st) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : st; };
  function lijst() { if (!Array.isArray(db.data.modeBezorg)) db.data.modeBezorg = []; return db.data.modeBezorg; }

  /* De winkel- en koerierlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten; de winkellaag gaat
     eerst de context in omdat de koerierlaag instel en de beelden
     gebruikt. */
  const ctx = { db, save, crypto, findSupplier, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, haversine, etaMinutes, leesUploadDataUrl,
    KETEN, KLAAR, id, nu, pin, schoon, getal, lijst };
  const deelWinkel = require('./modebezorg/winkel')(ctx);
  Object.assign(ctx, deelWinkel);
  const deelKoerier = require('./modebezorg/koerier')(ctx);
  const { isRetail, instel, setup, magLeveren, accountVerified, aanvraag, winkelOverzicht, winkelBeeld, klantBeeld, mijnBezorgingen } = deelWinkel;
  const { route, bezorging, neem, gps, overhandig, retour } = deelKoerier;

  return {
    MODEBEZORG_KETEN: KETEN,
    mbSetup: setup, mbInstel: instel, mbMagLeveren: magLeveren, mbAanvraag: aanvraag,
    mbWinkelOverzicht: winkelOverzicht, mbRoute: route, mbNeem: neem, mbGps: gps,
    mbOverhandig: overhandig, mbRetour: retour, mbMijn: mijnBezorgingen
  };
}

module.exports = { maakModebezorg };

/* Kern-module "modebezorg": een slimme, veilige bezorgdienst die een modewinkel
   (retail) in een tik opzet. Veilig voor beide kanten:

   Voor de winkel:
   - een bezorgcode die alleen de juiste ontvanger kent; de koerier rondt pas
     af als die klopt (./modebezorg/bezorgcode.js: gebonden, eenmalig, geremd),
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

function maakModebezorg({ db, save, crypto, bewerkCollectie, dataDir, findSupplier, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, haversine, etaMinutes, leesUploadDataUrl }) {
  const id = (p) => (p || 'MB') + crypto.randomBytes(4).toString('hex').toUpperCase();
  const nu = () => new Date().toISOString();
  // de bezorgcode: kort, gebonden, geremd en hash-only (./modebezorg/bezorgcode.js)
  const bezorgcode = require('./modebezorg/bezorgcode')({ crypto, bewerkCollectie, dataDir,
    geheim: process.env.RTG_SECRET_KEY || null });
  const houderVan = key => crypto.createHash('sha256').update('rtg-modebezorg-houder-v1|' + String(key || '')).digest('hex');
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const getal = (v, min, max, st) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : st; };
  function lijst() { if (!Array.isArray(db.data.modeBezorg)) db.data.modeBezorg = []; return db.data.modeBezorg; }

  /* De winkel- en koerierlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten; de winkellaag gaat
     eerst de context in omdat de koerierlaag instel en de beelden
     gebruikt. */
  const ctx = { db, save, crypto, findSupplier, accounts, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, haversine, etaMinutes, leesUploadDataUrl,
    KETEN, KLAAR, id, nu, bezorgcode, houderVan, schoon, getal, lijst };
  const deelWinkel = require('./modebezorg/winkel')(ctx);
  Object.assign(ctx, deelWinkel);
  const deelKoerier = require('./modebezorg/koerier')(ctx);
  const { isRetail, instel, setup, magLeveren, accountVerified, aanvraag, codeNieuw, winkelOverzicht, winkelBeeld, klantBeeld, mijnBezorgingen } = deelWinkel;
  const { route, bezorging, neem, gps, overhandig, retour } = deelKoerier;

  /* VERGETEN (AVG art. 17). Een bezorging is ook de administratie van de
     winkel en blijft; wat weggaat is het lid -- zijn sleutel en codenaam -- en
     elk punt: de bestemming en de laatste koerierpositie bij hem voor de deur.
     Het adres als tekst blijft bij een bezorging die nog loopt (de koerier is
     onderweg) en gaat weg bij een die klaar is. */
  function vergeet(key) {
    let n = 0;
    for (const b of key ? lijst() : []) {
      if (!b || b.key !== key) continue;
      b.loc = null; b.gps = null; b.key = null; b.codenaam = '(verwijderd)';
      if (KLAAR[b.status]) b.adres = null;
      n++;
    }
    return { bezorgingen: n };
  }

  return {
    mbVergeet: vergeet,
    MODEBEZORG_KETEN: KETEN,
    mbSetup: setup, mbInstel: instel, mbMagLeveren: magLeveren, mbAanvraag: aanvraag, mbCode: codeNieuw,
    mbWinkelOverzicht: winkelOverzicht, mbRoute: route, mbNeem: neem, mbGps: gps,
    mbOverhandig: overhandig, mbRetour: retour, mbMijn: mijnBezorgingen
  };
}

module.exports = { maakModebezorg };

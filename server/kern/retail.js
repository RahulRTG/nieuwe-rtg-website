/* De retail-/mode-laag: een breed, slim genre voor modehuizen, merken en winkels.
   Alsof alle grote modehuizen op RTG draaien. Twee kanten:

   MERK/WINKEL-BACKOFFICE (leverancier-app):
   - collecties per seizoen (SS/AW) en artikelen met varianten (maat x kleur x SKU)
   - voorraad per variant, lage-voorraad-signalen en bijbestel-suggesties
   - drops (getimede releases) met een wachtlijst die bij de release afgaat
   - clienteling: per klant maten, voorkeuren, verlanglijst, aankoophistorie en
     stylist-notities (het geheime wapen van elk luxe modehuis)
   - analytics: bestsellers, sell-through per collectie, dagomzet

   WINKELVLOER (personeels-PDA):
   - voorraad opzoeken (scan/zoek: welke maat, welke kleur, waar)
   - een klant erbij pakken (maten, verlanglijst, historie) en op maat adviseren
   - een artikel apart leggen voor een klant, een paskamerverzoek afhandelen
   - mobiele kassa op de vloer (voorraad daalt, de historie groeit)
   - een stylingvoorstel rechtstreeks naar de app van de klant sturen

   De kassa (posSales), de fooi, de reviews, de reisagenda en de leden-favorieten
   uit de bestaande lagen werken hier gewoon op mee. maakRetail(state) volgt het
   vaste kern-patroon. */

const MATEN = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SEIZOENEN = ['SS', 'AW', 'Pre', 'Resort', 'Capsule'];

function maakRetail({ db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, ledenPrijs, gidsHaal, meldWachtlijst }) {
  const id = () => crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const rond = n => Math.round(n * 100) / 100;
  const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 120);

  function isRetail(s) { return s && ((db.data.supplierTypes[s.type] || {}).caps || []).includes('retail'); }
  function artikelVan(s, artikelId) { return (s.artikelen || []).find(a => a.id === artikelId); }
  function variantVan(s, vsku) {
    for (const a of s.artikelen || []) { const v = (a.varianten || []).find(x => x.vsku === vsku); if (v) return { artikel: a, variant: v }; }
    return null;
  }
  function totaleVoorraad(a) { return (a.varianten || []).reduce((n, v) => n + (v.voorraad || 0), 0); }

  /* ---- collecties ---- */

  /* De drie lagen (assortiment, klant, vloer) draaien als submodules op een
     gedeelde context, een keer opgebouwd bij het opstarten; elke laag komt na
     het mounten de context in zodat de volgende hem kan gebruiken. */
  const ctx = { db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice,
    ledenPrijs, gidsHaal, meldWachtlijst, MATEN, SEIZOENEN,
    id, nu, vandaag, rond, schoon, isRetail, artikelVan, variantVan, totaleVoorraad };
  const deelAssortiment = require('./retail/assortiment')(ctx);
  Object.assign(ctx, deelAssortiment);
  const deelKlant = require('./retail/klant')(ctx);
  Object.assign(ctx, deelKlant);
  const deelVloer = require('./retail/vloer')(ctx);
  const { zetCollectie, zetArtikel, pasVoorraad, releaseDrop } = deelAssortiment;
  const { klantRec, klantProfiel, zetKlantMaten, voegKlantnotitie, wishlistToggle, legApart, mijnApart, vraagPaskamer, paskamerBreng, stuurStyling, mijnStyling } = deelKlant;
  const { verkoop, verkoopTerug, voorraadZoek, retailStats, retailState, catalogus } = deelVloer;

  return {
    isRetail, zetCollectie, zetArtikel, pasVoorraad, releaseDrop,
    klantProfiel, zetKlantMaten, voegKlantnotitie, wishlistToggle,
    legApart, mijnApart, vraagPaskamer, paskamerBreng, stuurStyling, mijnStyling,
    verkoop, verkoopTerug, voorraadZoek, retailStats, retailState, catalogus
  };
}

module.exports = { RETAIL_MATEN: MATEN, RETAIL_SEIZOENEN: SEIZOENEN, maakRetail };

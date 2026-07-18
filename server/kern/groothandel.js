/* Kern-module "groothandel": een brede B2B/B2C-marktplaats (denk Sligro, maar dan
   op het RTG-systeem). Een groothandel voert een assortiment en levert aan:
   - onze horeca/partners (B2B, op inkoopprijs),
   - RTG-leden (boodschappen, op consumentprijs, met bezorging),
   - andere groothandels (doorverkoop/streekproducten).

   Elke groothandel zet zijn eigen functies aan en uit (liever te veel dan te
   weinig): welke klanttypes, bezorgen/afhalen, AI-bijbestellen, doorverkoop,
   facturatie op rekening, retour, spoedlevering, enzovoort.

   AI-bijbestellen voor de horeca kijkt naar wat een zaak de afgelopen dagen
   verkocht (de bestellingen van gasten) en naar de mise-en-place, schat het
   verbruik per product en zet een concept-bestelling klaar die de zaak in een
   tik goedkeurt.

   maakGroothandel(state) volgt het vaste kern-patroon. */

// De functies die een groothandel zelf aan/uit zet. Standaard staat alles aan.
const GH_FUNCTIES = [
  { id: 'b2b', naam: 'Leveren aan horeca/partners (B2B)' },
  { id: 'consument', naam: 'Boodschappen aan leden (supermarkt)' },
  { id: 'doorverkoop', naam: 'Leveren aan andere groothandels' },
  { id: 'bezorgen', naam: 'Bezorgen' },
  { id: 'afhalen', naam: 'Afhalen bij de groothandel' },
  { id: 'aiBijbestel', naam: 'AI-bijbestellen voor de horeca' },
  { id: 'streek', naam: 'Streek- en versproducten' },
  { id: 'contractprijs', naam: 'Contractprijzen per klant' },
  { id: 'facturatie', naam: 'Leveren op rekening (factuur)' },
  { id: 'retour', naam: 'Retour & statiegeld' },
  { id: 'spoed', naam: 'Spoedlevering (zelfde dag)' },
  { id: 'allergenen', naam: 'Allergenen- en herkomstinfo' }
];
const GH_KETEN = { aangevraagd: 'bevestigd', bevestigd: 'onderweg', onderweg: 'geleverd' };
const GH_KLAAR = { geleverd: true, geweigerd: true, geannuleerd: true };
const CATEGORIEEN = ['Vers', 'Zuivel', 'Vlees & vis', 'Groente & fruit', 'Droog & houdbaar', 'Dranken', 'Diepvries', 'Non-food'];

function maakGroothandel({ db, save, crypto, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, anthropic, bijGeleverd }) {
  const id = (p) => (p || 'g') + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const getal = (v, min, max, st) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : st; };

  function isGroothandel(s) { return s && s.type === 'groothandel'; }
  function defaults(s) {
    if (!s.groothandel || typeof s.groothandel !== 'object') s.groothandel = {};
    const g = s.groothandel;
    if (!g.functies || typeof g.functies !== 'object') g.functies = {};
    for (const f of GH_FUNCTIES) if (!(f.id in g.functies)) g.functies[f.id] = true;   // standaard aan
    if (!Array.isArray(g.producten)) g.producten = [];
    return g;
  }
  function functieAan(s, fid) { return defaults(s).functies[fid] !== false; }
  // welk klanttype hoort bij een kopende partij, en welke functie moet daarvoor aanstaan
  function klantSoortVan(koper) {
    if (koper && koper.soort) return koper.soort;
    return 'partner';
  }
  function functieVoorKlant(soort) { return soort === 'lid' ? 'consument' : soort === 'groothandel' ? 'doorverkoop' : 'b2b'; }
  function prijsVoor(p, soort) {
    if (soort === 'lid') return Number(p.consumentPrijs != null ? p.consumentPrijs : p.inkoopPrijs) || 0;
    return Number(p.inkoopPrijs) || 0;
  }

  /* ---- de groothandel beheert zijn eigen functies en assortiment ---- */

  /* De assortiment- en orderlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten; de assortimentlaag gaat
     eerst de context in omdat de orderketen orders/markt gebruikt. */
  const ctx = { db, save, crypto, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer, sseToOffice, anthropic, bijGeleverd,
    GH_FUNCTIES, GH_KETEN, GH_KLAAR, CATEGORIEEN,
    id, nu, schoon, getal, isGroothandel, defaults, functieAan, klantSoortVan, functieVoorKlant, prijsVoor };
  const deelAssortiment = require('./groothandel/assortiment')(ctx);
  Object.assign(ctx, deelAssortiment);
  const deelOrders = require('./groothandel/orderlaag')(ctx);
  const { functieLijst, zetFunctie, zetProduct, zetVoorraad, orders, actieveGroothandels, publiekProduct, markt } = deelAssortiment;
  const { plaatsBestelling, orderVerder, annuleer, mijnBestellingen, inkomend, bijbestelVoorstel } = deelOrders;

  return {
    GROOTHANDEL_FUNCTIES: GH_FUNCTIES, GROOTHANDEL_CATEGORIEEN: CATEGORIEEN,
    ghIsGroothandel: isGroothandel, ghDefaults: defaults, ghFunctieAan: functieAan,
    ghFunctieLijst: functieLijst, ghZetFunctie: zetFunctie, ghZetProduct: zetProduct, ghZetVoorraad: zetVoorraad,
    ghMarkt: markt, ghPlaatsBestelling: plaatsBestelling, ghOrderVerder: orderVerder, ghAnnuleer: annuleer,
    ghMijnBestellingen: mijnBestellingen, ghInkomend: inkomend, ghBijbestelVoorstel: bijbestelVoorstel
  };
}

module.exports = { GROOTHANDEL_FUNCTIES: GH_FUNCTIES, maakGroothandel };

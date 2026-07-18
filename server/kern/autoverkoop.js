/* Kern-module "autoverkoop": een 5-sterren, exclusieve autoverkoop bovenop het
   verhuurbedrijf. Naast huren kan dezelfde zaak auto's verkopen, met een
   vloeiende, luxe flow:
   - een showroom met specs, opties, garantie en historie (VIP-stukken apart),
   - een proefrit op afspraak (de zaak plant hem in),
   - kopen met een bod, optioneel inruil (de zaak taxeert) en optioneel
     concierge-aflevering op je eigen adres,
   - een digitaal koopcontract dat het lid tekent,
   - slimme aanbevelingen.

   Alles zelfstandig in db.data.verkoopDeals en s.verkoop, met het vaste
   kern-patroon maakAutoverkoop(state). */

const KETEN_PROEFRIT = { aangevraagd: 'ingepland', ingepland: 'gereden' };
const KETEN_KOOP = { aangevraagd: 'aanvaard', aanvaard: 'getekend', getekend: 'afgeleverd' };
const KLAAR = { gereden: true, afgeleverd: true, afgewezen: true, geannuleerd: true };
const BRANDSTOF = ['Benzine', 'Diesel', 'Hybride', 'Elektrisch'];

function maakAutoverkoop({ db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, media }) {
  const id = (p) => (p || 'V') + crypto.randomBytes(4).toString('hex').toUpperCase();
  const nu = () => new Date().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const getal = (v, min, max, st) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : st; };
  function deals() { if (!Array.isArray(db.data.verkoopDeals)) db.data.verkoopDeals = []; return db.data.verkoopDeals; }

  function isVerkoopBedrijf(s) { return s && (s.type === 'verhuur' || s.type === 'tweewielers'); }
  function ver(s) {
    if (!s.verkoop || typeof s.verkoop !== 'object') s.verkoop = {};
    if (typeof s.verkoop.aan !== 'boolean') s.verkoop.aan = false;
    if (!Array.isArray(s.verkoop.showroom)) s.verkoop.showroom = [];
    return s.verkoop;
  }
  function magVerkopen(s) { return isVerkoopBedrijf(s) && ver(s).aan; }
  function autoNaam(a) { return [a.merk, a.model, a.jaar].filter(Boolean).join(' '); }

  /* ---- de zaak beheert de showroom ---- */

  /* De showroom- en deallaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten; de showroomlaag gaat
     eerst de context in omdat de dealketen vindAuto gebruikt. */
  const ctx = { db, save, crypto, findSupplier, notify, notifySupplier, sseToCustomer, sseToSupplier, sseToOffice, media,
    KETEN_PROEFRIT, KETEN_KOOP, KLAAR, BRANDSTOF,
    deals, isVerkoopBedrijf, ver, magVerkopen, autoNaam, id, nu, schoon, getal };
  const deelShowroom = require('./autoverkoop/showroom')(ctx);
  Object.assign(ctx, deelShowroom);
  const deelDeal = require('./autoverkoop/deal')(ctx);
  const { zetAan, zetAuto, verwijderAuto, publiekeAuto, bedrijven, showroom, aanbevolen, vindAuto } = deelShowroom;
  const { proefritAanvraag, koopAanvraag, inruilAanvraag, beslis, teken, mijnDeals, dealerInbox } = deelDeal;

  return {
    AUTOVERKOOP_BRANDSTOF: BRANDSTOF,
    avMagVerkopen: magVerkopen, avZetAan: zetAan, avZetAuto: zetAuto, avVerwijderAuto: verwijderAuto,
    avShowroom: showroom, avAanbevolen: aanbevolen, avProefrit: proefritAanvraag, avKoop: koopAanvraag,
    avInruil: inruilAanvraag, avBeslis: beslis, avTeken: teken, avMijnDeals: mijnDeals, avDealerInbox: dealerInbox
  };
}

module.exports = { maakAutoverkoop };

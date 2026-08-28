/* WAT RTG ZELF ECHT BETAALDE, per maand en per soort.

   Dit is de tegenhanger van ./tarieven.js. Een tarief zegt wat één eenheid
   KOST; dit zegt wat er aan het eind van de maand daadwerkelijk is AFGESCHREVEN
   -- de factuur van de hoster, de stroomnota, de afrekening van de
   modelaanbieder, het maandoverzicht van de betaalpartner.

   HET DIENT TWEE DOELEN EN DIE ZIJN NIET HETZELFDE.

   1. VERDELEN. Stroom en serverhuur zijn per gebruiker niet te meten. Wat er
      wel is, is de rekening. ./toerekening.js verdeelt die over de gebruikers
      naar hun gemeten verbruik. Zonder een ingevoerde rekening wordt er dus
      niets verdeeld -- en niet een bedacht bedrag.

   2. NAREKENEN. Voor de soorten die WEL per gebruiker gemeten worden, kan het
      huis twee getallen naast elkaar leggen: de optelsom van alle gebruikers
      (tellers maal tarief) en de echte rekening. Lopen die uiteen, dan klopt
      het tarief niet, of de meter mist verbruik. Dat verschil hoort ZICHTBAAR
      te zijn en niet weggerekend: ./overzicht.js toont het als 'afstemming'.
      Twee getallen die hetzelfde horen te zeggen zijn twee plekken, en dan is de
      vraag welke van de twee liegt -- LAT.md regel 4.

   OOK HIER GEEN BEDRAG ZONDER BRON. Zelfde regel, zelfde reden: een verdeelde
   stroomrekening komt uiteindelijk op de factuur van een lid terecht, en dan
   hoort navertelbaar te zijn welke nota dat was. */
'use strict';

const { soort } = require('./soorten');

const MAX_CENTEN = 1000000000;   // 10 miljoen euro in één maandpost: grens op het doel

module.exports = (ctx) => {
  const { d, save, nu, periodeVan } = ctx;

  function boek() {
    const k = d();
    if (!k.huisrekening || typeof k.huisrekening !== 'object') k.huisrekening = {};
    return k.huisrekening;
  }

  const rekening = (periode) => boek()[periodeVan(periode)] || {};
  const postVan = (periode, soortId) => rekening(periode)[String(soortId || '')] || null;

  function posten(periode) {
    const r = rekening(periode);
    return Object.keys(r).map(id => {
      const s = soort(id);
      return { soort: id, naam: s ? s.naam : id, centen: r[id].centen, bron: r[id].bron,
        factuurId: r[id].factuurId || null,
        gezetOp: r[id].gezetOp, gezetDoor: r[id].gezetDoor || null };
    }).sort((a, b) => b.centen - a.centen);
  }

  /* Een post zetten. Overschrijft de vorige stand voor die maand: een
     stroomnota wordt gecorrigeerd, niet opgeteld. De vorige stand blijft wel
     staan als `vorige`, zodat te zien is dat er iets veranderd is nadat er
     mogelijk al iets op is gebaseerd. */
  /* `factuurId` verwijst naar een echte leveranciersfactuur
     (./providerfactuur.js). Is die er, dan wordt de BRON daaruit AFGELEID en
     niet ingetikt: zo staat de herkomst op een plek en loopt de keten door tot
     iets wat je naast een bankafschrift kunt leggen. Zonder factuur mag een vrij
     ingetikte bron ook nog -- niet elke kostenpost heeft er een, en een systeem
     dat dan niets aanneemt, krijgt een lege maand in plaats van een eerlijke. */
  function postZet(periode, soortId, centen, bron, wie, factuurId) {
    const s = soort(soortId);
    if (!s) return { status: 400, error: 'Onbekende kostensoort.' };
    const p = periodeVan(periode);
    if (!/^\d{4}-\d{2}$/.test(p)) return { status: 400, error: 'Geen geldige maand (JJJJ-MM).' };
    const n = Math.round(Number(centen));
    if (!Number.isFinite(n) || n < 0 || n > MAX_CENTEN) return { status: 400, error: 'Geen geldig bedrag in centen.' };
    let fid = String(factuurId == null ? '' : factuurId).trim() || null;
    let b = String(bron == null ? '' : bron).trim().slice(0, 300);
    if (fid) {
      const uit = ctx.providerfactuur && ctx.providerfactuur.bronVan(fid);
      if (!uit) return { status: 404, error: 'Die leveranciersfactuur bestaat niet.' };
      b = uit;
    }
    if (b.length < 4) return { status: 400, error: 'Een bedrag zonder bron bestaat niet; noem de leveranciersfactuur, of anders de nota of afrekening.' };
    const r = boek()[p] || (boek()[p] = {});
    const oud = r[s.id];
    r[s.id] = { centen: n, bron: b, factuurId: fid, gezetOp: nu(), gezetDoor: String(wie || 'kantoor').slice(0, 80),
      vorige: oud ? { centen: oud.centen, bron: oud.bron, gezetOp: oud.gezetOp } : null };
    save();
    return { status: 200, ok: true, post: { soort: s.id, centen: n, bron: b, factuurId: fid } };
  }

  /* Welke toegerekende soorten missen een rekening voor deze maand. Het
     overzicht noemt ze bij naam in plaats van ze op nul te zetten: nul euro
     stroom is geen eerlijke uitkomst maar een ontbrekende nota. */
  function ontbrekend(periode) {
    const r = rekening(periode);
    return require('./soorten').toegerekend().filter(s => !r[s.id]).map(s => s.id);
  }

  return { posten, postZet, postVan, rekening, ontbrekend, MAX_CENTEN };
};

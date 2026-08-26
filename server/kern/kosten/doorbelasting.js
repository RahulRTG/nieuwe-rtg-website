/* WIE BETAALT WAT HIJ KOST -- en wie niet, en waarom niet.

   Meten is de helft. De andere helft is de vraag die eronder ligt: van welke
   gebruiker mag dit bedrag op een rekening komen? Dat is geen technische maar
   een BELOFTE-vraag, en daarom staat het antwoord hier uitgeschreven per pas en
   niet als een vinkje ergens in een scherm.

   DE VIER STANDEN, EN WELKE PAS WELKE KRIJGT, STAAN IN ./beleidkaart.js. Dat
   is een tabel zonder logica en die hoort apart: wie wil weten wat RTG belooft,
   moet niet door de machinerie hoeven die het uitvoert.

   DE AI ZET KLAAR, EEN MENS GEEFT VRIJ. voorstel() rekent; vrijgeven() boekt, en
   dat is een handeling van een mens uit het kantoor met zijn naam eronder.
   GELD.md par. 3 en LIFE.md: alles wat een tweede persoon bereikt, wordt nooit
   automatisch. Een maandelijkse rekening is precies dat.

   EN ER GAAT GEEN FACTUUR VOOR EEN PAAR CENT DE DEUR UIT. Onder de drempel
   schuift het bedrag door naar de volgende maand. Een rekening die minder
   oplevert dan hij kost is geen inkomsten maar ergernis. */
'use strict';

const { BELEID, STANDEN, VAST, DREMPEL_CENTEN, pasVan } = require('./beleidkaart');

module.exports = (ctx) => {
  const { d, save, nu, meter, overzicht, boekDoorbelasting } = ctx;

  function overschrijvingen() {
    const k = d();
    if (!k.beleid || typeof k.beleid !== 'object') k.beleid = {};
    return k.beleid;
  }
  const standVan = (pas) => {
    const o = overschrijvingen()[pas];
    return (o && o.stand) || (BELEID[pas] || BELEID.gratis).stand;
  };

  const beleid = () => Object.keys(BELEID).map(pas => {
    const o = overschrijvingen()[pas];
    return Object.assign({ pas }, BELEID[pas], {
      stand: standVan(pas), bestaatNog: BELEID[pas].bestaatNog !== false,
      vast: !!VAST[pas], waaromVast: VAST[pas] || null,
      verzet: o ? { van: BELEID[pas].stand, naar: o.stand, reden: o.reden, op: o.op, door: o.door } : null });
  });

  /* Een stand verzetten. Met een reden, want dit verandert wat een lid op zijn
     rekening krijgt; een verandering daarin zonder opgeschreven waarom is over
     een half jaar niet meer te verdedigen tegenover het lid dat hem betaalt. */
  function beleidZet(pas, stand, reden, wie) {
    const p = String(pas || '');
    if (!BELEID[p]) return { status: 400, error: 'Onbekende pas.' };
    if (VAST[p]) return { status: 403, error: VAST[p] };
    if (!STANDEN.includes(String(stand))) return { status: 400, error: 'Onbekende stand.' };
    if (stand === 'rtfoundation' || stand === 'huis') return { status: 400, error: 'Die stand hoort bij een gezin of bij het huis, niet bij een pas.' };
    const r = String(reden == null ? '' : reden).trim().slice(0, 300);
    if (r.length < 8) return { status: 400, error: 'Noem de reden; een pas die opeens verbruik doorbelast verandert de rekening van elk lid erop.' };
    const naam = String(wie || '').trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Zonder wie gebeurt dit niet.' };
    overschrijvingen()[p] = { stand: String(stand), reden: r, op: nu(), door: naam };
    save();
    return { status: 200, ok: true, beleid: beleid().find(b => b.pas === p) };
  }

  function boek() {
    const k = d();
    if (!k.doorbelast || typeof k.doorbelast !== 'object') k.doorbelast = {};
    return k.doorbelast;
  }
  const ronde = (periode) => boek()[meter.periodeVan(periode)] || null;

  /* Wat er deze maand op een rekening zou komen. Rekent voor IEDEREEN, ook voor
     de standen die niet factureren: juist dat verschil is het antwoord op "wat
     kost een gratis gebruiker ons". */
  /* De stand van ÉÉN gebruiker. Bestaat apart van voorstel() omdat het scherm
     van een lid alleen zijn eigen regel nodig heeft: het hele voorstel uitrekenen
     om er één rij uit te vissen, maakt van elke paginaweergave een doorrekening
     van alle gebruikers van die maand. */
  function standVoor(periode, drager, alVerdeeld) {
    const p = meter.periodeVan(periode);
    const o = overzicht.voorDrager(p, drager, alVerdeeld);
    const pas = pasVan(drager, meter.kijk(p, drager));
    const stand = standVan(pas);
    const b = BELEID[pas] || BELEID.gratis;
    const centen = o.totaal.centen;
    const teLaag = stand === 'doorbelasten' && centen < DREMPEL_CENTEN;
    return { drager, wie: o.wie, pas, stand, uitleg: b.uitleg, centen, graad: o.totaal.graad,
      factureren: stand === 'doorbelasten' && !teLaag,
      waaromNiet: stand !== 'doorbelasten' ? b.uitleg
        : teLaag ? ('Onder de drempel van ' + (DREMPEL_CENTEN / 100).toFixed(2) + ' euro; schuift door naar de volgende maand.') : null };
  }

  function voorstel(periode) {
    const p = meter.periodeVan(periode);
    const al = ronde(p);
    /* De verdeling van deze maand EEN keer, en dan doorgegeven. Zie de kop van
       voorDrager in ./overzicht.js voor waarom dat hier uitmaakt. */
    const verdeeld = ctx.toerekening ? ctx.toerekening.verdeling(p).perDrager : {};
    const rijen = meter.dragers(p).map(dr => standVoor(p, dr, verdeeld))
      .sort((a, b2) => b2.centen - a.centen);
    const som = (f) => rijen.filter(f).reduce((a, r) => a + r.centen, 0);
    return { periode: p, rijen,
      totalen: { alles: som(() => true), teFactureren: som(r => r.factureren),
        inbegrepen: som(r => r.stand === 'inbegrepen'), rtfoundation: som(r => r.stand === 'rtfoundation'),
        huis: som(r => r.stand === 'huis') },
      vrijgegeven: al ? { op: al.vrijgegevenOp, door: al.vrijgegevenDoor, regels: al.regels.length } : null };
  }

  /* Vrijgeven: de rekeningen daadwerkelijk klaarzetten op de factuur die er al
     is. Eén keer per maand, en een tweede poging weigert -- een dubbele
     doorbelasting is niet met een creditnota te repareren maar met vertrouwen. */
  function vrijgeven(periode, wie) {
    const p = meter.periodeVan(periode);
    if (!/^\d{4}-\d{2}$/.test(p)) return { status: 400, error: 'Geen geldige maand (JJJJ-MM).' };
    if (ronde(p)) return { status: 409, error: 'Deze maand is al vrijgegeven op ' + ronde(p).vrijgegevenOp + '.' };
    const naam = String(wie || '').trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Vrijgeven is een handeling van een mens; zonder wie gebeurt het niet.' };
    if (typeof boekDoorbelasting !== 'function') return { status: 503, error: 'De factuurlaag is nog niet wakker; probeer het zo weer.' };
    const v = voorstel(p);
    const regels = [];
    for (const r of v.rijen.filter(x => x.factureren)) {
      const uit = boekDoorbelasting({ drager: r.drager, periode: p, centen: r.centen, graad: r.graad });
      regels.push({ drager: r.drager, centen: r.centen, factuur: (uit && uit.id) || null,
        mislukt: uit && uit.error ? uit.error : null });
    }
    boek()[p] = { vrijgegevenOp: nu(), vrijgegevenDoor: naam, regels };
    save();
    return { status: 200, ok: true, periode: p, geboekt: regels.filter(r => !r.mislukt).length,
      mislukt: regels.filter(r => r.mislukt), totaalCenten: regels.filter(r => !r.mislukt).reduce((a, r) => a + r.centen, 0) };
  }

  return { beleid, beleidZet, voorstel, standVoor, vrijgeven, ronde, BELEID, STANDEN, DREMPEL_CENTEN, pasVan };
};

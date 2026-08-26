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

const { BELEID, STANDEN, DREMPEL_CENTEN, pasVan } = require('./beleidkaart');

module.exports = (ctx) => {
  const { d, save, nu, meter, overzicht, boekDoorbelasting, economie } = ctx;

  /* DE FIREWALL OP WERELDNIVEAU. Naast de vraag "wat zegt de pas van deze
     gebruiker" staat sinds de economielaag een tweede: mag RTG deze wereld
     überhaupt iets in rekening brengen? Dat is geen dubbeling maar een andere
     vraag. De pas zegt wat er met de kosten van DIT soort gebruiker hoort te
     gebeuren; de firewall zegt of er tussen twee rechtspersonen een grondslag
     ligt om iets te leveren. Beide moeten ja zeggen.

     De laag is er altijd: ./index.js weigert te bouwen zonder. Een firewall die
     wegvalt als hij ontbreekt, is geen firewall. */
  function wegOpen(drager) {
    const naar = economie.wereldVan(drager);
    if (naar === economie.INFRA_WERELD) {
      return { ok: false, code: 'eigen-wereld', uitleg: 'Dit is verbruik van RTG zelf; wij sturen onszelf geen rekening.' };
    }
    return economie.magBelasten({ van: economie.INFRA_WERELD, naar });
  }

  /* De beleidsstand woont in ./beleidstand.js: wat er per pas geldt en wie dat
     verzet heeft. Zie de kop daar voor waarom dat een eigen bestand is. */
  const stand = require('./beleidstand')(ctx);
  const { beleid, beleidZet, standVan } = stand;

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
    const fw = wegOpen(drager);
    return { drager, wie: o.wie, pas, stand, uitleg: b.uitleg, centen, graad: o.totaal.graad,
      wereld: economie.wereldVan(drager),
      firewall: { ok: !!fw.ok, code: fw.code, uitleg: fw.uitleg, hoeWel: fw.hoeWel || null },
      factureren: stand === 'doorbelasten' && !teLaag && !!fw.ok,
      waaromNiet: stand !== 'doorbelasten' ? b.uitleg
        : !fw.ok ? fw.uitleg
        : teLaag ? ('Onder de drempel van ' + (DREMPEL_CENTEN / 100).toFixed(2) + ' euro; schuift door naar de volgende maand.') : null,
      /* Het PLAFOND van de relatie geldt per wereld en niet per gebruiker; het
         wordt daarom in voorstel() getoetst, waar het weretotaal bekend is. Een
         plafond dat per gebruiker afslaat, laat willekeurig de laatsten in de
         lijst afvallen. */
      voorbehoud: stand === 'doorbelasten' && fw.ok
        ? 'De boardroom geeft per maand vrij; daar wordt ook het plafond van de relatie getoetst.' : null };
  }

  function voorstel(periode) {
    const p = meter.periodeVan(periode);
    const al = ronde(p);
    /* De verdeling van deze maand EEN keer, en dan doorgegeven. Zie de kop van
       voorDrager in ./overzicht.js voor waarom dat hier uitmaakt. */
    const verdeeld = ctx.toerekening ? ctx.toerekening.verdeling(p).perDrager : {};
    let rijen = meter.dragers(p).map(dr => standVoor(p, dr, verdeeld))
      .sort((a, b2) => b2.centen - a.centen);
    /* HET PLAFOND VAN DE RELATIE, per wereld en niet per gebruiker. Wat RTG bij
       een andere wereld mag neerleggen is met een maximum afgesproken; dat
       maximum geldt voor het totaal. Ligt de wereld erboven, dan valt de HELE
       wereld terug -- niet de laatste zoveel gebruikers uit een gesorteerde
       lijst, want wie er dan afvalt hangt af van de sorteervolgorde en niet van
       de afspraak. */
    const plafondBlok = {};
    const perWereld = {};
    for (const r of rijen) if (r.factureren) perWereld[r.wereld] = (perWereld[r.wereld] || 0) + r.centen;
    for (const w of Object.keys(perWereld)) {
      const uit = economie.magBelasten({ van: economie.INFRA_WERELD, naar: w, centen: perWereld[w] });
      if (!uit.ok) plafondBlok[w] = uit;
    }
    if (Object.keys(plafondBlok).length) {
      rijen = rijen.map(r => plafondBlok[r.wereld] && r.factureren
        ? Object.assign({}, r, { factureren: false, waaromNiet: plafondBlok[r.wereld].uitleg,
          firewall: Object.assign({ ok: false }, plafondBlok[r.wereld]) })
        : r);
    }
    const som = (f) => rijen.filter(f).reduce((a, r) => a + r.centen, 0);
    return { periode: p, rijen, plafondBlok,
      werelden: economie.WERELDEN.map(w => ({ wereld: w.id, naam: w.naam,
        centen: rijen.filter(r => r.wereld === w.id).reduce((a, r) => a + r.centen, 0),
        gebruikers: rijen.filter(r => r.wereld === w.id).length,
        teFactureren: rijen.filter(r => r.wereld === w.id && r.factureren).reduce((a, r) => a + r.centen, 0) })),
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
    /* EEN MAAND IN ONDERZOEK GAAT NIET NAAR EEN REKENING. Open is "er is nog
       niet naar gekeken" en dat mag; gesloten is "het klopt" en dat mag zeker.
       In-onderzoek betekent dat iemand van dit huis zelf heeft vastgesteld dat de
       cijfers niet kloppen -- en dan factureren is de duurste fout die deze laag
       kan maken (KOSTEN.md par. 7). */
    if (ctx.periode && ctx.periode.isOnderzoek(p)) {
      return { status: 409, error: 'Deze maand staat in onderzoek: er is een verschil gevonden dat nog niet verklaard is. ' +
        'Sluit de maand eerst, of zet hem terug op open.' };
    }
    const naam = String(wie || '').trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Vrijgeven is een handeling van een mens; zonder wie gebeurt het niet.' };
    if (typeof boekDoorbelasting !== 'function') return { status: 503, error: 'De factuurlaag is nog niet wakker; probeer het zo weer.' };
    const v = voorstel(p);
    const regels = [];
    for (const r of v.rijen.filter(x => x.factureren)) {
      const uit = boekDoorbelasting({ drager: r.drager, periode: p, centen: r.centen, graad: r.graad, wereld: r.wereld });
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

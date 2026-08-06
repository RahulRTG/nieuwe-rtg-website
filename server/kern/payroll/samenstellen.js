/* Payroll OS: DE INVOER VAN EEN LOONRUN SAMENSTELLEN.

   WAT HIER FOUT WAS, EN HET WAS GROOT. De loonrun bouwde zijn invoer uit EEN
   bron: de klok. Wie geklokte uren had kwam op de strook, wie er geen had niet.
   Dat betekende twee dingen die allebei niet mogen:

     1. VAST LOON BESTOND NIET. `basissalaris` stond wel in het
        componentenregister maar werd door niets geproduceerd. Iedereen met een
        maandsalaris die niet prikt -- kantoor, management, elke vaste kracht
        zonder prikklok -- stond niet eens IN de loonrun. Geen strook, geen
        betaling, en geen foutmelding: je verdwijnt gewoon uit de lijst.
     2. ZIEKTE VERLAAGDE HET LOON IN PLAATS VAN HET DOOR TE BETALEN. De
        verzuimlaag kende de doorbetalingspercentages (70% bij ziekte, 100% bij
        zwangerschap, 0% bij onbetaald verlof) en `voorPayroll()` werd door
        niemand aangeroepen. Iemand die twee weken ziek was, klokte twee weken
        niet en kreeg dus twee weken niets.

   DE REGEL DIE DAT OPLOST: de invoer van een loonrun begint bij het CONTRACT en
   niet bij de klok. Wie een contract heeft dat gold in de periode, hoort in de
   run -- wat hij krijgt hangt af van wat er is afgesproken.

     vaste omvang (vast, tijdelijk, minmax, stage met urenPerWeek)
        -> periodeloon uit het contract, naar rato van de gewerkte dagen, plus
           doorbetaling over de dagen dat hij er niet was
     geen vaste omvang (oproep, nuluren, freelance, uitzend)
        -> de geklokte uren, zoals het altijd al ging

   WAAROM DE TWEEDE GROEP GEEN DOORBETALING KRIJGT. Bij een oproepcontract volgt
   de loondoorbetaling uit het gemiddelde van de voorgaande perioden, en die
   berekening staat hier niet. Hem verzinnen zou betekenen dat een zieke
   oproepkracht een bedrag krijgt dat nergens op slaat. Er komt daarom een
   BEVINDING: bepaal dit met de hand. Een lege plek die zichzelf meldt is beter
   dan een gevuld vakje dat niemand kan navertellen.

   WAT HIER NIET GEBEURT: rekenen aan belasting, tarieven of grondslagen. Dit
   levert INVOER; de motor rekent. Die scheiding is waarom de motor te toetsen
   is zonder database en waarom deze laag te toetsen is zonder tarieven. */
'use strict';

/* De rekenhulp (werkdagen, periodeloon, vaste omvang) staat in
   ./samenstellen-rekenhulp.js -- pure functies, apart te toetsen. */
const { WEKEN_PER_MAAND, VASTE_OMVANG, heeftVasteOmvang, werkdagenVan,
  periodeloonVan } = require('./samenstellen-rekenhulp');

function maakSamenstellen({ contracten, uren, verzuim }) {

  /* De invoer van EEN mens. Levert { invoer, gewerkteUren, bevindingen }. */
  function voorMens({ code, periode, staffId, naam, contract, feit, toeslagen }) {
    const bevindingen = [];
    const invoer = [];
    const gewogen = feit ? uren.weeg(feit, contract, toeslagen) : { invoer: [], gewerkteUren: 0 };

    if (!heeftVasteOmvang(contract)) {
      /* Zonder vaste omvang is de klok de waarheid. Precies zoals het was. */
      const afwezig = verzuim.voorPayroll(code, staffId, periode + '-01', periode + '-31');
      if (afwezig.length) bevindingen.push({ soort: 'doorbetaling_handmatig', ernst: 'midden',
        staffId, eigenaar: 'administrateur', status: 'open',
        uitleg: naam + ' had verzuim in deze periode maar heeft geen contract met een vaste omvang. ' +
          'De loondoorbetaling volgt dan uit het gemiddelde van de voorgaande perioden; die berekening staat er niet. Bepaal het bedrag met de hand en voeg het toe.' });
      return { invoer: gewogen.invoer, gewerkteUren: gewogen.gewerkteUren, bevindingen };
    }

    /* ---- vaste omvang: het contract betaalt, niet de klok ---- */
    const loon = periodeloonVan(contract);
    const werkdagen = werkdagenVan(periode);
    const totaal = werkdagen.length || 1;

    /* Afwezige werkdagen per verlofsoort. Alleen WERKdagen tellen: ziek zijn op
       een zaterdag verlaagt geen maandsalaris. */
    const perSoort = new Map();
    for (const m of verzuim.voorPayroll(code, staffId, werkdagen[0], werkdagen[totaal - 1])) {
      for (const dag of werkdagen) {
        if (dag < m.van) continue;
        if (m.tot && dag > m.tot) continue;
        if (!perSoort.has(m.soort)) perSoort.set(m.soort, { soort: m.soort, naam: m.naam,
          betaaldDeel: m.betaaldDeel, viaUwv: m.viaUwv, dagen: new Set() });
        perSoort.get(m.soort).dagen.add(dag);
      }
    }
    /* Een dag kan maar EEN keer afwezig zijn. Overlappende meldingen (ziek
       tijdens vakantie) zouden anders dubbel van het loon af gaan. De eerste
       soort die de dag claimt houdt hem; welke dat is, ligt vast in de volgorde
       van de meldingen en niet in toeval. */
    const gezien = new Set();
    const soorten = [];
    for (const s of perSoort.values()) {
      const eigen = [...s.dagen].filter(d => !gezien.has(d));
      eigen.forEach(d => gezien.add(d));
      if (eigen.length) soorten.push(Object.assign({}, s, { aantal: eigen.length }));
    }

    const afwezig = gezien.size;
    const aanwezig = totaal - afwezig;

    if (aanwezig > 0) invoer.push({ component: 'basissalaris',
      centen: Math.round(loon.centen * (aanwezig / totaal)),
      dagen: aanwezig, vanDagen: totaal, periodeloonCenten: loon.centen,
      afgeleid: loon.afgeleid, uitleg: loon.uitleg });

    for (const s of soorten) {
      const deel = s.betaaldDeel == null ? 1 : s.betaaldDeel;
      const centen = Math.round(loon.centen * (s.aantal / totaal) * deel);
      if (centen > 0) invoer.push({ component: 'loondoorbetaling', centen,
        soort: s.soort, dagen: s.aantal, vanDagen: totaal, betaaldDeel: deel,
        uitleg: s.naam + ': ' + s.aantal + ' van ' + totaal + ' werkdagen tegen ' +
          Math.round(deel * 100) + '%' });
      if (s.viaUwv) bevindingen.push({ soort: 'uwv_uitkering', ernst: 'midden',
        staffId, eigenaar: 'administrateur', status: 'open',
        uitleg: naam + ': ' + s.naam + ' loopt via het UWV. Het doorbetaalde loon staat op de strook; de uitkering vraagt u apart aan en verrekent u met de werkgever.' });
      if (deel === 0) bevindingen.push({ soort: 'onbetaald_verlof', ernst: 'laag',
        staffId, eigenaar: 'manager', status: 'open',
        uitleg: naam + ': ' + s.aantal + ' dag(en) onbetaald verlof. Die dagen zijn van het loon af.' });
    }

    /* Toeslagen die WEL uit de klok komen: overuren en nachttoeslag. Een vaste
       kracht kan die hebben; zijn basisloon hangt er niet van af. `gewerkte_uren`
       gaat er bewust uit -- die zouden bovenop het maandsalaris komen en dan
       betaalt hij zichzelf twee keer. */
    for (const rij of gewogen.invoer) if (rij.component !== 'gewerkte_uren') invoer.push(rij);

    /* Voor de minimumloontoets: de contracturen van de periode, niet de
       geklokte. Anders deelt die toets een maandsalaris door nul uur en meldt
       hij niets, of door twee uur en meldt hij onzin. */
    const contractUren = Math.round(contract.urenPerWeek * WEKEN_PER_MAAND * (aanwezig / totaal) * 10) / 10;
    return { invoer, gewerkteUren: contractUren || gewogen.gewerkteUren, bevindingen };
  }

  /* De hele zaak. `personeel` komt van buiten (de accountlaag); deze module
     kent geen medewerkers, alleen contracten en meldingen. */
  function stel({ code, periode, personeel, toeslagen, leeftijdsgroep }) {
    const meting = uren.meet(code, periode);
    const perId = new Map(meting.feiten.map(f => [f.staffId, f]));
    const dag = periode + '-01';
    const regels = [];
    const bevindingen = meting.bevindingen.slice();

    for (const p of (personeel || [])) {
      const contract = contracten.opDatum(code, p.id, dag);
      if (!contract) continue; // de controlelaag meldt dit; hier niets verzinnen
      const uit = voorMens({ code, periode, staffId: p.id, naam: p.naam || p.name,
        contract, feit: perId.get(p.id), toeslagen });
      for (const b of uit.bevindingen) bevindingen.push(b);
      if (!uit.invoer.length) continue; // niets verdiend en niets afwezig: geen strook
      regels.push({ staffId: p.id, naam: p.naam || p.name, contract,
        invoer: uit.invoer, gewerkteUren: uit.gewerkteUren,
        leeftijdsgroep: p.leeftijdsgroep || leeftijdsgroep || '21+' });
    }
    return { regels, bevindingen, contracten: Object.fromEntries(
      (personeel || []).map(p => [p.id, contracten.opDatum(code, p.id, dag)])) };
  }

  return { stel, voorMens, werkdagenVan, periodeloonVan, heeftVasteOmvang, VASTE_OMVANG };
}

module.exports = { maakSamenstellen, werkdagenVan, periodeloonVan, heeftVasteOmvang, VASTE_OMVANG };

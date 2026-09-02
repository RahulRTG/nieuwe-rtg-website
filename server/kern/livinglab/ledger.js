/* ============================================================================
   HET ONDERZOEKSGROOTBOEK -- wat een studie kostte, en waarom de stichting die
   rekening mocht betalen.

   WAAROM DIT ER MOET ZIJN. Een lab dat niet kan zeggen wat een studie kostte,
   kan geen subsidie verantwoorden -- en een stichting die niet kan aantonen
   WAAROM zij die kosten droeg, verschilt op papier niet van een bedrijf dat zijn
   kosten ergens neerlegt. Dit grootboek beantwoordt allebei die vragen uit
   metingen die er al zijn, en verzint er geen enkele bij.

   HET GAT DAT HIERMEE DICHTGAAT. De deuren van het Living Lab zetten geen
   kostendrager, dus viel al het verbruik van het lab -- de AI-coach, de
   verzoeken, de opslag van een studie -- terug op 'huis': de eigen rekening van
   RTG. Voor verbruik zonder eigenaar is dat de juiste terugval, maar hier is er
   een eigenaar, en het is een andere rechtspersoon. RTG betaalde dus stilzwijgend
   het onderzoek van de stichting, en de stichting kon niet zeggen wat haar eigen
   onderzoek kostte. De vijfde dragersoort (`lab`, kern/kosten/haak.js) en de
   omhulling in de routes zetten dat recht.

   DRIE REGELS DIE DIT BESTAND DRAGEN.

   1. DE STUDIE IS DE KOSTENPLAATS, HET LAB IS DE BETALER. De drager is
      `lab:<labId>` en binnen een studie `lab:<labId>/<studieId>`. De betaler
      verandert daar niet door -- het lab heeft de begroting -- maar de rekening
      is per studie te lezen, en dat is wat een subsidiegever vraagt.

   2. DE DOORBELASTING IS EEN BESLUIT VAN DE FIREWALL EN GEEN OPTELSOM. RTG koopt
      de machines (wereld `rtg-intern`) en het lab hoort bij de stichting
      (`rtfoundation`). Of die eerste de tweede iets in rekening mag brengen,
      beslist kern/economie/firewall.js: zonder relatie met een grondslag EN een
      plafond is het antwoord nee, en dan staat er in dit grootboek geen
      doorbelasting maar de reden waarom er geen is. Het register is standaard
      leeg; dat is geen storing maar het uitgangspunt.

   3. TWEE BOEKEN, EN ZE WORDEN NIET STILZWIJGEND OPGETELD. De begroting van een
      lab is met de hand ingevoerd (kern/livinglab/bestuur.js, budgetZet); het
      verbruik is gemeten. Ze staan naast elkaar met hun herkomst erbij, en het
      verschil draagt de zwakste bewijsgraad van de twee. Een grootboek dat een
      ingetypt bedrag en een gemeten bedrag als hetzelfde soort getal toont, is
      precies hoe een verantwoording onbetrouwbaar wordt.
   ========================================================================== */
'use strict';
const klok = require('../../lib/klok');

const { dragerVanLab, dragerVanStudie, hoortBij, studieVanDrager } = require('./ledgeradres');

function maakLedger(ctx) {
  const kosten = () => (typeof ctx.kosten === 'function' ? ctx.kosten() : ctx.kosten);
  const economie = () => (typeof ctx.economie === 'function' ? ctx.economie() : ctx.economie);
  const labfonds = () => (typeof ctx.labfonds === 'function' ? ctx.labfonds() : ctx.labfonds);
  const vindLab = (id) => ctx.vindLab(id);
  const vindStudie = (id) => ctx.vindStudie(id);
  const periodeNu = () => String(ctx.nu ? ctx.nu() : klok.datum().toISOString()).slice(0, 7);

  /* Het verbruik van één drager, uit de kostenmeter. Er wordt hier niets
     opgeteld dat daar niet al staat: `voorDrager` levert de regels, hun
     bewijsgraad en wat er zonder tarief is gemeten. */
  function verbruikVan(drager, periode) {
    const o = kosten().voorDrager(periode, drager);
    return {
      drager, studie: studieVanDrager(drager),
      regels: o.regels.map(r => ({ soort: r.soort, aantal: r.aantal, eenheid: r.eenheid || null,
        centen: r.millicenten == null ? null : Math.round(r.millicenten / 1000),
        graad: r.graad || 'onbekend',
        reden: r.millicenten == null ? 'Voor deze soort staat geen tarief; dan rekent RTG niets uit in plaats van een nul te tonen.' : null })),
      toegerekend: o.toegerekend,
      totaal: o.totaal, zonderTarief: o.zonderTarief, nietGemeten: o.nietGemeten
    };
  }

  /* Of de stichting deze rekening mag krijgen, is een andere vraag dan wat er
     is verbruikt -- de eerste gaat over de firewall tussen de economische
     werelden, de tweede over de meter. Die eerste woont daarom apart; zie
     ./ledgerdoorbelasting.js. */
  const doorbelasting = require('./ledgerdoorbelasting')(economie);

  /* Het grootboek van één studie. */
  function studieLedger(studieId, periode) {
    const s = vindStudie(studieId);
    if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const lab = vindLab(s.labId);
    const p = periode || periodeNu();
    const v = verbruikVan(dragerVanStudie(s.labId, s.id), p);
    return { ok: true, periode: p,
      lab: lab ? { id: lab.id, naam: lab.naam, stad: lab.stad } : null,
      /* Het onderzoeksnummer staat erbij, want dit is het stuk dat een
         subsidiegever leest: die kent het onderzoek onder zijn nummer en niet
         onder een interne sleutel. */
      studie: { id: s.id, nummer: s.nummer || null, titel: s.titel, soort: s.soort },
      verbruik: v,
      doorbelasting: doorbelasting(v.totaal.centen),
      /* Wat het LAB-FONDS aan dit onderzoek heeft toegezegd. Het staat er als
         DERDE boek naast de begroting en het gemeten verbruik, en wordt er niet
         bij opgeteld: het is toegezegd door leden, niet uitgegeven. Ontbreekt
         het fonds, dan staat er een reden en geen nul. */
      fonds: labfonds() ? labfonds().financiering(s.id)
        : { nietTeZeggen: 'Het Lab-fonds is hier niet beschikbaar.' },
      zegtNiet: ZEGT_NIET };
  }

  /* Het grootboek van een heel lab: het lab zelf plus al zijn studies. De
     studies worden APART getoond en niet alleen opgeteld -- "het lab kostte
     €6.481" is geen verantwoording, "studie 24 kostte €5.904 daarvan" wel. */
  function labLedger(labId, periode) {
    const lab = vindLab(labId);
    if (!lab) return { status: 404, error: 'Dit lab bestaat niet.' };
    const p = periode || periodeNu();
    const alle = kosten().alleDragers(p).filter(r => hoortBij(r.drager, lab.id));
    const perStudie = alle.map(r => {
      const v = verbruikVan(r.drager, p);
      const sid = v.studie;
      const s = sid ? vindStudie(sid) : null;
      return { studie: s ? { id: s.id, nummer: s.nummer || null, titel: s.titel } : null,
        drager: r.drager, centen: v.totaal.centen, graad: v.totaal.graad,
        /* Welke soorten er WEL zijn gemeten maar geen tarief hebben. Zonder deze
           regel leest een nul als "gratis", en dat is een andere bewering dan
           "hiervoor staat geen prijs" (KOSTEN.md par. 1). */
        zonderTarief: v.zonderTarief,
        /* Een drager met een studie-id dat niet meer bestaat, wordt GEMELD en
           niet weggelaten: verbruik dat nergens bij hoort is precies wat een
           controleur wil zien. */
        onbekendeStudie: !!(sid && !s) ? sid : null };
    }).sort((a, b) => b.centen - a.centen);

    const centen = perStudie.reduce((a, r) => a + r.centen, 0);
    const begroting = lab.budget || { toegekend: 0, besteed: 0, bron: '' };
    return { ok: true, periode: p,
      lab: { id: lab.id, naam: lab.naam, stad: lab.stad },
      /* TWEE BOEKEN NAAST ELKAAR, met hun herkomst. Ze worden niet opgeteld en
         niet van elkaar afgetrokken tot een saldo: het ene is ingetypt en het
         andere gemeten, en een saldo van die twee zou een nauwkeurigheid
         suggereren die er niet is. */
      begroting: { toegekendEuro: begroting.toegekend, bestedEuro: begroting.besteed,
        bron: begroting.bron || null, herkomst: 'met de hand ingevoerd door het lab',
        graad: 'onbekend' },
      infrastructuur: { centen, graad: perStudie.length
        ? perStudie.map(r => r.graad).reduce((a, b) => (a === 'vermoed' || b === 'vermoed' ? 'vermoed' : b), 'gemeten')
        : 'onbekend', herkomst: 'gemeten door de kostenmeter (kern/kosten/meter.js)' },
      perStudie,
      doorbelasting: doorbelasting(centen),
      zegtNiet: ZEGT_NIET };
  }

  return { labLedger, studieLedger, verbruikVan, doorbelasting, dragerVanLab, dragerVanStudie, hoortBij };
}

/* Wat dit grootboek NIET zegt. Het staat er even groot bij, want een
   verantwoording die alleen haar eigen getallen toont, leest als volledig. */
const ZEGT_NIET = {
  personeel: 'Loon, uren en inzet van onderzoekers staan hier niet in. Dit grootboek telt wat een studie aan RTG-infrastructuur verbruikte, niet wat zij aan mensen kostte.',
  apparatuur: 'De aanschaf en het onderhoud van meetapparatuur staan in het apparatuurregister van het lab en niet hier.',
  deelnemers: 'Een vergoeding aan deelnemers loopt niet langs deze meter.',
  verdeeld: 'Elektriciteit en serverhuur zijn niet per gebruiker te meten. Wat daarvan bij een studie staat, is een verdeling van de echte nota naar het gemeten verbruik, en draagt daarom de graad "vermoed".'
};

/* De adresfuncties reizen mee naar buiten, zodat een aanroeper er maar EEN
   bestand voor hoeft te kennen. Ze wonen in ./ledgeradres.js. */
module.exports = { maakLedger, dragerVanLab, dragerVanStudie, hoortBij, studieVanDrager, ZEGT_NIET };

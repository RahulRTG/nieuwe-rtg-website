/* DE BEWIJSKETEN VAN DE LOONAANGIFTE: waar komt dit bedrag vandaan, en klopt
   het nog.

   De btw-kant kreeg dit al (kern/fiscaal/herkomst.js) en de loonkant is de
   tweede grote geldstroom van het huis. Dezelfde drie vragen, dezelfde vorm --
   maar met een verschil dat ertoe doet, want de loonkant had al iets.

   WAT ER AL WAS, EN WAT DUS NIET OPNIEUW WORDT GEBOUWD. ./dossier.js beantwoordt
   per medewerker per run de vier vragen: waarom is dit bedrag berekend, welke
   regelversie is gebruikt, is het betaald, is het aangegeven. Dat is de onderste
   helft van de keten en die is er. Wat ontbrak is de weg VAN DE AANGIFTE OMLAAG:
   het collectieve bedrag openvouwen naar de nominatieve regels, en van daaruit
   naar het dossier. Deze module bouwt die brug en verwijst voor het detail naar
   het dossier -- hem hier nog eens verzamelen zou een tweede dossier zijn
   (LAT.md regel 4).

   DRIE DINGEN:

   1. VERKLAREN. Het collectieve bedrag, de nominatieve regels eronder, en per
      medewerker de verwijzing naar zijn dossier.
   2. HERBOUWEN. De aangifte opnieuw opmaken uit de run en cent voor cent
      vergelijken. Met DEZELFDE routine als de aangifte zelf gebruikte
      (`nominatief` uit ./aangifte.js): een herbouw die anders optelt vindt
      altijd een verschil, en dan zegt een verschil niets meer.
   3. WAT DE KETEN ZELF TEGENSPREEKT. Twee controles die bij het opmaken al
      draaiden worden hier OPNIEUW gedaan, en dat is de hele bedoeling: bij het
      opmaken bewijzen ze dat de aangifte goed begon, hier bewijzen ze dat hij
      dat nog steeds is.

        - de optelling van het nominatieve deel MOET het collectieve deel zijn;
        - de ingehouden loonheffing MOET zijn wat er op de stroken staat.

      En een derde die alleen achteraf te stellen is: op welk REGELPAKKET rustte
      de run. Een pakket dat nooit is aangemerkt, of dat zelf meldt dat zijn
      cijfers niet tegen het Handboek zijn gelegd, maakt een aangifte niet
      ongeldig -- maar het is wel het eerste wat een controleur wil weten, en het
      stond nergens naast het bedrag. */
'use strict';

const { nominatief, telOp, RUBRIEKEN } = require('./aangifte');
const { zekerheid } = require('../fiscaal/zekerheid');

function maakPayrollHerkomst({ aangifte: aangifteLaag, run: runLaag, regelpakket, dossier }) {

  /* Het regelpakket waarop de run draaide. Niet "welke versie" -- dat staat al
     op de aangifte -- maar of dat pakket door een mens is aangemerkt en wat het
     over zichzelf zegt. */
  function pakketstand(a) {
    if (!regelpakket || typeof regelpakket.opVersie !== 'function' || !a.regelversie) return null;
    const p = regelpakket.opVersie(a.land, a.regelversie);
    if (!p) return { versie: a.regelversie, gevonden: false,
      let: 'Het regelpakket waarop deze run draaide is niet meer terug te vinden.' };
    return { versie: p.versie, gevonden: true, stand: p.stand,
      goedgekeurdDoor: p.goedgekeurdDoor || null, goedgekeurdOp: p.goedgekeurdOp || null,
      bron: p.bron || null, waarschuwing: p.waarschuwing || null,
      opDemoTabellen: !!p.opDemoTabellen };
  }

  /* De twee controles opnieuw, tegen de primaire bron. Geeft een LIJST
     bevindingen en nooit een boolean: wie iets afkeurt hoort te kunnen zeggen
     wat er niet klopt. Leeg is goed. */
  function bevindingen(a, r) {
    const uit = [];
    const opnieuw = telOp(a.nominatief || []);
    for (const rub of RUBRIEKEN) {
      if (opnieuw[rub] !== (a.totalen || {})[rub])
        uit.push({ soort: 'nominatief-wijkt-af', rubriek: rub,
          nominatief: opnieuw[rub], collectief: (a.totalen || {})[rub],
          let: 'De optelling van het nominatieve deel is niet het collectieve deel. Dit is de aangifte die zichzelf tegenspreekt.' });
    }
    if (r) {
      const opStroken = r.stroken.reduce((s, x) => s + x.strook.loonheffingCenten, 0);
      if (opStroken !== (a.totalen || {}).ingehoudenLoonheffing)
        uit.push({ soort: 'stroken-wijken-af',
          stroken: opStroken, aangifte: (a.totalen || {}).ingehoudenLoonheffing,
          let: 'De aangegeven loonheffing is niet wat er op de loonstroken is ingehouden.' });
    } else {
      uit.push({ soort: 'run-weg', runId: a.runId,
        let: 'De loonrun waar deze aangifte uit komt, is niet meer terug te vinden. Zonder die run is dit bedrag niet te herbouwen.' });
    }
    const pk = pakketstand(a);
    if (pk && pk.gevonden && pk.stand !== 'goedgekeurd')
      uit.push({ soort: 'pakket-ongecontroleerd', versie: pk.versie,
        let: 'De run draaide op een regelpakket dat nog niet door een mens is aangemerkt.' });
    if (pk && pk.waarschuwing)
      uit.push({ soort: 'pakket-waarschuwt', versie: pk.versie, tekst: pk.waarschuwing,
        let: 'Het regelpakket meldt zelf iets over zijn eigen cijfers.' });
    return uit;
  }

  /* ---------- 1. verklaren ---------- */
  function verklaar(aangifteId) {
    const a = aangifteLaag.haalAangifte
      ? aangifteLaag.haalAangifte(String(aangifteId || ''))
      : (aangifteLaag.haal ? aangifteLaag.haal(String(aangifteId || '')) : null);
    if (!a) return { status: 404, error: 'Deze loonaangifte kennen we niet.' };
    const r = runLaag.haal(a.runId);

    /* Per medewerker: het bedrag en de VERWIJZING naar zijn dossier. Bewust
       alleen de verwijzing -- ./dossier.js draagt het antwoord, en dat hier
       inlijven zou betekenen dat er twee plekken zijn waar staat waarom een
       loonbedrag is wat het is. */
    const mensen = (a.nominatief || []).map(n => ({
      staffId: n.staffId, naam: n.naam,
      ingehoudenLoonheffing: n.ingehoudenLoonheffing,
      premiesWerkgever: n.premiesWerkgever, zvwWerkgever: n.zvwWerkgever,
      dossier: { runId: a.runId, staffId: n.staffId }
    }));

    const bev = bevindingen(a, r);
    return { ok: true, id: a.id, code: a.code, periode: a.periode, land: a.land,
      soort: a.soort, stand: a.stand, corrigeert: a.corrigeert || null,
      run: r ? { id: r.id, stand: r.stand, aantal: r.stroken.length } : null,
      collectief: a.totalen, teBetalenCenten: a.teBetalenCenten,
      medewerkers: mensen,
      regelpakket: pakketstand(a),
      sluitAan: bev.length === 0,
      bevindingen: bev,
      zekerheid: zekerheid('loon.aangifte'),
      let: 'Het detail per medewerker -- de rekenstappen, de invoer en het contract -- staat in het loondossier van die run.' };
  }

  /* ---------- 2. herbouwen ---------- */
  /* De aangifte opnieuw opmaken uit de run. Rapporteert en weigert niet: het
     weigeren hoort bij het opmaken (./aangifte.js doet dat), het verantwoorden
     bij het terugkijken. */
  function herbouw(aangifteId) {
    const a = aangifteLaag.haalAangifte
      ? aangifteLaag.haalAangifte(String(aangifteId || ''))
      : (aangifteLaag.haal ? aangifteLaag.haal(String(aangifteId || '')) : null);
    if (!a) return { status: 404, error: 'Deze loonaangifte kennen we niet.' };
    const r = runLaag.haal(a.runId);
    if (!r) return { status: 409, error: 'De loonrun van deze aangifte is niet meer terug te vinden; herbouwen kan niet.' };

    const opnieuw = telOp(nominatief(r));
    const verschillen = RUBRIEKEN
      .filter(rub => opnieuw[rub] !== (a.totalen || {})[rub])
      .map(rub => ({ rubriek: rub, ingediend: (a.totalen || {})[rub], herbouwd: opnieuw[rub] }));
    const teBetalen = opnieuw.ingehoudenLoonheffing + opnieuw.premiesWerkgever + opnieuw.zvwWerkgever;
    const gelijk = verschillen.length === 0 && teBetalen === a.teBetalenCenten;

    return { ok: true, id: a.id, periode: a.periode, stand: a.stand, gelijk,
      ingediend: { totalen: a.totalen, teBetalenCenten: a.teBetalenCenten },
      herbouwd: { totalen: opnieuw, teBetalenCenten: teBetalen },
      verschillen,
      verschilCenten: teBetalen - a.teBetalenCenten,
      zekerheid: zekerheid('loon.herbouw'),
      uitslag: gelijk
        ? 'Herbouwd uit de loonrun: op de cent gelijk aan wat er is aangegeven.'
        : 'Herbouwd uit de loonrun en NIET gelijk aan wat er is aangegeven. Een definitieve run hoort niet meer te veranderen, dus dit vraagt uitleg.' };
  }

  return { payrollHerkomst: { verklaar, herbouw } };
}

module.exports = { maakPayrollHerkomst };

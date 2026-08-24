/* De alleen-lezen kant van de waardelaag: wat heeft dit lid, en wat staat er op
   een positie? Hier komen `save` noch `registreer` binnen -- wie iets uit dit
   bestand aanroept, kan per definitie geen positie wijzigen en geen geld
   verplaatsen. Zelfde scheiding als kern/pay/kijken.js, en om dezelfde reden.

   DE VRAAG "WAT HEEFT DIT LID" IS VERANDERD. Zolang er één wallet was, was het
   antwoord een getal. Sinds er budgetten bestaan, is het een lijst met regels
   erbij: een lid kan 40 euro maaltijdbudget hebben dat vrijdag vervalt en alleen
   in de horeca geldt, en daarnaast 12 euro eigen geld. Die twee optellen tot 52
   beantwoordt de vraag verkeerd -- 52 euro suggereert dat hij voor 52 euro kan
   tanken, en dat kan hij niet.

   Daarom geeft ./portefeuille() de posities náást elkaar, elk met zijn eigen
   plafond, verval en beleid, en daarbovenop twee totalen die eerlijk zijn over
   wat ze betekenen: `vrijBesteedbaar` (wat overal mag) en `gebonden` (wat
   alleen ergens mag). Nooit één getal dat doet alsof het allebei is. */
'use strict';

module.exports = ({ posities, positie, beschikbaar, ruimte, reserve, KLASSEN }) => {

  /* ALLE posities van een lid, met zijn gewone wallet erbij. Die staat er
     altijd bij, ook als er niets op staat: hij bestaat per definitie en een
     lijst zonder hem leest als een storing. */
  function positiesVan(codenaam) {
    const eigen = 'lid:' + codenaam;
    const uit = [eigen];
    for (const [rek, p] of Object.entries(posities())) {
      if (p && p.eigenaar === codenaam && rek !== eigen) uit.push(rek);
    }
    return uit;
  }

  /* Het overzicht van EEN positie: de drie getallen die uit elkaar gehouden
     moeten worden, plus waar hij aan gebonden is. */
  function overzicht(rek, saldo) {
    const p = positie(rek);
    const s = Math.round(Number(saldo) || 0);
    if (!p) return { rek, waardepositie: false, saldo: s };
    return { rek, waardepositie: true, klasse: p.klasse, klasseNaam: p.spec.naam,
      saldo: s, gereserveerd: reserve.vastgezet(rek), beschikbaar: beschikbaar(rek, s),
      plafondCenten: p.spec.plafondCenten,
      ruimte: Number.isFinite(p.spec.plafondCenten) ? Math.max(0, ruimte(rek, s)) : null,
      uitbetaalbaar: p.spec.uitbetaalbaar, overdraagbaar: p.spec.overdraagbaar,
      uitgever: p.uitgever, vervaltOp: p.vervaltOp, beleid: p.beleid, grond: p.spec.grond,
      reserveringen: reserve.open(rek).map(r => ({ id: r.id, centen: r.centen, doel: r.doel, tot: r.tot, door: r.ref })) };
  }

  /* De hele portefeuille van een lid. `saldoVan` komt van de aanroeper (RTG Pay
     houdt de saldi bij, deze laag niet) -- zo blijft er één bron voor het geld
     en één voor de betekenis. */
  function portefeuille(codenaam, saldoVan) {
    const rijen = positiesVan(codenaam).map(rek => overzicht(rek, saldoVan(rek)));
    let vrij = 0, gebonden = 0;
    for (const r of rijen) {
      const spec = KLASSEN[r.klasse];
      if (spec && spec.bestedingsgebied === 'rtg' && !(r.beleid && (r.beleid.genres || r.beleid.venster))) vrij += r.beschikbaar;
      else gebonden += r.beschikbaar;
    }
    /* Twee totalen en met opzet geen derde dat ze optelt. Een getal dat
       "totaal beschikbaar" heet, wordt gelezen als "dit kan ik uitgeven", en
       dat is precies wat gebonden waarde niet is. Wie ze toch bij elkaar wil
       zien, telt ze zelf op en weet dan wat hij doet. */
    return { ok: true, codenaam, posities: rijen, vrijBesteedbaar: vrij, gebonden };
  }

  return { positiesVan, overzicht, portefeuille };
};

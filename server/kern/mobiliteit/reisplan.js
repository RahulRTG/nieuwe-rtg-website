/* Mobility OS (deelmodule): de multimodale reisplanner. Van A naar B als een
   reeks etappes -- lopen, taxi, openbaar vervoer -- met per optie wat het kost,
   hoe lang het duurt, hoe vaak je overstapt en wat het uitstoot.

   DIT IS DE FUNCTIE DIE ANDERE VERVOERSAPPS NIET KUNNEN BOUWEN, en niet omdat
   het algoritme moeilijk is: het is dat de bestemmingen, de lijnen, de taxi's
   en de betaling hier allemaal van hetzelfde huis zijn. "Taxi naar het station,
   trein, taxi naar Sal de Mar" is bij ons EEN reis met EEN afrekening en geen
   drie apps met drie bonnetjes.

   WAT DE PLANNER WEL EN NIET DOET.

   Hij zoekt geen kortste pad door een netwerk met overstappen -- dat vraagt een
   dienstregeling per halte die wij niet hebben, en een planner die overstappen
   verzint op tijden die hij niet kent, stuurt mensen naar een perron waar niets
   komt. Hij doet wat hij WEL kan onderbouwen: per lijn de dichtstbijzijnde
   instap- en uitstaphalte, met de voor- en natransport erbij, en hij vergelijkt
   die met de directe taxi. Dat is precies het geval dat er in de praktijk toe
   doet, en elk getal eronder komt uit onze eigen gegevens.

   EEN OPTIE DIE NIET DEUGT WORDT NIET GETOOND. Een OV-etappe die je verder van
   je bestemming brengt dan je al was, is geen alternatief maar een omweg met
   een prijs eraan. Die valt hier af, met de reden erbij in de afgevallen-lijst,
   zodat een lege lijst nooit als storing hoeft te worden gelezen. */

const OV_MINSTENS_M = 800;        // een OV-etappe korter dan dit is geen reis
const OPTIES_MAX = 4;

module.exports = (ctx) => {
  const { db, schoon, modAan, plekBepaal,
    // de etappe-bouwers komen uit ./reisplan-etappe, dat hiervoor wordt gemount
    LOOP_MAX_M, afst, rond, loopEtappe, taxiEtappe, aanloop, ovEtappe, optieVan, opslag } = ctx;

  /* De planner. `waar` gaat naar het moduleregister: welke vervoersvormen hier
     bestaan bepaalt welke opties er uberhaupt gemaakt worden. */
  function reisPlan(session, body = {}) {
    const van = plekBepaal(body.van, session);
    if (van.error) return { status: 400, error: 'Vertrekpunt: ' + van.error };
    const naar = plekBepaal(body.naar, session);
    if (naar.error) return { status: 400, error: 'Bestemming: ' + naar.error };
    const rechtdoor = afst(van, naar);
    if (rechtdoor < 50) return { status: 400, error: 'Vertrek en bestemming liggen op dezelfde plek.' };

    const waar = { stad: schoon(body.stad, 40) || null, groep: session.tier, key: session.key };
    const magTaxi = modAan('ride_hailing', waar);
    const magOv = modAan('public_transport_planner', waar);

    const opties = [], afgevallen = [];

    // 1. helemaal lopen -- alleen als dat echt kan
    if (rechtdoor <= LOOP_MAX_M)
      opties.push(optieVan('lopen', 'Lopen', [loopEtappe(van, naar)], 'Het is hier vlakbij.'));

    // 2. de directe taxi
    if (magTaxi.aan) opties.push(optieVan('taxi', 'Rechtstreeks met de taxi', [taxiEtappe(van, naar)],
      'Van deur tot deur, zonder overstappen.'));
    else afgevallen.push({ naam: 'Taxi', reden: magTaxi.reden });

    // 3. multimodaal: per lijn de beste instap- en uitstaphalte
    if (!magOv.aan) afgevallen.push({ naam: 'Openbaar vervoer', reden: magOv.reden });
    else {
      for (const zaak of opslag.vreemd.leveranciers() || []) {
        if (zaak.type !== 'ov') continue;
        for (const lijn of zaak.lijnen || []) {
          const haltes = (lijn.haltes || []).filter(h => Number.isFinite(h.lat));
          if (haltes.length < 2) continue;
          const a = [...haltes].sort((x, y) => afst(van, x) - afst(van, y))[0];
          const b = [...haltes].sort((x, y) => afst(naar, x) - afst(naar, y))[0];
          if (!a || !b) continue;
          if (a.id === b.id) {
            // in en uit bij dezelfde halte is geen reis; benoemen, niet stil overslaan
            afgevallen.push({ naam: lijn.naam, reden: 'de dichtstbijzijnde halte is voor heen en terug dezelfde' });
            continue;
          }

          const ovM = afst(a, b);
          if (ovM < OV_MINSTENS_M) {
            afgevallen.push({ naam: lijn.naam, reden: 'de rit over deze lijn is te kort om zinnig te zijn' });
            continue;
          }
          /* De omwegtoets. Kost het voor- en natransport samen al meer dan de
             hele reis rechtdoor, dan brengt het OV je verder van huis. */
          const omweg = afst(van, a) + afst(b, naar);
          if (omweg >= rechtdoor) {
            afgevallen.push({ naam: lijn.naam, reden: 'de haltes liggen zo dat je er een omweg voor maakt' });
            continue;
          }
          const etappes = [];
          const voor = aanloop(van, a);
          if (voor.meters !== 0 || voor.km) etappes.push(voor);
          etappes.push(ovEtappe(zaak, lijn, a, b, waar));
          const na = aanloop(b, naar);
          if (na.meters !== 0 || na.km) etappes.push(na);

          const soorten = [...new Set(etappes.map(e => e.wijze))];
          opties.push(optieVan('ov-' + zaak.code + '-' + lijn.id,
            soorten.length > 1 ? 'Met ' + lijn.naam + ' en voor- en natransport' : 'Met ' + lijn.naam,
            etappes, 'Instappen bij ' + a.naam + ', uitstappen bij ' + b.naam + '.'));
        }
      }
    }

    if (!opties.length)
      return { ok: true, van, naar, opties: [], afgevallen,
        reden: 'Er is hier geen vervoer beschikbaar waarmee deze reis te maken is.' };

    /* Rangschikken op tijd, want dat is waar de meeste mensen op kiezen -- maar
       de goedkoopste en de schoonste worden apart AANGEWEZEN, zodat wie daarop
       let hem niet hoeft te zoeken. Er is bewust geen "beste": dat is een
       oordeel over andermans afweging. */
    opties.sort((x, y) => x.totaal.minuten - y.totaal.minuten);
    const kort = opties.slice(0, OPTIES_MAX);
    const goedkoopst = kort.reduce((a, b) => b.totaal.prijs < a.totaal.prijs ? b : a, kort[0]);
    const schoonst = kort.reduce((a, b) => b.totaal.co2Gram < a.totaal.co2Gram ? b : a, kort[0]);
    for (const o of kort) {
      o.snelst = o.id === kort[0].id;
      o.goedkoopst = o.id === goedkoopst.id;
      o.schoonst = o.id === schoonst.id;
    }
    return { ok: true, van, naar, rechtdoorKm: rond(rechtdoor / 1000, 1), opties: kort, afgevallen };
  }

  return { reisPlan, OV_MINSTENS_M };
};

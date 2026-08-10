/* RTG Evening OS: HET AANVRAGEN -- van plan naar werkelijkheid, per stap.

   Dit is de plek waar de avondplanner het meest kan liegen, dus staat hij hier
   apart met zijn eigen regels. Elke soort stap gaat naar het domein dat hem
   bezit, en wat dat domein antwoordt komt ONGEWIJZIGD op de stap te staan.

   HET VERSCHIL TUSSEN AANGEVRAAGD EN BEVESTIGD IS GEEN WOORDKEUS.
   - Een TAFEL wordt aangevraagd: het lid vraagt, de zaak beslist. Die regel
     stond al in de reserveringslaag en de planner mag hem niet omzeilen.
   - Een RIT wordt bevestigd: daar beslist niemand meer over: de mobiliteitskern
     boekt hem en er komt een chauffeur. Dat mag dus wél groen.
   Twee soorten die er hetzelfde uitzien in een lijstje en volstrekt verschillen
   in wat je ervan mag verwachten.

   EN DE TERUGREIS. "Naar huis" is de enige stap waarvoor de planner iets moet
   weten wat hij niet heeft: waar je woont. Dat staat in de kluis achter de
   gegevenspoort en hoort daar te blijven. De mobiliteitskern kent wél
   FAVORIETE PLEKKEN die het lid zelf heeft opgeslagen, en dat is precies de
   goede haak: heb je er een, dan plant de avond je terugreis; heb je er geen,
   dan zegt hij dat en waar je hem zet. Een adres uit de kluis trekken omdat het
   toevallig handig is, is precies wat privacy by design moet voorkomen. */
'use strict';

module.exports = ({ planlaag, schoon }) => {

  /* Waar begint en eindigt deze vervoersstap? Uit de BUREN in het plan: de zaak
     ervoor en de zaak erna. Staat er niets na, dan is het de terugreis. */
  function vanNaar(avond, index, thuisFav) {
    const ervoor = avond.stappen.slice(0, index).reverse().find(s => s.zaak);
    const erna = avond.stappen.slice(index + 1).find(s => s.zaak);
    if (!ervoor) return { fout: 'Deze rit heeft geen vertrekpunt: er staat geen zaak voor in het plan.' };
    if (erna) return { van: { zaak: ervoor.zaak }, naar: { zaak: erna.zaak }, soort: 'tussen' };
    if (thuisFav) return { van: { zaak: ervoor.zaak }, naar: { favoriet: thuisFav.id }, soort: 'thuis', naam: thuisFav.naam };
    return { fout: 'Voor de terugreis weet ik niet waar je heen wilt. Zet je thuisadres als favoriete plek in RTG OV; ' +
      'dan plant de avond hem mee. Uit de kluis halen doen we niet.' , code: 'geen-thuis' };
  }

  /* De goedkoopste optie die binnen de ruimte past. Bewust de goedkoopste en
     niet de snelste: het budget is een grens die de gast heeft gesteld, de
     snelheid is een voorkeur die hij niet heeft uitgesproken. Past er niets,
     dan wordt er niets geboekt en zegt het antwoord wat het goedkoopste kostte. */
  /* De prijs van een reisoptie zit in `optie.totaal.prijs` EN IN CENTEN.
     `totaal` is een object (minuten, prijs, km, co2) en geen getal -- ik nam
     eerst aan dat het een bedrag was, en dan is `optie.totaal <= ruimte` altijd
     onwaar en toont de weigering "de goedkoopste rit kost € NaN" aan een gast.
     Nagekeken in de bron: reisplan-etappe.js optieVan(), en het tarief in
     opdracht.js staat in centen (basis 350 = drie vijftig). */
  const prijsVan = (o) => {
    const p = o && o.totaal && Number(o.totaal.prijs);
    return Number.isFinite(p) ? p : null;
  };

  function kiesOptie(opties, ruimteCenten) {
    const met = (opties || []).map(o => ({ o, prijs: prijsVan(o) })).filter(x => x.prijs != null);
    if (!met.length) return { fout: 'Er is geen vervoer met een bekende prijs gevonden tussen deze twee plekken.' };
    met.sort((a, b) => a.prijs - b.prijs);
    if (ruimteCenten == null) return { optie: met[0].o, prijs: met[0].prijs };
    const past = met.find(x => x.prijs <= ruimteCenten);
    if (!past) return { fout: 'De goedkoopste rit kost € ' + (met[0].prijs / 100).toFixed(2) +
      ' en er is nog € ' + (ruimteCenten / 100).toFixed(2) + ' ruimte in je budget.', code: 'budget' };
    return { optie: past.o, prijs: past.prijs };
  }

  /* Eén vervoersstap aanvragen. `mob` is de mobiliteitskern (reisPlan,
     reisBoek, favsVan); die wordt doorgegeven en niet hier vastgepakt, want hij
     hoort bij een ander domein. */
  async function vervoerStap(key, session, avond, stap, index, mob) {
    if (!mob || !mob.reisPlan || !mob.reisBoek) {
      return { staat: 'voorstel', reden: 'De vervoerskern draait niet mee in dit proces; vraag de rit in RTG OV aan.' };
    }
    /* De favorieten komen via `favLijst(session)` en niet via een eigen
       lookup: dat is de bestaande weg van de mobiliteitskern, inclusief de
       regel dat alleen het lid zelf ze kan lezen. */
    const favs = (mob.favLijst ? (mob.favLijst(session) || {}).favorieten : null) || [];
    const thuis = favs.find(f => /thuis|home|huis/i.test(String(f.naam || '')));
    const plek = vanNaar(avond, index, thuis);
    if (plek.fout) return { staat: 'voorstel', reden: plek.fout, code: plek.code || null };

    const plan = mob.reisPlan(session, { van: plek.van, naar: plek.naar });
    if (plan.error) return { staat: 'mislukt', reden: plan.error };

    const g = planlaag.budget(avond.stappen, { plafondPP: avond.plafondPP, personen: avond.personen });
    const keuze = kiesOptie(plan.opties, g.ruimtePP);
    if (keuze.fout) return { staat: 'voorstel', reden: keuze.fout, code: keuze.code || null };

    const geboekt = await mob.reisBoek(session, { van: plek.van, naar: plek.naar, optie: keuze.optie.id });
    if (geboekt && geboekt.error) return { staat: 'mislukt', reden: geboekt.error };

    /* Een rit is ECHT geboekt: er komt een chauffeur en niemand hoeft er nog
       over te beslissen. Dit mag dus wel op bevestigd, anders dan een tafel. */
    return {
      staat: 'bevestigd', domein: 'mobiliteit',
      id: (geboekt && (geboekt.reis && geboekt.reis.id)) || (geboekt && geboekt.id) || null,
      reden: 'Geboekt: ' + (keuze.optie.naam || 'vervoer') +
        (plek.soort === 'thuis' ? ' naar ' + (plek.naam || 'huis') : ''),
      centenPP: keuze.prijs
    };
  }

  return { vanNaar, kiesOptie, vervoerStap };
};

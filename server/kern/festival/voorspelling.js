/* RTG Festival (deelmodule): DE VOORSPELLING. Het gat voordat het er is.

   TWEE DINGEN, EN ALLEBEI REKENWERK OP GETALLEN DIE ER AL STAAN:

     1. BEMENSING -- wat er volgens de norm hoort te staan (./norm.js), tegen
        wat er volgens het rooster staat (./dienst.js). Het verschil is een gat,
        en een gat om 21:00 dat je om 20:00 ziet is een ander ding dan een gat
        dat je om 21:00 ontdekt.
     2. LEEGLOPEN -- hoe lang het duurt voor het terrein leeg is, uit de gemeten
        aanwezigheid en de doorstroom van de uitgangen. Past dat niet meer voor
        sluitingstijd, dan is dat te weten voordat de laatste band opgaat.

   ER WORDT NIETS GESCHAT. Geen bezoekersprognose, geen weerinvloed, geen
   verwacht drankgebruik. Elk getal hieronder komt uit een meting (de scans) of
   uit een norm die een mens heeft gezet, en waar er een ontbreekt, staat er
   geen getal maar een zin (LAT-regel 3).

   EEN DIENST BEMENST DE PLEK WAAROP HIJ STAAT, en niets anders. Een dienst op
   de zone bemenst de bar in die zone dus niet. Dat is streng en het is met
   opzet: de andere kant op zou een rooster met tien man op "het terrein" elke
   bar, elk toilet en elke poort tegelijk bemand laten lijken.

   DE NOODUITGANGEN TELLEN NIET MEE IN HET LEEGLOPEN. Die zijn er voor een
   ontruiming, niet voor het uitstromen na de laatste act. Ze meerekenen maakt
   het getal mooier en de avond gevaarlijker. */
'use strict';

module.exports = (ctx) => {
  const { editieVind, dagVind, offset, duurVan, bezetting, vraagOp,
    dienstenVan, PLEK_SOORTEN } = ctx;

  const HORIZON = 60;
  const min = (n) => n + (n === 1 ? ' minuut' : ' minuten');

  /* Hoeveel mensen staan er op deze plek op dit moment volgens het rooster. */
  function bemand(diensten, dag, plekId, moment) {
    let n = 0;
    for (const d of diensten) {
      if (d.plek !== plekId) continue;
      const van = offset(dag, d.van), tot = offset(dag, d.tot);
      if (van === null || tot === null) continue;
      if (van <= moment && moment < tot) n++;
    }
    return n;
  }

  /* De gaten op een moment: per norm over MENSEN het verschil tussen wat er
     hoort te staan en wat er staat. Andere eenheden (bekers, bakken ijs) horen
     hier niet: die staan in de vraag en er is geen rooster om ze tegen af te
     zetten -- die worden klaargezet, niet ingeroosterd. */
  function bemensing(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const dag = dagVind(e, v.dag);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const nu = offset(dag, String(v.tijd || ''));
    if (nu === null) return { status: 400, error: 'Dat moment valt buiten deze dag.' };
    const vooruit = Math.max(0, Math.min(240, parseInt(v.vooruit, 10) || 0));

    const gevraagd = vraagOp(fid, eid, { dag: dag.id, tijd: v.tijd, vooruit });
    if (!gevraagd.ok) return gevraagd;
    const rooster = dienstenVan(fid, eid, dag.id);
    if (!rooster.ok) return rooster;

    const uit = [];
    for (const r of gevraagd.vraag) {
      if (r.wat !== 'mensen') continue;
      const staat = bemand(rooster.diensten, dag, r.plek, gevraagd.moment);
      if (staat >= r.nodig) continue;
      uit.push({ plek: r.plek, plekNaam: r.plekNaam, nodig: r.nodig, staat,
        gat: r.nodig - staat, over: gevraagd.moment - nu, gemetenOp: r.gemetenOp,
        aanwezig: r.aanwezig });
    }
    uit.sort((a, b) => b.gat - a.gat);
    return { ok: true, dag: dag.id, moment: gevraagd.moment, gaten: uit };
  }

  /* HET LEEGLOPEN. Aanwezig gedeeld door de doorstroom per minuut. */
  function leegloop(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const v = vraag || {};
    const dag = dagVind(e, v.dag);
    if (!dag) return { status: 404, error: 'Deze dag staat niet in de editie.' };
    const nu = offset(dag, String(v.tijd || ''));
    if (nu === null) return { status: 400, error: 'Dat moment valt buiten deze dag.' };

    const uitgangen = Object.values(e.plekken || {})
      .filter(p => (PLEK_SOORTEN[p.soort] || {}).poort && p.soort !== 'nooduitgang' && p.doorstroom > 0)
      .map(p => ({ id: p.id, naam: p.naam, soort: p.soort, doorstroom: p.doorstroom }));
    const perUur = uitgangen.reduce((n, p) => n + p.doorstroom, 0);

    const tel = bezetting(fid, eid, dag.id);
    if (!tel.ok) return tel;
    const wortels = tel.plekken.filter(p => !p.ouder);
    const aanwezig = wortels.reduce((n, p) => n + p.aanwezig, 0);
    const gemeten = wortels.length > 0;

    /* De tijd die er nog is: tot de curfew als die er staat, anders tot
       sluitingstijd. De curfew is het moment waarop de muziek uit moet, en dat
       is het moment waarop het uitstromen begint. */
    const eind = dag.curfew ? offset(dag, dag.curfew) : duurVan(dag);
    const rest = eind === null ? null : eind - nu;

    if (!perUur) {
      return { ok: true, dag: dag.id, bekend: false, aanwezig: gemeten ? aanwezig : null, rest,
        zin: 'Er staat bij geen enkele uitgang een doorstroom, dus hoe lang het leeglopen duurt valt niet te rekenen.' };
    }
    if (!gemeten) {
      return { ok: true, dag: dag.id, bekend: false, aanwezig: null, rest, perUur,
        zin: 'Er wordt op deze dag nog niemand geteld, dus er valt niets leeg te laten lopen.' };
    }
    const minuten = Math.ceil(aanwezig / (perUur / 60));
    return { ok: true, dag: dag.id, bekend: true, aanwezig, perUur, minuten, rest,
      uitgangen, past: rest === null ? null : minuten <= rest,
      zin: aanwezig + ' aanwezig, ' + perUur + ' per uur door ' + uitgangen.length
        + (uitgangen.length === 1 ? ' uitgang' : ' uitgangen') + ': ' + min(minuten) + ' leeglopen.' };
  }

  /* De signalen voor ./uitzondering.js, in dezelfde vorm als de rest. */
  function vooruitSignalen(fid, eid, vraag) {
    const v = vraag || {};
    const horizon = Math.max(5, Math.min(240, parseInt(v.vooruit, 10) || HORIZON));
    const uit = [];

    const nuGaten = bemensing(fid, eid, { dag: v.dag, tijd: v.tijd, vooruit: 0 });
    if (!nuGaten.ok) return nuGaten;
    const straks = bemensing(fid, eid, { dag: v.dag, tijd: v.tijd, vooruit: horizon });
    const alGemeld = new Set();

    for (const g of nuGaten.gaten) {
      alGemeld.add(g.plek);
      uit.push({ bron: 'bemensing', naam: g.plekNaam, ernst: 'hoog', over: 0,
        zin: g.plekNaam + ': ' + g.staat + ' van de ' + g.nodig + ' mensen die er horen te staan.',
        herkomst: { plek: g.plek, gat: g.gat } });
    }
    if (straks.ok) for (const g of straks.gaten) {
      /* Een plek die nu al een gat heeft, wordt niet nog een keer gemeld met
         "over een uur ook". Dezelfde plek twee keer op de lijst maakt van een
         cockpit een logboek. */
      if (alGemeld.has(g.plek)) continue;
      uit.push({ bron: 'bemensing', naam: g.plekNaam, ernst: 'aandacht', over: g.over,
        zin: g.plekNaam + ' staat over ' + min(g.over) + ' op ' + g.staat
          + ' van de ' + g.nodig + '.',
        herkomst: { plek: g.plek, gat: g.gat } });
    }

    const leeg = leegloop(fid, eid, { dag: v.dag, tijd: v.tijd });
    if (leeg.ok && leeg.bekend && leeg.past === false) {
      uit.push({ bron: 'leegloop', naam: 'Uitstroom', ernst: 'hoog', over: leeg.rest,
        zin: 'Leeglopen duurt ' + min(leeg.minuten) + ' en er is nog ' + min(leeg.rest) + '.',
        herkomst: { aanwezig: leeg.aanwezig, perUur: leeg.perUur } });
    }
    return { ok: true, signalen: uit };
  }

  return { bemensing, leegloop, vooruitSignalen };
};

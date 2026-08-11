/* SERVICEDOELEN EN FOUTBUDGET -- niveau 5 (Prevent) op de meetkant.

   SLO.md zegt sinds de eerste dag wat de doelen zijn. Wat er niet stond, is een
   laag die BIJHOUDT hoeveel budget er nog over is, en dat is precies het deel
   waar een foutbudget zijn hele nut aan ontleent: het maakt de afweging tussen
   snelheid en stabiliteit een cijfer in plaats van een discussie. Een SLO zonder
   budgetstand is een rapportcijfer achteraf.

   DRIE DINGEN DIE DEZE METER NIET DOET, en dat is de kern ervan:

   1. HIJ ZEGT NIET "GEHAALD" ALS HIJ TE WEINIG HEEFT GEZIEN. De tellers in
      server/meting.js beginnen bij elke herstart op nul. Een vers proces met
      drie verzoeken en nul fouten staat op 100,000% beschikbaar, en dat als
      "doel gehaald" tonen is de duurste leugen die dit scherm kan vertellen.
      Daarom heeft elk doel een oordeel 'onvoldoende gemeten' zolang er te
      weinig verzoeken zijn of het gemeten venster te klein is naast het
      afgesproken venster, en dat oordeel is geen tussenstand maar de uitslag.

   2. HIJ VERZINT GEEN EXACTE PERCENTIELEN. De duur zit in een histogram met
      vaste emmers (dat is een bewuste keuze, zie meting.js). Daar komt een
      BOVENGRENS uit en geen punt: "p90 ligt op of onder 0,25 s". Dat is minder
      mooi dan een kommagetal en het is het enige wat waar is.

   3. HIJ HAALT DE DOELEN NIET UIT ZICHZELF. Ze staan in SLO.json, en SLO.md
      krijgt zijn tabel daaruit geschreven (scripts/slo.js). Eén waarheid, twee
      afdrukken -- want een norm die op twee plaatsen staat, staat er binnen een
      maand twee keer anders.

   BINNEN EN BUITEN STAAN APART. Alles wat meting.js telt, telt de app over
   zichzelf. Ligt de app plat, dan telt er niets, en dan ziet de grafiek er
   prima uit. De sonde (./sonde.js) klopt van buiten aan; die cijfers staan hier
   naast de interne en worden er nooit mee opgeteld. */
'use strict';

const fs = require('fs');
const path = require('path');

const BESTAND = path.join(__dirname, '..', '..', '..', 'SLO.json');

/* Ontbreekt het bestand, dan gaat de meter NIET stilletjes op nul staan. Een
   SLO-scherm dat "geen doelen" toont omdat een bestand kwijt is, leest als
   "niets te melden". Zelfde keuze als in opzet/domeingrens.js. */
let onthouden = null;

function laadNorm() {
  try {
    /* Onthouden op de wijzigingstijd, niet op "een keer geladen": wie SLO.json
       aanpast wil dat het scherm dat toont zonder herstart, en wie het scherm
       ververst wil geen bestandslezing per reis. */
    const st = fs.statSync(BESTAND);
    if (onthouden && onthouden.mtimeMs === st.mtimeMs) return onthouden.norm;
    const n = JSON.parse(fs.readFileSync(BESTAND, 'utf8'));
    if (!Array.isArray(n.doelen) || !n.doelen.length) throw new Error('geen doelen');
    onthouden = { mtimeMs: st.mtimeMs, norm: n };
    return n;
  } catch (e) {
    throw new Error('slo: SLO.json is er niet of onleesbaar (' + e.message + '). ' +
      'Dat is de bron van de servicedoelen; zonder dat bestand is er geen norm om aan te meten.');
  }
}

const DAG = 86400000;

/* Past deze reeks bij dit doel? De keuze staat in SLO.json en niet hier, zodat
   een nieuw doel een regel gegevens is en geen tak code. */
function past(kies, reeks) {
  if (!kies) return false;
  if (Array.isArray(kies.methoden) && !kies.methoden.includes(reeks.methode)) return false;
  if (kies.routeBegintMet) return String(reeks.route).startsWith(kies.routeBegintMet);
  if (kies.route && kies.route !== '*') return reeks.route === kies.route;
  return true;
}

/* Het kwantiel uit een histogram: de kleinste emmer waar het aandeel gehaald
   wordt. Uitkomst is een bovengrens, en het antwoord zegt dat er ook bij. */
function kwantielGrens(emmers, opgeteld, aantal, q) {
  if (!aantal) return null;
  const doel = aantal * q;
  for (let i = 0; i < emmers.length; i++) if (opgeteld[i] >= doel) return emmers[i];
  return null;  // boven de grootste emmer: onbekend hoe ver
}

function maakSlo({ meting, sonde }) {
  /* Elk doel apart, met zijn eigen venster en zijn eigen oordeel. */
  function doelStand(norm, doel, r, nu) {
    const vensterMs = (doel.vensterDagen || 30) * DAG;
    const gemetenMs = Math.max(0, nu - r.gestart);
    const dekking = Math.min(1, gemetenMs / vensterMs);
    const uit = {
      id: doel.id, naam: doel.naam, meet: doel.meet, waarom: doel.waarom,
      streef: doel.streef, eenheid: doel.eenheid || '%', soort: doel.soort,
      venster: { dagen: doel.vensterDagen || 30, gemetenSeconden: Math.round(gemetenMs / 1000),
        dekking: Number(dekking.toFixed(4)) }
    };

    if (doel.soort === 'snelheid') {
      const emmers = r.emmers;
      const opgeteld = new Array(emmers.length).fill(0);
      let aantal = 0;
      for (const d of r.duur) {
        if (!past(doel.kies, d)) continue;
        aantal += d.aantal;
        for (let i = 0; i < emmers.length; i++) opgeteld[i] += d.emmers[i];
      }
      const grens = kwantielGrens(emmers, opgeteld, aantal, doel.kwantiel || 0.9);
      uit.metingen = aantal;
      uit.gemeten = grens;
      uit.genoeg = aantal >= norm.minimumVerzoeken && dekking >= norm.minimumDekking;
      uit.oordeel = !uit.genoeg ? 'onvoldoende gemeten'
        : grens === null ? 'niet gehaald'
        : (grens <= doel.streef ? 'gehaald' : 'niet gehaald');
      uit.uitleg = grens === null
        ? (aantal ? 'het percentiel ligt boven de grootste emmer van het histogram, dus verder dan ' +
            emmers[emmers.length - 1] + ' s' : 'nog niets gemeten op deze selectie')
        : 'p' + Math.round((doel.kwantiel || 0.9) * 100) + ' ligt op of onder ' + grens +
          ' s (een histogram geeft een bovengrens, geen punt)';
      return uit;
    }

    let totaal = 0, fout = 0;
    for (const v of r.verzoeken) {
      if (!past(doel.kies, v)) continue;
      totaal += v.aantal;
      if (v.status === '5xx') fout += v.aantal;
    }
    const toegestaan = (100 - doel.streef) / 100;
    const werkelijk = totaal ? fout / totaal : 0;
    const budgetMin = (doel.vensterDagen || 30) * 24 * 60 * toegestaan;
    const verbruikt = toegestaan ? werkelijk / toegestaan : 0;

    uit.metingen = totaal;
    uit.fouten = fout;
    uit.gemeten = totaal ? Number(((1 - werkelijk) * 100).toFixed(4)) : null;
    uit.genoeg = totaal >= norm.minimumVerzoeken && dekking >= norm.minimumDekking;
    uit.oordeel = !uit.genoeg ? 'onvoldoende gemeten' : (werkelijk <= toegestaan ? 'gehaald' : 'niet gehaald');
    uit.budget = {
      totaalMinuten: Number(budgetMin.toFixed(1)),
      verbruiktDeel: Number(verbruikt.toFixed(4)),
      restMinuten: Number((budgetMin * (1 - verbruikt)).toFixed(1)),
      restDeel: Number((1 - verbruikt).toFixed(4)),
      op: uit.genoeg && verbruikt >= 1
    };
    /* De brandsnelheid: hoe snel het budget opgaat ten opzichte van het tempo
       waarop het precies genoeg zou zijn. Boven de 1 is het budget op voordat
       het venster om is. */
    uit.brandsnelheid = Number(verbruikt.toFixed(3));
    uit.uitleg = !totaal ? 'geen enkel verzoek op deze selectie gemeten'
      : fout + ' van ' + totaal + ' verzoeken gaf een 5xx; het budget is ' +
        Number(budgetMin.toFixed(0)) + ' minuten per ' + (doel.vensterDagen || 30) + ' dagen';
    return uit;
  }

  function stand(nu) {
    const norm = laadNorm();
    const r = meting.reeksen();
    const t = typeof nu === 'number' ? nu : Date.now();
    const doelen = norm.doelen.map(d => doelStand(norm, d, r, t));

    const beoordeeld = doelen.filter(d => d.genoeg);
    const gezakt = beoordeeld.filter(d => d.oordeel === 'niet gehaald');
    const budgetOp = beoordeeld.filter(d => d.budget && d.budget.op);

    /* Het uitrolslot. Dit is de hele reden dat een foutbudget bestaat: zolang
       er budget over is mag er uitgerold worden, is het op dan gaat de aandacht
       naar stabiliteit. Onvoldoende gemeten is hier BEWUST geen slot -- anders
       kan er na elke herstart een dag lang niets uit, en dan wordt de meter
       omzeild in plaats van gebruikt. Het staat wel in het antwoord. */
    const uitrol = {
      mag: budgetOp.length === 0,
      reden: budgetOp.length
        ? 'het foutbudget van ' + budgetOp.map(d => d.naam).join(' en ') + ' is op'
        : (beoordeeld.length ? 'er is nog foutbudget over op elk beoordeeld doel'
          : 'er is nog geen doel voldoende gemeten om iets tegen te houden'),
      onbeoordeeld: doelen.length - beoordeeld.length
    };

    return {
      doelen, uitrol,
      tel: { doelen: doelen.length, gehaald: beoordeeld.filter(d => d.oordeel === 'gehaald').length,
        gezakt: gezakt.length, onvoldoende: doelen.length - beoordeeld.length },
      bron: {
        binnen: 'server/meting.js telt sinds de start van dit proces; bij een herstart begint dat opnieuw',
        buiten: sonde ? sonde.buitenkort() : null
      },
      norm: { vastgelegd: norm.vastgelegd, minimumVerzoeken: norm.minimumVerzoeken,
        minimumDekking: norm.minimumDekking, bestand: 'SLO.json' }
    };
  }

  return { stand, laadNorm, past, kwantielGrens };
}

module.exports = { maakSlo, laadNorm, past, kwantielGrens, BESTAND };

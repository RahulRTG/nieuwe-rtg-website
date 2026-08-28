/* WAT IS ER VERSCHULDIGD, EN WANNEER -- de rekenkant van een contract.

   ../contract.js is een TOESTANDSMACHINE: concept, aangeboden, geaccepteerd,
   actief, opzeggend, geeindigd, en de overgangen die daartussen mogen. Dit
   bestand is iets anders en hoort daarom niet in hetzelfde bestand: het rekent.
   Gegeven een contract en een datum -- is er dan iets verschuldigd, hoeveel, en
   de hoeveelste termijn is dat?

   DE TWEE FOUTEN DIE HIER ZIJN GEMAAKT staan er nog bij, want ze zijn allebei
   het soort dat er weer in sluipt:

   1. DERTIEN TERMIJNEN IN EEN JAARCONTRACT. `if (d > grens)` moest `>=` zijn:
      start plus twaalf maanden is het BEGIN van maand dertien, niet het einde
      van maand twaalf.
   2. EEN VERPLICHTING ZONDER EINDE. `verplichtingOp` keek alleen naar
      `eindigtOp`, dus een actief contract bleef eeuwig termijnen opleveren --
      "genereer oneindig veel termijnen", precies wat het moest oplossen, alleen
      met meer stappen ertussen. De grens van de VERBINTENIS moest erbij, met
      stilzwijgende verlenging als enige uitzondering.

   DATUMREKENEN GAAT OP MAANDBASIS EN NIET OP DAGEN. Een maandbijdrage die op de
   31e begint, hoort in februari niet op 3 maart te vallen. */
'use strict';

/* Datumrekenen op maandbasis. Bewust met Date en niet met "30 dagen": een
   maandbijdrage die op de 31e begint, hoort in februari niet op de 3e maart te
   vallen. `plusMaanden` klemt op de laatste dag van de doelmaand. */
function plusMaanden(iso, n) {
  const d = new Date(iso);
  const dag = d.getUTCDate();
  const doel = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const laatste = new Date(Date.UTC(doel.getUTCFullYear(), doel.getUTCMonth() + 1, 0)).getUTCDate();
  doel.setUTCDate(Math.min(dag, laatste));
  doel.setUTCHours(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return doel.toISOString();
}
const perMaand = f => (f === 'jaar' ? 12 : f === 'kwartaal' ? 3 : 1);

/* De rekenkant krijgt de begrippen van de toestandsmachine MEE en kent ze niet
   zelf: welke statussen lopen, wat stilzwijgend betekent, hoe je bij de rij
   komt. Zou dit bestand die tabellen kopieren, dan staan ze op twee plekken en
   lopen ze een keer uiteen -- dat is precies hoe kern/thuis/zakelijk.js aan een
   eigen commissie van 10 procent kwam. */
function maakVerplichting({ LOPEND, VERLENGING, STATUS, rij, tijd }) {
  /* ---------- de billing engine ----------
     De vraag die per periode gesteld wordt. Geeft de verplichting terug, of null
     met de reden erbij -- "er is niets" en "we weten het niet" zijn niet
     hetzelfde. */
  function verplichtingOp(c, datumIso) {
    if (!c) return { verschuldigd: false, reden: 'geen contract' };
    if (!LOPEND.has(c.status)) return { verschuldigd: false, reden: 'contract staat op ' + c.status };
    if (!Number.isFinite(c.afgesprokenCenten)) return { verschuldigd: false, reden: 'geen afgesproken bedrag' };
    const d = new Date(datumIso);
    if (d < new Date(c.startAt)) return { verschuldigd: false, reden: 'voor de startdatum' };
    if (c.eindigtOp && d >= new Date(c.eindigtOp)) return { verschuldigd: false, reden: 'na de einddatum' };

    /* DE GRENS VAN DE VERBINTENIS. Zonder deze regel zegt de billing engine ook
       ja tegen maand 13 van een contract dat nooit is verlengd -- en dan is dit
       bestand alsnog "genereer oneindig veel termijnen", alleen met meer stappen
       ertussen. Precies het probleem dat het moest oplossen.

       Bij STILZWIJGENDE verlenging loopt het door zonder dat iemand iets doet;
       dat is de betekenis van stilzwijgend. Bij OPZEGBAAR moet er een besluit
       zijn (verleng()), en dat besluit verhoogt `periode`, waardoor
       eindeVerbintenis vanzelf opschuift. */
    if (c.verlenging !== VERLENGING.STILZWIJGEND && d >= new Date(eindeVerbintenis(c)))
      return { verschuldigd: false, reden: 'na het einde van de verbintenis; nog niet verlengd' };

    // valt deze datum op een termijngrens?
    const stap = perMaand(c.frequentie);
    let n = 0, wanneer = c.startAt;
    while (new Date(wanneer) < d) { n += stap; wanneer = plusMaanden(c.startAt, n); }
    if (new Date(wanneer).getTime() !== d.getTime())
      return { verschuldigd: false, reden: 'geen termijndatum' };

    return { verschuldigd: true, centen: c.afgesprokenCenten * stap,
      maandCenten: c.afgesprokenCenten, termijn: n / stap + 1, vervalt: wanneer };
  }

  /* De termijnen tussen twee datums. Dit is wat het betaalschema gebruikt in
     plaats van "maak er twaalf". Loopt het contract door, dan komen er vanzelf
     meer; is het opgezegd, dan houdt het op de einddatum op. */
  function termijnenTussen(c, vanIso, totIso) {
    const uit = [];
    if (!c || !Number.isFinite(c.afgesprokenCenten)) return uit;
    const stap = perMaand(c.frequentie);
    const grens = new Date(totIso);
    for (let n = 0, i = 1; i <= 600; n += stap, i++) {
      const wanneer = plusMaanden(c.startAt, n);
      const d = new Date(wanneer);
      /* `>=` en niet `>`: de einddatum van een verbintenis is de eerste dag NA
         de termijn (start + 12 maanden is het begin van maand 13). Met `>` komt
         die dag er als dertiende termijn bij -- en dan telt een jaarcontract
         dertien maanden. */
      if (d >= grens) break;
      if (vanIso && d < new Date(vanIso)) continue;
      if (c.eindigtOp && d >= new Date(c.eindigtOp)) break;
      uit.push({ termijn: i, vervalt: wanneer, centen: c.afgesprokenCenten * stap, periode: c.periode });
    }
    return uit;
  }

  /* Het einde van de huidige verbintenis: startdatum plus minimumtermijn maal
     het aantal doorlopen periodes. */
  function eindeVerbintenis(c) {
    return c ? plusMaanden(c.startAt, c.minimumMaanden * (c.periode || 1)) : null;
  }

  /* Loopt de minimumtermijn af binnen `dagen`? Dit is wat een ronde zou vragen
     om VERLENGBAAR te zetten. De ronde zelf bestaat nog niet; de vraag wel. */
  function verlooptBinnen(dagen, nuIso) {
    const nuT = new Date(nuIso || new Date(tijd()).toISOString()).getTime();
    const grens = nuT + Math.max(0, dagen) * 86400000;
    return rij().filter(c => c.status === STATUS.ACTIEF)
      .filter(c => { const e = new Date(eindeVerbintenis(c)).getTime(); return e >= nuT && e <= grens; });
  }

  return { verplichtingOp, termijnenTussen, eindeVerbintenis, verlooptBinnen };
}

module.exports = { plusMaanden, perMaand, maakVerplichting };

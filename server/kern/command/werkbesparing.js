/* HET WERKBESPARINGSBORD -- hoeveel handwerk kost RTG per duizend handelingen,
   en waar zit het volgende lek?

   DIT IS DE METER VAN DE HELE OPZET. RTG Command bestaat niet om duizend
   medewerkers een scherm te geven, maar om ervoor te zorgen dat er geen duizend
   nodig zijn. Zo'n doel zonder meter is een leus. Deze meter is dus het punt
   waarop de belofte controleerbaar wordt -- en waar hij zichtbaar wordt
   gebroken als hij niet waar is.

   HOE HIJ MEET. Uit het journaal: elke genoteerde handeling draagt zijn niveau
   (hand, assist, auto). Handwerk is wat op 'hand' staat, plus de menselijke
   helft van 'assist'. Per handelingssoort staat er een minutenprijs; die is een
   SCHATTING en staat als zodanig in de uitslag. Een meter die zijn eigen
   onzekerheid verzwijgt, wordt gebruikt alsof hij zeker is.

   WAT ER BEWUST NIET GEBEURT. Er wordt niet teruggerekend naar euro's per FTE.
   Dat vraagt loonschalen en die horen in Payroll, niet hier -- en een tweede
   plek met salariskennis is precies wat LAT.md regel 4 verbiedt. Wat hier staat
   is tijd, en tijd is te controleren. */
'use strict';

/* De minutenprijs per handeling. Een schatting, en hij staat op één plek zodat
   hij als geheel bij te stellen is als er echte metingen komen. */
const MINUTEN = {
  'zaak openen': 0, 'zaak oppakken': 3, 'zaak besluiten': 12,
  'herstel droog': 2, 'herstel uitvoeren': 4, 'herstel terugdraaien': 15,
  'operator uitvoeren': 3,
  'beleid zetten': 20, 'beleid voorstellen': 15, 'beleid goedkeuren': 8, 'beleid afwijzen': 8, 'beleid terugzetten': 10,
  'agent stoppen': 5, 'agent hervatten': 5, 'agent rechten zetten': 10,
  'noodtoegang openen': 10, 'noodtoegang sluiten': 3, 'recht tijdelijk geven': 6
};
const STANDAARD_MINUTEN = 5;

/* Wat de machine bespaart als hij het zelf doet: de tijd die een mens er
   anders aan kwijt was geweest. Voor 'auto' is dat de volle minutenprijs, voor
   'assist' de helft -- de mens kijkt nog mee, maar zoekt niets meer uit. */
const AANDEEL = { hand: 1, assist: 0.5, auto: 0 };

function maakWerkbesparing({ journaal, zaken, runbooks }) {
  function regels(dagen) {
    const grens = new Date(Date.now() - Number(dagen || 30) * 86400000).toISOString();
    return journaal.recent(journaal.MAX).filter(r => r.at >= grens);
  }

  function bord(dagen) {
    const rij = regels(dagen);
    const per = new Map();
    let handMin = 0, bespaardMin = 0, handelingen = 0;
    for (const r of rij) {
      const min = MINUTEN[r.actie] == null ? STANDAARD_MINUTEN : MINUTEN[r.actie];
      const aandeel = AANDEEL[r.niveau] == null ? 1 : AANDEEL[r.niveau];
      const hand = min * aandeel, bespaard = min * (1 - aandeel);
      handMin += hand; bespaardMin += bespaard; handelingen++;
      const g = per.get(r.actie) || { actie: r.actie, aantal: 0, handMin: 0, bespaardMin: 0,
        perNiveau: { hand: 0, assist: 0, auto: 0 } };
      g.aantal++; g.handMin += hand; g.bespaardMin += bespaard;
      g.perNiveau[r.niveau] = (g.perNiveau[r.niveau] || 0) + 1;
      per.set(r.actie, g);
    }
    const werkstromen = [...per.values()].sort((a, b) => b.handMin - a.handMin).map(g => ({
      actie: g.actie, aantal: g.aantal,
      handUren: Math.round(g.handMin / 6) / 10, bespaardUren: Math.round(g.bespaardMin / 6) / 10,
      automatiseringsgraad: g.aantal ? Math.round((g.perNiveau.auto / g.aantal) * 100) : 0,
      perNiveau: g.perNiveau,
      /* Het lek: veel volume dat nog op 'hand' staat. Dat is de rij waar de
         volgende automatiseringsronde begint. */
      lek: g.perNiveau.hand >= 5 && g.perNiveau.auto === 0
    }));

    const per1000 = handelingen ? Math.round((handMin / handelingen) * 1000) : 0;
    return {
      dagen: Number(dagen || 30), handelingen,
      handminutenPer1000: per1000,
      handUren: Math.round(handMin / 6) / 10,
      bespaardeUren: Math.round(bespaardMin / 6) / 10,
      automatiseringsgraad: handelingen
        ? Math.round((rij.filter(r => r.niveau === 'auto').length / handelingen) * 100) : 0,
      werkstromen,
      lekken: werkstromen.filter(w => w.lek),
      /* Wat de menselijke besluiten leren: dezelfde uitzondering die steeds
         hetzelfde besluit krijgt, is een runbook dat nog niet bestaat. */
      kandidaten: zaken.leerpunten(3),
      onzeker: 'De minutenprijzen zijn schattingen (zie MINUTEN in kern/command/werkbesparing.js), geen gemeten tijden. De verhouding tussen de werkstromen is bruikbaar; het absolute getal is dat pas als er echte metingen onder liggen.'
    };
  }

  /* Wat levert automatisering per runbook op? Uren, en hoeveel er nu nog
     blijft liggen doordat het niveau te hoog is. */
  function opbrengst() {
    return runbooks.lijst().map(rb => {
      const min = MINUTEN['herstel uitvoeren'];
      const handmatig = Math.round((rb.kandidaten * STANDAARD_MINUTEN) / 6) / 10;
      const geautomatiseerd = Math.round((rb.kandidaten * min) / 6) / 10;
      return { runbook: rb.id, naam: rb.naam, kandidaten: rb.kandidaten,
        niveau: rb.oordeel.niveau, score: rb.oordeel.score,
        urenMetDeHand: handmatig, urenAutomatisch: geautomatiseerd,
        besparingUren: Math.round((handmatig - geautomatiseerd) * 10) / 10,
        blokkade: rb.oordeel.niveau === 'auto' ? null
          : 'staat op ' + rb.oordeel.niveau + ' -- ' + rb.oordeel.waarom };
    }).sort((a, b) => b.besparingUren - a.besparingUren);
  }

  return { bord, opbrengst, MINUTEN, AANDEEL };
}

module.exports = { maakWerkbesparing, MINUTEN, AANDEEL };

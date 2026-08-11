/* Magnaat: VERZEKEREN -- afsluiten, opzeggen, en wat de maand ermee doet.

   De acties en de maandloop van de verzekeringslaag. Het model staat ernaast:
   ./risico.js (wat er mis kan gaan en hoe vaak) en ./polis.js (wat een polis
   kost, dekt en niet dekt). Dezelfde driedeling als bij de bank, en om dezelfde
   reden -- de tabel, de regels en het gesprek veranderen om verschillende
   redenen.

   PREMIE EN SCHADE VERNIETIGEN, EEN UITKERING HERSTELT. Dat is het patroon
   waarop scripts/magnaat-pomp.js deze laag keurt, en het is scherper dan het
   klinkt: een uitkering mag de wereld niet rijker maken dan hij vóór de schade
   was. Vandaar dat een uitkering nooit boven de aantoonbare schade uitkomt
   (./polis.js) en dat de premie een opslag draagt.

   VERZEKEREN IS EEN VRIJE ACTIE. Een speler die op zijn beurt moet wachten om
   zich te mogen verzekeren, is een speler die schade oploopt aan de
   beurtvolgorde. */
const R = require('./risico');
const P = require('./polis');

const rond = (n) => Math.round(n);

module.exports = ({ mijnVestiging }) => {
  const mijne = (st, h) => (st.polissen || []).filter(p => p.speler === h && p.status === 'loopt');
  /* De maandomzet waar een premie en een schade over rekenen. Uit het KORTE
     verleden en niet uit deze maand: een premie die met de maand meebeweegt zou
     betekenen dat je in een slechte maand ineens goedkoper uit bent, en dat is
     precies verkeerd om. */
  const omzetVan = (v) => (v.maanden ? (v.omzetTotaal || 0) / v.maanden : 0);

  /* Wat een polis vandaag zou kosten. Los, want het scherm heeft hem nodig
     voordat er iets getekend is. */
  function offerte(st, h, { vestiging, risico, dekking, eigenRisico, maximum }) {
    const v = mijnVestiging(st, h, vestiging);
    if (!v) return { error: 'Die vestiging is niet van jou.' };
    const wens = {
      risico: String(risico || ''),
      dekking: Number(dekking === undefined ? 1 : dekking),
      eigenRisico: Math.floor(Number(eigenRisico) || 0),
      maximum: Math.floor(Number(maximum) || P.GRENZEN.maximum[1])
    };
    const fout = P.keurPolis(wens);
    if (fout) return { error: fout };
    const ctx = { winter: (st.maand % 12) < 3 || (st.maand % 12) > 9,
      bezetting: (v.laatsteBezetting || 0) / 100 };
    const premie = P.premieVoor(wens.risico, v, omzetVan(v), wens, ctx);
    return Object.assign({}, wens, {
      naam: R.RISICOS[wens.risico].naam, vestiging: v.id, premie: rond(premie),
      verwachteSchade: rond(R.verwachteSchade(wens.risico, v, omzetVan(v), ctx)),
      kans: R.RISICOS[wens.risico].volgtOp ? null : R.kansOp(wens.risico, v, ctx),
      uitsluitbaar: R.RISICOS[wens.risico].uitsluitbaar,
      uitgesloten: R.RISICOS[wens.risico].uitsluitbaar && v.onderhoud < P.ONDERHOUDSGRENS
    });
  }

  const ACTIES = {
    /* VRIJ: een polis afsluiten. Een risico per vestiging maar EEN keer -- twee
       polissen op hetzelfde risico is geen dubbele dekking (er wordt nooit meer
       dan de schade uitgekeerd) maar wel dubbele premie, en dat is een val. */
    'polis-sluiten'(potje, h, z) {
      const st = potje.staat;
      if (mijne(st, h).length >= P.MAX_POLISSEN)
        return { status: 429, error: 'Je hebt al ' + P.MAX_POLISSEN + ' polissen lopen.' };
      const o = offerte(st, h, z);
      if (o.error) return { status: 400, error: o.error };
      if (mijne(st, h).some(p => p.vestiging === o.vestiging && p.risico === o.risico))
        return { status: 409, error: 'Voor dat risico loopt er al een polis op die zaak.' };
      const p = {
        id: 'p' + (st.polisTeller = (st.polisTeller || 0) + 1),
        speler: h, vestiging: o.vestiging, risico: o.risico,
        dekking: o.dekking, eigenRisico: o.eigenRisico, maximum: o.maximum,
        sinds: st.maand, status: 'loopt', betaald: 0, uitgekeerd: 0, voorvallen: 0
      };
      (st.polissen = st.polissen || []).push(p);
      return { status: 200, ok: true, id: p.id, premie: o.premie };
    },

    /* VRIJ: opzeggen. Per direct en zonder boete -- een verzekering die je niet
       kunt opzeggen is een abonnement, en dan is de keuze eenmalig in plaats van
       doorlopend. */
    'polis-opzeggen'(potje, h, z) {
      const st = potje.staat;
      const p = (st.polissen || []).find(x => x.id === String(z.id || '') && x.speler === h && x.status === 'loopt');
      if (!p) return { status: 404, error: 'Die polis loopt niet op jouw naam.' };
      p.status = 'opgezegd';
      p.tot = st.maand;
      return { status: 200, ok: true };
    }
  };

  /* ---------- de maand ----------
     Eerst de premies, dan de voorvallen, dan de uitkeringen. In die volgorde,
     want een polis die deze maand is opgezegd hoort deze maand nog te betalen
     EN nog te dekken -- andersom zou opzeggen op het juiste moment een gratis
     maand dekking opleveren. */
  function maandVoorSpeler(potje, h) {
    const st = potje.staat;
    const regels = [];
    let premie = 0, schade = 0, uitgekeerd = 0;
    const polissen = mijne(st, h);
    for (const v of st.vestigingen[h] || []) {
      const ctx = { winter: (st.maand % 12) < 3 || (st.maand % 12) > 9,
        bezetting: (v.laatsteBezetting || 0) / 100 };
      const omzet = omzetVan(v);
      // 1. de premies
      for (const p of polissen.filter(x => x.vestiging === v.id)) {
        const bedrag = P.premieVoor(p.risico, v, omzet, p, ctx);
        st.geld[h] -= bedrag;
        p.betaald += bedrag;
        premie += bedrag;
      }
      // 2. wat er gebeurt -- deterministisch uit (partij, maand, vestiging)
      for (const voorval of R.voorvallen(potje.id, st.maand, v, ctx)) {
        const kosten = R.kosten(voorval, v, omzet);
        if (kosten < 1) continue;
        st.geld[h] -= kosten;
        schade += kosten;
        /* PANDSCHADE ZET OOK DE STAAT TERUG. Zonder dat is een brand alleen een
           rekening, en dan werkt hij niet door in kwaliteit en reputatie -- en
           juist die doorwerking is wat een risico van een boete onderscheidt. */
        if (voorval.soort === 'pand') v.onderhoud = Math.max(0, v.onderhoud - voorval.deel * 100);
        // 3. en wat de polis daarvan draagt
        const p = polissen.find(x => x.vestiging === v.id && x.risico === voorval.risico);
        const uit = p ? P.uitkering(p, v, kosten) : { bedrag: 0, reden: 'niet verzekerd' };
        if (uit.bedrag > 0) { st.geld[h] += uit.bedrag; p.uitgekeerd += uit.bedrag; uitgekeerd += uit.bedrag; }
        if (p) p.voorvallen++;
        regels.push({ id: voorval.risico, naam: voorval.naam, zaak: v.naam,
          schade: rond(kosten), uitkering: rond(uit.bedrag), reden: uit.reden,
          verzekerd: !!p, resultaat: -rond(kosten - uit.bedrag) });
      }
    }
    if (premie > 0) regels.unshift({ id: 'premie', naam: 'Verzekeringspremie',
      premie: rond(premie), resultaat: -rond(premie) });
    return { regels, premie, schade, uitgekeerd };
  }

  /* WAT EEN SPELER ZIET: zijn eigen polissen en wat ze hebben gedaan. Van een
     ander niets -- weten dat de buurman onverzekerd is, is precies het soort
     kennis waar een spel niet leuker van wordt. */
  function beeld(st, h) {
    return {
      polissen: (st.polissen || []).filter(p => p.speler === h).map(p => ({
        id: p.id, risico: p.risico, naam: R.RISICOS[p.risico].naam, status: p.status,
        vestiging: p.vestiging, dekking: p.dekking, eigenRisico: p.eigenRisico,
        maximum: p.maximum, sinds: p.sinds, voorvallen: p.voorvallen,
        betaald: rond(p.betaald), uitgekeerd: rond(p.uitgekeerd)
      })),
      // wat er te verzekeren valt per zaak, met de kans en de verwachte schade erbij
      risicos: (st.vestigingen[h] || []).map(v => ({
        vestiging: v.id, naam: v.naam,
        posten: R.RISICOLIJST.map(r => offerte(st, h, { vestiging: v.id, risico: r, dekking: 1 }))
          .filter(o => !o.error)
      })),
      onderhoudsgrens: P.ONDERHOUDSGRENS
    };
  }

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES), offerte, beeld, maandVoorSpeler, mijne };
};

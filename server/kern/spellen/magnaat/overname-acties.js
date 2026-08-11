/* Magnaat: DE OVERNAMEACTIES -- bieden, antwoorden, intrekken.

   De acties van de overnamelaag; de regels staan in ./overname.js. Dezelfde
   driedeling en dezelfde onderhandelvorm als bij de contracten en de belangen:
   een voorstel, en dan ja, nee of TEGEN -- waarna de beurt omdraait, want wie
   het laatst iets voorstelde tekent niet zelf.

   ALLE DRIE VRIJ. Bieden op een zaak van een ander verandert de kaart niet; pas
   het JA verandert hem, en dat is precies waarom het antwoord van de eigenaar
   komt en niet van de bieder. Zonder die vrijheid staat een partij van zes met
   24 uur per beurt stil terwijl er onderhandeld wordt. */
const O = require('./overname');

module.exports = ({ overname, wieHeeft }) => {
  const ACTIES = {
    /* VRIJ: een bod op de zaak van een ander. */
    'overname-bod'(potje, h, z) {
      const st = potje.staat;
      const w = wieHeeft(st, String(z.vestiging || ''));
      if (!w) return { status: 404, error: 'Die vestiging bestaat niet.' };
      if (w.speler === h) return { status: 409, error: 'Dat is je eigen zaak.' };
      if (overname.lopend(st, h).filter(o => o.koper === h).length >= O.MAX_OPEN)
        return { status: 429, error: 'Je hebt al ' + O.MAX_OPEN + ' biedingen open staan.' };
      if ((st.overnames || []).some(o => o.status === 'voorgesteld'
        && o.vestiging === w.v.id && o.koper === h))
        return { status: 409, error: 'Daar ligt al een bod van je op tafel.' };
      const prijs = Math.floor(Number(z.prijs) || 0);
      const fout = overname.keur(st, h, w.v, prijs);
      if (fout) return { status: 409, error: fout };
      const o = { id: 'o' + (st.overnameTeller = (st.overnameTeller || 0) + 1),
        status: 'voorgesteld', vestiging: w.v.id, koper: h, verkoper: w.speler,
        prijs, van: h, ronde: 1, sinds: st.maand };
      (st.overnames = st.overnames || []).push(o);
      return { status: 200, ok: true, id: o.id, prijs, wek: w.speler,
        bagage: overname.bagage(st, w.v) && undefined };
    },

    /* VRIJ: antwoorden. Ja, nee, of een tegenbod -- en dan draait de beurt om. */
    'overname-antwoord'(potje, h, z) {
      const st = potje.staat;
      const o = (st.overnames || []).find(x => x.id === String(z.id || ''));
      if (!o || (o.koper !== h && o.verkoper !== h))
        return { status: 404, error: 'Dat bod bestaat niet.' };
      if (o.status !== 'voorgesteld') return { status: 409, error: 'Dat bod ligt niet meer op tafel.' };
      const antwoord = String(z.antwoord || '');
      const ander = o.koper === h ? o.verkoper : o.koper;
      if (o.van === h && antwoord !== 'nee')
        return { status: 409, error: 'Je bent zelf aan zet; de ander moet antwoorden.' };

      if (antwoord === 'nee') { o.status = 'afgewezen'; o.tot = st.maand; return { status: 200, ok: true, wek: ander }; }
      if (antwoord === 'tegen') {
        if (o.ronde >= O.MAX_RONDEN) return { status: 409, error: 'Na ' + O.MAX_RONDEN + ' rondes is het ja of nee.' };
        const w = wieHeeft(st, o.vestiging);
        if (!w) { o.status = 'vervallen'; return { status: 409, error: 'Die vestiging bestaat niet meer.' }; }
        const prijs = Math.floor(Number(z.prijs) || 0);
        /* DE GRENZEN GELDEN OOK VOOR EEN TEGENBOD, en die van de KOPER worden
           getoetst -- hij betaalt. Zonder dat kon een verkoper een bedrag noemen
           dat de koper niet heeft, en dan strandt het pas bij het ja. */
        const fout = overname.keur(st, o.koper, w.v, prijs);
        if (fout) return { status: 409, error: fout };
        Object.assign(o, { prijs, van: h, ronde: o.ronde + 1 });
        return { status: 200, ok: true, wek: ander, ronde: o.ronde, prijs };
      }
      if (antwoord !== 'ja') return { status: 400, error: 'Antwoord met ja, nee of tegen.' };

      const w = wieHeeft(st, o.vestiging);
      if (!w) { o.status = 'vervallen'; return { status: 409, error: 'Die vestiging bestaat niet meer.' }; }
      if (w.speler !== o.verkoper) { o.status = 'vervallen'; return { status: 409, error: 'Die zaak is inmiddels van een ander.' }; }
      if (st.geld[o.koper] < o.prijs) return { status: 400, error: 'De koper heeft ' + o.prijs + ' niet op de rekening.' };
      const uit = overname.voltrek(st, o);
      if (!uit) return { status: 409, error: 'De overname kon niet worden voltrokken.' };
      /* DE ANDERE BIEDINGEN OP DEZELFDE ZAAK VERVALLEN. Ze staan op een pand dat
         nu van iemand anders is, en een bod dat de verkeerde kant op wijst is
         erger dan geen bod. */
      for (const x of st.overnames || [])
        if (x.status === 'voorgesteld' && x.vestiging === o.vestiging) { x.status = 'vervallen'; x.tot = st.maand; }
      return { status: 200, ok: true, prijs: o.prijs, afgelost: o.afgelost,
        contracten: o.contractenMee, wek: ander };
    },

    /* VRIJ: je eigen bod intrekken. */
    'overname-intrekken'(potje, h, z) {
      const st = potje.staat;
      const o = (st.overnames || []).find(x => x.id === String(z.id || '') && x.koper === h);
      if (!o || o.status !== 'voorgesteld') return { status: 404, error: 'Dat bod ligt niet meer op tafel.' };
      o.status = 'ingetrokken'; o.tot = st.maand;
      return { status: 200, ok: true, wek: o.verkoper };
    }
  };

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES),
    beeld: (st, h, codenaamVan) => overname.beeld(st, h, codenaamVan) };
};

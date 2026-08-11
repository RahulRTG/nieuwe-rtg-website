/* Magnaat: EEN BELANG KOPEN -- voorstellen, tegenvoorstellen, tekenen.

   Afgesplitst van ./aandeel.js op dezelfde naad als ./handel-acties.js en
   ./veiling-acties.js: dat bestand kent het BELANG (wat het uitkeert, wat het
   waard is, hoeveel er weg mag), dit bestand kent het gesprek.

   HET GAAT NET ALS BIJ EEN CONTRACT: een voorstel, eventueel een tegenvoorstel,
   en pas dan geld. Twee velden om over te praten (het percentage en de prijs)
   en verder niets -- er valt hier minder te verzinnen dan bij een contract, en
   dat is goed: dit is een investering en geen afspraak.

   ALLEBEI VRIJE ACTIES, om dezelfde reden als daar: op je beurt wachten om te
   mogen onderhandelen maakt van een partij van zes een week vertraging. */
module.exports = ({ wieHeeft, uitgegeven, MAX_DEEL }) => {
  const MAX_OPEN = 4;   // openstaande voorstellen per speler

  const ACTIES = {
    /* VRIJ: een belang aanbieden of erom vragen. Wie het voorstel doet maakt
       niet uit voor de rollen -- de EIGENAAR van de genoemde vestiging is altijd
       de verkoper. Dat volgt uit de wereld en niet uit het verzoek, precies
       zoals bij een contract de leverancier uit de sector volgt. */
    'belang-voorstel'(potje, h, z) {
      const st = potje.staat;
      const open = (st.deelnemingen || []).filter(d => d.status === 'voorgesteld' && d.van === h);
      if (open.length >= MAX_OPEN) return { status: 429, error: `Je hebt al ${MAX_OPEN} voorstellen openstaan.` };
      const w = wieHeeft(st, String(z.vestiging || ''));
      if (!w) return { status: 404, error: 'Die vestiging bestaat niet.' };
      const deel = Math.floor(Number(z.deel) || 0);
      const prijs = Math.floor(Number(z.prijs) || 0);
      if (!(deel >= 1 && deel <= MAX_DEEL)) return { status: 400, error: `Een belang is 1 tot ${MAX_DEEL} procent.` };
      if (!(prijs >= 1 && prijs <= 50000000)) return { status: 400, error: 'Noem een prijs.' };
      // wie is de koper? de ander dan de eigenaar
      const houder = w.speler === h ? String(z.houder || '') : h;
      if (!houder || houder === w.speler) return { status: 400, error: 'Noem aan wie je het belang aanbiedt.' };
      if (!potje.spelers.includes(houder)) return { status: 404, error: 'Die speler doet niet mee.' };
      if (uitgegeven(st, w.v.id) + deel > MAX_DEEL)
        return { status: 409, error: `Er zit al ${uitgegeven(st, w.v.id)}% bij anderen; meer dan ${MAX_DEEL}% mag niet weg.` };
      const d = { id: 'd' + (st.deelnemingTeller = (st.deelnemingTeller || 0) + 1),
        status: 'voorgesteld', van: h, ronde: 1,
        vestiging: w.v.id, eigenaar: w.speler, houder, deel, prijs,
        gekocht: null, ontvangen: 0 };
      (st.deelnemingen = st.deelnemingen || []).push(d);
      return { status: 200, ok: true, id: d.id, wek: h === houder ? w.speler : houder };
    },

    /* VRIJ: antwoorden. Ja, nee, of een tegenvoorstel met een ander percentage
       en een andere prijs -- en dan draait de beurt om, net als bij een
       contract: wie het laatst iets voorstelde tekent niet zelf. */
    'belang-antwoord'(potje, h, z) {
      const st = potje.staat;
      const d = (st.deelnemingen || []).find(x => x.id === String(z.id || ''));
      if (!d || (d.eigenaar !== h && d.houder !== h)) return { status: 404, error: 'Dat voorstel bestaat niet.' };
      if (d.status !== 'voorgesteld') return { status: 409, error: 'Dat voorstel ligt niet meer op tafel.' };
      const antwoord = String(z.antwoord || '');
      const ander = d.eigenaar === h ? d.houder : d.eigenaar;
      if (d.van === h && antwoord !== 'nee')
        return { status: 409, error: 'Je bent zelf aan zet met dit voorstel; de ander moet antwoorden.' };

      if (antwoord === 'nee') { d.status = 'afgewezen'; return { status: 200, ok: true, wek: ander }; }
      if (antwoord === 'tegen') {
        if (d.ronde >= 6) return { status: 409, error: 'Na zes rondes is het ja of nee.' };
        const deel = Math.floor(Number(z.deel) || 0), prijs = Math.floor(Number(z.prijs) || 0);
        if (!(deel >= 1 && deel <= MAX_DEEL)) return { status: 400, error: `Een belang is 1 tot ${MAX_DEEL} procent.` };
        if (!(prijs >= 1 && prijs <= 50000000)) return { status: 400, error: 'Noem een prijs.' };
        if (uitgegeven(st, d.vestiging) + deel > MAX_DEEL)
          return { status: 409, error: 'Zoveel zit er niet meer in.' };
        Object.assign(d, { deel, prijs, van: h, ronde: d.ronde + 1 });
        return { status: 200, ok: true, wek: ander, ronde: d.ronde };
      }
      if (antwoord !== 'ja') return { status: 400, error: 'Antwoord met ja, nee of tegen.' };

      if (!wieHeeft(st, d.vestiging)) return { status: 409, error: 'Die vestiging bestaat niet meer.' };
      if (uitgegeven(st, d.vestiging) + d.deel > MAX_DEEL)
        return { status: 409, error: 'Er is inmiddels te veel van deze zaak vergeven.' };
      if (st.geld[d.houder] < d.prijs) return { status: 400, error: 'De koper heeft ' + d.prijs + ' niet op de rekening.' };
      /* DE EIGENAAR VAN NU KRIJGT HET GELD, en dat is niet vanzelfsprekend: het
         belang hangt aan de VESTIGING (besluit 4), dus als de zaak inmiddels van
         een ander is, betaalt de koper aan die ander. Dat is ook de eerlijke
         kant -- die ander draagt vanaf nu het verwaterde resultaat. */
      const nu = wieHeeft(st, d.vestiging).speler;
      st.geld[d.houder] -= d.prijs;
      st.geld[nu] += d.prijs;
      d.status = 'loopt';
      d.eigenaar = nu;
      d.gekocht = st.maand;
      return { status: 200, ok: true, wek: ander, deel: d.deel };
    }
  };

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES) };
};

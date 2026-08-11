/* Magnaat: BIEDEN -- inzetten, bieden, intrekken.

   Afgesplitst van ./veiling.js op dezelfde naad als ./handel-acties.js van
   ./handel.js: dat bestand kent het OBJECT en de afloop (wat er onder de hamer
   gaat, wat de bodem is, wat er overgaat als hij valt), dit bestand kent wat
   een speler mag doen en wanneer.

   ALLE DRIE ZIJN VRIJE ACTIES (GAMEHALL.md 12.3). Bieden op je beurt zou
   betekenen dat een veiling van vier spelmaanden in een asynchrone partij
   dagen duurt en dat wie het laatst aan de beurt is altijd het meeste weet. */
module.exports = ({ K, mijnVestiging, vrijKavel, lopende, bodem, LOOPTIJD, MAX_LOPEND }) => {
  const ACTIES = {
    /* VRIJ: iets in de veiling zetten. Een kavel mag iedereen inzetten; een
       vestiging alleen de eigenaar. */
    'veiling-start'(potje, h, z) {
      const st = potje.staat;
      if (lopende(st).filter(v => v.door === h).length >= MAX_LOPEND)
        return { status: 429, error: `Je hebt al ${MAX_LOPEND} veilingen lopen.` };
      const duur = LOOPTIJD[String(z.duur || 'normaal')];
      if (!duur) return { status: 400, error: 'Kies kort, normaal of lang.' };
      if (st.maand + duur > st.duur) return { status: 400, error: 'Zo lang duurt de campagne niet meer.' };

      const soort = String(z.soort || '');
      const x = { soort };
      if (soort === 'kavel') {
        x.kavel = String(z.kavel || '');
        if (!vrijKavel(st, x.kavel)) return { status: 400, error: 'Dat kavel is er niet of is al bezet.' };
        if (lopende(st).some(v => v.kavel === x.kavel)) return { status: 409, error: 'Dat kavel staat al in de veiling.' };
      } else if (soort === 'vestiging') {
        x.vestiging = String(z.vestiging || '');
        if (!mijnVestiging(st, h, x.vestiging)) return { status: 404, error: 'Die vestiging is niet van jou.' };
        if (lopende(st).some(v => v.vestiging === x.vestiging)) return { status: 409, error: 'Die staat al in de veiling.' };
      } else return { status: 400, error: 'Je veilt een kavel of een vestiging.' };

      const v = Object.assign({
        id: 'a' + (st.veilingTeller = (st.veilingTeller || 0) + 1),
        status: 'loopt', door: h, sluitMaand: st.maand + duur,
        bodem: bodem(st, x), biedingen: [], winnaar: null, prijs: null
      }, x);
      (st.veilingen = st.veilingen || []).push(v);
      return { status: 200, ok: true, id: v.id, bodem: v.bodem, sluit: v.sluitMaand };
    },

    /* VRIJ: bieden. Je bod is geheim tot de hamer valt, en je mag het
       verhogen -- maar niet verlagen: een bod is een bod, en anders is dit een
       aftelling waarin iedereen zijn bod op het laatste moment weghaalt.

       ER WORDT NIETS GERESERVEERD, en dat is een besluit met een reden. Zou het
       bedrag vastgezet worden, dan is meebieden op drie veilingen tegelijk
       onmogelijk voor wie niet rijk is -- en dan is de veiling een voorrecht.
       In plaats daarvan wordt er bij de HAMER gekeken of je kunt betalen; kun
       je dat niet, dan gaat hij naar de volgende bieder en dat kost je je
       naam (`gemist`), die iedereen ziet. */
    'veiling-bod'(potje, h, z) {
      const st = potje.staat;
      const v = (st.veilingen || []).find(x => x.id === String(z.id || ''));
      if (!v || v.status !== 'loopt') return { status: 404, error: 'Die veiling loopt niet.' };
      if (v.soort === 'vestiging' && v.door === h) return { status: 409, error: 'Je kunt niet op je eigen zaak bieden.' };
      const bedrag = Math.floor(Number(z.bedrag) || 0);
      if (!Number.isFinite(bedrag) || bedrag < v.bodem)
        return { status: 400, error: 'Het minimum is ' + v.bodem + '.' };
      const bestaand = v.biedingen.find(b => b.speler === h);
      if (bestaand) {
        if (bedrag <= bestaand.bedrag) return { status: 400, error: 'Je kunt je bod alleen verhogen.' };
        bestaand.bedrag = bedrag;
      } else v.biedingen.push({ speler: h, bedrag });
      return { status: 200, ok: true, biedingen: v.biedingen.length };
    },

    /* VRIJ: je eigen veiling intrekken, zolang er niemand op geboden heeft.
       Daarna niet meer -- wie een bod uitlokt en dan wegloopt heeft de ander
       laten rekenen voor niets. */
    'veiling-intrekken'(potje, h, z) {
      const st = potje.staat;
      const v = (st.veilingen || []).find(x => x.id === String(z.id || ''));
      if (!v || v.status !== 'loopt') return { status: 404, error: 'Die veiling loopt niet.' };
      if (v.door !== h) return { status: 403, error: 'Die veiling is niet van jou.' };
      if (v.biedingen.length) return { status: 409, error: 'Er is al geboden; nu kun je er niet meer uit.' };
      v.status = 'ingetrokken';
      return { status: 200, ok: true };
    }
  };

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES) };
};

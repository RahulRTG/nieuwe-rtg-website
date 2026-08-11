/* Magnaat: LENEN -- offerte vragen, tekenen, aflossen, heronderhandelen.

   Afgesplitst van ./bank.js op dezelfde naad als overal in deze map: dat
   bestand kent de VORMEN en de prijs, dit bestand kent wat een speler mag doen.

   EEN OFFERTE IS GEEN ONDERHANDELING, en dat is met opzet anders dan bij een
   contract. Tegenover een medespeler valt te praten; tegenover de bank niet --
   die rekent, en het antwoord is een getal dat je van tevoren kunt zien. Wat er
   wel te kiezen valt is de VORM, de looptijd en het bedrag, en dat is precies
   waar de strategie zit. Een speler die een betere rente wil, verandert zijn
   bedrijf en niet zijn toon.

   LENEN IS EEN VRIJE ACTIE, aflossen ook. Ze veranderen de kaart niet, en een
   speler die op zijn beurt moet wachten om rood te mogen staan is een speler
   die failliet gaat aan de beurtvolgorde.

   HERONDERHANDELEN IS DE UITWEG UIT EEN CONVENANT, en het is de reden dat de
   trappen bestaan (zie ./bank.js). Wie eroverheen zit mag een keer per lening
   herzien: langer lenen tegen een hogere rente, zodat de maandlast daalt. Dat
   is een echte keuze met een echte prijs, en het is wat een bank in het echt
   ook doet voordat hij iets opeist. */
const B = require('./bank');

const rond = (n) => Math.round(n);
const MAX_LENINGEN = 8;

module.exports = ({ mijnVestiging, profiel, cijfers, waarde, liquideer }) => {
  const mijne = (st, h) => (st.leningen || []).filter(l => l.speler === h && l.status === 'loopt');

  /* Wat de bank vandaag zou aanbieden. Een LOSSE functie omdat het scherm hem
     nodig heeft voordat er iets getekend is -- een offerte die je pas ziet als
     je hebt getekend, is geen offerte. */
  function offerte(st, h, { soort, bedrag, looptijd, vestiging }) {
    const v = B.VORMEN[soort];
    if (!v) return { error: 'Die kredietvorm bestaat niet.' };
    const c = cijfers(st, h);
    const p = profiel(st, h);
    const onderpand = vestiging ? mijnVestiging(st, h, vestiging) : null;
    if (v.onderpand && !onderpand) return { error: 'Voor deze vorm hoort een vestiging als onderpand.' };
    const looptijdOk = v.looptijd
      ? Math.round(Math.min(v.looptijd[1], Math.max(v.looptijd[0], Number(looptijd) || v.looptijd[0])))
      : 0;
    /* Wat er al op DIT pand rust; zie de reden bij `ruimte` in ./bank.js. */
    const onderpandSchuld = onderpand ? (st.leningen || [])
      .filter(l => l.status === 'loopt' && l.onderpand === onderpand.id)
      .reduce((n, l) => n + l.restant, 0) : 0;
    const max = B.ruimte(soort, { vermogen: c.vermogen, schuld: c.schuld,
      achtergesteldeSchuld: c.achtergesteld, onderpandSchuld,
      onderpandwaarde: onderpand ? waarde(onderpand) : 0 });
    const { rente, stap } = B.renteVoor(soort, p, {
      sector: onderpand ? onderpand.sector : (st.vestigingen[h][0] || {}).sector,
      looptijd: looptijdOk, cyclus: st.cyclus || 0 });
    return { soort, naam: v.naam, max, rente, stap, looptijd: looptijdOk,
      aflossend: v.aflossend, onderpand: onderpand ? onderpand.id : null,
      covenanten: v.covenanten.map(k => Object.assign({ sleutel: k }, B.NORMEN[k])),
      bedrag: bedrag === undefined ? null : Math.min(Math.floor(Number(bedrag) || 0), max),
      maandlast: bedrag ? rond(Math.min(bedrag, max) * rente
        + (v.aflossend && looptijdOk ? Math.min(bedrag, max) / looptijdOk : 0)) : null };
  }

  const ACTIES = {
    /* VRIJ: geld opnemen. De offerte wordt HIER opnieuw gerekend en niet uit het
       verzoek gelezen -- anders bepaalt de client zijn eigen rente. */
    'krediet-opnemen'(potje, h, z) {
      const st = potje.staat;
      const soort = String(z.soort || '');
      const v = B.VORMEN[soort];
      if (!v) return { status: 400, error: 'Die kredietvorm bestaat niet.' };
      if (v.automatisch) return { status: 400, error: 'De rekening-courant loopt vanzelf; die vraag je niet aan.' };
      if (mijne(st, h).length >= MAX_LENINGEN) return { status: 429, error: 'Je hebt al ' + MAX_LENINGEN + ' leningen lopen.' };
      /* GEEN NIEUW GELD ZOLANG JE EEN CONVENANT BREEKT. Dat is trap twee uit
         ./bank.js en het is de kern van waarom convenanten iets betekenen:
         niet je zaak kwijt, maar de deur dicht. */
      if (mijne(st, h).some(l => (l.breukMaanden || 0) >= B.TRAP.opslag))
        return { status: 409, error: 'Je zit op een convenant; eerst dat oplossen of herzien.' };

      const o = offerte(st, h, { soort, bedrag: z.bedrag, looptijd: z.looptijd, vestiging: z.vestiging });
      if (o.error) return { status: 400, error: o.error };
      const bedrag = Math.floor(Number(z.bedrag) || 0);
      if (bedrag < 1000) return { status: 400, error: 'Onder de duizend leent geen bank.' };
      if (bedrag > o.max) return { status: 400, error: 'De bank gaat tot ' + o.max + ' bij deze vorm.' };

      const l = {
        id: 'l' + (st.leningTeller = (st.leningTeller || 0) + 1),
        speler: h, soort, hoofdsom: bedrag, restant: bedrag, rente: o.rente,
        looptijd: o.looptijd, startMaand: st.maand, eindMaand: o.looptijd ? st.maand + o.looptijd : null,
        onderpand: o.onderpand, opslag: 0, breukMaanden: 0, herzien: 0,
        betaaldRente: 0, betaaldAflossing: 0, status: 'loopt'
      };
      (st.leningen = st.leningen || []).push(l);
      st.geld[h] += bedrag;
      return { status: 200, ok: true, id: l.id, rente: l.rente, maandlast: o.maandlast };
    },

    /* VRIJ: extra aflossen. Altijd toegestaan en zonder boete: een speler die
       zijn schuld wil verkleinen tegenhouden is een regel zonder doel. */
    'krediet-aflossen'(potje, h, z) {
      const st = potje.staat;
      const l = (st.leningen || []).find(x => x.id === String(z.id || '') && x.speler === h && x.status === 'loopt');
      if (!l) return { status: 404, error: 'Die lening loopt niet op jouw naam.' };
      const bedrag = Math.min(Math.floor(Number(z.bedrag) || 0), l.restant, Math.floor(st.geld[h]));
      if (bedrag < 1) return { status: 400, error: 'Daar is geen geld voor.' };
      st.geld[h] -= bedrag;
      l.restant -= bedrag;
      l.betaaldAflossing += bedrag;
      if (l.restant < 1) { l.restant = 0; l.status = 'afgelost'; }
      return { status: 200, ok: true, restant: rond(l.restant), status_: l.status };
    },

    /* VRIJ: herzien. De uitweg uit een convenant, en hij kost wat hij hoort te
       kosten: langer lenen tegen een hogere rente. Een keer per lening, want
       eindeloos herzien is geen uitweg maar een ontsnapping. */
    'krediet-herzien'(potje, h, z) {
      const st = potje.staat;
      const l = (st.leningen || []).find(x => x.id === String(z.id || '') && x.speler === h && x.status === 'loopt');
      if (!l) return { status: 404, error: 'Die lening loopt niet op jouw naam.' };
      if (l.herzien >= 1) return { status: 409, error: 'Deze lening is al een keer herzien.' };
      const v = B.VORMEN[l.soort];
      if (!v.aflossend) return { status: 400, error: 'Bij deze vorm valt niets te verlengen; los af of laat lopen.' };
      const langer = Math.round(Math.min(v.looptijd[1] - l.looptijd, Math.max(6, Number(z.maanden) || 12)));
      if (langer < 1) return { status: 400, error: 'Langer dan dit gaat deze vorm niet.' };
      l.looptijd += langer;
      l.eindMaand += langer;
      l.rente += 0.002;
      l.opslag = 0;
      l.breukMaanden = 0;
      l.herzien++;
      return { status: 200, ok: true, looptijd: l.looptijd, rente: l.rente };
    }
  };

  /* WAT EEN SPELER VAN ZIJN FINANCIERING ZIET. Alles van zichzelf; van een
     ander niets -- schuld is de scherpste vorm van andermans boeken. */
  function beeld(st, h) {
    const c = cijfers(st, h);
    return {
      leningen: (st.leningen || []).filter(l => l.speler === h).map(l => ({
        id: l.id, soort: l.soort, naam: B.VORMEN[l.soort].naam, status: l.status,
        hoofdsom: l.hoofdsom, restant: rond(l.restant), rente: l.rente, opslag: l.opslag || 0,
        looptijd: l.looptijd, eindMaand: l.eindMaand, onderpand: l.onderpand,
        maandlast: rond(l.restant * (l.rente + (l.opslag || 0))
          + (B.VORMEN[l.soort].aflossend && l.looptijd ? l.hoofdsom / l.looptijd : 0)),
        breukMaanden: l.breukMaanden || 0, trap: B.trapVan(l.breukMaanden || 0),
        herzienbaar: l.herzien < 1 && B.VORMEN[l.soort].aflossend,
        betaaldRente: rond(l.betaaldRente), betaaldAflossing: rond(l.betaaldAflossing)
      })),
      // wat er vandaag te krijgen is, per vorm -- de offerte vooraf
      offertes: B.VORMLIJST.filter(s => !B.VORMEN[s].automatisch && !B.VORMEN[s].onderpand)
        .map(s => offerte(st, h, { soort: s })),
      /* EN WAT ELK PAND ALS ZEKERHEID WAARD IS. Die stonden er niet, omdat een
         onderpandvorm zonder gekozen pand geen bedrag heeft -- maar het gevolg
         was dat een speler NERGENS kon zien wat zijn gebouwen aan kredietruimte
         opleveren, terwijl dat precies het getal is waarop de vraag "kan ik dit
         financieren" wordt beantwoord. Gevonden doordat de geldpompmeter de lus
         onderzoek -> waardering -> lening wilde meten en er geen enkele offerte
         te vinden was om hem mee te sluiten. */
      onderpandOffertes: (st.vestigingen[h] || []).flatMap(v =>
        B.VORMLIJST.filter(s => B.VORMEN[s].onderpand && !B.VORMEN[s].automatisch)
          .map(s => Object.assign({ vestiging: v.id, vestigingNaam: v.naam },
            offerte(st, h, { soort: s, vestiging: v.id })))),
      normen: B.NORMEN, buffer: Math.round(c.buffer * 100) / 100,
      schuldlast: Math.round(c.schuldlast * 10) / 10
    };
  }

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES), offerte, beeld, mijne, MAX_LENINGEN };
};

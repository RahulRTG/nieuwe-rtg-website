/* Magnaat: BEHEER AAN- EN UITZETTEN, en de regels waaronder het gebeurt.

   De acties en het beeld van de beheerlaag; de besluiten staan in ./beheer.js.
   Dezelfde driedeling als bij de bank, de verzekering en het onderzoek.

   ALLES IS VRIJ. Je manager instellen verandert de kaart niet en gaat niemand
   anders aan -- het is huishouding in de zuiverste zin. Juist daarom mag het
   altijd: wie halverwege een partij op vakantie gaat, moet dat op dat moment
   kunnen regelen en niet op zijn beurt hoeven wachten (GAMEHALL.md 12.3).

   AANZETTEN IS EEN BESLUIT MET EEN PRIJS, en die staat in het antwoord. Er is
   geen scherm denkbaar waarop "laat het over aan de manager" gratis oogt. */
const B = require('./beheer');

const rond = (n) => Math.round(n);
const klem = (n, a, b) => Math.max(a, Math.min(b, n));

module.exports = () => {
  const vak = (st, h) => (st.beheer = st.beheer || {}) && (st.beheer[h] = st.beheer[h] || { aan: false, regels: {}, log: [] });

  /* Wat het beheer deze speler NU zou kosten, op de omzet van vorige maand. Het
     staat in het antwoord van elke actie en in het beeld, want een dienst met
     een onzichtbare prijs is geen afweging. */
  function tarief(st, h) {
    const vorige = (st.laatste[h] || {}).regels || [];
    return rond((st.vestigingen[h] || []).reduce((n, v) => {
      const r = vorige.find(x => x.id === v.id);
      return n + Math.max(B.MINTARIEF, (r ? r.omzet : 0) * B.TARIEF);
    }, 0));
  }

  const ACTIES = {
    /* VRIJ: het beheer aan- of uitzetten. */
    'beheer-aan'(potje, h) {
      const st = potje.staat;
      const b = vak(st, h);
      if (b.aan) return { status: 409, error: 'Je manager draait al.' };
      b.aan = true;
      b.sinds = st.maand;
      return { status: 200, ok: true, aan: true, kostenPerMaand: tarief(st, h),
        regels: B.regelsVan(st, h) };
    },
    'beheer-uit'(potje, h) {
      const st = potje.staat;
      const b = vak(st, h);
      if (!b.aan) return { status: 409, error: 'Je manager staat al uit.' };
      b.aan = false;
      b.tot = st.maand;
      return { status: 200, ok: true, aan: false };
    },

    /* VRIJ: de regels bijstellen. Wat er NIET in staat, blijft staan -- een
       speler die alleen zijn onderhoudsdoel verzet, hoort zijn
       toestemmingen niet kwijt te raken. */
    'beheer-regels'(potje, h, z) {
      const st = potje.staat;
      const b = vak(st, h);
      const r = b.regels = b.regels || {};
      if (z.onderhoudsdoel !== undefined) r.onderhoudsdoel = klem(Math.round(Number(z.onderhoudsdoel) || 0), 0, 100);
      if (z.bezettingsdoel !== undefined) r.bezettingsdoel = klem(Number(z.bezettingsdoel) || 0, 0.5, 1);
      if (z.kasbuffer !== undefined) r.kasbuffer = klem(Math.round(Number(z.kasbuffer) || 0), 0, 2000000);
      if (z.mag && typeof z.mag === 'object') {
        r.mag = r.mag || {};
        /* ALLEEN DE LIJST DIE BESTAAT. Een onbekende sleutel stil overnemen zou
           betekenen dat een typefout een toestemming lijkt te zetten die
           nergens gelezen wordt -- en dan denkt een speler dat hij iets heeft
           aangezet wat uit staat. */
        for (const k of B.MAGLIJST) if (z.mag[k] !== undefined) r.mag[k] = !!z.mag[k];
      }
      return { status: 200, ok: true, regels: B.regelsVan(st, h) };
    }
  };

  /* WAT EEN SPELER ZIET: zijn eigen regels, wat het kost, en het log met de
     reden per besluit. Van een ander niets -- of iemand zijn zaken zelf draait
     of laat draaien, is precies het soort ding waar een tegenpartij zijn
     gedrag op zou aanpassen. */
  function beeld(st, h) {
    const b = (st.beheer || {})[h] || {};
    return {
      aan: !!b.aan, sinds: b.sinds ?? null,
      regels: B.regelsVan(st, h),
      standaard: B.STANDAARD, magLijst: B.MAGLIJST,
      kostenPerMaand: tarief(st, h),
      tarief: B.TARIEF, minTarief: B.MINTARIEF,
      log: (b.log || []).slice(0, 20)
    };
  }

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES), beeld, tarief };
};

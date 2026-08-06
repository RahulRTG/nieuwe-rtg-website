/* RTG Stad, deel "bewoner": de stad voor wie er WOONT. Twee dingen:

   1. Het bewonersbeeld: hetzelfde eerlijke stadsbeeld als de boardroom, maar
      zonder de bedrijfsvoering -- standen en waarden per domein, het scenario
      en de waarschuwingen; geen serienummers, sleutels of regimeknoppen.
   2. Meldingen: een bewoner meldt iets dat stuk of vol is (lantaarn, container,
      overlast). De melding wordt METEEN een klus op de werklijst van de
      veld-app; wordt hij daar klaargemeld, dan ziet de melder dat live terug.

   DE MELDING IS EEN WAARNEMING, GEEN EIGEN LIJSTJE MEER. Dit deel hield vroeger
   db.data.stadMeldingen bij. Dat was precies het gat: dezelfde kapotte lantaarn,
   gemeld via Mijn Stad en via het gemeenteloket, werd twee losse klussen en
   niets kon zien dat het om dezelfde paal ging. Nu biedt dit deel de melding
   aan bij de zaakmotor van het stadsweefsel (kern/stadsweefsel/zaken.js), net
   als elk ander kanaal. Wat de bewoner ziet blijft gelijk; wat de stad ermee
   kan is een orde groter -- de melding hangt aan een OBJECT, een tweede melder
   wordt herkend in plaats van verdubbeld, en drie donkere palen op dezelfde
   voedingsgroep wijzen naar hun gedeelde oorzaak.

   Privacy zoals overal: meldingen hangen aan de codenaam (pseudoniem), de
   melder ziet alleen zijn eigen meldingen, en de vrije tekst gaat NIET mee in
   de AI-dataset (kern/aidata leest de zakentak met opzet niet). Begrensd tegen
   misbruik: hooguit vijf open meldingen per bewoner -- die grens staat nu in de
   motor, want hij hoort voor elk kanaal te gelden en niet alleen voor dit
   scherm. Krijgt de gedeelde ctx. */
module.exports = (ctx) => {
  const { zones, regie, DOMEINEN, standVan, alerts, SCENARIOS, zorgBasis, simuleer, weefsel } = ctx;

  // de vijf woorden waarin de app met bewoners praat; de vertaling naar de acht
  // stedelijke categorieen staat in kern/stadsweefsel/categorien.js
  const SOORTEN = { licht: 'kapotte verlichting', afval: 'volle of kapotte container', water: 'water op straat', geluid: 'geluidsoverlast', anders: 'iets anders' };

  /* Een zaak zoals de melder hem ziet. De weefsel-motor levert al de
     melderweergave (zijn EIGEN tekst, niet die van de buren die dezelfde paal
     meldden); hier komt alleen de woordkeuze van dit scherm overheen: "in
     behandeling" heet voor de melder gewoon open, want hij wacht nog. */
  const alsMelding = (z) => ({
    id: z.id, ref: z.ref, zone: z.plaats, soort: z.categorie, soortLabel: z.categorieLabel,
    tekst: z.tekst, status: z.status === 'in-behandeling' ? 'open' : z.status,
    melders: z.melders, at: z.at, klaarAt: z.klaarAt || null
  });

  // het beeld voor de bewoner: wat de stad doet, niet hoe hij bestuurd wordt
  function bewonerBeeld(codenaam) {
    zorgBasis(); simuleer();
    const s = SCENARIOS.find(x => x.naam === regie().scenario);
    return { status: 200,
      scenario: { naam: regie().scenario, label: s ? s.label : regie().scenario, uitleg: s ? s.uitleg : '' },
      domeinen: DOMEINEN.map(x => {
        const rij = { id: x.id, label: x.label, eenheid: x.eenheid, ...standVan(x.id) };
        if (x.id === 'verkeer') { const v = ctx.verkeerExtra && ctx.verkeerExtra(); if (v) rij.ovOnderweg = Number(v.ovOnderweg) || 0; }
        return rij;
      }),
      alerts: alerts(), zones: zones().slice(), soorten: SOORTEN,
      mijnMeldingen: weefsel.weefselZakenVanMelder(codenaam).slice(0, 20).map(alsMelding),
      privacy: 'de stad meet dingen, geen mensen; je melding hangt aan je codenaam en is alleen voor jou en de veldploeg zichtbaar' };
  }

  /* Melden. De zone-controle blijft hier: de app biedt een keuzelijst met zones
     aan, en een onbekende zone hoort een nette 400 te geven in plaats van een
     zaak op een gegokte plek. De overige regels (tekstlengte, het aantal open
     meldingen, de duplicaatvraag) staan in de motor. */
  function meld({ codenaam, zone, soort, tekst }) {
    zorgBasis();
    const cn = String(codenaam || '').trim();
    if (!cn) return { status: 401, error: 'Log opnieuw in.' };
    const z = String(zone || '').trim();
    if (!zones().includes(z)) return { status: 400, error: 'Kies een bestaande zone: ' + zones().join(', ') + '.' };
    if (!SOORTEN[String(soort || '')]) return { status: 400, error: 'Kies wat er speelt: ' + Object.keys(SOORTEN).join(', ') + '.' };
    const r = weefsel.weefselMeld({ kanaal: 'bewonersapp', soort: String(soort), tekst, gebied: z, melder: cn });
    if (!r.ok) return r;
    return { ok: true, samengevoegd: r.duplicaat,
      melding: { id: r.zaak.id, ref: r.zaak.ref, zone: z, soort: r.zaak.categorie, status: r.zaak.status },
      ...(r.duplicaat ? { let_op: 'Dit was al bij ons bekend; je melding is bij die zaak gevoegd.' } : {}) };
  }

  return { api: { stadBewonerBeeld: bewonerBeeld, stadBewonerMeld: meld } };
};

/* Toernooi (deelmodule): HET SCHEMA -- welke vormen er zijn, wie tegen wie
   speelt, en wat de stand is.

   Afgesplitst uit ../toernooi.js: dat bestand gaat over de LEVENSLOOP van een
   toernooi (aanmaken, aanzeggen, een uitslag verwerken, opruimen), dit over de
   VORM ervan. Die twee gaan los van elkaar over de kop -- een derde
   toernooivorm raakt alleen dit bestand, en een andere manier van uitnodigen
   alleen dat.

   Wat hier staat heeft geen eigen geheugen: elke functie krijgt het toernooi
   mee en levert een schema of een stand. De opslag, het opslaan en het
   aanzeggen blijven aan de andere kant. */
module.exports = (ctx) => {
  const { save, potjeDirect, schud, codenaamVan, SOORTEN } = ctx;

  /* De maten en de vormen: welke velden er kunnen bestaan. Knockout alleen in
     machten van twee -- een vrijlot is een wedstrijd die iemand wint zonder te
     spelen, en dat is geen toernooi maar een cadeau. */
  const MAAT = { knockout: [4, 8], roundrobin: [3, 4, 5, 6, 7, 8] };
  const VORMEN = Object.keys(MAAT);
  const PUNT = { winst: 3, gelijk: 1 };

  // de gevraagde vorm en maat, teruggebracht tot iets dat bestaat
  const vormVan = (vorm) => (VORMEN.includes(vorm) ? vorm : 'knockout');
  const maatVan = (vorm, maat) => (MAAT[vorm].includes(Number(maat)) ? Number(maat) : MAAT[vorm][0]);

  /* Round robin: iedereen tegen iedereen, alle wedstrijden meteen. Dat mag
     hier omdat een potje op zijn beurt wacht en niemand tegelijk hoeft te
     spelen -- en het scheelt een rondeplanning die bij een oneven veld weer
     vrijloten zou vragen. */
  function maakAlleParen(t) {
    t.paren = [];
    for (let i = 0; i < t.spelers.length; i++)
      for (let j = i + 1; j < t.spelers.length; j++) {
        const potje = potjeDirect(t.soort, [t.spelers[i], t.spelers[j]], { toernooi: t.id });
        t.paren.push({ a: t.spelers[i], b: t.spelers[j], potje: potje.id, winnaar: null, gelijk: false });
      }
  }

  /* De stand van een round robin: winst 3, gelijk 1. Bij gelijke punten wint
     het onderlinge resultaat niet -- dat is bewust niet ingebouwd, want dan
     moet je ook cirkels van drie oplossen. Gelijk is hier gewoon gelijk, en
     dat staat er ook zo bij. */
  function standVan(t) {
    const punten = new Map(t.spelers.filter(Boolean).map(k => [k, { key: k, punten: 0, gespeeld: 0 }]));
    for (const p of t.paren || []) {
      if (!p.potje && !p.winnaar && !p.gelijk) continue;
      if (!p.winnaar && !p.gelijk) continue;
      for (const k of [p.a, p.b]) if (punten.has(k)) punten.get(k).gespeeld++;
      if (p.gelijk) { for (const k of [p.a, p.b]) if (punten.has(k)) punten.get(k).punten += PUNT.gelijk; }
      else if (punten.has(p.winnaar)) punten.get(p.winnaar).punten += PUNT.winst;
    }
    return [...punten.values()].sort((x, y) => y.punten - x.punten || y.gespeeld - x.gespeeld);
  }

  function maakRonde(t, door) {
    t.paren = [];
    for (let i = 0; i < door.length; i += 2) {
      const a = door[i], b = door[i + 1];
      const potje = potjeDirect(t.soort, [a, b], { toernooi: t.id });
      t.paren.push({ a, b, potje: potje.id, winnaar: null });
    }
  }

  /* HET VANGNET. Een openstaande wedstrijd waarvan het potje niet meer bestaat
     (verlaten en opgeruimd) zou het toernooi voor altijd laten wachten op een
     uitslag die nooit komt. Dat is precies het risico van "overspelen tot er
     een winnaar is", dus het hoort hier en niet in een losse opmerking. Wordt
     aangeroepen als iemand het toernooi opvraagt: geen achtergrondtaak die
     iets kan missen. */
  function controleerVastgelopen(t, potjes) {
    if (!t || t.status !== 'bezig') return t;
    const kwijt = (t.paren || []).some(p => !p.winnaar && !p.gelijk && p.potje && !potjes[p.potje]);
    if (!kwijt) return t;
    t.status = 'klaar';
    t.afgebroken = true;
    t.winnaar = null;
    save();
    return t;
  }

  /* De weergave voor een deelnemer: codenamen, nooit sleutels naar buiten
     behalve die van jezelf -- je hebt ze niet nodig om te kijken, en een
     toernooibord is iets wat meer mensen zien dan een potje. */
  function toon(t, mij) {
    return {
      id: t.id, naam: t.naam, soort: t.soort, spel: SOORTEN[t.soort] || t.soort,
      status: t.status, ronde: t.ronde, maat: t.maat, vorm: t.vorm, afgebroken: !!t.afgebroken,
      spelers: t.spelers.map(codenaamVan),
      wachtOp: t.uitgenodigd.length,
      ikDoeMee: t.spelers.includes(mij),
      uitgenodigd: t.uitgenodigd.includes(mij),
      winnaar: t.winnaar ? codenaamVan(t.winnaar) : null,
      stand: t.vorm === 'roundrobin'
        ? standVan(t).map(r => ({ codenaam: codenaamVan(r.key), punten: r.punten, gespeeld: r.gespeeld }))
        : null,
      paren: (t.paren || []).map(p => ({
        a: codenaamVan(p.a), b: codenaamVan(p.b),
        potje: (p.a === mij || p.b === mij) ? p.potje : null,   // alleen je eigen partij open je
        winnaar: p.winnaar ? codenaamVan(p.winnaar) : null, gelijk: !!p.gelijk
      })),
      at: t.at
    };
  }

  /* De loting. Schudden hoort bij het SCHEMA en niet bij de levensloop: het is
     de eerste beslissing over wie tegen wie speelt. */
  function loot(t) {
    t.spelers = schud(t.spelers.slice());
    if (t.vorm === 'roundrobin') maakAlleParen(t); else maakRonde(t, t.spelers);
  }

  return { MAAT, VORMEN, PUNT, vormVan, maatVan, maakAlleParen, maakRonde, standVan, controleerVastgelopen, loot, toon };
};

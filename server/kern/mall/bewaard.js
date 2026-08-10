/* RTG Mall, deelbestand "bewaard": HET HARTJE, EN WAT ER SINDSDIEN VERANDERDE.

   Twee dingen die vaak apart worden gebouwd en die hier met opzet EEN ding
   zijn: favorieten en het prijsalarm.

   ================== FAVORIETEN ZIJN EEN LIJST ==================

   "Bewaard" is een systeemlijst in ./lijsten.js, geen tweede opslag. Een eigen
   favorietentabel zou dezelfde vraag -- wat heeft dit lid bewaard? -- op twee
   plekken beantwoorden, en dan is het een kwestie van tijd tot het hartje aan
   staat en de lijst leeg is (LAT-regel 4). De lijst maakt zichzelf aan bij het
   eerste hartje en is niet te verwijderen.

   Favoriete ZAKEN zijn iets anders en bestonden al (db.data.favorieten, via
   kern/ervaring/leden/waardering.js). Die blijven daar; dit gaat over aanbod.

   ================== HET ALARM, EN WAT HET NIET DOET ==================

   Omdat elke bewaarde regel zijn prijs en beschikbaarheid van HET MOMENT VAN
   BEWAREN meekrijgt, is het prijsalarm geen nieuwe machinerie maar een
   vergelijking: wat stond er toen, wat staat er nu. Er wordt dus nergens een
   tweede prijs bijgehouden.

   Wat dit met opzet NIET is, en dat is hier de belangrijkste beslissing:

   1. GEEN MELDING DIE JE OPZOEKT. Er gaat geen push, geen e-mail, geen badge
      met een rood cijfer. Je ziet het wanneer je zelf de Mall opent. CLAUDE.md
      verbiedt verslavende patronen, en een prijsalarm is precies het soort
      ding dat je daarin laat ontsporen: een app die je uit je avond belt omdat
      een scooterhuur twee euro is gezakt, verkoopt niet beter, hij went alleen
      slechter.
   2. GEEN AFTELLENDE KLOK EN GEEN SCHAARSTE. Er staat niet "nog 2 beschikbaar"
      of "deze prijs geldt nog 4 uur". Er staat wat er is.
   3. GEEN VOORSPELLING. Er staat niet "koop nu, dit wordt duurder". Wij weten
      dat niet, en doen alsof is liegen met een grafiekje erbij.

   ================== WAT WE NIET WETEN, ZEGGEN WE ==================

   Regels die zijn bewaard voordat dit bestand bestond hebben geen vastgelegde
   beschikbaarheid. Daarover doet `wijzigingen` GEEN uitspraak: zo'n regel komt
   terug met `onbekendSindsdien: true` in plaats van als "onveranderd". Anders
   telt "wij weten het niet" stilletjes mee als "er is niets gebeurd"
   (LAT-regel 3). */

const RICHTING = {
  omlaag: 'De prijs is gezakt sinds u dit bewaarde.',
  omhoog: 'De prijs is gestegen sinds u dit bewaarde.'
};

module.exports = (ctx, hulp) => {
  const { save, crypto } = ctx;
  const { bak, voegToe, haalWeg, nu, BEWAARD } = hulp;

  /* De systeemlijst, aangemaakt zodra hij nodig is. Vooraf aanmaken bij elke
     registratie zou iedereen een lijst geven die de meesten nooit gebruiken. */
  function bewaardLijst(key) {
    const lijsten = bak(key);
    let l = lijsten.find(x => x.soort === BEWAARD);
    if (!l) {
      l = { id: crypto.randomBytes(4).toString('hex'), naam: 'Bewaard', soort: BEWAARD,
        plek: null, van: null, tot: null, regels: [], systeem: true, at: nu() };
      lijsten.unshift(l);
      save();
    }
    return l;
  }

  // het hartje aan of uit: staat het er al in, dan gaat het eruit
  function bewaarWissel(key, aanbodId) {
    const l = bewaardLijst(key);
    const gezocht = String(aanbodId || '');
    if (l.regels.some(r => r.aanbodId === gezocht)) {
      const r = haalWeg(key, l.id, gezocht);
      return r.ok ? { ok: true, bewaard: false, aantal: r.aantal } : r;
    }
    const r = voegToe(key, l.id, gezocht);
    return r.ok ? { ok: true, bewaard: true, aantal: r.aantal } : r;
  }

  // de ids die dit lid bewaard heeft, voor het filter "alleen mijn bewaarde"
  const bewaardeIds = (key) =>
    new Set((bak(key).find(l => l.soort === BEWAARD) || { regels: [] }).regels.map(r => r.aanbodId));

  /* Wat er veranderde aan alles wat dit lid bewaarde -- over AL zijn lijsten,
     niet alleen "Bewaard": wie een reismand bouwt wil ook weten dat het hotel
     erin duurder is geworden. */
  function wijzigingen(key) {
    const levend = new Map(ctx.aanbodAlles().aanbod.map(a => [a.id, a]));
    const uit = [];
    let bekeken = 0, onbekend = 0;
    for (const l of bak(key)) {
      for (const r of l.regels) {
        bekeken++;
        const a = levend.get(r.aanbodId);
        if (!a) {
          uit.push({ lijst: l.id, lijstNaam: l.naam, aanbodId: r.aanbodId, titel: r.titel,
            soort: 'weg', tekst: 'Dit staat niet meer in de Mall.' });
          continue;
        }
        const nuPrijs = a.prijs ? a.prijs.bedrag : null;
        if (r.prijsBijBewaren != null && nuPrijs != null && nuPrijs !== r.prijsBijBewaren) {
          const omlaag = nuPrijs < r.prijsBijBewaren;
          uit.push({
            lijst: l.id, lijstNaam: l.naam, aanbodId: a.id, titel: a.titel,
            soort: 'prijs', was: r.prijsBijBewaren, nu: nuPrijs,
            verschil: Math.round((nuPrijs - r.prijsBijBewaren) * 100) / 100,
            tekst: RICHTING[omlaag ? 'omlaag' : 'omhoog'], pagina: a.pagina
          });
        }
        /* De beschikbaarheid. Zonder vastgelegde stand bij het bewaren zeggen
           we hier NIETS -- niet "onveranderd", want dat weten we niet. */
        const nuStand = a.beschikbaar ? (a.beschikbaar.uit ? 'uit' : 'in') : null;
        if (r.beschikbaarBijBewaren == null || nuStand == null) { onbekend++; continue; }
        if (nuStand !== r.beschikbaarBijBewaren) {
          uit.push({
            lijst: l.id, lijstNaam: l.naam, aanbodId: a.id, titel: a.titel,
            soort: 'beschikbaar', was: r.beschikbaarBijBewaren, nu: nuStand,
            tekst: nuStand === 'in' ? 'Dit is weer beschikbaar.' : 'Dit is nu uitverkocht.',
            pagina: a.pagina
          });
        }
      }
    }
    return {
      ok: true,
      wijzigingen: uit,
      bekeken,
      /* Hoeveel regels we NIET op beschikbaarheid konden vergelijken. Dit getal
         hoort in het antwoord: staat het hoog, dan meet dit scherm minder dan
         het lijkt, en dat wil je zien in plaats van vermoeden. */
      zonderVergelijking: onbekend,
      opmerking: 'U ziet dit wanneer u zelf kijkt. RTG stuurt hier geen meldingen over en zet er geen klok bij.'
    };
  }

  return { bewaardLijst, bewaarWissel, bewaardeIds, mallWijzigingen: wijzigingen };
};

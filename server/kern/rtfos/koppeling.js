/* Foundation OS, deel "koppeling": wat er van RTF naar RTG loopt, en wat niet.

   DE VERLEIDING VAN EEN KOPPELVLAK IS OM TE DOEN ALSOF. Een lijstje met
   "RTG-vervoer: gekoppeld", "RTG-betalingen: gekoppeld" staat prachtig op een
   plaat en is binnen een maand een leugen -- want de eerste die erop klikt,
   merkt dat er niets gebeurt. Dat is LAT.md regel 6 (een belofte in tekst is
   een belofte in code) en regel 3 (een meter zonder invoer hoort te zakken, en
   niet te zwijgen).

   Daarom is dit bord LEEG waar het leeg is. Elke koppeling zegt of hij WERKT,
   en zo niet: waarom niet en wat ervoor nodig is. Geen "binnenkort", geen
   halfwerkende knop die stilletjes niets doet.

   WAT ER VANDAAG ECHT WERKT: de agenda. Een RTF-activiteit gaat als afspraak in
   de PERSOONLIJKE RTG-agenda van degene die erom vraagt (kern/agenda.js,
   dezelfde motor als de leden-app). Bewust die richting en niet andersom:
   RTF weet niets van RTG-leden, en een activiteit in de agenda van een ander
   zetten zou betekenen dat dit systeem RTG-accounts kan aanraken die niet van
   de aanvrager zijn.

   WAT ER NIET WERKT, EN WAAROM DAT ZO OPGESCHREVEN STAAT:
   - VERVOER: een rit voor een vrijwilliger of deelnemer raakt een adres, en dat
     staat hier bewust nergens (de casus heeft een codenaam, geen adres). Een
     koppeling vraagt dus eerst een besluit over welke gegevens de vervoerskant
     mag zien -- dat is een privacyvraag en geen technische.
   - BETALINGEN: donaties lopen nu als BRON in de eigen administratie, niet als
     betaalstroom. Koppelen betekent geld verplaatsen, en dat gaat niet zonder
     de betaal-naad en een besluit van het landelijke bestuur over rekeningen.
   - CHAT: de communicatiemodule (berichten.js) legt vast WAT er is verstuurd,
     niet hoe. Een echte chatkoppeling vraagt een kanaal per groep en een
     bewaartermijn; beide bestaan hier nog niet.

   Wie zo'n koppeling bouwt, haalt hem hier van de lijst af door hem te laten
   werken. Tot die tijd is dit bord het eerlijke antwoord op "is het gekoppeld?" */

module.exports = (ctx, eigen) => {
  const { schoon, S, audit, wie, poort } = ctx;
  const { agenda } = eigen;

  /* De stand van de koppelingen. `werkt` is geen instelling maar een
     WAARNEMING: voor de agenda wordt gekeken of de motor er werkelijk is. Een
     vlag die met de hand op true staat, is precies het soort belofte waar deze
     module tegen bestaat. */
  function bord(req) {
    const w = wie(req);
    if (!w.key) return { status: 401, error: 'Log in om het koppelbord te zien.' };
    return { ok: true, koppelingen: [
      { id: 'agenda', naam: 'RTG-agenda', werkt: !!(agenda && typeof agenda.voegToe === 'function'),
        wat: 'Een RTF-activiteit als afspraak in uw eigen RTG-agenda.',
        nodig: null },
      { id: 'vervoer', naam: 'RTG-vervoer', werkt: false,
        wat: 'Ritten voor vrijwilligers en deelnemers.',
        nodig: 'Eerst een besluit welke gegevens de vervoerskant mag zien. Een hulpvraag heeft hier een codenaam en geen adres; dat is met opzet, en een rit heeft een adres nodig.' },
      { id: 'betalingen', naam: 'RTG-betalingen', werkt: false,
        wat: 'Donaties en uitbetalingen over de RTG-rails.',
        nodig: 'Donaties staan nu als bron in de eigen administratie. Koppelen betekent geld verplaatsen; dat vraagt de betaal-naad en een landelijk besluit over rekeningen.' },
      { id: 'chat', naam: 'RTG-chat', werkt: false,
        wat: 'Vrijwilligers-, project- en partnergroepen.',
        nodig: 'De communicatiemodule legt vast WAT er is verstuurd, niet hoe. Een kanaal per groep en een bewaartermijn moeten er eerst zijn.' }
    ] };
  }

  /* De agenda-koppeling, en het enige dat hier echt iets doet. De afspraak gaat
     naar de agenda van de AANVRAGER zelf ('lid:<sleutel>' -- dezelfde
     eigenaarsleutel als de leden-app gebruikt). */
  async function naarAgenda(req, activiteitId) {
    const a = S().activiteiten.find(x => x.id === String(activiteitId || ''));
    if (!a) return { status: 404, error: 'Deze activiteit bestaat niet.' };
    const w = wie(req);
    const g = poort(w, a.stad, 'stad.lezen', 'events');
    if (!g.ok) return g;
    if (!agenda || typeof agenda.voegToe !== 'function') {
      return { status: 503, error: 'De RTG-agenda draait niet in dit proces. Er is niets weggeschreven.' };
    }
    if (!a.wanneer) {
      return { status: 400, error: 'Deze activiteit heeft nog geen datum. Een afspraak zonder datum kan de agenda niet aannemen.' };
    }
    if (!w.key || !String(w.key).startsWith('user-')) {
      /* De gedeelde kantoorcode heeft geen persoonlijke agenda. Dat is geen
         fout maar het gevolg van dezelfde regel als bij de zetels: wat aan een
         mens hangt, vraagt een mens. */
      return { status: 400, error: 'Deze koppeling zet de afspraak in UW eigen RTG-agenda, en daarvoor is een persoonlijke inlog nodig. Meld u aan met uw eigen RTG-account.' };
    }
    const r = await agenda.voegToe('lid:' + w.key, {
      titel: 'RTF: ' + a.naam,
      datum: a.wanneer,
      tijd: a.tijd || null,
      notitie: [a.locatie, 'RTF ' + (g.stad.naam || ''), a.soort].filter(Boolean).join(' - ').slice(0, 300)
    });
    if (r && r.error) return { status: 400, error: r.error };
    audit(w.key, 'koppeling.agenda', a.naam, 'in eigen RTG-agenda');
    return { ok: true, item: r.item,
      melding: '"' + a.naam + '" staat in uw eigen RTG-agenda op ' + a.wanneer + '.' };
  }

  /* Een koppeling die niet bestaat, geeft geen stilte maar het antwoord van het
     bord. Dat scheelt de volgende bouwer een uur zoeken naar waar het misgaat:
     er gaat niets mis, er is niets. */
  function nietGekoppeld(req, welke) {
    const b = bord(req);
    if (!b.ok) return b;
    const k = b.koppelingen.find(x => x.id === schoon(welke, 30));
    if (!k) return { status: 404, error: 'Deze koppeling kennen we niet.' };
    if (k.werkt) return { status: 400, error: 'Deze koppeling werkt wel; gebruik zijn eigen ingang.' };
    return { status: 503, error: k.naam + ' is niet gekoppeld. ' + k.nodig };
  }

  return { bord, naarAgenda, nietGekoppeld };
};

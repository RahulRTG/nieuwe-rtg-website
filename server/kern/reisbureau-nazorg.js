/* WAT ER NA EEN BEVESTIGING GEBEURT -- de nazorg van een reisaanvraag.

   DE NAAD. ../reisbureau.js is wat een LID met het reisbureau doet,
   ./reisbureau-besluit.js is wat het KANTOOR met een OPEN aanvraag doet. Dit
   bestand is het derde stuk en het miste: wat er gebeurt als de reis al
   bevestigd is. Dat was een echte doodlopende weg -- de meting van 10 september
   2026 (TRAVELCOMMERCE.md par. 9) liep hem van beide kanten vast:

     lid annuleert een bevestigde reis  -> "Deze aanvraag is al bevestigd."
     kantoor wijzigt of zegt af         -> exact dezelfde weigering

   Wijzigen en afzeggen zijn het dagelijks werk van een reisbureau, en ze
   bestonden geen van beide. Wat hier bij komt is precies die twee, en niets
   meer.

   TWEE REGELS DIE DE VORM BEPALEN.

   1. HET LID VRAAGT, HET KANTOOR BESLIST. Een bevestiging is een toezegging aan
      een lid; die mag het lid niet zelf omschrijven naar een andere datum. Een
      wijzigingsverzoek zet de reis daarom op `wijziging-gevraagd` met de wens
      ERNAAST, en pas een mens van het kantoor past hem toe of wijst hem af. Dat
      is dezelfde vorm als het oorspronkelijke besluit, en dezelfde als
      REIZEN.md par. 2.1: RTG stelt samen en zet klaar, een mens maakt het af.

   2. AFZEGGEN IS IETS ANDERS DAN INTREKKEN, en het draagt daarom een eigen
      stand. `geannuleerd` is een lid dat een OPEN aanvraag terugtrekt -- er was
      niets toegezegd. `afgezegd` is een reis die WEL rond was en alsnog niet
      doorgaat. Wie die twee op een hoop gooit, kan achteraf niet meer zien of er
      ooit iets beloofd is, en dat is precies wat je bij een geschil wilt weten.

   HET GELD WORDT KLAARGEZET, NIET VERPLAATST. Een BETAALDE reis krijgt bij het
   afzeggen een teruggaverecht (kern/reisbureau-teruggave.js) dat een mens van
   het kantoor uitvoert; een onbetaalde houdt `nietGeregeld` met de reden erbij
   (KOSTEN.md: geen nul maar een reden).

   DE GESCHIEDENIS GROEIT AAN EN WORDT NOOIT HERSCHREVEN. Elke stap zet een
   regel bij: wat, wanneer, door wie, en waarom. Dat is het actielog uit het
   wereldpatroon (REIZEN.md par. 6) op het enige object dat hier van stand
   verandert. */
'use strict';

// de standen waarin nog iets van het kantoor wordt verwacht
const OPEN_STANDEN = ['aangevraagd', 'wijziging-gevraagd'];
// de standen waarin een reis rond is en dus afgezegd KAN worden
const ROND_STANDEN = ['bevestigd', 'wijziging-gevraagd'];

/* DE AANVRAGEN KOMEN BINNEN ALS `rij`, en dit bestand raakt db.data niet aan.
   Waar de aanvragen wonen, weet ../reisbureau.js -- die deur is er al en er hoort
   er geen tweede naast te komen. Dat is dezelfde regel die scripts/deuren.js
   telt en die NORM.json op een ratel heeft staan: elk bestand buiten server/db/
   dat db.data rechtstreeks aanraakt, is een plek waar de opslag kan verschuiven
   zonder dat iemand het merkt. */
module.exports = ({ rij, save, nu, dossier, visum, meldLid, terugboeken }) => {

  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);

  /* Een regel bij de geschiedenis. `door` is een INTERNE naam (een sleutel van
     het kantoor, of 'lid'); wat het lid ervan ziet wordt in ./lidbeeld gefilterd
     -- zie lidBeeld() onderaan. */
  function spoor(a, wat, door, extra) {
    if (!Array.isArray(a.geschiedenis)) a.geschiedenis = [];
    a.geschiedenis.push({ wat, at: nu(), door: schoon(door, 60) || 'onbekend', ...(extra || {}) });
    // een reis met honderd wijzigingen is geen reis meer; de oudste blijft staan
    if (a.geschiedenis.length > 50) a.geschiedenis = a.geschiedenis.slice(-50);
  }

  function pak(ref, standen, watMag) {
    const a = rij().find(x => x.ref === String(ref || '').trim());
    if (!a) return { status: 404, error: 'Reisaanvraag niet gevonden.' };
    if (!standen.includes(a.status))
      return { status: 409, error: 'Deze reis is ' + a.status + '; ' + watMag };
    return { aanvraag: a };
  }

  /* Het bedrag hoort bij het aantal personen, en de prijs per persoon is de
     enige die vaststaat. Hier opnieuw rekenen in plaats van het oude totaal
     laten staan: anders reist er een derde persoon mee voor het bedrag van
     twee. */
  function herbereken(a) {
    const pp = Math.max(0, Number(a.prijs && a.prijs.pp) || 0);
    a.prijs = { pp, totaal: Math.round(pp * a.personen * 100) / 100, valuta: 'EUR' };
  }

  /* ---- 1. DE WIJZIGING staat in ./reisbureau-wijziging.js ----
     Afgesplitst op de 10 kB-grens, en op een echte naad: een wijziging is een
     GESPREK van twee kanten (het lid vraagt, het kantoor beslist) en afzeggen
     is een EINDE dat beide kanten alleen kunnen aankondigen. Wat ze delen --
     de standcontrole, het spoor, de herberekening en het bericht aan het lid --
     wordt hier een keer gemaakt en daarheen doorgegeven, zodat er maar EEN plek
     is waar een reis van stand verandert. */

  /* ---- 2. AFZEGGEN, VAN BEIDE KANTEN ---- */

  /* WIE ZEGT AF MAAKT UIT, en niet alleen voor het spoor. Zegt het KANTOOR af,
     dan krijgt het lid bericht -- dat is nieuws voor hem. Zegt het LID af, dan
     weet hij het al en komt de afzegging op de balie te liggen. Beide kanten
     eisen een reden: een lid dat "afgezegd" leest zonder te weten waarom belt,
     en een medewerker die een lege afzegging ziet ook. */
  async function zegAf({ ref, doorLid, key, door, reden }) {
    const tekst = schoon(reden, 300);
    if (!tekst) return { status: 400, error: 'Afzeggen kan alleen met een reden.' };
    const wie = doorLid ? 'lid' : schoon(door, 60);
    if (!doorLid && !wie) return { status: 400, error: 'Een afzegging zonder naam eronder is geen afzegging.' };

    const g = pak(ref, ROND_STANDEN, 'afzeggen kan alleen bij een reis die rond is.');
    if (g.error) return g;
    const a = g.aanvraag;
    if (doorLid && a.customerKey !== key) return { status: 404, error: 'Reisaanvraag niet gevonden.' };

    /* Eerst het geld, dan de stand: een BETAALDE reis krijgt een teruggaverecht
       (kern/reisbureau-teruggave.js), anders wordt hij niet afgezegd (D9). */
    let geld = { stand: 'nietGeregeld', uitleg: 'Niet via RTG betaald; een mens handelt het geld af, dit systeem verplaatste niets.' };
    if (a.betaald) {
      const t = terugboeken ? terugboeken(a.ref, { reden: tekst }) : { status: 503, error: 'geen terugboeklaag' };
      if (!t.ok) return { status: t.status || 409, error: 'Betaalde reis; de teruggave kon niet klaar: ' + t.error };
      geld = { stand: 'teruggaveKlaargezet', recht: t.recht, centen: t.centen,
        uitleg: 'Het bedrag staat klaar om terug te betalen; een mens van het kantoor voert het uit.' };
    }
    a.status = 'afgezegd';
    a.afzegging = { door: doorLid ? 'lid' : 'reisbureau', reden: tekst, at: nu() };
    a.geld = geld;
    spoor(a, 'afgezegd', wie, { reden: tekst });
    save();

    // een reis die niet doorgaat hoort niet meer in het dossier en niet in de agenda
    if (dossier) dossier.weghalen(a.customerKey, a.ref);
    const vt = visum && visum();
    if (vt) await vt.bijAnnulering(a.customerKey, a.ref);

    if (!doorLid) meld(a, { title: 'Uw reis gaat niet door', body: reisNaam(a) + ': ' + tekst });
    return { ok: true, aanvraag: a };
  }

  /* ---- het bericht aan het lid ---- */

  const reisNaam = (a) => a.titel + ' (' + a.bestemming + ')';

  /* De melding valt onder de scope `orders`: deze reis staat in "alles wat u
     lopen heeft" (kern/mall/bestellingen.js), en een lid dat die meldingen heeft
     uitgezet hoort ze ook hier niet te krijgen. meldLid is laat gebonden, want
     de meldingslaag wordt eerder opgebouwd dan deze kern maar wordt hier als
     functie doorgegeven; zonder haar loopt alles gewoon door. */
  function meld(a, note) {
    const m = typeof meldLid === 'function' ? meldLid : null;
    if (!m || !a.customerKey) return null;
    try { return m(a.customerKey, { icon: 'reisboek', scope: 'orders', ...note }); }
    catch (e) { console.error('[reisbureau-nazorg] melding niet bezorgd'); return null; }
  }

  /* ---- wat het lid van de nazorg ziet ----

     Dezelfde regel als bij het besluit in ./reisbureau-besluit.js: het lid ziet
     WAT er is gebeurd en WANNEER, niet WIE er in het kantoor op de knop drukte.
     Die naam is een interne sleutel ('user-3', of "backoffice (gedeelde code)")
     en hoort in het kantoor te blijven. Zijn eigen handelingen ziet hij wel als
     de zijne. */
  function lidBeeld(a) {
    if (!a.geschiedenis) return a;
    return Object.assign({}, a, {
      geschiedenis: a.geschiedenis.map(r => {
        const uit = { wat: r.wat, at: r.at, door: r.door === 'lid' ? 'u' : 'het reisbureau' };
        for (const veld of ['reden', 'bericht', 'toelichting', 'gevraagd', 'was', 'werd']) {
          if (r[veld] != null) uit[veld] = r[veld];
        }
        return uit;
      })
    });
  }

  const { vraagWijziging, besluitWijziging } =
    require('./reisbureau-wijziging')({ pak, spoor, herbereken, meld, reisNaam, schoon, nu, save });

  // thuis: de reis is voorbij (./reisbureau-thuis.js, besluit C3)
  const { markeerThuis } = require('./reisbureau-thuis')({ pak, spoor, schoon, nu, save });

  return { vraagWijziging, besluitWijziging, zegAf, markeerThuis, lidBeeld, spoor, OPEN_STANDEN, ROND_STANDEN };
};

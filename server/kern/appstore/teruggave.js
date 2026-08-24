/* ============================================================================
   HET TERUGGAVERECHT -- wat er ontstaat als een app die iemand heeft GEKOCHT
   wordt ingetrokken.

   HIER ZAT EEN ECHTE SPANNING, EN DIT IS HOE HIJ IS OPGELOST. Grens 5 van de
   App Store zegt dat intrekken onmiddellijk werkt en overal -- ook bij de leden
   die de app al hadden. Die grens is er voor de veiligheid en mag niet zachter:
   een app die gevaarlijk blijkt, hoort weg te zijn voordat iemand nadenkt over
   geld. Maar een lid dat ervoor betaald heeft, is dan zijn aankoop kwijt door
   een besluit van ons.

   De uitweg is niet de grens verzachten maar het geld apart regelen. Intrekken
   blijft absoluut; wat het achterlaat is een RECHT, dat wordt KLAARGEZET. Een
   mens van RTG betaalt terug of wijst af met een reden. Automatisch terugboeken
   zou geld verplaatsen zonder dat iemand het besloot, en dat is precies wat
   GELD.md par. 3 verbiedt -- ook als de richting sympathiek is.
   ========================================================================== */
'use strict';

module.exports = function maakTeruggave({ S, save, nu, boek, eigen, pay, aankopen }) {

  function rechten() { const s = S(); if (!Array.isArray(s.teruggaven)) s.teruggaven = []; return s.teruggaven; }

  /* Een ingetrokken app die iemand heeft GEKOCHT, laat een recht achter. Het
     wordt hier alleen KLAARGEZET: uitbetalen is een handeling van een mens, en
     dat is dezelfde regel als overal waar geld dit huis raakt. */
  function rechtenBijIntrekken(sleutel, reden, door) {
    const s = S();
    const bak = s.aankopen && typeof s.aankopen === 'object' ? s.aankopen : {};
    let n = 0;
    for (const key of Object.keys(bak)) {
      const b = eigen(bak, key) ? eigen(bak, key)[String(sleutel)] : null;
      if (!b || b.brutoCenten <= 0) continue;
      if (rechten().some(x => x.key === key && x.sleutel === sleutel && x.status === 'open')) continue;
      rechten().unshift({ id: 'tg' + Math.random().toString(36).slice(2, 10), key, sleutel, naam: b.naam,
        codenaam: b.codenaam || null,
        /* De drie potjes van de bon gaan MEE op het recht. Terugbetalen loopt de
           weg van de verkoop terug -- de uitgever geeft zijn netto terug, RTG de
           btw en de afdracht -- en die verdeling hoort bevroren te zijn op het
           moment van intrekken, niet opnieuw uitgerekend met de tarieven van
           later. */
        uitgeverCenten: b.uitgeverCenten || 0, btwCenten: b.btwCenten || 0, afdrachtCenten: b.afdrachtCenten || 0,
        centen: b.brutoCenten, zaak: b.zaak, gekochtOp: b.at, ingetrokkenDoor: door || null,
        reden: reden || null, status: 'open', at: nu(), besluit: null });
      n++;
    }
    if (rechten().length > 20000) rechten().length = 20000;
    if (n) boek('teruggaverechten-open', sleutel, door || null, { aantal: n });
    return n;
  }

  const openRechten = () => rechten().filter(x => x.status === 'open').slice(0, 200);

  /* Afhandelen. Twee wegen, en allebei met een naam eronder: terugbetalen (het
     geld gaat van de zaak terug naar het lid) of afwijzen met een reden. */
  async function rechtDoe({ id, besluit, reden, door, idem }) {
    const r = rechten().find(x => x.id === String(id || ''));
    if (!r) return { status: 404, error: 'Dit teruggaverecht bestaat niet.' };
    if (r.status !== 'open') return { status: 409, error: 'Hierover is al besloten (' + r.status + ').' };
    const wie = String(door || '').trim().slice(0, 80);
    if (!wie) return { status: 400, error: 'Zet je naam erbij: een besluit over andermans geld hoort een mens te hebben genomen.' };
    if (besluit === 'afgewezen') {
      if (String(reden || '').trim().length < 10) return { status: 400, error: 'Een afwijzing draagt een reden van ten minste tien tekens; die leest het lid.' };
      r.status = 'afgewezen'; r.besluit = { door: wie, at: nu(), reden: String(reden).trim().slice(0, 400) };
      boek('teruggave-afgewezen', r.sleutel, wie, { id: r.id, reden: r.besluit.reden });
      save();
      return { status: 200, ok: true, recht: r };
    }
    if (besluit !== 'terugbetaald') return { status: 400, error: 'Een besluit is terugbetaald of afgewezen.' };
    /* Het betaaladres staat op de bon en wordt hier niet opnieuw opgezocht: een
       tweede weg naar dezelfde waarheid kan afwijken, en bij geld is dat het
       verschil tussen "terugbetaald" en "aan iemand anders overgemaakt". */
    const codenaam = r.codenaam;
    if (!codenaam) return { status: 409, error: 'Bij deze aanschaf staat geen betaaladres; er is niets om naar terug te betalen.' };
    const b = await pay.terugGave({ codenaam, vanPartner: r.zaak, partnerCenten: r.uitgeverCenten,
      uitRtg: [{ rekening: 'rtg:btw', centen: r.btwCenten }, { rekening: 'rtg:appstore', centen: r.afdrachtCenten }],
      oms: 'Teruggave App Store: ' + r.naam, ref: r.sleutel, idem: idem || r.id });
    if (b.error) return { status: b.status || 400, error: b.error };
    r.status = 'terugbetaald'; r.besluit = { door: wie, at: nu(), reden: String(reden || '').trim().slice(0, 400) || null, delen: b.delen };
    boek('teruggave-betaald', r.sleutel, wie, { id: r.id, centen: b.centen });
    save();
    return { status: 200, ok: true, recht: r };
  }

  return { rechtenBijIntrekken, openRechten, rechtDoe };
};

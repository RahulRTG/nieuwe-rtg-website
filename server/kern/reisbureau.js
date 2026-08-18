/* Het RTG-reisbureau: een echt reisbureau in de leden-app. Leden bladeren door
   de samengestelde reizen (dezelfde die het partnerkanaal aan niet-leden toont,
   maar tegen de nettoprijs zonder opslag), en vragen een reis aan. De aanvraag
   landt bij een RTG-reisadviseur, die de datum bevestigt en de losse onderdelen
   (verblijf, transfers, tafels) regelt. Nooit de belofte dat iets al geboekt is:
   een aanvraag heet "aangevraagd" tot een mens hem bevestigt. Die mens zit in de
   kamer Reisbureau van het RTG-kantoor en drukt op `besluit` (onderaan); zonder
   die kamer was dit een belofte zonder iemand die hem kon waarmaken.

   Geen echte lucht-/hotelmerken als bevestigde partners. Prijzen in euro.
   Volgt het vaste kern-patroon maakReisbureau(state). */

/* De reizen zoals het lid ze ziet: nettoprijs per persoon, geen opslag. Staat
   als pure functie buiten de fabriek omdat de Mall-vindlaag (kern/mall/aanbod
   .js) dezelfde projectie nodig heeft en er geen tweede versie van de prijs-
   en veldnamen mag ontstaan (LAT-regel 4): een reis die hier EUR 2200 kost en
   in de Mall EUR 22 is precies het soort verschil dat niemand ziet aankomen. */
function reisAanbod(db) {
  return ((db.data || {}).partnerTrips || []).map(t => ({
    id: t.id, titel: t.title, bestemming: t.dest, dates: t.dates || null,
    prijs: Math.max(0, Number(t.netto) || 0),
    omschrijving: t.desc || null,
    inbegrepen: Array.isArray(t.includes) ? t.includes : [],
    visual: t.visual || null
  }));
}

function maakReisbureau({ db, save, crypto, visumtaakVan }) {
  const nu = () => new Date().toISOString();
  // de visumtaak-laag is optioneel en laat gebonden; zonder haar loopt alles door
  const visum = () => (visumtaakVan && visumtaakVan()) || null;

  const reizen = () => reisAanbod(db);
  /* Het lokale reisadvies woont apart (./reisbureau-advies.js): het is de enige
     laag hier die niets met de aanvraag doet -- hij LEEST alleen de catalogus en
     rangschikt hem. Het draait op dezelfde `reizen()`, zodat er geen tweede
     projectie van de prijs ontstaat (LAT-regel 4). */
  const { advies } = require('./reisbureau-advies')({ reizen });

  function overzicht() {
    const lijst = reizen();
    return {
      ok: true, reizen: lijst, aantal: lijst.length, valuta: 'EUR',
      opmerking: 'Het RTG-reisbureau. Leden reizen tegen de nettoprijs, zonder opslag. Je vraagt een reis aan; een RTG-reisadviseur bevestigt de datum en stelt de reis samen. Prijzen per persoon, in euro.'
    };
  }

  // een lid vraagt een reis aan; de aanvraag komt bij het reisbureau te liggen
  async function boek(sess, codename, data) {
    data = data || {};
    const trip = (db.data.partnerTrips || []).find(t => t.id === String(data.tripId || ''));
    if (!trip) return { status: 404, error: 'Reis niet gevonden.' };
    const personen = Math.min(20, Math.max(1, Math.round(Number(data.personen) || 1)));
    const vertrek = /^\d{4}-\d{2}-\d{2}$/.test(String(data.vertrek || '')) ? data.vertrek : null;
    const notitie = String(data.notitie || '').replace(/[<>]/g, '').trim().slice(0, 300);
    const pp = Math.max(0, Number(trip.netto) || 0);
    if (!Array.isArray(db.data.reisAanvragen)) db.data.reisAanvragen = [];
    // dubbele aanvraag remmen: dezelfde reis, nog open, van hetzelfde lid
    if (db.data.reisAanvragen.some(a => a.status === 'aangevraagd' && a.customerKey === sess.key && a.tripId === trip.id))
      return { status: 409, error: 'Je aanvraag voor deze reis staat al open. Een reisadviseur neemt contact met je op.' };
    const entry = {
      ref: 'RTG-R-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      tripId: trip.id, titel: trip.title, bestemming: trip.dest,
      customerKey: sess.key, codename, personen, vertrek, notitie,
      prijs: { pp, totaal: Math.round(pp * personen * 100) / 100, valuta: 'EUR' },
      status: 'aangevraagd', at: nu()
    };
    db.data.reisAanvragen.unshift(entry);
    db.data.reisAanvragen = db.data.reisAanvragen.slice(0, 5000);
    save();
    // is de bestemming visumplichtig, dan staat de aanvraag-taak meteen klaar
    const vt = visum();
    const taak = vt ? (await vt.bijBoeking(sess.key, { ref: entry.ref, bestemming: trip.dest, vertrek })).taak : null;
    return { ok: true, aanvraag: entry, visumtaak: taak };
  }

  /* WAT HET LID VAN EEN BESLUIT ZIET: de stand, wanneer het genomen is en het
     bericht van de adviseur -- niet WIE er in het kantoor op de knop drukte.
     Die naam is een interne sleutel (`user-3`, of "backoffice (gedeelde code)")
     en hoort in het kantoor te blijven; het lid heeft aan een mens met een
     bericht genoeg. Het besluit zelf staat wel op de aanvraag, want het kantoor
     leest dezelfde rij. */
  function mijn(key) {
    return (db.data.reisAanvragen || []).filter(a => a.customerKey === key).slice(0, 50)
      .map(a => a.besluit
        ? Object.assign({}, a, { besluit: { at: a.besluit.at, bericht: a.besluit.bericht } })
        : a);
  }

  // een lid trekt zijn eigen aanvraag in zolang die nog openstaat
  async function annuleer(key, ref) {
    const a = (db.data.reisAanvragen || []).find(x => x.ref === String(ref || '') && x.customerKey === key);
    if (!a) return { status: 404, error: 'Reisaanvraag niet gevonden.' };
    if (a.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al ' + a.status + '.' };
    a.status = 'geannuleerd';
    save();
    // de visumtaak van deze reis gaat mee weg; een taak voor een reis die
    // niet doorgaat is ruis in de agenda
    const vt = visum();
    if (vt) await vt.bijAnnulering(key, a.ref);
    return { ok: true, aanvraag: a };
  }

  // het reisbureau-kantoor: de openstaande aanvragen (codenamen, nooit echte namen)
  function aanvragen() {
    return { ok: true, aanvragen: (db.data.reisAanvragen || []).slice(0, 200) };
  }

  /* HET BESLUIT VAN DE REISADVISEUR -- de stap die hier tot vandaag ontbrak.
     Bovenaan dit bestand staat: een aanvraag heet "aangevraagd" tot een mens
     hem bevestigt. Dat was een belofte zonder mens: `boek` zette de stand op
     "aangevraagd", `annuleer` kon hem namens het lid op "geannuleerd" zetten,
     en verder kon niemand er iets aan doen. De rest van het platform rekende er
     wel al op -- de reisagenda laat alleen "aangevraagd" en "bevestigd" op de
     dagen zien (kern/ervaring/leden/spaarpot.js) en de reiswereld heeft voor
     "bevestigd" en "afgewezen" allang een teken en een signaal klaarliggen
     (kern/reiswereld.js). Vandaar deze twee woorden en geen eigen vocabulaire:
     de betekenis van een stand woont daar, niet hier (LAT-regel 4).

     WIE beslist komt van de aanroeper uit de SESSIE en niet uit het verzoek;
     zie de kop van routes/kantoren/index.js bij de identiteitskluis. Een naam
     die de aanvrager zelf invult is geen naam.

     Afwijzen kan alleen met een reden. Een lid dat "afgewezen" leest zonder te
     weten waarom, belt -- en dan is de balie alsnog aan zet, maar nu met een
     boos lid. Bevestigen mag zonder bericht: de bevestiging IS het bericht. */
  async function besluit(ref, stand, door, bericht) {
    if (stand !== 'bevestigd' && stand !== 'afgewezen')
      return { status: 400, error: 'Een reisaanvraag wordt bevestigd of afgewezen; een andere uitkomst kent het reisbureau niet.' };
    const wie = String(door || '').replace(/[<>]/g, '').trim().slice(0, 60);
    if (!wie) return { status: 400, error: 'Een besluit zonder naam eronder is geen besluit.' };
    const a = (db.data.reisAanvragen || []).find(x => x.ref === String(ref || '').trim());
    if (!a) return { status: 404, error: 'Reisaanvraag niet gevonden.' };
    if (a.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al ' + a.status + '.' };
    const tekst = String(bericht || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (stand === 'afgewezen' && !tekst)
      return { status: 400, error: 'Afwijzen kan alleen met een reden voor het lid.' };
    a.status = stand;
    a.besluit = { door: wie, at: nu(), bericht: tekst || null };
    save();
    /* Een afgewezen reis gaat niet door, dus de visumtaak eromheen ook niet --
       dezelfde redenering als bij een ingetrokken aanvraag: een taak voor een
       reis die niet doorgaat is ruis in de agenda. Bij een bevestiging blijft
       de taak juist staan; die wordt vanaf nu pas echt urgent. */
    if (stand === 'afgewezen') { const vt = visum(); if (vt) await vt.bijAnnulering(a.customerKey, a.ref); }
    return { ok: true, aanvraag: a };
  }

  return { reisbureau: { overzicht, boek, mijn, annuleer, advies, reizen, aanvragen, besluit } };
}

module.exports = { maakReisbureau, reisAanbod };

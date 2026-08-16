/* Het RTG-reisbureau: een echt reisbureau in de leden-app. Leden bladeren door
   de samengestelde reizen (dezelfde die het partnerkanaal aan niet-leden toont,
   maar tegen de nettoprijs zonder opslag), en vragen een reis aan. De aanvraag
   landt bij een RTG-reisadviseur, die de datum bevestigt en de losse onderdelen
   (verblijf, transfers, tafels) regelt. Nooit de belofte dat iets al geboekt is:
   een aanvraag heet "aangevraagd" tot een mens hem bevestigt.

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

  function mijn(key) {
    return (db.data.reisAanvragen || []).filter(a => a.customerKey === key).slice(0, 50);
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

  /* Lokaal reisadvies: het lid vertelt in vrije tekst wat het zoekt. Een
     uitlegbare score wijst de best passende reis uit de bestaande catalogus
     aan en toont de woorden waarop de overeenkomst berust. */
  function regelRangschik(wens) {
    const lijst = reizen();
    if (!lijst.length) return null;
    const w = String(wens || '').toLowerCase();
    const woorden = [...new Set(w.split(/[^a-z0-9à-ÿ]+/).filter(x => x.length > 2))];
    const stop = new Set(['een', 'het', 'die', 'dat', 'met', 'voor', 'naar', 'van', 'zoek', 'willen', 'graag', 'reis']);
    const intenties = [
      ['rust', ['rust', 'stilte', 'rustig', 'natuur', 'wandelen', 'bergen']],
      ['zon', ['zon', 'strand', 'zee', 'warm', 'zwemmen', 'kust']],
      ['cultuur', ['cultuur', 'kunst', 'museum', 'historie', 'stad', 'architectuur']],
      ['culinair', ['culinair', 'eten', 'restaurant', 'wijn', 'keuken', 'proeven']],
      ['avontuur', ['avontuur', 'actief', 'hiken', 'surfen', 'safari', 'duiken']]
    ];
    const uitgebreid = new Set(woorden.filter(x => !stop.has(x)));
    for (const [, groep] of intenties) if (groep.some(x => uitgebreid.has(x))) for (const x of groep) uitgebreid.add(x);
    let beste = lijst[0], score = -1, treffers = [];
    for (const r of lijst) {
      const hooi = ((r.bestemming || '') + ' ' + (r.titel || '') + ' ' + (r.omschrijving || '') + ' ' + (r.inbegrepen || []).join(' ')).toLowerCase();
      const raak = [...uitgebreid].filter(woord => hooi.includes(woord));
      const s = raak.length;
      if (s > score) { score = s; beste = r; treffers = raak; }
    }
    return { reis: beste, score, treffers: treffers.slice(0, 4) };
  }
  async function advies(wens) {
    const lijst = reizen();
    if (!lijst.length) return { status: 404, error: 'Er staan nu geen reizen klaar.' };
    const val = regelRangschik(wens);
    const reden = val.treffers.length
      ? 'Deze reis sluit aan op ' + val.treffers.join(', ') + '.'
      : 'Er is geen sterke inhoudelijke match; dit is het eerste beschikbare voorstel om mee te vergelijken.';
    return { ok: true, reis: val.reis, reden, bron: 'regel', ai: false,
      onderbouwing: { score: val.score, treffers: val.treffers } };
  }

  // het reisbureau-kantoor: de openstaande aanvragen (codenamen, nooit echte namen)
  function aanvragen() {
    return { ok: true, aanvragen: (db.data.reisAanvragen || []).slice(0, 200) };
  }

  return { reisbureau: { overzicht, boek, mijn, annuleer, advies, reizen, aanvragen } };
}

module.exports = { maakReisbureau, reisAanbod };

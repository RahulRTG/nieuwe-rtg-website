/* Het RTG-reisbureau: een echt reisbureau in de leden-app. Leden bladeren door
   de samengestelde reizen (dezelfde die het partnerkanaal aan niet-leden toont,
   maar tegen de nettoprijs zonder opslag), en vragen een reis aan. De aanvraag
   landt bij een RTG-reisadviseur, die de datum bevestigt en de losse onderdelen
   (verblijf, transfers, tafels) regelt. Nooit de belofte dat iets al geboekt is:
   een aanvraag heet "aangevraagd" tot een mens hem bevestigt.

   Geen echte lucht-/hotelmerken als bevestigde partners. Prijzen in euro.
   Volgt het vaste kern-patroon maakReisbureau(state). */

function maakReisbureau({ db, save, crypto, anthropic }) {
  const nu = () => new Date().toISOString();

  // de reizen zoals het lid ze ziet: nettoprijs per persoon, geen opslag
  function reizen() {
    return (db.data.partnerTrips || []).map(t => ({
      id: t.id, titel: t.title, bestemming: t.dest, dates: t.dates || null,
      prijs: Math.max(0, Number(t.netto) || 0),
      omschrijving: t.desc || null,
      inbegrepen: Array.isArray(t.includes) ? t.includes : [],
      visual: t.visual || null
    }));
  }

  function overzicht() {
    const lijst = reizen();
    return {
      ok: true, reizen: lijst, aantal: lijst.length, valuta: 'EUR',
      opmerking: 'Het RTG-reisbureau. Leden reizen tegen de nettoprijs, zonder opslag. Je vraagt een reis aan; een RTG-reisadviseur bevestigt de datum en stelt de reis samen. Prijzen per persoon, in euro.'
    };
  }

  // een lid vraagt een reis aan; de aanvraag komt bij het reisbureau te liggen
  function boek(sess, codename, data) {
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
    return { ok: true, aanvraag: entry };
  }

  function mijn(key) {
    return (db.data.reisAanvragen || []).filter(a => a.customerKey === key).slice(0, 50);
  }

  // een lid trekt zijn eigen aanvraag in zolang die nog openstaat
  function annuleer(key, ref) {
    const a = (db.data.reisAanvragen || []).find(x => x.ref === String(ref || '') && x.customerKey === key);
    if (!a) return { status: 404, error: 'Reisaanvraag niet gevonden.' };
    if (a.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al ' + a.status + '.' };
    a.status = 'geannuleerd';
    save();
    return { ok: true, aanvraag: a };
  }

  /* AI-reisadvies: het lid vertelt in vrije tekst wat het zoekt, de reisadviseur
     wijst de best passende reis aan uit de catalogus. Met een AI-sleutel denkt
     Claude mee; zonder sleutel kiest een deterministische regel (woorden uit de
     wens tegen bestemming/omschrijving), zodat de functie altijd iets teruggeeft. */
  function regelAdvies(wens) {
    const lijst = reizen();
    if (!lijst.length) return null;
    const w = String(wens || '').toLowerCase();
    const woorden = w.split(/[^a-z0-9]+/).filter(x => x.length > 2);
    let beste = lijst[0], score = -1;
    for (const r of lijst) {
      const hooi = ((r.bestemming || '') + ' ' + (r.titel || '') + ' ' + (r.omschrijving || '') + ' ' + (r.inbegrepen || []).join(' ')).toLowerCase();
      let s = 0;
      for (const woord of woorden) if (hooi.includes(woord)) s += 1;
      if (s > score) { score = s; beste = r; }
    }
    return beste;
  }
  async function advies(wens) {
    const lijst = reizen();
    if (!lijst.length) return { status: 404, error: 'Er staan nu geen reizen klaar.' };
    const val = regelAdvies(wens);
    if (!anthropic) return { ok: true, reis: val, reden: 'Deze past het best bij wat je zoekt.', bron: 'regel' };
    try {
      const katalogus = lijst.map(r => '- ' + r.id + ': ' + r.titel + ' (' + r.bestemming + ') EUR ' + r.prijs + ' pp. ' + (r.omschrijving || '')).join('\n');
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 300,
        system: 'Je bent een RTG-reisadviseur. Kies uit de gegeven reizen de EEN die het best past bij de wens van het lid. ' +
          'Verzin geen reizen; kies alleen uit de lijst. Antwoord uitsluitend als JSON: {"id":"<reis-id>","reden":"<een korte zin, in de taal van de wens>"}.',
        messages: [{ role: 'user', content: 'Reizen:\n' + katalogus + '\n\nWens van het lid: ' + String(wens || '').slice(0, 400) }]
      });
      const tekst = (resp.content.find(c => c.type === 'text') || {}).text || '';
      const m = tekst.match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : {};
      const reis = lijst.find(r => r.id === j.id) || val;
      return { ok: true, reis, reden: String(j.reden || 'Deze past het best bij je wens.').slice(0, 200), bron: 'ai' };
    } catch (e) {
      return { ok: true, reis: val, reden: 'Deze past het best bij wat je zoekt.', bron: 'regel' };
    }
  }

  // het reisbureau-kantoor: de openstaande aanvragen (codenamen, nooit echte namen)
  function aanvragen() {
    return { ok: true, aanvragen: (db.data.reisAanvragen || []).slice(0, 200) };
  }

  return { reisbureau: { overzicht, boek, mijn, annuleer, advies, reizen, aanvragen } };
}

module.exports = { maakReisbureau };

/* Doe-laag, deel "bevestig" (kern/fluister): de bevestiging (ja/nee op een
   openstaand voorstel), de gratis en altijd omkeerbare acties (annuleren,
   reserveren) en het opvragen/zoeken (dagplan, saldo, door het aanbod). Niets
   hier verlaat geld; de voorstellen met de drempel wonen in ./boeken en
   ./betalen. Elke handler krijgt {q,p,klaar,key,codenaam,sess} en geeft een
   klaar(...)-antwoord of null (dan probeert de orkestrator de volgende). */
module.exports = (ctx) => {
  const { db, save, reserveerTafel, annuleerReservering, zorgVoor, pay, nu, eur, datumInZin, voerUit } = ctx;

  // "ja": het openstaande voorstel uitvoeren
  async function ja({ q, p, klaar, key, codenaam, sess }) {
    if (!/^(ja|yes|ok[eé]?|doe maar|graag|bevestig|akkoord|prima)[.!]?$/i.test(q)) return null;
    const wachtVers = p.wacht && Date.now() - Date.parse(p.wacht.at) < 10 * 60000;
    if (!wachtVers) return klaar('Er staat niets open om te bevestigen. Zeg gerust wat ik moet regelen.');
    const w = p.wacht;
    p.wacht = null;
    const r = await voerUit(key, codenaam, w, sess);
    return klaar(r.tekst, r.gedaan);
  }

  // "nee": het voorstel gaat van tafel
  async function nee({ q, p, klaar }) {
    if (!/^(nee|nope|laat maar|annuleer|stop|toch niet)[.!]?$/i.test(q)) return null;
    const wachtVers = p.wacht && Date.now() - Date.parse(p.wacht.at) < 10 * 60000;
    if (!wachtVers) return klaar('Er stond niets open; alles blijft zoals het was.');
    p.wacht = null;
    save();
    return klaar('Goed, het gaat niet door. Het voorstel is van tafel.');
  }

  // "plan mijn dag": een echt dagprogramma uit het echte aanbod, met
  // voor elk onderdeel de zin waarmee ik het meteen regel
  async function planDag({ q, p, klaar, key }) {
    if (!/plan (mijn|de|m.n) dag|dagplan(ning)?\b/i.test(q)) return null;
    const alle = db.data.suppliers || [];
    const resto = alle.filter(x => x.type === 'restaurant');
    const beach = alle.find(x => x.type === 'beachclub');
    const actZaak = alle.find(x => (x.activiteiten || []).length);
    const act = actZaak && actZaak.activiteiten[0];
    const avond = alle.find(x => ['bar', 'club'].includes(x.type));
    const topper = s => ((s && s.menu) || [])[0];
    const regels = [];
    if (beach) regels.push('10:00 ligbedden bij ' + beach.name);
    if (resto[0] && topper(resto[0])) regels.push('13:00 lunch bij ' + resto[0].name + ' (bijv. ' + topper(resto[0]).name + ', ' + eur(Math.round((topper(resto[0]).price || 0) * 100)) + ')');
    if (act) regels.push(((act.tijden || [])[0] || '16:00') + ' ' + act.name + ' bij ' + actZaak.name + ' (' + eur(Math.round((act.prijs || 0) * 100)) + ' p.p., zeg: "boek 2 tickets voor ' + act.name + ' morgen")');
    if (resto[0]) regels.push('20:00 diner bij ' + resto[0].name + ' (zeg: "reserveer bij ' + resto[0].name + ' morgen om 20:00")');
    if (avond && topper(avond)) regels.push('23:00 ' + avond.name + ' (' + topper(avond).name + ', ' + eur(Math.round((topper(avond).price || 0) * 100)) + ')');
    const zorgNu = zorgVoor && zorgVoor(key);
    return klaar('Mijn voorstel voor uw dag: ' + regels.join(' | ') + '.' +
      (p.weetjes.length ? ' Ik hield rekening met uw weetjes.' : '') +
      (zorgNu && (zorgNu.allergenen || []).length ? ' Uw allergenen (' + zorgNu.allergenen.join(', ') + ') reizen overal automatisch mee.' : '') +
      ' Zeg het maar en ik regel elk onderdeel, van de tickets tot de taxi.');
  }

  // "wat is mijn saldo": de stand van RTG Pay, gewoon in het gesprek
  async function saldo({ q, klaar, codenaam }) {
    if (!(pay && /\bsaldo\b/i.test(q))) return null;
    const ov = pay.overzicht(codenaam);
    return klaar('Uw RTG Pay-saldo is ' + eur(ov.saldo) + '. Te weinig voor een plan? Bij elke betaling laad ik automatisch bij.');
  }

  // "annuleer mijn reservering (bij Sal de Mar)": kost niets, dus direct
  async function annuleerRes({ q, klaar, key }) {
    if (!(annuleerReservering && /^annuleer\b/i.test(q) && /reserver/i.test(q))) return null;
    const naam = (q.match(/\bbij\s+(.+?)[.?!]?\s*$/i) || [])[1];
    const mijnRes = (db.data.reserveringen || []).filter(r => r.customerKey === key && ['aangevraagd', 'bevestigd'].includes(r.status) &&
      (!naam || (r.supplierName || '').toLowerCase().includes(naam.toLowerCase().trim())));
    if (!mijnRes.length) return klaar('Ik zie geen lopende reservering' + (naam ? ' bij ' + naam : '') + ' om te annuleren.');
    const r = annuleerReservering(key, mijnRes[0].id);
    if (r.error) return klaar('Dat lukt niet: ' + r.error);
    return klaar('Geannuleerd: ' + mijnRes[0].supplierName + ', ' + mijnRes[0].datum + ' om ' + mijnRes[0].tijd + '. De zaak weet het meteen.', true);
  }

  // "reserveer bij Sal de Mar morgen om 20:00 met 2 personen":
  // onder de drempel (gratis en altijd annuleerbaar), dus direct
  async function reserveer({ q, klaar, key, codenaam, sess }) {
    if (!(reserveerTafel && /\breserveer\b/i.test(q))) return null;
    if (sess.tier === 'guest') return klaar('Reserveren kan alleen met een lidmaatschap.');
    const naam = (q.match(/\bbij\s+(.+?)(?=\s+(?:op|om|voor|met|morgen|overmorgen|vandaag)\b|\s*[.?!]?\s*$)/i) || [])[1];
    const s = naam && (db.data.suppliers || []).find(x => (x.name || '').toLowerCase().includes(naam.toLowerCase().trim()));
    if (!s) return klaar('Bij welke zaak? Zeg bijvoorbeeld: "reserveer bij Sal de Mar morgen om 20:00 met 2 personen".');
    const tijd = q.match(/(\d{1,2})[:.](\d{2})/);
    const datum = datumInZin(q);
    if (!datum || !tijd) return klaar('Wanneer? Noem een dag en een tijd, bijvoorbeeld "morgen om 20:00".');
    const personen = parseInt((q.match(/(\d{1,2})\s*(personen|gasten|man)\b/i) || [])[1], 10) || 2;
    const r = reserveerTafel({ key, tier: sess.tier }, codenaam, { supplierCode: s.code, datum, tijd: tijd[1].padStart(2, '0') + ':' + tijd[2], personen });
    if (r.error) return klaar('Dat lukt niet: ' + r.error);
    // het zorgprofiel reist mee, precies zoals bij een gewone reservering
    const z = zorgVoor && zorgVoor(key);
    if (z) { r.reservering.zorg = z; save(); }
    return klaar('Aangevraagd: ' + s.name + ', ' + datum + ' om ' + r.reservering.tijd + ' voor ' + personen + '. De zaak bevestigt zo; u ziet het in de bel.', true);
  }

  // "zoek lamsrack" / "waar kan ik sushi eten": door het hele aanbod
  // van alle partners (zaken, menukaarten, diensten en producten)
  async function zoek({ q, klaar }) {
    if (!(/^(zoek|vind)\b/i.test(q) || /\bwaar (kan|vind|koop|eet|drink|huur) ik\b/i.test(q))) return null;
    const term = q.replace(/^(zoek|vind)\b(\s+(een|naar))?/i, '').replace(/\bwaar (kan|vind|koop|eet|drink|huur) ik\b/i, '').replace(/[?.!]/g, ' ').trim().toLowerCase();
    if (term.length < 2) return klaar('Waar zal ik naar zoeken? Zeg bijvoorbeeld: "zoek lamsrack" of "waar kan ik sushi eten".');
    const hits = [];
    for (const s of (db.data.suppliers || [])) {
      if (((s.name || '') + ' ' + (s.type || '') + ' ' + (s.city || '')).toLowerCase().includes(term))
        hits.push((s.icon || '🏛') + ' ' + s.name + (s.type ? ' (' + s.type + ')' : '') + (s.city ? ' in ' + s.city : ''));
      for (const it of [].concat(s.menu || [], s.services || [], s.products || [])) {
        const naam = it.name || it.naam || '';
        if (!naam.toLowerCase().includes(term)) continue;
        const prijs = Number(it.price != null ? it.price : it.prijs);
        hits.push('· ' + naam + (Number.isFinite(prijs) ? ' voor ' + eur(Math.round(prijs * 100)) : '') + ' bij ' + s.name);
      }
      if (hits.length >= 8) break;
    }
    if (!hits.length) return klaar('Ik vond niets over "' + term + '" in het aanbod. Probeer een ander woord, of vraag het de zaak via de gastchat.');
    return klaar('Dit vond ik voor u: ' + hits.slice(0, 6).join(' | ') + '. Zal ik iets reserveren of regelen? Zeg het maar.');
  }

  return { ja, nee, planDag, saldo, annuleerRes, reserveer, zoek };
};

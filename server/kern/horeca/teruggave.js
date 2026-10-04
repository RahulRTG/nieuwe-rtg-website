/* ============================================================================
   HET TERUGGAVERECHT VAN EEN REKENING UITVOEREN -- door de zaak, per wijze.

   Een correctie na de betaling zet een teruggaverecht klaar (./correctie.js).
   Dat recht stond er met "een medewerker betaalt het terug langs RTG Pay" --
   en er was geen weg om dat te doen (Fase 0, defect D8). Bovendien KAN het niet
   langs RTG Pay: een gast aan tafel is meestal geen lid, en een pinbetaling
   loopt niet over ons grootboek.

   Besluit van de eigenaar (4 oktober 2026): DE ZAAK VOERT UIT, PER WIJZE.
   De manager van de zaak beslist; het geld gaat terug langs de weg waarlangs
   het binnenkwam, en nooit langs een andere:

     online (via de betaalwaarheid)  terugbetalen bij de provider; uitgevoerd
                                     pas als de provider het bevestigt
     bon / tegoed                    terug op dezelfde bon, op de afboeking
                                     waarmee betaald werd
     contant, pin, of met de hand    het geld gaat fysiek terug (lade, terminal);
     als online geregistreerd        hier wordt vastgelegd WIE het deed en WAAROM
     kamer, rekening, munt           niet hier: die lopen via de folio, de
                                     factuur of de muntlaag, en een tweede weg
                                     ernaast zou het bedrag twee keer terugzetten

   Het RTG-kantoor kijkt mee en voert niets uit: het is het geld van de zaak.

   DRIE REGELS.
   1. EERST VASTHOUDEN, DAN WACHTEN. De terugbetaling staat met `bezig` op de
      rekening VOORDAT er iets wordt aangeroepen, en telt mee in wat er nog
      terug kan. Twee managers die tegelijk drukken, betalen samen nooit meer
      terug dan het recht (dezelfde race als bij de deurverkoop).
   2. UITGEVOERD IS EEN FEIT, GEEN KNOP. Alleen een terugbetaling met stand
      `uitgevoerd` telt af van wat er betaald is (horeca.teruggegeven); een die
      nog bij de provider ligt niet. Het recht zelf is pas `uitgevoerd` als de
      uitgevoerde delen samen zijn bedrag halen.
   3. NOOIT MEER DAN DE BETALING. Per betaling gaat er hooguit terug wat er met
      die betaling binnenkwam, min wat er al terugging.
   ========================================================================== */
'use strict';

const FYSIEK = new Set(['contant', 'pin', 'online']);
const ELDERS = {
  kamer: 'Op de kamer geboekt: corrigeer de regel op de folio van de gast; daar komt het bedrag vanzelf af.',
  rekening: 'Op rekening betaald: maak een creditnota op die factuur.',
  munt: 'Met munten betaald: munten gaan terug via de muntlaag van het evenement.'
};
const LOPEND = new Set(['bezig', 'bij-provider', 'controle', 'uitgevoerd']);

module.exports = ({ horeca, betaalWaarheid, bonlaag, nu, id }) => {
  const tekst = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const lijst = (rek) => (Array.isArray(rek.terugbetalingen) ? rek.terugbetalingen : (rek.terugbetalingen = []));
  const telt = (t) => LOPEND.has(t.stand);
  const som = (l) => l.reduce((n, t) => n + t.centen, 0);

  function wegVan(b) {
    if (b.waarheidId) return 'betaalwaarheid';
    if ((b.wijze === 'bon' || b.wijze === 'tegoed') && b.bonId && b.bonRef) return 'bon';
    if (FYSIEK.has(b.wijze)) return 'handmatig';
    return null;
  }

  function rechtKlaar(rek, c) {
    const uit = som(lijst(rek).filter(t => t.correctieId === c.id && t.stand === 'uitgevoerd'));
    if (uit >= c.teruggave.centen) { c.teruggave.uitgevoerd = true; c.teruggave.uitgevoerdAt = nu(); }
  }

  /* De stand van een providerterugbetaling, gelezen uit de opdracht die bij
     DEZE terugbetaling hoort (herkend aan zijn id in de reden). */
  function providerStand(t) {
    const r = betaalWaarheid.van(t.waarheidId);
    const op = r && (r.terugbetaalOpdrachten || []).find(o => String(o.reden || '').includes(t.id));
    if (!op) return 'bezig';
    return op.status === 'BEVESTIGD' ? 'uitgevoerd' : op.status === 'CONTROLE_NODIG' ? 'controle' : 'bij-provider';
  }

  async function uitvoeren(rek, { correctieId, betalingId, centen, reden, door, zaak, idem }) {
    const c = (rek.correcties || []).find(x => x.id === String(correctieId || ''));
    if (!c || !c.teruggave) return { status: 404, error: 'Bij deze correctie staat geen teruggave klaar.' };
    const sleutel = tekst(idem, 80);
    if (!sleutel) return { status: 400, error: 'Geef een idem-sleutel mee, zodat een dubbele klik niet twee keer terugbetaalt.' };
    const al = lijst(rek).find(t => t.correctieId === c.id && t.idem === sleutel);
    if (al) {
      // een herhaling is ook de manier om een providerterugbetaling na te vragen
      if (al.waarheidId && al.stand !== 'uitgevoerd') { al.stand = providerStand(al); rechtKlaar(rek, c); }
      return { ok: true, herhaald: true, terugbetaling: al, teruggave: c.teruggave };
    }
    if (c.teruggave.uitgevoerd) return { status: 409, error: 'Deze teruggave is al uitgevoerd.' };
    const b = (rek.betalingen || []).find(x => x.id === String(betalingId || ''));
    if (!b) return { status: 404, error: 'Kies de betaling waarlangs het geld terug moet.' };
    const soort = wegVan(b);
    if (!soort) return { status: 409, error: 'Deze betaling gaat niet hier terug.', hoe: ELDERS[b.wijze] || 'Deze betaalwijze kent hier geen weg terug.' };
    if (soort === 'betaalwaarheid' && !(betaalWaarheid && typeof betaalWaarheid.terugbetalen === 'function'))
      return { status: 503, error: 'De betaalwaarheid is hier niet bereikbaar; er is niets teruggezet.' };
    if (soort === 'bon' && !(bonlaag && typeof bonlaag.terug === 'function'))
      return { status: 503, error: 'De bonlaag is hier niet bereikbaar; er is niets teruggezet.' };
    const waarom = tekst(reden, 160);
    if (waarom.length < 5) return { status: 400, error: 'Noteer waarom en hoe het geld terugging; dat blijft bij de teruggave staan.' };

    const openRecht = c.teruggave.centen - som(lijst(rek).filter(t => t.correctieId === c.id && telt(t)));
    const openBetaling = b.centen - som(lijst(rek).filter(t => t.betalingId === b.id && telt(t)));
    const wil = centen == null ? Math.min(openRecht, openBetaling) : Math.round(Number(centen));
    if (!(wil > 0) || wil > openRecht || wil > openBetaling) {
      return { status: 409, error: 'Er kan nog ' + (Math.min(openRecht, openBetaling) / 100).toFixed(2) + ' terug langs deze betaling.' };
    }

    // 1. eerst vasthouden (zie de kop), dan pas iets aanroepen
    const t = { id: 'HT-' + id(4), correctieId: c.id, betalingId: b.id, wijze: b.wijze, soort, centen: wil,
      reden: waarom, door: tekst(door, 60), idem: sleutel, at: nu(), stand: 'bezig' };
    lijst(rek).push(t);
    try {
      if (soort === 'handmatig') {
        t.stand = 'uitgevoerd';
        t.let = 'Het geld ging fysiek terug; RTG legt vast wie het deed en waarom, en kan het niet nagaan.';
      } else if (soort === 'bon') {
        const u = await bonlaag.terug({ zaak, id: b.bonId, ref: b.bonRef, centen: wil, idem: t.id });
        if (u.error) throw Object.assign(new Error(u.error), { status: u.status || 409 });
        t.stand = 'uitgevoerd';
      } else {
        t.waarheidId = b.waarheidId;
        await betaalWaarheid.terugbetalen(b.waarheidId, { centen: wil, idem: t.id, reden: 'horeca-teruggave ' + t.id });
        t.stand = providerStand(t);
      }
    } catch (e) {
      t.stand = 'mislukt'; t.fout = String(e && e.message || e).slice(0, 160);
      return { status: e.status || 502, error: 'De teruggave is niet gelukt: ' + t.fout, terugbetaling: t };
    }
    rechtKlaar(rek, c);
    return { ok: true, terugbetaling: t, teruggave: c.teruggave };
  }

  return { uitvoeren, ELDERS };
};

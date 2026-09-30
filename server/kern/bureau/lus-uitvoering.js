/* Het Privekantoor, deelbestand "lus-uitvoering": van vastgezet naar voorbij.

   De onderdelen van een case op de klok, wat een vertraging raakt, wat er
   gebeurt als er een onderdeel omvalt, en hoe een case sluit. Plus de weergave
   voor een ZAAK die een onderdeel levert. Zie ./lus.js voor de wens en het
   voorstel, en CONCIERGE.md par. 2.11-2.14 voor waarom het zo loopt.

   VIER DINGEN DIE HIER VASTLIGGEN:

   1. EEN VERTRAGING VERSTUURT NIETS. `lusVertraging` rekent de gevolgen uit en
      zet per deelnemer een bericht KLAAR. `lusVerstuur` verstuurt ze pas als de
      mens die drukt ze alle heeft gezien: de lijst ids die hij meestuurt moet
      precies de klaargezette lijst zijn (CON-06).
   2. EEN KAPOT ONDERDEEL MAAKT GEEN NIEUWE ZAAK. Het blijft staan met zijn
      reden, de case gaat "in herstel", en een alternatief dat wordt vastgezet
      VERVANGT het. De gast hoeft zijn verhaal niet opnieuw te doen (CON-01).
   3. "GEREGELD" KAN ALLEEN ALS HET WAAR IS. `lusAfsluitbaar` weigert zolang er
      een onderdeel niet bevestigd is of een voorstel openstaat; het bureau
      (./cases-bureau.js) vraagt het hem voordat het die stand zet.
   4. EEN ZAAK ZIET ZIJN EIGEN ONDERDELEN EN NIETS ANDERS. `lusVoorZaak` loopt
      over alle cases maar geeft per onderdeel alleen de positieve lijst velden
      uit lus-regels.js terug -- geen codenaam, geen hotelkamer, geen tweede
      leverancier (CON-02). Een besloten case komt er niet langs. */
'use strict';

const R = require('./lus-regels');

module.exports = (ctx) => {
  const { db, save, schoon, rid, nu, stap, vind, notifySupplier } = ctx;
  const levens = require('../levensdossier')({ db }).voor('bureau');
  const { actief, afsluitbaar: lusAfsluitbaar } = R;

  function lusOnderdeel(key, id, b) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const wat = schoon(b.wat, 160);
    if (!wat) return { status: 400, error: 'Welk onderdeel?' };
    const code = schoon(b.zaak, 40);
    const o = { id: rid(), wat, van: /^\d{1,2}:\d{2}$/.test(String(b.van || '')) ? b.van : '',
      duurMin: Math.max(0, Math.min(720, Math.round(Number(b.duurMin) || 0))),
      reisMin: Math.max(0, Math.min(240, Math.round(Number(b.reisMin) || 0))),
      deelnemer: code ? { soort: 'zaak', code } : null,
      stand: b.bevestigd === true ? 'bevestigd' : 'gepland', vertragingMin: 0 };
    const zelfde = R.actief(c).find(x => x.wat === o.wat && x.van === o.van && ((x.deelnemer && x.deelnemer.code) || '') === code);
    if (zelfde) return { status: 200, ok: true, onderdeel: zelfde }; // dubbeltik
    c.onderdelen.push(o);
    c.onderdelen.sort((x, y) => String(x.van).localeCompare(String(y.van)));
    stap(c, c.status === 'in voorbereiding' ? 'in uitvoering' : c.status, 'Onderdeel: ' + wat + (o.van ? ' om ' + o.van : '') + '.', 'kantoor');
    save();
    return { status: 200, ok: true, onderdeel: o };
  }

  function lusBevestig(key, id, onderdeelId) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const o = c.onderdelen.find(x => x.id === onderdeelId);
    if (!o) return { status: 404, error: 'Dit onderdeel staat niet bij deze zaak.' };
    if (o.stand === 'kapot') return { status: 409, error: 'Dit onderdeel is omgevallen; zet een alternatief vast.' };
    if (o.stand === 'bevestigd') return { status: 200, ok: true };
    o.stand = 'bevestigd';
    stap(c, c.status, 'Bevestigd: ' + o.wat + '.', 'kantoor');
    save();
    return { status: 200, ok: true };
  }

  function lusVertraging(key, id, b) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const o = c.onderdelen.find(x => x.id === b.onderdeel);
    if (!o) return { status: 404, error: 'Dit onderdeel staat niet bij deze zaak.' };
    const min = Math.max(-240, Math.min(240, Math.round(Number(b.minuten) || 0)));
    if (c.klaar && o.vertragingMin === min) return { status: 200, ok: true, klaar: c.klaar, tijdlijn: R.tijdlijn(c) }; // dubbeltik
    o.vertragingMin = min;
    const berichten = R.gevolgen(c).map(g => Object.assign({ id: rid() }, g));
    c.klaar = { id: rid(), op: nu(), berichten };
    stap(c, c.status, o.wat + ': ' + (o.vertragingMin >= 0 ? '+' : '') + o.vertragingMin + ' min. ' +
      berichten.length + ' bericht(en) klaargezet, nog niets verstuurd.', 'kantoor');
    save();
    return { status: 200, ok: true, klaar: c.klaar, tijdlijn: R.tijdlijn(c) };
  }

  function lusVerstuur(key, id, b) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    if (!c.klaar || c.klaar.id !== b.klaar) return { status: 409, error: 'Deze berichten zijn niet meer de klaargezette; kijk opnieuw.' };
    const gezien = new Set(Array.isArray(b.gezien) ? b.gezien.map(String) : []);
    const ids = c.klaar.berichten.map(x => x.id);
    if (ids.length !== gezien.size || ids.some(x => !gezien.has(x))) {
      return { status: 409, error: 'Alleen berichten die u allemaal heeft gezien, gaan in een keer weg.' };
    }
    const uit = [];
    for (const m of c.klaar.berichten) {
      const mag = R.magBereiken(c, m.deelnemer);
      if (!mag.ok) { uit.push({ id: m.id, bezorgd: false, reden: mag.reden }); continue; }
      if (!notifySupplier) { uit.push({ id: m.id, bezorgd: false, reden: 'Er is geen weg naar een zaak ingericht.' }); continue; }
      try {
        notifySupplier(m.deelnemer.code, { icon: '\u{1F5DD}', title: 'Wijziging van De Rechterhand', body: m.bericht });
        uit.push({ id: m.id, bezorgd: true });
      } catch (e) { uit.push({ id: m.id, bezorgd: false, reden: 'De melding aan de zaak mislukte.' }); }
    }
    /* De nieuwe tijd is nu de afgesproken tijd -- maar alleen voor wie hem
       werkelijk kreeg. Een zaak die het bericht niet kreeg, verwacht de gast nog
       steeds op de oude tijd, en dat moet zichtbaar blijven. */
    const nieuw = R.tijdlijn(c); // EEN keer: de lus hieronder verandert wat hij zou uitrekenen
    for (const o of c.onderdelen) {
      const m = c.klaar.berichten.find(x => x.onderdeel === o.id);
      const r = m && uit.find(x => x.id === m.id);
      if (!m || (r && r.bezorgd)) { o.van = (nieuw.find(x => x.id === o.id) || {}).van || o.van; o.vertragingMin = 0; }
    }
    stap(c, c.status, uit.filter(x => x.bezorgd).length + ' van ' + uit.length + ' berichten bezorgd.', 'kantoor');
    c.klaar = null;
    save();
    return { status: 200, ok: true, uitslag: uit };
  }

  function lusKapot(key, id, b) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const o = c.onderdelen.find(x => x.id === b.onderdeel);
    if (!o) return { status: 404, error: 'Dit onderdeel staat niet bij deze zaak.' };
    const reden = schoon(b.reden, 300);
    if (!reden) return { status: 400, error: 'Wat is er gebeurd?' };
    if (o.stand === 'kapot') return { status: 200, ok: true };
    o.stand = 'kapot';
    o.reden = reden;
    c.herstel = true;
    stap(c, 'in herstel', o.wat + ' gaat niet door: ' + reden + '. Het doel staat; wij zoeken een alternatief.', 'kantoor');
    save();
    return { status: 200, ok: true };
  }

  // de uitkomst telt de ACTIEVE onderdelen als beloften; een vervangen kapot onderdeel is een herstelmoment
  const lusUitkomst = c => R.afsluitUitkomst(c);

  function lusKantoor(key, id) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const nuMs = Date.now();
    return { status: 200, zaak: c, bericht: R.gastBericht(c),
      mogelijkheden: c.mogelijkheden.map(a => Object.assign({ stand: R.aanbodStand(a, nuMs), label: R.AANBOD_LABEL[R.aanbodStand(a, nuMs)] }, a)),
      tijdlijn: R.tijdlijn(c), klaar: c.klaar || null, afsluitbaar: lusAfsluitbaar(c) };
  }

  function lusVoorZaak(code) {
    const uit = [];
    for (const l of Object.values(levens.alleLezend())) {
      for (const c of (l.cases || [])) {
        if (c.werkwijze !== 'voorstel' || c.besloten || c.status === 'ingetrokken') continue;
        uit.push(...R.deelnemerBeeld(Object.assign({}, c, { onderdelen: actief(c) }), code));
      }
    }
    return { status: 200, opdrachten: uit };
  }

  return { lusOnderdeel, lusBevestig, lusVertraging, lusVerstuur, lusKapot, lusAfsluitbaar, lusUitkomst, lusKantoor, lusVoorZaak };
};

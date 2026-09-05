/* De laatste naad van een inkomende betaling: de provider heeft het geld
   definitief bevestigd, maar het bijbehorende domein moet de bestelling nog
   vrijgeven. Een mislukking mag nooit als verwerkte webhook eindigen. De
   provider krijgt daarom een fout terug en deze ronde blijft de duurzame
   betaling ook na een herstart opnieuw aanbieden. */
'use strict';

const WACHT_MS = Object.freeze([60 * 1000, 5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000]);

module.exports = function maakAfhandeling(ctx) {
  const { d, doos, save, nuIso, gebeurtenis, STATUS, log, afhandelaars } = ctx;
  const bezig = new Map();
  const tijdVan = waarde => {
    const n = typeof waarde === 'number' ? waarde : Date.parse(String(waarde || ''));
    return Number.isFinite(n) ? n : 0;
  };

  function fout(r, oorzaak) {
    const pogingen = (Number(r.afhandelingPogingen) || 0) + 1;
    const bericht = String(oorzaak && oorzaak.message || oorzaak || 'onbekende fout').slice(0, 180);
    r.afhandelingPogingen = pogingen;
    r.afhandelingLaatsteFout = bericht;
    r.afhandelingVolgendeAt = new Date(tijdVan(nuIso()) + WACHT_MS[Math.min(pogingen - 1, WACHT_MS.length - 1)]).toISOString();
    gebeurtenis(r, 'AFHANDELING_MISLUKT', { fout: bericht, poging: pogingen });
    save();
    const e = new Error('De bevestigde betaling kon nog niet veilig worden afgehandeld.');
    e.code = 'BETAAL_AFHANDELING_MISLUKT';
    e.cause = oorzaak;
    throw e;
  }

  async function handelAf(r) {
    if (!r || r.status !== STATUS.BEVESTIGD || r.afgehandeldAt) return false;
    const eerder = bezig.get(r.id);
    if (eerder) return eerder;
    const werk = (async () => {
      const fn = afhandelaars.get(r.soort);
      if (!fn) return fout(r, new Error('Geen afhandelaar geregistreerd voor ' + r.soort + '.'));
      try { await fn(r); } catch (e) { return fout(r, e); }

      const lengte = Array.isArray(r.gebeurtenissen) ? r.gebeurtenissen.length : 0;
      const bijgewerktAt = r.bijgewerktAt;
      r.afgehandeldAt = nuIso();
      delete r.afhandelingLaatsteFout;
      delete r.afhandelingVolgendeAt;
      gebeurtenis(r, 'DOMEIN_AFGEHANDELD', { bron: r.soort });
      try { save(); }
      catch (e) {
        delete r.afgehandeldAt;
        if (Array.isArray(r.gebeurtenissen)) r.gebeurtenissen.length = lengte;
        r.bijgewerktAt = bijgewerktAt;
        return fout(r, e);
      }
      return true;
    })();
    bezig.set(r.id, werk);
    try { return await werk; }
    finally { bezig.delete(r.id); }
  }

  function sluitMeldingen(betalingId) {
    const meldingen = d().betaalWaarheidMeldingen || {};
    const geraakt = [];
    for (const m of Object.values(meldingen)) {
      if (m && !m.verwerktAt && m.soort !== 'terugbetaling' && m.betalingId === betalingId) {
        geraakt.push(m); m.verwerktAt = nuIso();
      }
    }
    if (!geraakt.length) return 0;
    try { save(); }
    catch (e) { for (const m of geraakt) m.verwerktAt = null; throw e; }
    return geraakt.length;
  }

  async function ronde(opties) {
    const o = opties || {};
    const grens = Number.isFinite(o.tot) ? o.tot : tijdVan(o.tot || nuIso());
    const limiet = Math.min(100, Math.max(1, Number(o.limiet) || 25));
    const kandidaten = Object.values(doos()).filter(r => r && r.status === STATUS.BEVESTIGD &&
      !r.afgehandeldAt && tijdVan(r.afhandelingVolgendeAt) <= grens).slice(0, limiet);
    let gelukt = 0, mislukt = 0, meldingen = 0;
    for (const r of kandidaten) {
      try { await handelAf(r); meldingen += sluitMeldingen(r.id); gelukt += 1; }
      catch (e) {
        mislukt += 1;
        if (log && log.uitzondering) log.uitzondering(e, { bron: 'betaalwaarheid-herstel', betaling: r.id });
      }
    }
    /* Een proces kan precies na de domeinafhandeling en vóór het sluiten van
       de inbox stoppen. Ook die halve naad wordt zonder tweede domeinactie
       hersteld. */
    for (const r of Object.values(doos())) if (r && r.afgehandeldAt) meldingen += sluitMeldingen(r.id);
    return { ok: mislukt === 0, bekeken: kandidaten.length, gelukt, mislukt, meldingen };
  }

  return { handelAf, ronde };
};

module.exports.WACHT_MS = WACHT_MS;

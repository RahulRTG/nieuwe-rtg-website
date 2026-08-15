/* Dunne zero-dependency verbinding tussen Magnaat en de zuivere Rust-rekenlaag.
   Zonder motor-URL blijft Magnaat volledig lokaal werken. Met een URL gaat de
   zware marktstap naar Rust; de economie houdt zelf de autoritatieve spelstaat. */
'use strict';

function begrensGetal(waarde, standaard, min, max) {
  const n = Number(waarde);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : standaard;
}

function motorFout(code, boodschap, oorzaak) {
  const fout = new Error(boodschap, oorzaak ? { cause: oorzaak } : undefined);
  fout.code = code;
  return fout;
}

module.exports = function maakMagnaatMotorklant(opties = {}) {
  const URL = (process.env.RTG_MOTOR_REKEN_URL || process.env.RTG_MOTOR_GELD_URL || process.env.RTG_MOTOR_SHADOW || '').replace(/\/$/, '');
  const globaleNoodstop = process.env.RTG_RUST_ALLES_UIT === '1';
  const modus = globaleNoodstop ? 'uit' : String(process.env.RTG_MAGNAAT_RUST || (URL ? 'motor' : 'uit')).toLowerCase();
  const aan = modus === 'motor';
  const timeout = begrensGetal(process.env.RTG_MOTOR_REKEN_TIMEOUT, 5000, 250, 30000);
  const foutGrens = begrensGetal(process.env.RTG_MOTOR_REKEN_FOUTGRENS, 3, 1, 20);
  const afkoelMs = begrensGetal(process.env.RTG_MOTOR_REKEN_AFKOEL_MS, 15000, 1000, 300000);
  const maxTegelijk = begrensGetal(process.env.RTG_MOTOR_REKEN_MAX_TEGELIJK, 32, 1, 1024);
  const maxAntwoord = begrensGetal(process.env.RTG_MOTOR_REKEN_MAX_ANTWOORD, 1024 * 1024, 65536, 4 * 1024 * 1024);
  const token = process.env.RTG_MOTOR_TOKEN || '';
  const haal = opties.fetch || globalThis.fetch;
  const klok = opties.nu || Date.now;
  if (aan && !URL) throw new Error('RTG_MAGNAAT_RUST=motor vereist RTG_MOTOR_REKEN_URL.');
  if (aan && typeof haal !== 'function') throw new Error('De JavaScript-runtime heeft geen fetch voor de Rust-motor.');
  if (aan) {
    let adres;
    try { adres = new globalThis.URL(URL); } catch (fout) { throw new Error('RTG_MOTOR_REKEN_URL is geen geldige URL.'); }
    if (!['http:', 'https:'].includes(adres.protocol) || adres.username || adres.password) {
      throw new Error('RTG_MOTOR_REKEN_URL vereist HTTP(S) zonder inloggegevens in de URL.');
    }
  }

  let actief = 0;
  let fouten = 0;
  let openTot = 0;
  let proefBezig = false;

  async function leesJsonBegrensd(antwoord) {
    const opgegeven = Number(antwoord.headers && antwoord.headers.get('content-length'));
    if (Number.isFinite(opgegeven) && opgegeven > maxAntwoord) {
      if (antwoord.body && antwoord.body.cancel) await antwoord.body.cancel().catch(() => {});
      throw motorFout('MOTOR_ANTWOORD_TE_GROOT', 'Rust-motor gaf een te groot antwoord.');
    }
    if (!antwoord.body || typeof antwoord.body.getReader !== 'function') {
      const tekst = await antwoord.text();
      if (Buffer.byteLength(tekst) > maxAntwoord) throw motorFout('MOTOR_ANTWOORD_TE_GROOT', 'Rust-motor gaf een te groot antwoord.');
      try { return JSON.parse(tekst); } catch (fout) { throw motorFout('MOTOR_PROTOCOL', 'Rust-motor gaf geen geldige JSON.', fout); }
    }
    const lezer = antwoord.body.getReader();
    const stukken = [];
    let totaal = 0;
    while (true) {
      const { done, value } = await lezer.read();
      if (done) break;
      totaal += value.byteLength;
      if (totaal > maxAntwoord) {
        await lezer.cancel().catch(() => {});
        throw motorFout('MOTOR_ANTWOORD_TE_GROOT', 'Rust-motor gaf een te groot antwoord.');
      }
      stukken.push(Buffer.from(value));
    }
    try { return JSON.parse(Buffer.concat(stukken, totaal).toString('utf8')); }
    catch (fout) { throw motorFout('MOTOR_PROTOCOL', 'Rust-motor gaf geen geldige JSON.', fout); }
  }

  function beginPoging() {
    const nu = klok();
    if (openTot > nu) throw motorFout('MOTOR_CIRCUIT_OPEN', 'Rust-motor is tijdelijk uit de route na herhaalde fouten.');
    const halfOpen = openTot !== 0;
    if (halfOpen && proefBezig) throw motorFout('MOTOR_CIRCUIT_OPEN', 'Rust-motor wacht op één herstelproef.');
    if (actief >= maxTegelijk) throw motorFout('MOTOR_DRUK', 'Rust-motor heeft zijn gelijktijdigheidsgrens bereikt.');
    actief += 1;
    if (halfOpen) proefBezig = true;
    return halfOpen;
  }

  function geslaagd() {
    fouten = 0;
    openTot = 0;
  }

  function mislukt() {
    fouten += 1;
    if (fouten >= foutGrens) openTot = klok() + afkoelMs;
  }

  async function markt(invoer) {
    if (!aan) throw motorFout('MOTOR_UIT', 'Rust-motor staat uit; gebruik de JavaScript-rekenlaag.');
    const halfOpen = beginPoging();
    const af = new AbortController();
    const timer = setTimeout(() => af.abort(), timeout);
    try {
      const koppen = { 'content-type': 'application/json' };
      if (token) koppen['x-rtg-motor-token'] = token;
      const antwoord = await haal(URL + '/api/reken/magnaat/markt', {
        method: 'POST', headers: koppen, body: JSON.stringify(invoer), signal: af.signal
      });
      const body = await leesJsonBegrensd(antwoord);
      if (!antwoord.ok || !body || body.ok !== true) {
        throw motorFout('MOTOR_HTTP', (body && body.error) || ('Rust-motor gaf HTTP ' + antwoord.status));
      }
      geslaagd();
      return body;
    } catch (fout) {
      mislukt();
      if (fout && fout.name === 'AbortError') throw motorFout('MOTOR_TIMEOUT', 'Rust-motor overschreed de rekentime-out.', fout);
      throw fout;
    } finally {
      clearTimeout(timer);
      actief -= 1;
      if (halfOpen) proefBezig = false;
    }
  }

  function status() {
    return {
      aan, modus, globaleNoodstop, actief, maxTegelijk, fouten,
      circuit: openTot > klok() ? 'open' : openTot ? 'half-open' : 'gesloten',
      herstelNaMs: Math.max(0, openTot - klok())
    };
  }

  return { aan, modus, globaleNoodstop, url: URL, markt, status };
};

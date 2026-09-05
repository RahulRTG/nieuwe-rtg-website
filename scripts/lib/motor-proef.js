'use strict';

const MAX_ANTWOORD = 256 * 1024;

async function leesBegrensd(antwoord) {
  const lengte = Number(antwoord.headers && antwoord.headers.get('content-length'));
  if (Number.isFinite(lengte) && lengte > MAX_ANTWOORD) throw new Error('statusantwoord is te groot');
  if (!antwoord.body || typeof antwoord.body.getReader !== 'function') {
    const tekst = await antwoord.text();
    if (Buffer.byteLength(tekst) > MAX_ANTWOORD) throw new Error('statusantwoord is te groot');
    return JSON.parse(tekst);
  }
  const lezer = antwoord.body.getReader();
  const delen = []; let totaal = 0;
  for (;;) {
    const { done, value } = await lezer.read();
    if (done) break;
    totaal += value.byteLength;
    if (totaal > MAX_ANTWOORD) { await lezer.cancel().catch(() => {}); throw new Error('statusantwoord is te groot'); }
    delen.push(Buffer.from(value));
  }
  return JSON.parse(Buffer.concat(delen, totaal).toString('utf8'));
}

function motorUrl(env) {
  return String(env.RTG_MOTOR_REKEN_URL || env.RTG_MOTOR_GELD_URL || env.RTG_MOTOR_SHADOW || '').replace(/\/$/, '');
}

async function motorProef(env, haal = globalThis.fetch) {
  if (String(env.RTG_RUST_ALLES_UIT || '0') === '1')
    return { ok: true, overgeslagen: true, noodstop: true, ms: 0, native: [] };
  const url = motorUrl(env);
  if (!url) return { overgeslagen: true };
  const begin = Date.now();
  const af = new AbortController();
  const timer = setTimeout(() => af.abort(), 5000);
  try {
    const koppen = { 'content-type': 'application/json' };
    if (env.RTG_MOTOR_TOKEN) koppen['x-rtg-motor-token'] = env.RTG_MOTOR_TOKEN;
    const vraag = async pad => {
      const antwoord = await haal(url + pad, {
        method: 'POST', headers: koppen, body: '{}', signal: af.signal
      });
      return { antwoord, body:await leesBegrensd(antwoord) };
    };
    const { antwoord, body } = await vraag('/api/motor/status');
    if (!antwoord.ok || !body || body.ok !== true || body.klopt !== true)
      throw new Error((body && body.error) || 'status is niet gezond (HTTP ' + antwoord.status + ')');
    const native = Array.isArray(body.nativeMotoren) ? body.nativeMotoren : [];
    const nodig = [];
    if (String(env.RTG_MAGNAAT_RUST || '').toLowerCase() === 'motor') nodig.push('magnaat-markt');
    const geld = String(env.RTG_MOTOR_GELD || '').toLowerCase() === 'motor';
    if (geld) nodig.push('pay-grootboek', 'bank-grootboek');
    const mist = nodig.filter(naam => !native.includes(naam));
    if (mist.length) throw new Error('native motor(en) ontbreken: ' + mist.join(', '));
    let bank = null, duurzaam = null;
    if (geld) {
      duurzaam = body.duurzaam;
      if (!duurzaam || duurzaam.gereed !== true || duurzaam.snapshotGeladen !== true ||
          duurzaam.snapshotGeldig !== true || duurzaam.versleuteld !== true ||
          duurzaam.algoritme !== 'XChaCha20-Poly1305' ||
          !/^g-[a-f0-9]{32}$/.test(String(duurzaam.genesisId || '')) ||
          duurzaam.genesisId !== String(env.RTG_MOTOR_EXPECT_GENESIS || '') ||
          !/^[A-Za-z0-9._-]{1,40}$/.test(String(duurzaam.keyId || '')) ||
          !Number.isSafeInteger(duurzaam.huidigeRevisie) ||
          !Number.isSafeInteger(duurzaam.laatsteDuurzameRevisie) ||
          duurzaam.huidigeRevisie !== duurzaam.laatsteDuurzameRevisie ||
          duurzaam.laatsteSchrijfFout !== null)
        throw new Error('geldmotor heeft geen groen duurzaamheids-/snapshotbewijs');
      if (!Number.isSafeInteger(body.som) || body.som !== 0)
        throw new Error('pay-grootboek meldt geen integer nulconservatie');
      const bankAntwoord = await vraag('/api/bank/status');
      bank = bankAntwoord.body;
      if (!bankAntwoord.antwoord.ok || !bank || bank.ok !== true || bank.klopt !== true ||
          !Number.isSafeInteger(bank.som) || bank.som !== 0 || !bank.vingerafdruk)
        throw new Error('bank-grootboek is niet geladen, integer of conserverend');
    }
    return { ok: true, ms: Date.now() - begin, native, duurzaam, bank,
      vingerafdruk: body.vingerafdruk || null };
  } catch (e) {
    return { ok: false, ms: Date.now() - begin, fout: e && e.name === 'AbortError' ? 'geen antwoord binnen 5 seconden' : String(e.message || e) };
  } finally { clearTimeout(timer); }
}

module.exports = { motorProef, motorUrl, leesBegrensd, MAX_ANTWOORD };

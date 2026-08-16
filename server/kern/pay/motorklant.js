/* Motor-client voor de CUTOVER (RTG_MOTOR_GELD=motor): maakt de Rust-motor het
   ENIGE autoritatieve grootboek. Anders dan de schaduw-laag (fire-and-forget
   spiegeling) is dit een SYNCHRONE afhankelijkheid op het geld-pad: elke boeking
   gaat eerst geguard naar de motor (/api/pay/boekguard), en pas als die de
   boeking bevestigt past de JS-engine dezelfde regel toe op zijn spiegel. Zo is
   er EEN grootboek (de motor) en kan er geen split-brain ontstaan.

   Standaard uit: zonder RTG_MOTOR_GELD=motor is dit een no-op en blijft de
   JS-engine zelf de baas (schaduw-modus). De URL komt uit RTG_MOTOR_GELD_URL of
   valt terug op RTG_MOTOR_SHADOW. */
'use strict';

module.exports = function maakMotorklant() {
  const globaleNoodstop = process.env.RTG_RUST_ALLES_UIT === '1';
  const modus = globaleNoodstop ? 'uit' : String(process.env.RTG_MOTOR_GELD || 'schaduw').toLowerCase();
  const aan = modus === 'motor';
  const URL = (process.env.RTG_MOTOR_GELD_URL || process.env.RTG_MOTOR_SHADOW || '').replace(/\/$/, '');
  const TIMEOUT_MS = Number(process.env.RTG_MOTOR_GELD_TIMEOUT || 5000);
  /* Het gedeelde geheim van de motor-poortwacht. Staat het daar gezet, dan
     weigert de motor elk verzoek zonder geldig token -- dus moet de client hem
     meesturen. Leeg laten is prima zolang de motor op loopback staat. */
  const TOKEN = process.env.RTG_MOTOR_TOKEN || '';
  const koppen = () => {
    const h = { 'content-type': 'application/json' };
    if (TOKEN) h['x-rtg-motor-token'] = TOKEN;
    return h;
  };

  if (aan && !URL) {
    // Fail-closed: motor-modus zonder motor-URL is een misconfiguratie. Beter nu
    // luid dan stil geld verliezen.
    throw new Error('RTG_MOTOR_GELD=motor maar geen RTG_MOTOR_GELD_URL / RTG_MOTOR_SHADOW gezet.');
  }

  async function post(pad, body) {
    const af = new AbortController();
    const t = setTimeout(() => af.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(URL + pad, {
        method: 'POST', headers: koppen(),
        body: JSON.stringify(body || {}), signal: af.signal,
      });
      const j = await r.json().catch(() => ({}));
      return { http: r.status, body: j };
    } finally { clearTimeout(t); }
  }

  return {
    aan, modus, globaleNoodstop, url: URL,

    // Geguard boeken op de motor (autoriteit). Retourneert {ok, boeking} bij
    // succes, of {error, status} als de motor weigert (bijv. 402 onvoldoende
    // saldo) of onbereikbaar is. NOOIT throwen op het geld-pad: de caller vertaalt
    // dit naar een nette fout en past NIETS toe op de spiegel bij een fout.
    async boekGuard({ van, naar, centen, soort, oms, ref }) {
      if (!aan) return { error: 'Rust-motor staat uit; JavaScript blijft autoritatief.', status: 503 };
      try {
        const { http, body } = await post('/api/pay/boekguard', { van, naar, centen: Math.round(Number(centen)), soort, oms, ref });
        if (http >= 300 || !body || body.ok !== true || !body.boeking) {
          return { error: (body && body.error) || 'Motor weigerde de boeking.', status: http || 502 };
        }
        return { ok: true, boeking: body.boeking };
      } catch (e) {
        return { error: e.name === 'AbortError' ? 'Motor-time-out.' : ('Motor onbereikbaar: ' + e.message), status: 502 };
      }
    },

    // De volledige saldi-stand van de motor (autoriteit), voor de herstart-
    // reconcile van de JS-spiegel. Vereist RTG_MOTOR_SALDI=1 (of _DEBUG=1) op de
    // motor. Retourneert { ok, saldi } of { error }.
    async saldiSnapshot() {
      if (!aan) return { error: 'Rust-motor staat uit; geen native saldi opgevraagd.', status: 503 };
      const af = new AbortController();
      const t = setTimeout(() => af.abort(), TIMEOUT_MS);
      try {
        const r = await fetch(URL + '/api/motor/saldi', { method: 'POST', headers: koppen(), body: '{}', signal: af.signal });
        if (r.status >= 300) return { error: 'Motor gaf ' + r.status + ' op /api/motor/saldi (staat RTG_MOTOR_SALDI=1 aan?).', status: r.status };
        const j = await r.json().catch(() => null);
        if (!j || typeof j !== 'object') return { error: 'Motor gaf geen saldi terug.', status: 502 };
        return { ok: true, saldi: j };
      } catch (e) {
        return { error: e.name === 'AbortError' ? 'Motor-time-out.' : ('Motor onbereikbaar: ' + e.message), status: 502 };
      } finally { clearTimeout(t); }
    },
  };
};

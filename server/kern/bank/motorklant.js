/* Motor-client voor de bank-CUTOVER (RTG_MOTOR_GELD=motor): maakt de Rust-motor
   het ENIGE autoritatieve grootboek voor OOK de RTG Bank (naast RTG Pay). De
   motor houdt een tweede, aparte Ledger voor de bank; de rijke bank-guard
   (rekening bestaat, bevroren, rood-staan-bodem) blijft in de JS-engine, want die
   leunt op de rekening-metadata die daar woont. De motor doet dus een RAUWE apply
   (/api/bank/boek) en is de bron van waarheid voor de saldi; de JS-engine guard't
   ervoor en spiegelt de door de motor bevestigde regel.

   Standaard uit: zonder RTG_MOTOR_GELD=motor is dit een no-op en blijft de
   JS-engine zelf de baas (schaduw-modus), exact als voorheen. Dezelfde vlag en
   URL als de pay-motorklant, want het is dezelfde motor-processus. */
'use strict';

module.exports = function maakBankMotorklant() {
  const modus = String(process.env.RTG_MOTOR_GELD || 'schaduw').toLowerCase();
  const aan = modus === 'motor';
  const URL = (process.env.RTG_MOTOR_GELD_URL || process.env.RTG_MOTOR_SHADOW || '').replace(/\/$/, '');
  const TIMEOUT_MS = Number(process.env.RTG_MOTOR_GELD_TIMEOUT || 5000);

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
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body || {}), signal: af.signal,
      });
      const j = await r.json().catch(() => ({}));
      return { http: r.status, body: j };
    } finally { clearTimeout(t); }
  }

  return {
    aan, modus, url: URL,

    // Rauw boeken op de motor (autoriteit). De JS-guard is AL gepasseerd voordat
    // dit wordt aangeroepen; de motor past de al-genomen beslissing enkel toe.
    // Retourneert {ok, boeking} bij succes, of {error, status} als de motor
    // weigert of onbereikbaar is. NOOIT throwen op het geld-pad: de caller
    // vertaalt dit naar een nette fout en past NIETS toe op de spiegel bij een fout.
    async bankBoek({ van, naar, centen, soort, oms, ref }) {
      try {
        const { http, body } = await post('/api/bank/boek', { van, naar, centen: Math.round(Number(centen)), soort, oms, ref });
        if (http >= 300 || !body || body.ok !== true || !body.boeking) {
          return { error: (body && body.error) || 'Motor weigerde de bankboeking.', status: http || 502 };
        }
        return { ok: true, boeking: body.boeking };
      } catch (e) {
        return { error: e.name === 'AbortError' ? 'Motor-time-out.' : ('Motor onbereikbaar: ' + e.message), status: 502 };
      }
    },

    // De volledige bank-saldi-stand van de motor (autoriteit), voor de herstart-
    // reconcile van de JS-spiegel. Vereist RTG_MOTOR_SALDI=1 (of _DEBUG=1) op de
    // motor. Retourneert { ok, saldi } of { error }.
    async bankSaldiSnapshot() {
      const af = new AbortController();
      const t = setTimeout(() => af.abort(), TIMEOUT_MS);
      try {
        const r = await fetch(URL + '/api/bank/saldi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: af.signal });
        if (r.status >= 300) return { error: 'Motor gaf ' + r.status + ' op /api/bank/saldi (staat RTG_MOTOR_SALDI=1 aan?).', status: r.status };
        const j = await r.json().catch(() => null);
        if (!j || typeof j !== 'object') return { error: 'Motor gaf geen saldi terug.', status: 502 };
        return { ok: true, saldi: j };
      } catch (e) {
        return { error: e.name === 'AbortError' ? 'Motor-time-out.' : ('Motor onbereikbaar: ' + e.message), status: 502 };
      } finally { clearTimeout(t); }
    },
  };
};

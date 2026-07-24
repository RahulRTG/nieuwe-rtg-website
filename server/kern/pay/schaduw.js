/* Schaduw-modus: spiegelt elke boeking van de autoritaire JS-engine naar de
   Rust-motor, zodat die een continu-geverifieerd parallel-grootboek wordt op
   ECHT verkeer. JS blijft de baas; dit is fire-and-forget (nul latentie op het
   geld-pad) en in-order. Aangezet met RTG_MOTOR_SHADOW=<motor-url>.

   Ontwerp: een kleine wachtrij + een achtergrond-flusher die batches naar
   /api/pay/boekbatch stuurt. Valt de motor weg, dan buffert het tot een plafond
   en laat daarna de oudste vallen (best-effort; de drift-detector ziet een gat).
   De motor herspeelt rauw (zonder saldo-guard), dus een spiegeling faalt nooit
   spontaan op volgorde. */
'use strict';

module.exports = function maakSchaduw() {
  const URL = process.env.RTG_MOTOR_SHADOW;
  if (!URL) return { aan: false, spiegel() {}, async stand() { return null; } };

  const BATCH = 500;
  const MAX_QUEUE = 100000; // plafond tegen geheugengroei als de motor wegvalt
  const rij = [];
  let bezig = false;

  async function flush() {
    if (bezig || rij.length === 0) return;
    bezig = true;
    try {
      while (rij.length) {
        const stuk = rij.splice(0, BATCH);
        try {
          await fetch(URL.replace(/\/$/, '') + '/api/pay/boekbatch', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ boekingen: stuk }),
          });
        } catch (e) {
          // motor even weg: terug in de rij (vooraan) en stoppen tot de
          // volgende tik; niet vastlopen
          rij.unshift(...stuk);
          break;
        }
      }
    } finally {
      bezig = false;
    }
  }

  // elke 200 ms een batch wegwerken (coalesced, buiten het geld-pad om)
  const timer = setInterval(() => { flush().catch(() => {}); }, 200);
  if (timer.unref) timer.unref();

  return {
    aan: true,
    // wordt aangeroepen NA een geslaagde lokale boeking; nooit blokkeren/gooien
    spiegel(b) {
      try {
        if (rij.length >= MAX_QUEUE) rij.shift(); // oudste valt, best-effort
        rij.push({ van: b.van, naar: b.naar, centen: b.centen, soort: b.soort, oms: b.oms, ref: b.ref || null });
      } catch (e) { /* schaduw mag het echte pad nooit raken */ }
    },
    // vergelijk de stand: JS-som vs motor-som (drift-detector). Met een korte
    // time-out zodat het statusbord nooit hangt op een trage/dode motor.
    async stand(jsSom) {
      const af = new AbortController();
      const t = setTimeout(() => af.abort(), 2000);
      try {
        const r = await fetch(URL.replace(/\/$/, '') + '/api/motor/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: af.signal });
        const j = await r.json();
        return { motorSom: j.som, motorKlopt: j.klopt, jsSom, gelijk: Number(j.som) === Number(jsSom) };
      } catch (e) { return { fout: e.name === 'AbortError' ? 'time-out (2s)' : e.message }; }
      finally { clearTimeout(t); }
    },
  };
};

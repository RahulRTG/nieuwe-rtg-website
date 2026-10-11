/* RTG Pay, de HERSTART-RECONCILE in motorstand (uit ./opladen.js gehaald,
   keuringsregel 13): een onderwerp op zich -- de JS-spiegel die zijn saldi bij het
   opstarten van de motor overneemt -- en geen deel van het opladen. */
'use strict';

module.exports = ({ geldModus, motorklant, d, save }) => {
  /* Herstart-reconcile (cutover): bij het opstarten in motor-modus is de motor de
     autoriteit, dus de JS-spiegel moet zijn saldi uit de motor-snapshot overnemen
     i.p.v. uit zijn eigen (mogelijk verouderde) snapshot. We halen de volledige
     saldi-stand op en vervangen db.data.paySaldi ermee. Zo start de spiegel altijd
     in lockstep met de motor, ook na een crash of nadat de motor los is bijgewerkt.
     No-op buiten motor-modus. */
  return async function reconcileVanMotor() {
    if (geldModus !== 'motor') return { ok: true, overgeslagen: true };
    const r = await motorklant.saldiSnapshot();
    if (!r || r.error) return { ok: false, error: (r && r.error) || 'Geen saldi van de motor.' };
    const nieuw = {};
    for (const k in r.saldi) {
      if (!Object.prototype.hasOwnProperty.call(r.saldi, k)) continue;
      const v = Math.round(Number(r.saldi[k]) || 0);
      if (v !== 0) nieuw[k] = v; // nul-saldi laten we weg (schone spiegel)
    }
    d().paySaldi = nieuw;
    save();
    let som = 0; for (const k in nieuw) som += nieuw[k];
    return { ok: true, rekeningen: Object.keys(nieuw).length, som };
  };
};

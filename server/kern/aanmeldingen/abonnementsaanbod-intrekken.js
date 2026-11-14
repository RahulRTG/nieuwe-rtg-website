/* Alleen een voorstel zonder enige betaalstart kan worden ingetrokken. Het
   contractslot deelt de grendel met betaling.bereid; betaalWaarheid wordt ook
   onder hetzelfde getypeerde slot gelezen, nooit uit een oudere worker-cache. */
'use strict';
const vorm = require('./abonnementsaanbod-vorm');
module.exports = ({ werk, resultaat, herstel, slot }) => async function intrekken(id, input) {
  if (!vorm.object(input) || typeof input.contractId !== 'string' || typeof input.aanbodHash !== 'string')
    return vorm.fout(400, 'Noem het eigen voorstel en de gelezen aanbodreferentie.');
  return werk(id, (data, motor, at) => {
    const c = data.contracten.find(c => c.id === input.contractId && c.accountId === id && c.automatischAbonnement);
    if (!c) return vorm.fout(404, 'Dit eigen voorstel is niet gevonden.');
    if (!vorm.aanbodGeldig(c) || input.aanbodHash !== c.aanbod.hash)
      return vorm.fout(409, 'De aanbodreferentie klopt niet. Lees het eigen voorstel opnieuw.');
    if (c.status === 'GEEINDIGD' && c.intrekking && c.verrekening.status === 'VRIJGEGEVEN')
      return resultaat(c, motor, { herhaald: true });
    if (!['AANGEBODEN', 'GEACCEPTEERD'].includes(c.status))
      return vorm.fout(409, 'Een lopende overeenkomst kan niet als voorstel worden ingetrokken. Gebruik de eigen opzegroute.');
    const schema = data.lidmaatschapBetalingen.filter(r => r.contractId === c.id);
    const gestart = schema.some(r => !Array.isArray(r.termijnen) || r.termijnen.length > 0) ||
      Object.values(data.betaalWaarheid).some(w => w && w.context && w.context.contractId === c.id) ||
      c.activering || c.betaalafspraak || c.start || c.setup;
    if (gestart) return vorm.fout(409, 'Er is al een betalings- of setupopdracht. Laat die eerst herstellen; het voorstel kan niet veilig worden vrijgegeven.');
    const r = motor.beeindig(c);
    if (r.error || !c.verrekening) return herstel();
    c.verrekening.status = 'VRIJGEGEVEN'; c.intrekking = { at, reden: 'eigen-voorstel-voor-betaalstart' };
    return resultaat(c, motor, { herhaald: false });
  }, { ...slot, betaalWaarheid: 'kaart' });
};

/* Conflictvaste drie-weg-merge voor een HTTP-request.

   De gewone synchronisatiemerge kiest bij twee wijzigingen van hetzelfde
   scalarveld de lokale schrijver. Dat is geschikt voor een write-behind
   gebruikersinterface, maar niet voor een autorisatie- of intrekkingsrequest:
   een verouderde rol mag nooit een nieuwere intrekking overschrijven. Deze
   variant voegt alleen aantoonbaar onafhankelijke velden/items samen. Raken
   beide kanten hetzelfde blad verschillend, dan moet de aanroeper opnieuw
   lezen en faalt de transactie gesloten. */
'use strict';

const { itemSleutel, soort } = require('../db/merge');
const json = v => JSON.stringify(v);

function conflict(pad) {
  const e = new Error('Dezelfde gegevens zijn gelijktijdig gewijzigd' +
    (pad ? ' bij ' + pad : '') + '; laad opnieuw voordat u deze handeling herhaalt.');
  e.code = 'PG_REQUEST_CONFLICT'; throw e;
}

function voegVeilig(base, ons, hun, pad) {
  if (json(ons) === json(hun)) return ons;
  if (json(ons) === json(base)) return hun;
  if (json(hun) === json(base)) return ons;

  const so = soort(ons), st = soort(hun), sb = soort(base);
  if (so !== st || (base !== undefined && sb !== so)) return conflict(pad);
  if (so === 'scalar') return conflict(pad);

  if (so === 'object') {
    const uit = {}, b = base || {};
    const sleutels = new Set([...Object.keys(b), ...Object.keys(ons), ...Object.keys(hun)]);
    for (const k of sleutels) {
      const waarde = voegVeilig(b[k], ons[k], hun[k], pad ? pad + '.' + k : k);
      if (waarde !== undefined) uit[k] = waarde;
    }
    return uit;
  }

  const b = base || [];
  const keybaar = [b, ons, hun].every(a => Array.isArray(a) && a.every(x => itemSleutel(x) != null));
  if (!keybaar) return conflict(pad);
  const kaart = a => new Map(a.map(x => [itemSleutel(x), x]));
  const mb = kaart(b), mo = kaart(ons), mt = kaart(hun), uit = [];
  const sleutels = new Set([...mb.keys(), ...mo.keys(), ...mt.keys()]);
  for (const k of sleutels) {
    const waarde = voegVeilig(mb.get(k), mo.get(k), mt.get(k), (pad || 'lijst') + '[' + k + ']');
    if (waarde !== undefined) uit.push(waarde);
  }
  return uit;
}

module.exports = { voegVeilig };

/* De API-poort, deelbestand "levensduur": hoe lang een machinesleutel leeft
   en hoe hij wordt vervangen (CODECREDENTIALS.json, command.api_machinesleutel).

   DE LEVENSDUUR IS VERPLICHT. Zonder `dagen` krijgt een sleutel de standaard,
   en langer dan het maximum bestaat niet: een koppeling die langer loopt,
   roteert. Een sleutel van voor deze regel (vervalt null) houdt het merkteken
   legacy en vervalt op LEGACY_TOT -- zo breekt een lopende koppeling niet
   vandaag, en "nooit" bestaat niet meer. Die datum is een besluit van de
   eigenaar en staat als open punt in de notitie van de deur.

   ROTEREN is een nieuwe sleutel met dezelfde naam, eigenaar, scopes en quotum,
   en de oude is in DEZELFDE opslagronde ingetrokken. Geen overlap: intrekken
   was hier altijd meteen, en een koppeling die een wisselvenster nodig heeft
   maakt eerst een tweede sleutel en trekt de eerste daarna in.

   UITGEVEN DOET EEN MENS OP NAAM. De routes hangen achter naamAuth; hier weigert
   de kern een lege of gedeelde uitgever alsnog, zodat een tweede aanroeper die
   de deur vergeet niet stil onder de gedeelde kantoorcode uitgeeft. */
'use strict';

const DAGEN_STANDAARD = 90;
const DAGEN_MAX = 365;
const LEGACY_TOT = '2026-12-31T23:59:59.000Z';
const vervaltVan = (s) => (s && s.vervalt) || LEGACY_TOT;

/* Een dagtelling is een geheel getal tussen 1 en DAGEN_MAX; weglaten geeft de
   standaard. Een ongeldige waarde wordt geweigerd en niet stil afgekapt. */
function geldigheid(dagen) {
  if (dagen == null || dagen === '') return DAGEN_STANDAARD;
  const d = Number(dagen);
  return Number.isInteger(d) && d >= 1 && d <= DAGEN_MAX ? d : null;
}

function uitgifteFout(opties) {
  const o = opties || {};
  if (!geldigheid(o.dagen))
    return { error: 'Een sleutel geldt 1 tot ' + DAGEN_MAX + ' dagen; langer bestaat niet, dan roteert u.', status: 400 };
  if (!o.door || /gedeelde code/.test(String(o.door)))
    return { error: 'Een machinesleutel wordt op naam uitgegeven, niet onder de gedeelde kantoorcode.', status: 403 };
  return null;
}

function maakRoteer({ vak, save, journaal, NIVEAUS, maak, kort, nu }) {
  return function roteer(id, opties) {
    const o = opties || {};
    const oud = vak().sleutels[String(id)];
    if (!oud) return { error: 'Die sleutel bestaat niet.', status: 404 };
    if (oud.ingetrokken) return { error: 'Een ingetrokken sleutel roteert niet; maak een nieuwe.', status: 409 };
    const r = maak(oud.naam, oud.scopes, { door: o.door, eigenaar: oud.eigenaar,
      quotaPerUur: oud.quotaPerUur, dagen: o.dagen });
    if (r.error) return r;
    oud.ingetrokken = { at: nu(), door: String(o.door || ''), reden: 'geroteerd naar ' + r.sleutel.id };
    save();
    if (journaal) journaal.noteer({ actie: 'api-sleutel geroteerd', actor: o.door, niveau: NIVEAUS.hand,
      objectType: 'apisleutel', objectId: oud.id, reden: r.sleutel.id });
    return Object.assign(r, { vorige: kort(oud) });
  };
}

module.exports = { DAGEN_STANDAARD, DAGEN_MAX, LEGACY_TOT, vervaltVan, geldigheid, uitgifteFout, maakRoteer };

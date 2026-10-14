/* DE MIGRATIE VAN DE KALE CONTRACTHASH NAAR HET HMAC-ZEGEL, en de rotatie
   daarna (./bearercode-zegel.js). Wordt aangeroepen door
   scripts/bearercode-herseal.js, nooit door een opstartpad: herzegelen is een
   besluit van de eigenaar en geen bijwerking.

   WAT ER GEBEURT. Een v2-record zonder `contractkid` draagt nog een kale
   sha256. Zo'n record opent sinds het zegel NIETS (`ongezegeld`), en valt ook
   niet terug op v1 of op een kale controle. herzegel() loopt een collectie
   af, en zegelt een record alleen als zijn kale hash NU klopt voor precies
   een namespace uit de kandidaten; anders blijft het dicht en wordt het
   geteld. Met `roteer` krijgt een record dat al onder een oudere, nog
   aanwezige kid klopt, het zegel van de nieuwste -- daarna kan de oude kid uit
   de ring.

   DE GRENS, eerlijk: een record dat VOOR de migratie al gemanipuleerd en
   opnieuw kaal gehasht was, is niet te onderscheiden van een echt record en
   wordt meegezegeld. Wat dat risico beperkt: `maxRestMs` zegelt alleen wat
   binnen de normale termijn nog openstaat (een opgerekte expires_at valt
   erbuiten en blijft dicht), verlopen en ingetrokken records blijven
   ongezegeld (die openen toch niets), en het rapport noemt per collectie wat
   er gebeurde, zodat de eigenaar het naast een back-up van voor het besluit
   kan leggen. Zo kort mogelijk tussen besluit en migratie houdt het venster
   klein. */
'use strict';
const { maakContractzegel, kaleHash } = require('./bearercode-zegel');

const v2spoor = o => o && typeof o === 'object' && !Array.isArray(o) && typeof o.code_hash === 'string' &&
  ['contractversie', 'contracthash', 'contractkid', 'gebruiksvorm'].some(k => o[k] !== undefined);

function* records(waarde, diepte = 0) {
  if (!waarde || typeof waarde !== 'object' || diepte > 12) return;
  if (v2spoor(waarde)) { yield waarde; return; }
  for (const v of Array.isArray(waarde) ? waarde : Object.values(waarde)) yield* records(v, diepte + 1);
}

function herzegel(waarde, { crypto, namespaces, sleutelring, nu, roteer = false, maxRestMs = null }) {
  const zegels = new Map([...new Set(namespaces)].map(ns => [ns, maakContractzegel({ crypto, ns, sleutelring })]));
  const telling = { bekeken: 0, gemigreerd: 0, geroteerd: 0, inOrde: 0, kaleHashKloptNiet: 0,
    buitenTermijn: 0, nietLevend: 0, sleutelOntbreekt: 0, gemanipuleerd: 0 };
  const t0 = Date.parse(nu());
  for (const t of records(waarde)) {
    telling.bekeken += 1;
    if (typeof t.contractkid === 'string' && t.contractkid) {
      /* Al gezegeld: welke namespace? Die waarvoor het zegel klopt. */
      const passend = [...zegels.entries()].filter(([, z]) => z.toets(t) === null);
      if (passend.length !== 1) {
        const r = [...zegels.values()][0];
        telling[r && r.toets(t) === 'sleutel-ontbreekt' ? 'sleutelOntbreekt' : 'gemanipuleerd'] += 1;
        continue;
      }
      const z = passend[0][1];
      if (roteer && t.contractkid !== z.actief()) { Object.assign(t, z.zegel(t)); telling.geroteerd += 1; } else telling.inOrde += 1;
      continue;
    }
    const passend = [...zegels.keys()].filter(ns => t.contracthash === kaleHash(crypto, ns, t));
    /* Klopt voor geen bekende namespace: gemanipuleerd, of een namespace die
       de kandidatenlijst mist. Beide blijven dicht; het script noemt de lijst. */
    if (!passend.length) { telling.kaleHashKloptNiet += 1; continue; }
    const einde = Date.parse(t.expires_at);
    if (t.ingetrokken_at || !(einde > t0)) { telling.nietLevend += 1; continue; }
    if (maxRestMs != null && einde - t0 > maxRestMs) { telling.buitenTermijn += 1; continue; }
    Object.assign(t, zegels.get(passend[0]).zegel(t));
    telling.gemigreerd += 1;
  }
  return telling;
}

module.exports = { herzegel, records };

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
   klein.

   OPNIEUW UITGEVEN (voorwaarde 3 van de uitrol). metLijst() geeft naast de
   telling per collectie de records die DICHT blijven en dus opnieuw moeten
   worden uitgegeven (kaleHashKloptNiet, buitenTermijn, sleutelOntbreekt,
   gemanipuleerd), met alleen een pad binnen de collectie, en `id`, `doel` en
   `expires_at` als die er zijn. Nooit code_hash, contracthash of een ander
   geheim: een objectsleutel die op een hash of token lijkt wordt `[#n]`.
   nietLevend telt apart en staat NIET in die lijst: dat record opende al niets.

   DE CONTROLE NA DE MIGRATIE (voorwaarde 6). controleer() leest alleen en
   meldt als afwijking: er is nog iets te migreren (of, met roteer, te
   roteren), of een record dat op `moment` (het migratiemoment) al verlopen of
   ingetrokken was draagt een geldig zegel. De grens, eerlijk: intrekken zit
   niet in het zegel, dus een code die de server NA de invoering van het zegel
   uitgaf en daarna introk telt ook mee; `zegelSinds` (het moment dat het zegel
   live ging) laat die weg. */
'use strict';
const { maakContractzegel, kaleHash } = require('./bearercode-zegel');

const v2spoor = o => o && typeof o === 'object' && !Array.isArray(o) && typeof o.code_hash === 'string' &&
  ['contractversie', 'contracthash', 'contractkid', 'gebruiksvorm'].some(k => o[k] !== undefined);

/* Een objectsleutel komt alleen in een pad als hij niet op een hash of token
   lijkt (een collectie die op code_hash is geïndexeerd, lekt die anders). */
const toonbaar = k => k.length <= 40 && /^[\w.:-]+$/.test(k) && !/[0-9a-f]{16,}/i.test(k) &&
  !(/[A-Za-z0-9_-]{20,}/.test(k) && /\d/.test(k));

function* records(waarde, pad = '', diepte = 0) {
  if (!waarde || typeof waarde !== 'object' || diepte > 12) return;
  if (v2spoor(waarde)) { yield [waarde, pad]; return; }
  if (Array.isArray(waarde)) { for (let i = 0; i < waarde.length; i++) yield* records(waarde[i], pad + '[' + i + ']', diepte + 1); return; }
  let i = 0;
  for (const [k, v] of Object.entries(waarde)) {
    yield* records(v, pad + (toonbaar(k) ? '.' + k : '[#' + i + ']'), diepte + 1);
    i += 1;
  }
}

function herzegel(waarde, { crypto, namespaces, sleutelring, nu, roteer = false, maxRestMs = null, melding = null }) {
  const zegels = new Map([...new Set(namespaces)].map(ns => [ns, maakContractzegel({ crypto, ns, sleutelring })]));
  const telling = { bekeken: 0, gemigreerd: 0, geroteerd: 0, inOrde: 0, kaleHashKloptNiet: 0,
    buitenTermijn: 0, nietLevend: 0, sleutelOntbreekt: 0, gemanipuleerd: 0 };
  const t0 = Date.parse(nu());
  for (const [t, pad] of records(waarde)) {
    const dicht = reden => { telling[reden] += 1; if (melding && reden !== 'nietLevend') melding(reden, t, pad); };
    telling.bekeken += 1;
    if (typeof t.contractkid === 'string' && t.contractkid) {
      /* Al gezegeld: welke namespace? Die waarvoor het zegel klopt. */
      const passend = [...zegels.entries()].filter(([, z]) => z.toets(t) === null);
      if (passend.length !== 1) {
        const r = [...zegels.values()][0];
        dicht(r && r.toets(t) === 'sleutel-ontbreekt' ? 'sleutelOntbreekt' : 'gemanipuleerd');
        continue;
      }
      const z = passend[0][1];
      if (roteer && t.contractkid !== z.actief()) { Object.assign(t, z.zegel(t)); telling.geroteerd += 1; } else telling.inOrde += 1;
      continue;
    }
    const passend = [...zegels.keys()].filter(ns => t.contracthash === kaleHash(crypto, ns, t));
    /* Klopt voor geen bekende namespace: gemanipuleerd, of een namespace die
       de kandidatenlijst mist. Beide blijven dicht; het script noemt de lijst. */
    if (!passend.length) { dicht('kaleHashKloptNiet'); continue; }
    const einde = Date.parse(t.expires_at);
    if (t.ingetrokken_at || !(einde > t0)) { dicht('nietLevend'); continue; }
    if (maxRestMs != null && einde - t0 > maxRestMs) { dicht('buitenTermijn'); continue; }
    Object.assign(t, zegels.get(passend[0]).zegel(t));
    telling.gemigreerd += 1;
  }
  return telling;
}

/* Een regel voor een lijst: pad en wat geen geheim is. Een veld waarvan de
   waarde in het pad terugkomt, haalt het pad weg -- liever geen pad dan een lek. */
function regel(reden, t, pad, wortel) {
  const geheim = ['code_hash', 'contracthash', 'bron_toegang'].map(k => t[k]).filter(v => typeof v === 'string' && v);
  const r = { reden, pad: geheim.some(g => pad.includes(g)) ? wortel + '[verborgen]' : wortel + pad };
  if ((typeof t.id === 'string' && toonbaar(t.id) && !geheim.includes(t.id)) || Number.isSafeInteger(t.id)) r.id = t.id;
  for (const k of ['doel', 'issued_at', 'expires_at']) if (typeof t[k] === 'string') r[k] = t[k].slice(0, 100);
  return r;
}
const lijst = max => { const l = { regels: [], nietInLijst: 0 };
  l.voeg = r => { if (l.regels.length < max) l.regels.push(r); else l.nietInLijst += 1; }; return l; };

/* herzegel() plus de opnieuw-uitgeven-lijst. Schrijft in `waarde`, zoals herzegel. */
function metLijst(waarde, opties) {
  const { wortel = '', max = 500 } = opties;
  const l = lijst(max);
  const telling = herzegel(waarde, Object.assign({}, opties, { melding: (reden, t, pad) => l.voeg(regel(reden, t, pad, wortel)) }));
  return Object.assign(telling, { opnieuwUitgeven: l.regels, nietInLijst: l.nietInLijst });
}

/* Alleen lezen: is de migratie af, en leeft er geen dood record weer? */
function controleer(waarde, opties) {
  const { crypto, namespaces, sleutelring, nu, roteer = false, wortel = '', max = 500 } = opties;
  const uitslag = metLijst(JSON.parse(JSON.stringify(waarde)), opties);
  const zegels = [...new Set(namespaces)].map(ns => maakContractzegel({ crypto, ns, sleutelring }));
  const moment = Date.parse(opties.moment || nu());
  const sinds = opties.zegelSinds ? Date.parse(opties.zegelSinds) : null;
  const dood = lijst(max);
  for (const [t, pad] of records(waarde)) {
    if (typeof t.contractkid !== 'string' || !t.contractkid || !zegels.some(z => z.toets(t) === null)) continue;
    const ingetrokken = t.ingetrokken_at && !(Date.parse(t.ingetrokken_at) > moment);
    if (!ingetrokken && Date.parse(t.expires_at) > moment) continue;
    if (sinds != null && Date.parse(t.issued_at) >= sinds) continue;
    dood.voeg(regel('doodMetZegel', t, pad, wortel));
  }
  const afwijkingen = [];
  if (uitslag.gemigreerd) afwijkingen.push(uitslag.gemigreerd + ' record(s) nog te migreren');
  if (roteer && uitslag.geroteerd) afwijkingen.push(uitslag.geroteerd + ' record(s) nog te roteren');
  const n = dood.regels.length + dood.nietInLijst;
  if (n) afwijkingen.push(n + ' verlopen of ingetrokken record(s) met een geldig zegel');
  return Object.assign(uitslag, { doodMetZegel: dood.regels, doodNietInLijst: dood.nietInLijst, afwijkingen });
}

module.exports = { herzegel, metLijst, controleer, records };

/* Het gedeelde PIN-slot: EEN teller per DOEL, voor elke deur die op dat doel
   uitkomt.

   De persoonlijke pincode van een personeelslid is met vier cijfers al niet
   sterk; hij is bruikbaar omdat er maar een handjevol pogingen in past. Dat
   werkt alleen als de teller aan het DOEL hangt (deze pin, van deze persoon,
   bij deze zaak) en niet aan de aanvrager -- en als elke deur naar dezelfde
   pin dezelfde teller gebruikt.

   Allebei ging het mis.

   /api/supplier/login telde netjes per doel ('CODE:staffId', vijf pogingen,
   dan een minuut dicht). /api/account/koppel -- de tweede deur naar precies
   dezelfde verifyStaffPin -- had een EIGEN teller, en die hing aan het account
   van de aanvrager. Een gratis RTG-account kost een e-mailadres, dus wie er
   twintig maakte had twintig keer vijf pogingen per minuut op EEN pin, en de
   teller van de eerste deur zag daar niets van. Vier cijfers zijn dan in een
   uur of anderhalf uur af te lopen, zonder ooit een slot te raken.

   Bovendien telde de tweede deur de TOTP-poging helemaal niet: kwam de
   backoffice-code goed door, dan mocht de authenticator-code onbeperkt geraden
   worden.

   Dit bestand is dus geen nieuwe laag maar een SAMENVOEGING: een teller,
   gedeeld door beide deuren, met een sleutel die het doel benoemt. Wie een
   derde deur naar een pin bouwt, gebruikt hem ook -- dat is de hele bedoeling.

   In het geheugen, bewust: een slot dat een herstart overleeft is fijn, maar
   een slot dat bij een herstart WEG is, is nog altijd oneindig veel beter dan
   vijf tellers die elkaar niet kennen. Bij meerdere instances telt elke
   instance apart; dat is een bekende beperking van elke in-memory rem in dit
   huis (loginFails doet het net zo) en hoort bij de gedeelde-opslag-stap. */

const MAX_POGINGEN = 5;      // zoveel misgrepen mag een doel hebben...
const STRAF_MS = 60000;      // ...daarna gaat het een minuut dicht

function maakPinSlot({ beveilig } = {}) {
  // doel -> { n: misgrepen sinds de laatste straf, tot: dicht tot (ms), sinds }
  const fails = new Map();

  /* De sleutel van een personeelspin. Number() aan beide kanten, anders zijn
     "7" en "07" twee doelen en dus twee tellers voor een pin. */
  const personeel = (code, staffId) => 'staff:' + String(code || '').toUpperCase() + ':' + Number(staffId);

  function dicht(doel) {
    const f = fails.get(doel);
    return !!(f && f.tot > Date.now());
  }

  /* Een misgreep op dit doel. `wat` is de menselijke omschrijving voor het
     veiligheidsbord; die melding komt ALLEEN op de overgang naar dicht, niet
     bij elke poging -- anders verdrinkt het bord in ruis bij iemand die zijn
     eigen pin verkeerd intikt. */
  function fout(doel, wat) {
    const f = fails.get(doel) || { n: 0, tot: 0, sinds: 0 };
    const n = f.n + 1;
    if (n >= MAX_POGINGEN) {
      fails.set(doel, { n: 0, tot: Date.now() + STRAF_MS, sinds: Date.now() });
      if (beveilig) {
        try {
          beveilig.meld('pin-raden', 'waarschuwing',
            MAX_POGINGEN + ' foute pincode-pogingen achter elkaar op ' + (wat || doel) + '; dit doel staat een minuut dicht.',
            { bron: doel });
        } catch (e) {}
      }
      return true;
    }
    fails.set(doel, { n, tot: 0, sinds: f.sinds || Date.now() });
    return false;
  }

  // gelukt: de teller van dit doel schoon
  function goed(doel) { fails.delete(doel); }

  /* Opruimen zonder de rem te lossen. De oude sweeper gooide ALLES weg
     waarvan `until < nu`, en dat gold ook voor een lopende telling
     ({ n: 3, until: 0 }): elke vijf minuten begon een aanvaller weer bij nul.
     Weg mag alleen wat niets meer tegenhoudt EN niets meer telt. */
  function opruimen(ouderDanMs) {
    const nu = Date.now();
    const oud = nu - (ouderDanMs || 15 * 60000);
    for (const [k, f] of fails) {
      if (f.tot > nu) continue;                 // staat nu dicht: laten staan
      if (f.n > 0 && (f.sinds || 0) > oud) continue; // telt nog en is vers: laten staan
      fails.delete(k);
    }
  }

  return { personeel, dicht, fout, goed, opruimen, MAX_POGINGEN, STRAF_MS, map: fails };
}

module.exports = { maakPinSlot };

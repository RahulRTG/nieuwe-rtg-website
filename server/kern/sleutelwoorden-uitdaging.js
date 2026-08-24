/* De INLOG-UITDAGING van de sleutelwoorden (het andere deel staat in
   ./sleutelwoorden.js: het instellen, het normaliseren en het hashen).

   Afgesplitst omdat het een ander onderwerp is dan het bewaren van vier woorden
   -- en omdat het hoofdbestand door de meting van taak 17 over de 9,4 kB van de
   omvangsmeter heen ging. Korter schrijven was de verleiding; opknippen is wat
   de regel vraagt, en dit was de natuurlijke naad.

   Wat hier zit is de kern van de veiligheid:

   - ROTERENDE DEELVERZAMELING. Elke inlog kiest willekeurig drie van de vier
     posities en hun volgorde. Wie meekijkt ziet hooguit drie woorden en nooit
     welke opstelling de volgende keer geldt, dus replay valt dood.
   - DE LOKVINK. Een onbekend account (of een account zonder sleutelwoorden)
     krijgt toch een uitdaging, met hetzelfde rekenwerk, die aan het eind gewoon
     faalt. Zo verklapt de poort niet welke e-mailadressen bekend zijn. Dat het
     even zwaar is, is dus geen verspilling maar de bedoeling.
   - HET SLOT. Vijf missers zetten het account een minuut vast; de uitdaging
     verloopt na drie minuten en na zes beurten.

   Alles komt binnen via de fabriek, zodat dit deel niets zelf hoeft te weten
   over de opslag of de kluis. */
'use strict';

const PER_KEER = 3;             // per inlog gebruik je er drie van de vier
const UITDAAG_TTL = 3 * 60000;  // een uitdaging leeft drie minuten
const MAX_BEURTEN = 6;          // en hooguit zes beurten
const MAX_OPEN = 500;           // zoveel lopende uitdagingen houden we bij

function maakUitdaging({ crypto, accounts, rij, herken, teVaak, fout, slotGoed, doel }) {
  const uitdagingen = new Map();   // id -> { userId, volgorde, stap, at, n, openOk }

  /* DEZE SCHUDBEURT BLIJFT OP CRYPTO, EN DAT IS EEN BESLUIT.

     Bij het invoeren van RTG_ZAAD (server/lib/toeval.js) ging deze eerst mee naar
     het zaad, met als redenering: welke woorden iemand kent is de beveiliging, de
     volgorde is presentatie. Dat klopte niet. kiesDrie() schudt VIER posities en
     neemt er DRIE -- de schudbeurt bepaalt dus ook wie er buiten valt. Wie de
     uitkomst kan voorspellen, hoeft maar drie van de vier sleutelwoorden te
     kennen. Dat is geen presentatie maar een kwart van de deur.

     Math.random stond hier eerder en was al fout om dezelfde reden, alleen
     stiller. Nu uit de systeembron, met randomInt zodat er geen restvertekening
     in zit: modulo op ruwe bytes maakt de lage waarden net iets waarschijnlijker,
     en bij vier posities is dat meetbaar. */
  function kiesDrie() {
    const p = [0, 1, 2, 3];
    for (let i = p.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p.slice(0, PER_KEER);
  }

  /* Verlopen uitdagingen weg, en anders de oudste. Zonder deze ronde groeit de
     Map met elke inlogpoging die nooit is afgemaakt -- inclusief die van een
     aanvaller, en dat is dan een geheugenlek met een open deur ervoor. */
  function opruim() {
    if (uitdagingen.size < MAX_OPEN) return;
    const nu = Date.now();
    for (const [id, c] of uitdagingen) if (nu - c.at > UITDAAG_TTL) uitdagingen.delete(id);
    while (uitdagingen.size >= MAX_OPEN) uitdagingen.delete(uitdagingen.keys().next().value);
  }

  // begint een uitdaging voor dit login; geeft altijd een id + de gevraagde
  // posities terug (ook voor een onbekend account: een lokvink die straks faalt)
  function swStart(login) {
    opruim();
    let user = null;
    try { user = accounts.findByLogin(login); } catch (e) { user = null; }
    const heeft = !!(user && rij()[user.id]);
    if (heeft && teVaak(user.id)) return { status: 429, error: 'Even te vaak geprobeerd; wacht een minuutje en begin opnieuw.' };
    const id = 'sw' + crypto.randomBytes(9).toString('hex');
    uitdagingen.set(id, { userId: heeft ? user.id : null, volgorde: kiesDrie(), stap: 'open', at: Date.now(), n: 0, openOk: false });
    const c = uitdagingen.get(id);
    return { id, posA: c.volgorde[0], posB: c.volgorde[1] };
  }

  // een beurt in de uitdaging. Stap 'open' verwacht de eerste twee woorden in
  // een zin; stap 'sluit' het derde. Succes geeft { ok, userId }.
  async function swZeg(id, tekst) {
    const c = uitdagingen.get(id);
    if (!c) return { status: 410, error: 'Deze inlogpoging ken ik niet meer; begin gerust opnieuw.' };
    if (Date.now() - c.at > UITDAAG_TTL) { uitdagingen.delete(id); return { status: 410, error: 'De inlogpoging verliep; begin opnieuw.' }; }
    if (++c.n > MAX_BEURTEN) { uitdagingen.delete(id); return { status: 429, error: 'Te veel heen en weer; begin even opnieuw.' }; }
    if (c.stap === 'open') {
      const a = await herken(c.userId, c.volgorde[0], tekst);
      const b = await herken(c.userId, c.volgorde[1], tekst);
      c.openOk = !!(c.userId != null && a && b);
      c.stap = 'sluit';
      return { stap: 'sluit', echo: c.openOk ? b : null, posSluit: c.volgorde[2] };
    }
    // stap 'sluit'
    const derde = await herken(c.userId, c.volgorde[2], tekst);
    const goed = c.openOk && !!derde && c.userId != null;
    uitdagingen.delete(id);
    if (goed) { slotGoed(doel(c.userId)); return { ok: true, userId: c.userId }; }
    if (c.userId != null) fout(c.userId);
    return { status: 401, error: 'Dat klopte net niet helemaal.' };
  }

  return { swStart, swZeg };
}

module.exports = { maakUitdaging, PER_KEER, UITDAAG_TTL, MAX_BEURTEN };

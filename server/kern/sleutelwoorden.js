/* Sleutelwoorden: inloggen door een gesprek met Rahul, in plaats van een
   wachtwoord in te tikken. Het lid onthoudt VIER woorden (in volgorde); per
   inlog gebruikt Rahul er DRIE, telkens een andere combinatie. Je verweeft je
   eerste twee gevraagde woorden losjes in een zin, Rahul herkent er een en
   zegt hem terug, en jij sluit af met het derde. Zo staat er nergens een vast
   wachtwoord op de lijn en geeft een keer meekijken nooit alle vier de woorden
   prijs.

   Veiligheid, bewust:
   - Elk woord gaat als scrypt-hash met een eigen zout de kluis in (node:crypto,
     geen afhankelijkheden); de woorden zelf worden nooit bewaard of gelogd, en
     vergelijken gaat timingvast (timingSafeEqual).
   - Roterende deelverzameling: elke inlog kiest de server willekeurig drie van
     de vier posities en hun volgorde. Een afgeluisterde sessie onthult hooguit
     drie woorden, en nooit welke opstelling de volgende keer geldt (replay valt
     dood).
   - Een slot per account: vijf misgelopen pogingen = een minuut wachten; de
     uitdaging zelf verloopt na drie minuten en na zes beurten.
   - Bestaat een account niet (of heeft het nog geen sleutelwoorden), dan geeft
     de server toch een uitdaging die aan het eind gewoon faalt: zo verklapt de
     poort niet welke e-mailadressen bekend zijn (geen account-enumeratie).

   Eerlijk over de grens: de "Rahul zegt een woord terug" is een herkennings-
   moment, geen sterk bewijs tegen phishing (hij herhaalt een woord dat je net
   zei). De echte kracht zit in de roterende deelverzameling, scrypt en het slot.

   maakSleutelwoorden(state) volgt het vaste kern-patroon. */

const AANTAL = 4;               // je onthoudt er vier
const PER_KEER = 3;             // per inlog gebruik je er drie
const UITDAAG_TTL = 3 * 60000;  // een uitdaging leeft drie minuten
const MAX_BEURTEN = 6;          // en hooguit zes beurten
const MAX_TOKENS = 16;          // zoveel woorden uit een zin wegen we hoogstens
const SLOT_NA = 5;              // vijf fouten
const SLOT_MS = 60000;          // = een minuut op slot

function maakSleutelwoorden({ db, save, crypto, accounts, slot }) {
  const rij = () => {
    if (!db.data.sleutelwoorden || typeof db.data.sleutelwoorden !== 'object') db.data.sleutelwoorden = {};
    return db.data.sleutelwoorden;
  };
  /* Het slot is gedeeld (server/pinslot.js); hier stond een eigen kopie van
     dezelfde teller zonder opruimronde. Zie de kop van dat bestand. */
  if (!slot || typeof slot.dicht !== 'function')
    throw new Error('sleutelwoorden: het gedeelde slot ontbreekt; zonder rem zijn vier woorden af te lopen.');
  const doel = userId => 'sleutelwoord:' + userId;
  const uitdagingen = new Map();   // id -> { userId, volgorde, stap, at, n, openOk }
  const DUMMY_ZOUT = crypto.randomBytes(16); // voor gelijkmatig rekenwerk bij een lokvink

  // woorden normaliseren: kleine letters, accenten en leestekens eraf, zodat
  // "Café!" en "cafe" hetzelfde matchen, ook los in een zin
  const norm = w => String(w || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  function woordenUit(tekst) {
    const zien = new Set(); const uit = [];
    for (const ruw of String(tekst || '').split(/[^A-Za-zÀ-ÿ0-9]+/)) {
      const t = norm(ruw);
      if (t.length >= 2 && !zien.has(t)) { zien.add(t); uit.push(t); if (uit.length >= MAX_TOKENS) break; }
    }
    return uit;
  }
  /* SCRYPT HOORT NIET OP DE EVENT-LOOP. Dit was crypto.scryptSync, en dat is
     gemeten wat het kostte:

       een enkele hash (N=16384, r=8, p=1)             40 ms
       een open-beurt (2 posities x 16 woorden)        32 hashes = 1298 ms
       een sluit-beurt (1 positie x 16 woorden)        16 hashes =  696 ms

     Die 1298 ms stond de HELE server stil: een hartslag (GET /api/health) die
     in rust 2 ms duurt, duurde tijdens een enkel inlogbericht 1301 ms. Acht
     tegelijk liepen keurig achter elkaar op -- 1,3 / 2,6 / 3,9 ... tot 10,9 s --
     want synchroon rekenwerk kent geen gelijktijdigheid. En dit pad ligt VOOR
     de inlog: een lokvink (onbekend account) kost exact evenveel, want dat is
     juist de bedoeling tegen account-enumeratie.

     De asynchrone variant rekent in de threadpool naast de lus. Even zwaar --
     dat is de bescherming en die blijft -- maar de server blijft ondertussen
     antwoorden. Zelfde parameters, zelfde uitkomst, alleen niet meer op de lus.

     BEWUST NIET met Promise.all: dan claimt een enkel inlogverzoek de hele
     threadpool (vier threads) en staan andere verzoeken die crypto of bestanden
     nodig hebben alsnog te wachten. Op volgorde is per verzoek even snel als
     voorheen en veel eerlijker tegenover de rest. */
  const hash = (w, zout) => new Promise((klaar, mis) =>
    crypto.scrypt(w, zout, 32, { N: 16384, r: 8, p: 1 }, (e, k) => e ? mis(e) : klaar(k.toString('base64'))));

  const teVaak = userId => slot.dicht(doel(userId));
  const fout = userId => slot.fout(doel(userId), 'de sleutelwoorden van ' + userId);

  // vind in de zin het woord dat op deze positie hoort; geef het herkende woord
  // terug (uit de zin van de gebruiker zelf) of null. Bij een lokvink draait er
  // gelijkwaardig rekenwerk zodat de duur niets verklapt.
  async function herken(userId, positie, tekst) {
    const w = userId != null && rij()[userId] && rij()[userId].woorden[positie];
    const tokens = woordenUit(tekst);
    if (!w) { for (const t of tokens) await hash(t, DUMMY_ZOUT); return null; }
    const zout = Buffer.from(w.zout, 'base64');
    const doel = Buffer.from(w.hash, 'base64');
    let raak = null;
    for (const t of tokens) {
      const h = Buffer.from(await hash(t, zout), 'base64');
      /* NIET vroegtijdig stoppen: wie het goede woord vooraan zet zou dan
         sneller antwoord krijgen dan wie het achteraan zet, en dat verschil is
         te meten. Alle woorden wegen, dan pas oordelen. */
      if (raak == null && h.length === doel.length && crypto.timingSafeEqual(h, doel)) raak = t;
    }
    return raak;
  }

  /* ---- instellen (achter de leden-inlog): precies vier verschillende woorden ---- */
  function swInfo(userId) { return { gezet: !!rij()[userId] }; }
  async function swZet(userId, woorden) {
    const schoon = (Array.isArray(woorden) ? woorden : []).map(w => String(w || '').trim());
    const genorm = schoon.map(norm);
    if (genorm.length !== AANTAL || genorm.some(w => !w)) return { status: 400, error: 'Kies precies vier sleutelwoorden.' };
    if (genorm.some(w => w.length < 3)) return { status: 400, error: 'Elk sleutelwoord is minstens drie letters.' };
    if (new Set(genorm).size !== AANTAL) return { status: 400, error: 'Kies vier verschillende woorden.' };
    const gehasht = [];
    for (const w of genorm) { const z = crypto.randomBytes(16); gehasht.push({ zout: z.toString('base64'), hash: await hash(w, z) }); }
    rij()[userId] = { woorden: gehasht, at: new Date().toISOString() };
    save();
    return { ok: true, gezet: true };
  }
  function swWeg(userId) { if (rij()[userId]) { delete rij()[userId]; save(); } return { ok: true, gezet: false }; }

  /* ---- de inlog-uitdaging: kies drie van de vier posities, in willekeurige volgorde ---- */
  function kiesDrie() {
    const p = [0, 1, 2, 3];
    for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    return p.slice(0, PER_KEER);
  }
  function opruim() {
    if (uitdagingen.size < 500) return;
    const nu = Date.now();
    for (const [id, c] of uitdagingen) if (nu - c.at > UITDAAG_TTL) uitdagingen.delete(id);
    while (uitdagingen.size >= 500) uitdagingen.delete(uitdagingen.keys().next().value);
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
    if (goed) { slot.goed(doel(c.userId)); return { ok: true, userId: c.userId }; }
    if (c.userId != null) fout(c.userId);
    return { status: 401, error: 'Dat klopte net niet helemaal.' };
  }

  return { swInfo, swZet, swWeg, swStart, swZeg };
}

module.exports = { maakSleutelwoorden };

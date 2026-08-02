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
/* Hoogstens zoveel woorden uit een zin. Stond op 16, en dat is de hefboom op de
   rekening: elk woord kost 40 ms scrypt en de open-beurt weegt twee posities,
   dus 16 woorden = 32 hashes = 1,3 s rekentijd die de AANVALLER aanlevert en de
   server betaalt. Acht is ruim voor een gewone zin; wie langer typt verliest
   alleen de staart, en daar zet een aanvaller juist zijn ballast neer. */
const MAX_TOKENS = 8;
/* Hier stonden SLOT_NA = 5 en SLOT_MS = 60000. Ze werden nergens gelezen: sinds
   de vier losse tellers zijn samengevoegd komt de grens uit server/pinslot.js.
   Twee constanten die een instelling beloven die ze niet bepalen -- wie ze zou
   wijzigen, verandert niets en denkt van wel. Weg, en de waarheid staat op de
   ene plek waar hij hoort (LAT.md regel 4 en 6). */

const { maakUitdaging } = require('./sleutelwoorden-uitdaging');

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

  /* De inlog-uitdaging zelf staat in ./sleutelwoorden-uitdaging.js: het roteren
     van de posities, de lokvink en het opruimen van lopende pogingen. Dit deel
     levert alleen wat die nodig heeft en weet verder niets van uitdagingen. */
  const { swStart, swZeg } = maakUitdaging({
    crypto, accounts, rij, herken, teVaak, fout, slotGoed: k => slot.goed(k), doel
  });

  return { swInfo, swZet, swWeg, swStart, swZeg };
}

module.exports = { maakSleutelwoorden };

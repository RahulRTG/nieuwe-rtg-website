/* ============================================================================
   HET TWEEDE MOMENT -- de step-up die echt gevraagd en echt gegeven wordt.

   Laag 3 velt het oordeel ("deze handeling verdient een tweede bevestiging").
   Dit bestand is het moment zelf: een bon die wordt uitgegeven als er wordt
   gevraagd, die pas geldt nadat een MENS zich opnieuw heeft bewezen, en die
   daarna precies EEN handeling doorlaat.

   TWEE SOORTEN DOORLAAT, EN HET VERSCHIL IS DE HELE ONTWERPKEUZE.

     zwaar          een VERSE, harde verificatie volstaat. Wie net zijn
                    wachtwoord opnieuw heeft gegeven, mag daarna een kwartier
                    doorwerken zonder het bij elke handeling te herhalen.
     uitzonderlijk  daar is dat NIET genoeg. Zo'n handeling vraagt een bon die
                    aan deze ene handeling vastzit -- zelfde soort, zelfde
                    aantal, zelfde doel -- en die daarna op is.

   Waarom dat verschil moet bestaan: zonder de tweede vorm zou een kwartier
   versheid, eenmaal verdiend met een klein zwaar dingetje, ook de vernietiging
   van een tenant doorlaten. Dan koopt een aanvaller met de goedkoopste step-up
   een vrijbrief voor de duurste handeling.

   VIER EIGENSCHAPPEN DIE EEN BON MOET HEBBEN, en ze zijn alle vier een aanval
   die anders werkt:

   1. AAN DE SESSIE. Anders lost de aanvaller zijn eigen bon op en gebruikt het
      slachtoffer hem -- of andersom.
   2. AAN DE HANDELING: soort, aantal EN doel. Anders bevestigt iemand een
      uitvoer van twaalf records en voert er achttienduizend uit -- de aanval uit
      het oorspronkelijke ontwerpvoorbeeld, die deze laag anders juist mogelijk
      zou maken. En zonder het DOEL erbij bevestigt iemand het vernietigen van
      klant A en vernietigt klant B: dezelfde soort, hetzelfde aantal.
   3. EEN KEER. Anders is een bevestiging een abonnement.
   4. KORT. Een bon die een uur blijft liggen, is een sleutel die een uur
      rondslingert.

   DE BON WORDT NIET DOOR DIT BESTAND OPGELOST. `los()` gelooft de aanroeper op
   zijn woord dat de mens zich opnieuw heeft bewezen -- het echte
   wachtwoordwerk hoort bij accounts, en die kennis hoort niet in twee lagen te
   staan. Wie `los()` aanroept zonder te verifieren, omzeilt de hele step-up;
   daarom staat er precies EEN aanroeper -- /api/techniek/tenant/bevestig in
   routes/techniek/tenant.js -- en heeft die een toets die hem op een fout
   wachtwoord ziet weigeren.
   ========================================================================== */
'use strict';

const crypto = require('crypto');
const { nu: klokNu } = require('../../lib/klok');

/* Kort. Lang genoeg om een wachtwoord te typen, te kort om te blijven liggen. */
const GELDIG_MS = 5 * 60 * 1000;
const MAX = 500;

const hash = (s) => crypto.createHash('sha256').update('rtg-moment:' + String(s || '')).digest('hex').slice(0, 32);
/* HET MERK VAN EEN BON: soort, aantal EN DOEL. Dat derde is er bij het
   schrijven van de toets bijgekomen, en het was een echt gat. Zonder het doel
   dragen "vernietig tenant A" en "vernietig tenant B" hetzelfde merk -- allebei
   soort tenant.vernietig, aantal een -- en dan laat een bevestiging voor de een
   de ander door. Precies de aanval die deze binding hoort te stoppen, met een
   ander voorvoegsel. */
const merk = (soort, aantal, doel) => String(soort) + '#' + String(aantal) + '#' + String(doel || '');

function veeg(bak, nu) {
  const b = bak.momenten || (bak.momenten = {});
  for (const id of Object.keys(b)) if (b[id].verloopt <= nu) delete b[id];
  const ids = Object.keys(b);
  if (ids.length > MAX) for (const id of ids.slice(0, ids.length - MAX)) delete b[id];
  return b;
}

/* Een open vraag. De bon is nog NIETS waard: hij is een uitnodiging. */
function vraag(bak, { sessie, soort, aantal, doel } = {}) {
  if (!bak || !sessie) return null;
  const nu = klokNu();
  const b = veeg(bak, nu);
  const id = crypto.randomBytes(18).toString('hex');
  b[id] = { sessie: hash(sessie), merk: merk(soort, aantal, doel), gevraagd: nu,
    verloopt: nu + GELDIG_MS, opgelost: false };
  return { id, verlooptOverMs: GELDIG_MS };
}

/* De mens heeft zich opnieuw bewezen. De aanroeper heeft dat gecontroleerd;
   zie de kop. */
function los(bak, id, sessie) {
  const nu = klokNu();
  const b = veeg(bak, nu);
  const r = b[String(id || '')];
  if (!r) return { ok: false, reden: 'Deze bevestiging bestaat niet meer. Zij vervallen na vijf minuten; begin opnieuw.' };
  if (r.sessie !== hash(sessie)) return { ok: false, reden: 'Deze bevestiging hoort bij een andere sessie.' };
  if (r.opgelost) return { ok: false, reden: 'Deze bevestiging is al gegeven.' };
  r.opgelost = true;
  return { ok: true };
}

/* Verzilveren: hoort er bij DEZE handeling een opgeloste bon, en is hij nog
   niet gebruikt? Verbruikt hem meteen -- ook als de handeling daarna faalt.
   Dat is met opzet: een bon die na een mislukte poging blijft liggen, is een
   tweede poging zonder tweede bevestiging. */
function verzilver(bak, { sessie, soort, aantal, doel, id } = {}) {
  const nu = klokNu();
  const b = veeg(bak, nu);
  const r = b[String(id || '')];
  if (!r) return { ok: false, reden: 'Er hoort een bevestiging bij deze handeling, en die is er niet (meer).' };
  if (!r.opgelost) return { ok: false, reden: 'Deze bevestiging is aangevraagd maar nooit gegeven.' };
  if (r.sessie !== hash(sessie)) return { ok: false, reden: 'Deze bevestiging hoort bij een andere sessie.' };
  if (r.merk !== merk(soort, aantal, doel))
    return { ok: false, reden: 'Deze bevestiging hoort bij een andere handeling dan die u nu doet.' };
  delete b[String(id)];
  return { ok: true };
}

module.exports = { vraag, los, verzilver, GELDIG_MS, MAX };

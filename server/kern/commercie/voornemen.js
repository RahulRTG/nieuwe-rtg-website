/* HET VOORNEMEN: van "boek vijf hotels in Parijs onder 180 euro" naar een
   gecontroleerd plan, met de blokkade VOOR de uitvoering.

   DE FOUT DIE DIT VOORKOMT, en zij is de reden dat deze laag bestaat. Een agent
   die vijf boekingen doet, vraagt vandaag vijf keer los "mag dit". Bij de vierde
   is het budget op. Er staan dan drie boekingen, een boze klant en een
   half-uitgevoerde handeling die niemand heeft besloten. Het beleid heeft
   gewerkt en het resultaat is een puinhoop.

   Dus: eerst het HELE plan wegen, dan pas beginnen.

       922 euro totaal; beleid staat 900 toe -> goedkeuring nodig

   Dat is de zin die een mens hoort te lezen VOORDAT er iets gebeurt, niet
   halverwege.

   VIJF DINGEN DIE HARD ZIJN:

   1. DE KEURING GAAT OVER HET TOTAAL. Niet over de duurste stap en niet over het
      gemiddelde: over de som. Vijf keer 190 euro is geen vijf kleine besluiten
      maar een van 950.
   2. EEN GOEDGEKEURD PLAN KAN NIET MEER VERANDEREN. De vingerafdruk
      (./voornemen/plan.js) wordt bij elke uitvoering opnieuw gerekend. Zonder dat
      is "goedgekeurd" een stempel op iets dat daarna nog kan groeien: keur 900
      goed, voer 9000 uit.
   3. ELKE STAP LEVERT ZIJN BEWIJS IN. Het besluit geeft een bewijstoken mee
      (./bewijstoken.js) en de uitvoering levert hem in. Zo kan een stap niet
      draaien op "de keuring stond hierboven toch" -- de keten is aantoonbaar en
      niet aannemelijk.
   4. EEN STAP GEBEURT HOOGSTENS EEN KEER. De economische sleutel van het
      voornemen loopt door naar elke stap, met het stapnummer erachter. Zeventien
      herhalingen, een economische handeling -- dezelfde regel als in
      kern/betaalopdracht/rij.js, nu over een hele keten in plaats van over een
      betaling.
   5. EEN NEE WORDT GEEN JA DOOR HET NOG EENS TE VRAGEN. Er is geen overgang van
      AFGEWEZEN naar GEKEURD. Wie het anders wil, stelt een nieuw voornemen op,
      met een eigen sleutel en een eigen keuring.

   WAT DIT NIET IS: een plaats waar rechten ontstaan. De keuring is ./besluit.js,
   de bevoegdheid ./bevoegdheid.js. Deze laag zet een plan in elkaar, laat het
   wegen, en voert het uit als het mag -- meer niet. En zij BEDENKT ook geen
   plan: `stappen` komt van de aanroeper. Een laag die zelf verzint wat er moet
   gebeuren EN of het mag, is geen controlelaag maar een tweede opdrachtgever. */
'use strict';

const crypto = require('crypto');
const klok = require('../../lib/klok');
const P = require('./voornemen/plan');
/* Uitvoeren staat apart: dit bestand BESLUIT, dat DOET. Zie
   ./voornemen/uitvoeren.js voor de drie grendels tussen goedkeuren en doen. */
const { maakUitvoering } = require('./voornemen/uitvoeren');
/* En keuren staat ook apart: dat gaat over het TOTAAL en niet over een stap.
   Zie ./voornemen/keuring.js. */
const { maakKeuring } = require('./voornemen/keuring');

function maakVoornemens({ db, save, nu, beslis, munt, verbruikToken, veiligheidskern }) {
  const tijd = nu || klok.nu;

  const eigen = require('../eigencollectie')({ db, domein: 'kern/commercie/voornemen', bezit: { voornemens: 'lijst' } });
  function alles() { return eigen.bak('voornemens'); }
  const vind = id => alles().find(v => v.id === String(id || '')) || null;

  function zet(v, naar, velden) {
    if (!P.magOvergaan(v.stand, naar))
      return { status: 409, error: 'Een voornemen kan niet van ' + v.stand + ' naar ' + naar + '.' };
    v.stand = naar;
    Object.assign(v, velden || {});
    v.bijgewerkt = tijd();
    save();
    return { ok: true };
  }

  /* OPSTELLEN. De aanroeper levert de stappen; deze laag rekent het totaal en
     legt de vingerafdruk vast. Er wordt nog niets gewogen -- dat is `keur`, en
     het onderscheid is er zodat een mens een plan kan LEZEN voordat het langs de
     poort gaat. */
  function stelOp({ actor, handeling, doel, stappen, sleutel }) {
    const rauw = Array.isArray(stappen) ? stappen : [];
    if (!handeling) return { status: 400, error: 'Een voornemen hoort bij een handeling.' };
    if (!rauw.length) return { status: 400, error: 'Een voornemen zonder stappen is geen voornemen.' };
    if (rauw.length > P.MAX_STAPPEN)
      return { status: 400, error: 'Een voornemen heeft hoogstens ' + P.MAX_STAPPEN + ' stappen; dit zijn er ' + rauw.length + '.' };

    const uit = [];
    for (let i = 0; i < rauw.length; i++) {
      const s = P.maakStap(rauw[i], i);
      if (s.error) return { status: 400, error: s.error };
      uit.push(s);
    }
    const v = {
      id: 'VN' + crypto.randomBytes(6).toString('hex').toUpperCase(),
      /* DE ECONOMISCHE SLEUTEL. Een aanroeper mag hem meegeven -- dan is een
         herhaald verzoek hetzelfde voornemen en niet een tweede. */
      sleutel: String(sleutel || '').slice(0, 120) || null,
      actor: actor == null ? null : String(actor).slice(0, 60),
      handeling: String(handeling), doel: doel == null ? null : String(doel).slice(0, 80),
      stappen: uit, totaalCenten: P.totaal(uit),
      stand: P.STAND.OPGESTELD, besluit: null, afdruk: null,
      bewijstoken: null, goedgekeurdDoor: null, reden: null,
      at: tijd(), bijgewerkt: tijd()
    };
    v.afdruk = P.afdruk(v);

    if (v.sleutel) {
      const al = alles().find(x => x.sleutel === v.sleutel);
      if (al) return { status: 200, ok: true, voornemen: publiek(al), hergebruikt: true };
    }
    alles().push(v);
    if (alles().length > 20000) alles().splice(0, alles().length - 20000);
    save();
    return { status: 200, ok: true, voornemen: publiek(v) };
  }

  const { keur, tekenAf } = maakKeuring({ vind, zet, publiek, save, tijd, beslis });

  const uitvoering = maakUitvoering({ vind, zet, publiek, save, tijd, verbruikToken, veiligheidskern });
  const voerUit = uitvoering.voerUit;
  const halverwege = () => uitvoering.halverwege(alles);

  function staak(id, reden, door) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Dit voornemen bestaat niet.' };
    const r = zet(v, P.STAND.GESTAAKT, {
      reden: String(reden || 'gestaakt').slice(0, 200) + (door ? ' (' + String(door).slice(0, 60) + ')' : '') });
    return r.ok ? { status: 200, ok: true, voornemen: publiek(v) } : r;
  }

  function publiek(v) {
    return { id: v.id, sleutel: v.sleutel, actor: v.actor, handeling: v.handeling, doel: v.doel,
      stand: v.stand, totaalCenten: v.totaalCenten, reden: v.reden,
      besluit: v.besluit, goedgekeurdDoor: v.goedgekeurdDoor,
      /* Het token komt er NIET uit. Wie het voornemen kan lezen, hoeft de sleutel
         tot de uitvoering niet in handen te krijgen. */
      heeftBewijs: !!v.bewijstoken,
      stappen: v.stappen.map(s => ({ nr: s.nr, wat: s.wat, doel: s.doel, centen: s.centen,
        gedaan: s.gedaan, uitkomst: s.uitkomst, at: s.at })),
      gedaan: v.stappen.filter(s => s.gedaan).length,
      at: v.at, bijgewerkt: v.bijgewerkt };
  }

  function lijst({ stand, limit = 50 } = {}) {
    let r = alles().slice().reverse();
    if (stand) r = r.filter(v => v.stand === String(stand));
    return { aantal: r.length, voornemens: r.slice(0, Math.min(200, Math.max(1, limit))).map(publiek) };
  }

  return { stelOp, keur, tekenAf, voerUit, staak, vind, publiek, lijst, halverwege, STAND: P.STAND };
}

module.exports = { maakVoornemens, STAND: P.STAND };

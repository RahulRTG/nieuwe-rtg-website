/* ============================================================================
   HET DOENETWERK -- een actie die bij de burger begint (POLITIEK.md par. 6).

     aansluiten -> bijeenkomst -> actie -> resultaat -> terugkoppeling

   De vraag hier is niet "welke wet moet veranderen?" maar "kunnen mensen dit
   samen oplossen?". Met opzet net genoeg om `samen-opgelost` echt te laten
   ontstaan (par. 18.4, stap 4), en niets meer.

   EEN ACTIE IS NIET DE KWESTIE. Een kwestie bezit niets en verwijst (par. 4);
   de actie woont hier, in haar eigen collectie, en de kwestie krijgt alleen een
   regel op haar tijdlijn als een actie begint, stopt of een resultaat heeft.

   DE EINDSTAND BLIJFT BIJ HET KANTOOR (besluit van de eigenaar, 28 september
   2026). Een actie legt haar resultaat vast; een medewerker op naam die zelf
   niet betrokken is, sluit de kwestie met `samen-opgelost`. Zo blijft W2 staan
   (wie inbrengt of volgt, beslist niet) en verandert de eindstandenlijst niet.

   VIER GRENZEN, alle vier in de code en niet in een belofte:
   1. EEN ACTIE BEGINT BIJ WIE DE KWESTIE HEEFT. Alleen wie hem inbracht of volgt,
      kan er een actie van maken -- en alleen met `zichtbaar: true`, want dan
      zien andere leden het onderwerp. Dat is zijn keuze en niet die van ons.
   2. GEEN NAMEN. Een lid ziet hoeveel mensen meedoen, niet wie. Wie meedoet,
      staat op een deelnemersnummer uit ./koppeling.js, nooit op een sleutel.
   3. NIETS GAAT VANZELF NAAR EEN ANDER (LIFE.md): geen uitnodiging, geen
      herinnering. Aansluiten doet een mens zelf.
   4. DE BIJEENKOMST VOLGT DE REGELS VAN genootschap/bijeenkomst.js: een
      plaatsgrens die eerlijk werkt en geen wachtlijst, misschien blijft
      misschien, en geen "X anderen komen" om over te halen.

   Wie aansluit, gaat de kwestie VOLGEN: hij krijgt de terugkoppeling als de
   eindstand vastligt, en W2 geldt dan ook voor hem. Wie weer vertrekt, blijft
   volger -- volgers groeien alleen aan, zoals bij een samenvoeging. */
'use strict';

const { schoon } = require('../util');

const DATUM = /^\d{4}-\d{2}-\d{2}$/, TIJD = /^\d{2}:\d{2}$/;
const ANTWOORDEN = ['ja', 'misschien', 'nee'];
const MAX_DEELNEMERS = 200;

function maakDoe({ kaart, kijk, zoek, schrijver, koppeling, vastleggen, ontvangersVan, crypto, nu }) {
  const vind = (id) => kijk()[String(id || '').toUpperCase()] || null;
  const mijnRefs = (sleutel) => koppeling.nummersVan(sleutel);
  const doetMee = (a, refs) => refs.find(r => a.deelnemers[r]) || null;
  const startte = (a, refs) => refs.includes(a.starter);
  const dag = (t) => (t ? String(t).slice(0, 10) : null);
  const tel = (b, w) => Object.values(b.antwoorden).filter(x => x === w).length;

  function beeld(a, sleutel) {
    const refs = sleutel ? mijnRefs(sleutel) : [];
    const k = zoek(a.kwestie);
    const b = a.bijeenkomst;
    const ik = doetMee(a, refs);
    return {
      id: a.id, kwestie: k ? { id: k.id, onderwerp: k.onderwerp, gebied: k.gebied || null } : null,
      wat: a.wat, rollen: a.rollen, stand: a.stand, at: dag(a.at),
      deelnemers: Object.keys(a.deelnemers).length, ikDoeMee: !!ik, ikStartte: startte(a, refs),
      bijeenkomst: b ? { datum: b.datum, tijd: b.tijd, waar: b.waar, plaatsen: b.plaatsen,
        ja: tel(b, 'ja'), misschien: tel(b, 'misschien'), nee: tel(b, 'nee'),
        vol: !!(b.plaatsen && tel(b, 'ja') >= b.plaatsen),
        mijnAntwoord: (ik && b.antwoorden[ik]) || null, afgelast: b.afgelast || null } : null,
      resultaat: a.resultaat ? { tekst: a.resultaat.tekst, at: dag(a.resultaat.at) } : null,
      gestopt: a.gestopt ? { reden: a.gestopt.reden, at: dag(a.gestopt.at) } : null
    };
  }

  /* Wat het kantoor en de inbrenger bij een kwestie zien: geen nummers. */
  const opKwestie = (kid) => Object.values(kijk()).filter(a => a.kwestie === kid)
    .map(a => ({ id: a.id, wat: a.wat, stand: a.stand, deelnemers: Object.keys(a.deelnemers).length,
      resultaat: a.resultaat ? a.resultaat.tekst : null }));

  async function start(sleutel, b) {
    const k = zoek(b.kwestie);
    const refs = k ? mijnRefs(sleutel).filter(r => ontvangersVan(k).includes(r)) : [];
    if (!k || !refs.length) return { status: 404, error: 'Die kwestie staat niet op uw naam.' };
    if (b.zichtbaar !== true) return { status: 400, error: 'Een actie maakt het onderwerp van uw kwestie zichtbaar voor andere leden, zonder uw naam. Bevestig dat eerst.' };
    if (!schrijver.loopt(k)) return { status: 409, error: 'Over deze kwestie is al besloten. Heropenen gaat via het kantoor.' };
    const open = Object.values(kijk()).find(a => a.kwestie === k.id && a.stand === 'open');
    if (open) return { status: 409, error: 'Er loopt al een actie bij deze kwestie: ' + open.id + '.', actie: open.id };
    const wat = schoon(b.wat, 300);
    if (wat.length < 10) return { status: 400, error: 'Zeg in minstens tien tekens wat u samen wilt doen.' };
    const rollen = (Array.isArray(b.rollen) ? b.rollen : String(b.rollen || '').split(','))
      .map(r => schoon(r, 60)).filter(Boolean).slice(0, 5);
    let a = null;
    const mis = await vastleggen(() => {
      const acties = kaart();
      let id;
      do { id = 'AC-' + crypto.randomBytes(3).toString('hex').toUpperCase(); } while (acties[id]);
      a = { id, kwestie: k.id, wat, rollen, at: nu(), stand: 'open', starter: refs[0],
        deelnemers: { [refs[0]]: { sinds: nu() } }, bijeenkomst: null, resultaat: null, gestopt: null };
      acties[id] = a;
      schrijver.actie(k, id, 'gestart');
    });
    return mis || { ok: true, actie: beeld(a, sleutel) };
  }

  const lijst = (sleutel) => ({ ok: true, acties: Object.values(kijk())
    .filter(a => a.stand !== 'gestopt').sort((x, y) => String(y.at).localeCompare(String(x.at)))
    .map(a => beeld(a, sleutel)) });

  /* Een handeling op een actie. `alleenStarter` en `alleenDeelnemer` weigeren
     voordat er iets wordt aangeraakt. */
  async function op(sleutel, id, eis, werk) {
    const a = vind(id);
    if (!a) return { status: 404, error: 'Onbekende actie.' };
    const refs = mijnRefs(sleutel);
    if (eis === 'starter' && !startte(a, refs)) return { status: 403, error: 'Alleen wie de actie begon, kan dit.' };
    if (eis === 'deelnemer' && !doetMee(a, refs)) return { status: 403, error: 'Sluit eerst aan bij deze actie.' };
    if (a.stand !== 'open') return { status: 409, error: 'Deze actie is afgerond of gestopt.' };
    const fout = werk.toets ? werk.toets(a, refs) : null;
    if (fout) return fout;
    const mis = await vastleggen(() => werk.doe(a, refs));
    return mis || { ok: true, actie: beeld(a, sleutel) };
  }

  const aansluit = async (sleutel, id) => {
    const a = vind(id);
    if (a && doetMee(a, mijnRefs(sleutel))) return { ok: true, herhaling: true, actie: beeld(a, sleutel) };
    return op(sleutel, id, null, {
      toets: (x) => (Object.keys(x.deelnemers).length >= MAX_DEELNEMERS ? { status: 409, error: 'Deze actie is vol.' } : null),
      doe: (x) => {
        const k = zoek(x.kwestie);
        let ref = mijnRefs(sleutel).find(r => ontvangersVan(k).includes(r));
        if (!ref) { ref = koppeling.koppel(sleutel); schrijver.volg(k, [ref]); }
        x.deelnemers[ref] = { sinds: nu() };
      } });
  };

  const verlaat = (sleutel, id) => op(sleutel, id, 'deelnemer', {
    toets: (x, refs) => (startte(x, refs) ? { status: 409, error: 'Wie de actie begon, vertrekt niet; stop de actie met een reden.' } : null),
    doe: (x, refs) => { const r = doetMee(x, refs); delete x.deelnemers[r]; if (x.bijeenkomst) delete x.bijeenkomst.antwoorden[r]; } });

  const bijeenkomst = require('./doe-bijeenkomst')({ op, schoon, DATUM, TIJD, ANTWOORDEN, tel, doetMee, nu });

  const resultaat = (sleutel, id, b) => op(sleutel, id, 'starter', {
    toets: () => (schoon(b.tekst, 1000).length < 15 ? { status: 400, error: 'Beschrijf in minstens vijftien tekens wat er is bereikt.' } : null),
    doe: (x) => { x.resultaat = { tekst: schoon(b.tekst, 1000), at: nu() }; x.stand = 'klaar'; schrijver.actie(zoek(x.kwestie), x.id, 'resultaat'); } });

  const stop = (sleutel, id, b) => op(sleutel, id, 'starter', {
    toets: () => (schoon(b.reden, 300).length < 10 ? { status: 400, error: 'Zeg in minstens tien tekens waarom de actie stopt.' } : null),
    doe: (x) => { x.gestopt = { reden: schoon(b.reden, 300), at: nu() }; x.stand = 'gestopt'; schrijver.actie(zoek(x.kwestie), x.id, 'gestopt'); } });

  return { start, lijst, aansluit, verlaat, ...bijeenkomst, resultaat, stop, opKwestie };
}

module.exports = { maakDoe };

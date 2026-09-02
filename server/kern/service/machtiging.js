/* ============================================================================
   DE SERVICEMACHTIGING -- context weten is iets anders dan gegevens openen.

   WAAR DIT VANDAAN KOMT. kern/command/bijstand*.js loste dit al op, maar alleen
   voor zakelijke klanten: RTG komt niet binnen met een beheerdersaccount maar
   met een sessie die een organisatie, een onderwerp, een niveau, een looptijd
   en een spoor heeft. Dat is geen feature van dat domein -- dat is de vorm die
   ELKE menselijke supporttoegang hoort te hebben. Deze module is diezelfde vorm,
   met de ZAAK als bereik in plaats van de organisatie.

   Dat er twee zijn is bewust. Bijstand gaat over een omgeving van iemand
   anders, met een klant die live meekijkt; dit gaat over een dossier bij RTG
   zelf. De vorm is gedeeld, de poort niet -- samenvoegen zou de klantkant van
   bijstand een tak geven waarin RTG zichzelf toegang geeft.

   VIER DINGEN DIE STRUCTUREEL ZIJN, NIET AFGESPROKEN.

   1. EEN MACHTIGING VERSMALT ALLEEN. Wat erin mag staan is begrensd door wat
      het TEAM nodig heeft (kern/service/router.js): `verleen()` rekent de
      doorsnede uit, en er is geen pad waarlangs er iets bij komt. Zelfde
      grammatica als kern/stuur/mandaat.js.
   2. VERLOPEN IS EEN BEREKENDE TOESTAND. `stand()` leest de klok bij elke
      vraag. Er is geen opruimtaak, dus er valt niets te vergeten.
   3. HET BEREIK IS DE ZAAK. Een machtiging die bij zaak SUP-1 hoort, opent
      niets bij SUP-2 -- ook niet voor dezelfde mens en dezelfde capability.
      Dat is wat "case-scoped" betekent, en het is de reden dat een medewerker
      geen zoekbalk over de hele wereld nodig heeft.
   4. ZWAAR WERK VRAAGT EEN TWEEDE MENS. Identiteit, bankgegevens, een grote
      compensatie en een gegevensuitvoer staan in ZWAAR; die machtiging bestaat
      wel, maar `mag()` blijft nee zeggen tot een ANDER mens heeft afgetekend.
      Niet de aanvrager zelf -- dat wordt hier gecontroleerd en niet gevraagd.

   WAT DEZE MODULE NIET IS: een tweede rollenmodel. Zij bakent tijdelijk en met
   een reden af wat iemand binnen DEZE zaak aanraakt, en levert de zin die het
   inzagejournaal altijd miste: niet "medewerker bekeek lid X" maar "medewerker
   opende de betaalstand omdat SUP-382 over een ontbrekende uitbetaling ging".
   ========================================================================== */
'use strict';

const klok = require('../../lib/klok');
const router = require('./router');

/* Capabilities die niet met een enkele handtekening opengaan. De lijst is kort
   met opzet: elke regel hier maakt een handeling duurder, en een lijst die
   alles bevat wordt door iedereen omzeild. */
const ZWAAR = {
  'identiteit.openen': 'De echte naam achter een codenaam.',
  'bank.gegevens': 'Rekeninggegevens van een lid of zaak.',
  'geld.compensatie': 'Geld toekennen buiten de gewone weg om.',
  'gegevens.uitvoer': 'Een export van iemands gegevens.'
};

const MAX_MINUTEN = 60;
const STANDAARD_MINUTEN = 20;

module.exports = function maakMachtigingen({ db, save, crypto, zaken, inzagelog }) {
  const eigen = require('../eigencollectie')({ db, domein: 'kern/service-machtiging', bezit: { serviceMachtigingen: 'lijst' } });
  const M = () => eigen.bak('serviceMachtigingen');
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n);
  const inhoud = (s) => String(s || '').replace(/[^\p{L}\p{N}]/gu, '').length;

  function stand(m) {
    if (m.ingetrokken) return 'ingetrokken';
    return Date.parse(m.tot) <= klok.nu() ? 'verlopen' : 'geldig';
  }
  const vind = (id) => M().find(m => m.id === String(id || '')) || null;

  /* DE DOORSNEDE. Gevraagd ∩ wat het team nodig heeft. Wat wegvalt komt in het
     antwoord te staan: een machtiging die stilletjes minder blijkt te zijn dan
     gevraagd, levert een medewerker op die denkt dat het systeem stuk is. */
  /* `binnenTeam` is de bovengrens waartegen wordt versmald. Hij bestaat omdat
     een zaak van team kan wisselen tussen het LEZEN en het INDRUKKEN van een
     bevestiging -- "ik wil een mens" doet dat -- en het lid dan een weigering
     zag over een team waar hij nooit van hoorde, voor toegang die hij net had
     goedgekeurd. Gevonden met een kale meetronde, niet met lezen: in de toets
     verhuisde geen team. Verruimen kan hij niet; het blijft `benodigd()` van
     een echt team, en ./bevestiging.js versmalt er bij het vragen al tegen. */
  function verleen({ zaakId, mens, doel, capabilities, minuten, reden, binnenTeam } = {}) {
    const z = zaken.vind(zaakId);
    if (!z) return { status: 404, error: 'Zonder zaak is er geen bereik, en zonder bereik geen machtiging.' };
    const w = schoon(mens, 60);
    if (!w) return { status: 400, error: 'Een machtiging staat op naam. Zonder mens is er niets te verantwoorden.' };
    const r = schoon(reden, 300);
    if (inhoud(r) < 10) return { status: 400, error: 'Noteer waarom dit nodig is voor deze zaak. Het lid kan die reden later opvragen.' };

    const mag = router.benodigd(binnenTeam || z.team);
    const gevraagd = (Array.isArray(capabilities) ? capabilities : []).map(c => schoon(c, 60)).filter(Boolean);
    if (!gevraagd.length) return { status: 400, error: 'Zeg wat u nodig heeft. Een machtiging zonder inhoud opent niets.' };
    const gekregen = gevraagd.filter(c => mag.includes(c));
    const geweigerd = gevraagd.filter(c => !mag.includes(c));
    if (!gekregen.length) {
      return { status: 403, error: 'Het team ' + (binnenTeam || z.team) + ' heeft dit niet nodig voor deze zaak. Zet de zaak eerst door naar het team dat het wel mag.', geweigerd };
    }

    const m = Number(minuten);
    const duur = Math.max(5, Math.min(Number.isFinite(m) ? m : STANDAARD_MINUTEN, MAX_MINUTEN));
    const at = nu();
    const machtiging = {
      id: 'MCH-' + crypto.randomBytes(4).toString('hex').toUpperCase(),
      zaak: z.id, team: binnenTeam || z.team, mens: w,
      doel: schoon(doel, 200) || null, reden: r,
      capabilities: gekregen,
      zwaar: gekregen.filter(c => ZWAAR[c]),
      tweedeMens: null, tweedeAt: null,
      at, tot: new Date(Date.parse(at) + duur * 60000).toISOString(), minuten: duur,
      ingetrokken: false, gebruikt: []
    };
    M().unshift(machtiging);
    if (M().length > 20000) M().pop();
    save();

    /* Het BESTAANDE journaal, geen tweede. De zin die eronder komt te staan is
       eindelijk compleet: wie, wat, en voor welke zaak. */
    try {
      if (inzagelog && inzagelog.noteer) {
        inzagelog.noteer({ door: w, over: { id: null, codenaam: z.melder },
          waarom: 'Servicezaak ' + z.id + ': ' + r, bron: 'service/machtiging' });
      }
    } catch (e) {}

    return { ok: true, machtiging: kortM(machtiging), geweigerd,
      let: machtiging.zwaar.length
        ? 'Deze machtiging bevat zwaar werk (' + machtiging.zwaar.join(', ') + ') en opent pas nadat een tweede mens heeft afgetekend.'
        : null };
  }

  function kortM(m) {
    return { id: m.id, zaak: m.zaak, mens: m.mens, doel: m.doel, capabilities: m.capabilities.slice(),
      zwaar: m.zwaar.slice(), stand: stand(m), at: m.at, tot: m.tot, minuten: m.minuten,
      tweedeMens: m.tweedeMens, gebruikt: m.gebruikt.length };
  }

  /* De tweede handtekening. Nooit van de aanvrager zelf -- dat wordt hier
     gecontroleerd, want een regel die alleen in een handleiding staat, is bij
     drukte de eerste die sneuvelt. */
  function tekenBij(id, { mens, reden } = {}) {
    const m = vind(id);
    if (!m) return { status: 404, error: 'Deze machtiging bestaat niet.' };
    const w = schoon(mens, 60);
    if (!w) return { status: 400, error: 'Wie tekent er bij?' };
    if (w === m.mens) return { status: 403, error: 'De aanvrager kan niet zijn eigen tweede handtekening zijn.' };
    if (stand(m) !== 'geldig') return { status: 400, error: 'Deze machtiging is ' + stand(m) + '.' };
    m.tweedeMens = w; m.tweedeAt = nu();
    m.reden2 = schoon(reden, 300) || null;
    save();
    return { ok: true, machtiging: kortM(m) };
  }

  /* DE VRAAG DIE ERTOE DOET. Mag deze mens, in deze zaak, nu, dit? Geeft altijd
     een reden mee: een nee zonder reden laat een medewerker raden of hij een
     fout maakt of een grens raakt. */
  function magNu(id, capability, { zaakId } = {}) {
    const m = vind(id);
    if (!m) return { mag: false, waarom: 'Deze machtiging bestaat niet.' };
    const s = stand(m);
    if (s !== 'geldig') return { mag: false, waarom: 'Deze machtiging is ' + s + '.' };
    if (zaakId && String(zaakId).toUpperCase() !== m.zaak) {
      return { mag: false, waarom: 'Deze machtiging hoort bij ' + m.zaak + ' en opent niets bij een andere zaak.' };
    }
    const c = String(capability || '');
    if (!m.capabilities.includes(c)) return { mag: false, waarom: 'Deze machtiging draagt "' + c + '" niet.' };
    if (ZWAAR[c] && !m.tweedeMens) return { mag: false, waarom: 'Dit vraagt een tweede mens. ' + ZWAAR[c] };
    m.gebruikt.push({ at: nu(), capability: c });
    if (m.gebruikt.length > 200) m.gebruikt.shift();
    save();
    return { mag: true, machtiging: m.id, zaak: m.zaak, mens: m.mens };
  }

  function trekIn(id, { door } = {}) {
    const m = vind(id);
    if (!m) return { status: 404, error: 'Deze machtiging bestaat niet.' };
    m.ingetrokken = true; m.ingetrokkenDoor = schoon(door, 60) || null; m.ingetrokkenAt = nu();
    save();
    return { ok: true, machtiging: kortM(m) };
  }

  const lijst = (f) => {
    const o = f || {};
    let a = M();
    if (o.zaak) a = a.filter(m => m.zaak === String(o.zaak).toUpperCase());
    if (o.mens) a = a.filter(m => m.mens === String(o.mens));
    if (o.alleenGeldig) a = a.filter(m => stand(m) === 'geldig');
    return a.slice(0, Number(o.max || 100)).map(kortM);
  };

  /* Wat RTG op dit moment permanent bij een lid mag: niets. Zelfde getal en
     dezelfde reden als in kern/command/bijstand.js -- het is aflezbaar en het
     kan niet nul blijven zonder dat iemand deze laag verbouwt. */
  const tel = () => ({ geldig: M().filter(m => stand(m) === 'geldig').length, totaal: M().length, permanenteToegang: 0 });

  return { verleen, tekenBij, magNu, trekIn, lijst, tel, stand, vind, ZWAAR };
};

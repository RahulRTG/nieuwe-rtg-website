/* ============================================================================
   DE BRUG -- de ENIGE weg van een app van derden naar RTG.

   In de cel heeft een app geen netwerk (de CSP van de celroute zet connect-src
   op 'none') en geen toegang tot het venster erboven (de iframe draait met
   sandbox="allow-scripts" en dus op een naamloze herkomst). Wat overblijft is
   een postMessage naar de celpagina, en die komt hier uit.

   DRIE CONTROLES, IN DEZE VOLGORDE, EN GEEN ERVAN IS OVER TE SLAAN.

     1. IS DIT EEN BESTAANDE METHODE? Zo niet: een fout die de bestaande methodes
        noemt. Niet "onbekend"; een uitgever hoort niet te hoeven raden.
     2. IS DE BIJBEHORENDE MACHTIGING VERLEEND? Niet gevraagd -- VERLEEND. De
        brug leest de lijst van het lid, niet die van het manifest. Dat is
        grens 4, en dit is de enige plek waar hij bestaat.
     3. PAST HET BINNEN DE GRENZEN VAN DIE MACHTIGING? Elke methode draagt zijn
        eigen maten, en die worden hier gerekend en niet vertrouwd.

   WAT HIER NOOIT DOORHEEN KOMT, ONGEACHT WELKE MACHTIGING ER IS VERLEEND: de
   echte naam van een lid, zijn e-mailadres, zijn telefoonnummer, zijn adres en
   zijn geboortedatum. Die staan in de identiteitskluis (accounts.js) en deze
   module heeft er geen verwijzing naartoe -- niet omdat het niet mag, maar zodat
   het niet KAN. Wie het er alsnog bij zou zetten, moet er een require voor
   schrijven, en dat is een regel die opvalt in een diff.
   ========================================================================== */
'use strict';

const GRENS = {
  opslagSleutels: 32,
  opslagSleutelLengte: 64,
  opslagWaarde: 4096,
  opslagTotaal: 64 * 1024,
  berichtLengte: 240,
  berichtenPerDag: 5,
  bakGrootte: 20,
  roepenPerMinuut: 120
};

function maakBrug(kern) {
  const { S, eigen, nu, boek } = kern;
  const save = kern.save;

  /* De rem staat in het geheugen en niet in de database: een teller die per
     aanroep wordt weggeschreven, maakt van een rem een schrijfstorm. Hij gaat bij
     een herstart verloren, en dat is hier goed -- een herstart is geen aanval. */
  const remmen = new Map();
  function rem(sleutel, max, venster) {
    const t = Date.parse(nu());
    const r = remmen.get(sleutel);
    if (!r || t - r.begin > venster) { remmen.set(sleutel, { begin: t, n: 1 }); return false; }
    r.n += 1;
    if (remmen.size > 20000) remmen.clear();
    return r.n > max;
  }

  const bak = (pot, a, b) => {
    const p = S()[pot];
    if (!p[String(a)] || typeof p[String(a)] !== 'object') p[String(a)] = {};
    const r = p[String(a)];
    if (!r[String(b)]) r[String(b)] = pot === 'bakjes' ? [] : {};
    return r[String(b)];
  };

  /* ------------------------------------------------------------- de methodes */

  const METHODES = {
    /* profiel.basis -- de codenaam en verder niets waarmee je iemand vindt. */
    'profiel.wieBenIk': { machtiging: 'profiel.basis', doe: (ctx) => ({
      codenaam: ctx.codenaam, taal: ctx.taal, pas: ctx.pas,
      let: 'Dit is alles wat een app van derden over jou te zien krijgt.' }) },

    /* opslag.eigen -- een kladblok per app per lid. */
    'opslag.lees': { machtiging: 'opslag.eigen', doe: (ctx, args) => {
      const k = String((args && args.sleutel) || '').slice(0, GRENS.opslagSleutelLengte);
      const b = bak('opslag', ctx.sleutel, ctx.key);
      return { sleutel: k, waarde: Object.prototype.hasOwnProperty.call(b, k) ? b[k] : null };
    } },
    'opslag.lijst': { machtiging: 'opslag.eigen', doe: (ctx) => ({ sleutels: Object.keys(bak('opslag', ctx.sleutel, ctx.key)).sort() }) },
    'opslag.zet': { machtiging: 'opslag.eigen', doe: (ctx, args) => {
      const k = String((args && args.sleutel) || '').trim();
      if (!k || k.length > GRENS.opslagSleutelLengte) return { fout: 'Een sleutel is 1 tot ' + GRENS.opslagSleutelLengte + ' tekens.' };
      const w = args && args.waarde == null ? '' : String(args.waarde);
      if (w.length > GRENS.opslagWaarde) return { fout: 'Een waarde is hooguit ' + GRENS.opslagWaarde + ' tekens; deze is er ' + w.length + '.' };
      const b = bak('opslag', ctx.sleutel, ctx.key);
      const nieuw = !Object.prototype.hasOwnProperty.call(b, k);
      if (nieuw && Object.keys(b).length >= GRENS.opslagSleutels) return { fout: 'Je app heeft al ' + GRENS.opslagSleutels + ' sleutels bij dit lid; wis er eerst een.' };
      const totaal = Object.entries(b).reduce((n, [kk, vv]) => n + kk.length + String(vv).length, 0) - (nieuw ? 0 : k.length + String(b[k]).length);
      if (totaal + k.length + w.length > GRENS.opslagTotaal) return { fout: 'Het kladblok van je app bij dit lid is vol (' + Math.round(GRENS.opslagTotaal / 1024) + ' kB).' };
      b[k] = w; save();
      return { ok: true, sleutel: k };
    } },
    'opslag.wis': { machtiging: 'opslag.eigen', doe: (ctx, args) => {
      const b = bak('opslag', ctx.sleutel, ctx.key);
      const k = String((args && args.sleutel) || '');
      if (Object.prototype.hasOwnProperty.call(b, k)) { delete b[k]; save(); }
      return { ok: true };
    } },

    /* bericht.klaarzetten -- KLAARZETTEN, niet sturen. Het bericht komt in het
       bakje van deze app; het lid haalt het op in de App Store. Er gaat geen
       push, geen e-mail en geen sms achteraan, en dat is geen kwestie van
       instellingen: er is geen weg naartoe (zie machtigingen.NIET_GEBOUWD). */
    'bericht.zet': { machtiging: 'bericht.klaarzetten', doe: (ctx, args) => {
      const t = String((args && args.tekst) || '').trim().slice(0, GRENS.berichtLengte);
      if (t.length < 2) return { fout: 'Een bericht is 2 tot ' + GRENS.berichtLengte + ' tekens.' };
      const b = bak('bakjes', ctx.key, ctx.sleutel);
      const dag = nu().slice(0, 10);
      if (b.filter(x => String(x.at).slice(0, 10) === dag).length >= GRENS.berichtenPerDag) {
        return { fout: 'Je app heeft vandaag al ' + GRENS.berichtenPerDag + ' berichten voor dit lid klaargezet. Dat is het maximum.' };
      }
      b.unshift({ id: Math.random().toString(36).slice(2, 10), tekst: t, at: nu(), gelezen: false });
      if (b.length > GRENS.bakGrootte) b.length = GRENS.bakGrootte;
      save();
      return { ok: true, klaargezet: t };
    } }
  };

  const namen = Object.keys(METHODES);

  /* De aanroep zelf. `ctx` komt van de route en niet van de app: de app noemt
     alleen een methode en argumenten. Wie hij is, welke app dit is en wat er is
     verleend, wordt hier bepaald uit de sessie. */
  function roep({ key, sleutel, methode, args, codenaam, taal, pas, verleend, vraagt }) {
    const naam = String(methode || '');
    const m = Object.prototype.hasOwnProperty.call(METHODES, naam) ? METHODES[naam] : null;
    if (!m) return { status: 400, error: 'De methode "' + naam + '" bestaat niet. Er zijn er ' + namen.length + ': ' + namen.join(', ') + '.' };
    const heeft = Array.isArray(verleend) ? verleend : [];
    if (!heeft.includes(m.machtiging)) {
      /* EEN WEIGERING DIE UITLEGT, en dat is geen vriendelijkheid maar
         gereedschap. "403 Forbidden" laat een uitgever raden tussen vier
         oorzaken: vroeg ik het verkeerde, vroeg ik het niet, gaf het lid het
         niet, of trok hij het terug? Elk van die vier heeft een andere
         oplossing, en drie ervan zijn niets waar hij iets aan kan doen.

         Daarom staat er wat er nodig was, wat dit lid WEL heeft gegeven, en waar
         hij het kan veranderen. Dat laatste is het belangrijkste: het lid, niet
         de uitgever, en niet RTG. */
      const gevraagdMaarNietGegeven = Array.isArray(vraagt) && vraagt.includes(m.machtiging);
      return { status: 403,
        error: 'De methode "' + naam + '" vraagt de machtiging "' + m.machtiging + '". '
          + (gevraagdMaarNietGegeven
              ? 'Je app vraagt hem in zijn manifest, maar dit lid heeft hem niet verleend of weer ingetrokken.'
              : 'Je app vraagt hem niet in zijn manifest, dus het lid heeft hem ook nooit kunnen geven.'),
        machtiging: m.machtiging,
        verleend: heeft,
        gevraagd: Array.isArray(vraagt) ? vraagt : null,
        hoe: gevraagdMaarNietGegeven
          ? 'Alleen het lid kan dit aanzetten, in de App Store onder "wat mag deze app". Vraag het niet nog eens via de brug; werk zonder deze machtiging verder.'
          : 'Zet hem in het manifest van een volgende versie, met een doel. Die versie gaat opnieuw langs de keuring, en het lid beslist opnieuw.' };
    }
    if (rem('roep:' + sleutel + ':' + key, GRENS.roepenPerMinuut, 60000)) {
      return { status: 429, error: 'Meer dan ' + GRENS.roepenPerMinuut + ' aanroepen per minuut houdt de brug tegen.' };
    }
    let uit;
    try { uit = m.doe({ key, sleutel, codenaam, taal, pas }, args || {}); }
    catch (e) { return { status: 500, error: 'De brug kon deze aanroep niet uitvoeren.' }; }
    if (uit && uit.fout) return { status: 400, error: uit.fout };
    return { status: 200, ok: true, uit };
  }

  /* De LEES-kant van de bakjes staat in ./bakjes.js. Dat is de naad die hier al
     als alinea stond: een app SCHRIJFT een bericht via de brug, maar mag nooit
     zien of het gelezen is -- anders is een bericht een baken. */
  const { bakje, bakjeGelezen, bakjes } = require('./bakjes')({ S, save, eigen, bak, GRENS });

  return { roep, bakje, bakjeGelezen, bakjes, METHODES: namen, GRENS, boek };
}

module.exports = { maakBrug, GRENS };

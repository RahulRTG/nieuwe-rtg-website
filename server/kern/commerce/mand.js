/* ============================================================================
   DE MAND -- wat een koper bij elkaar heeft staan, over verkopers heen.

   DIT IS HET ENIGE BEGRIP VAN DEZE LAAG WAAR SAMENVOEGEN ECHT IETS OPLEVERT.
   COMMERCE.json telde 24 vormen die regels dragen (een aantal naast een bedrag)
   in 17 domeinen, waarvan er 22 VERSCHILLEND zijn. Ze delen dus vrijwel niets --
   anders dan bij `Koopbaar` is hier geen bestaand type dat kapotgemaakt wordt
   door er een gedeelde vorm voor te zetten.

   WAT ER NIET IN ZIT: BEDRAGEN. Een mand bewaart WAT en HOEVEEL, nooit wat het
   kost. Zou hij een prijs bewaren, dan is dat binnen een dag een prijs van
   gisteren -- en dan staat er in de mand iets anders dan in de afrekening, en
   moet iemand kiezen welke van de twee de echte is. De prijs wordt uitgerekend
   op het moment dat hij nodig is, door ./afrekening.js, uit de server. Dat is
   dezelfde regel als "de prijs komt nooit uit de browser", een laag dieper:
   de prijs komt ook niet uit het geheugen.

   DE SLEUTEL IS DIE VAN DE SESSIE EN NOOIT EEN NAAM. Voor een lid is dat zijn
   codenaam, voor een gast de sleutel die hij bij de tafel of de winkel kreeg
   (routes/gast.js: een tafelsleutel is geen inlog). CLAUDE.md, privacy by
   design: hier staat geen mens, hier staat een sleutel.

   EEN MAND VERVALT. Zonder vervaltijd groeit deze tabel met elke bezoeker die
   ooit iets aanklikte, en dan bewaren we jarenlang wat iemand ooit overwoog. Dat
   is geen opslagprobleem maar een gegeven dat er niet hoort te zijn.
   ========================================================================== */
'use strict';

const MAX_REGELS = 60;          // meer dan dit is geen mand maar een import
const MAX_AANTAL = 999;
const MAX_MANDEN = 5000;        // de tabel blijft begrensd, ook zonder veger
const VERVAL_MS = 30 * 24 * 3600 * 1000;

module.exports = ({ db, save, nu }) => {
  /* De HUISKLOK en niet die van het besturingssysteem: een vervaltijd is precies
     wat je met een verzette klok (RTG_KLOK) wilt beproeven -- wat doet een mand
     die dertig dagen oud wordt? Zie server/lib/klok.js. */
  const huisklok = require('../../lib/klok').nu;
  const klok = () => (typeof nu === 'function' ? nu() : huisklok());
  const sleutelVan = (s) => String(s == null ? '' : s).slice(0, 120);

  function pot() {
    if (!db.data.commerceManden || typeof db.data.commerceManden !== 'object') db.data.commerceManden = {};
    return db.data.commerceManden;
  }

  /* Vervallen manden gaan eruit op het moment dat er toch al naar de tabel
     wordt gekeken. Een eigen veger zou een tweede plek zijn die weet wanneer
     een mand oud is. */
  function ruim() {
    const p = pot(); const grens = klok() - VERVAL_MS;
    let weg = 0;
    for (const k of Object.keys(p)) if (!p[k] || !(p[k].bij > grens)) { delete p[k]; weg++; }
    const over = Object.keys(p);
    if (over.length > MAX_MANDEN) {
      /* Oudste eruit. Dit is een noodrem en geen beleid: hij hoort nooit te
         vuren zolang de vervaltijd zijn werk doet. */
      over.sort((a, b) => (p[a].bij || 0) - (p[b].bij || 0));
      for (const k of over.slice(0, over.length - MAX_MANDEN)) { delete p[k]; weg++; }
    }
    return weg;
  }

  function lees(sleutel) {
    const s = sleutelVan(sleutel);
    if (!s) return { regels: [], bij: null };
    ruim();
    const m = pot()[s];
    return m ? { regels: (m.regels || []).slice(), bij: m.bij || null } : { regels: [], bij: null };
  }

  /* Een regel erbij, of het aantal van een bestaande regel ophogen. `aantal: 0`
     haalt hem weg -- zo hoeft een scherm geen tweede endpoint te kennen voor
     "eentje minder tot hij op is". */
  function zet(sleutel, koopbaarId, aantal, vervang, antwoorden) {
    const s = sleutelVan(sleutel);
    if (!s) return { status: 400, error: 'Geen mand zonder sleutel.' };
    const id = String(koopbaarId == null ? '' : koopbaarId).slice(0, 80);
    if (!id) return { status: 400, error: 'Welk aanbod?' };
    const n = Math.max(0, Math.min(MAX_AANTAL, parseInt(aantal, 10) || 0));

    ruim();
    const p = pot();
    if (!p[s]) p[s] = { regels: [], bij: klok() };
    const m = p[s];
    const bestaand = m.regels.find(r => r.koopbaarId === id);
    if (n === 0) {
      m.regels = m.regels.filter(r => r.koopbaarId !== id);
    } else if (bestaand) {
      bestaand.aantal = vervang ? n : Math.min(MAX_AANTAL, bestaand.aantal + n);
      /* Wie het aantal verandert, heeft iets anders in gedachten dan wat er is
         doorgegeven. Het merkje van ./overdracht.js hoort dan weg: een briefje
         dat "2 stuks" zegt naast een regel die er 5 telt, is erger dan geen
         briefje. */
      delete bestaand.overdracht;
    } else {
      if (m.regels.length >= MAX_REGELS) return { status: 409, error: 'Deze mand zit vol (' + MAX_REGELS + " regels). Reken eerst af wat erin zit." };
      m.regels.push({ koopbaarId: id, aantal: n, at: klok() });
    }
    /* DE ANTWOORDEN OP DE PRIJSVRAAG. Dit is GEEN bedrag en dus geen breuk met
       de kop hierboven: het is een KEUZE, net als het aantal -- welke kamer,
       hoeveel nachten. Het bedrag dat eruit volgt wordt uitgerekend op het
       moment dat het nodig is, door ./afrekening.js, uit de server. Zou de mand
       het bedrag bewaren, dan staat er morgen een prijs van gisteren in.

       Een gewijzigd antwoord is een andere keuze, dus het merkje van de
       overdracht vervalt -- om dezelfde reden als bij een gewijzigd aantal. */
    if (antwoorden && typeof antwoorden === 'object') {
      const r = m.regels.find(x => x.koopbaarId === id);
      if (r) {
        const schoon = {};
        for (const k of Object.keys(antwoorden).slice(0, 8)) {
          schoon[String(k).slice(0, 40)] = String(antwoorden[k] == null ? '' : antwoorden[k]).slice(0, 80);
        }
        r.antwoorden = schoon;
        delete r.overdracht;
      }
    }
    m.bij = klok();
    if (!m.regels.length) delete p[s];
    save();
    return { ok: true, regels: (p[s] && p[s].regels.slice()) || [] };
  }

  function leeg(sleutel) {
    const s = sleutelVan(sleutel);
    if (!s) return { status: 400, error: 'Geen mand zonder sleutel.' };
    delete pot()[s];
    save();
    return { ok: true, regels: [] };
  }

  /* EEN MERKJE OP EEN REGEL: naar wie is deze doorgegeven, en wanneer. Dit is
     geen bedrag en dus geen breuk met de kop hierboven -- het is wat er met de
     regel is GEBEURD. En het is met opzet geen stand `besteld`: RTG hoort niet
     van het domein of de koper heeft doorgezet, dus staat er alleen wat RTG zelf
     heeft gedaan (zie ./overdracht.js). De koper haalt zelf uit zijn mand wat
     hij heeft afgerond; dat is een handeling van een mens en geen gok. */
  function merk(sleutel, ids, o) {
    const s = sleutelVan(sleutel);
    const m = pot()[s];
    if (!s || !m) return { ok: true, gemerkt: 0 };
    const lijst = (Array.isArray(ids) ? ids : []).map(x => String(x || ''));
    let n = 0;
    for (const r of m.regels) {
      if (!lijst.includes(r.koopbaarId)) continue;
      r.overdracht = { id: String((o && o.id) || ''), naar: String((o && o.naar) || ''), at: klok() };
      n++;
    }
    if (n) { m.bij = klok(); save(); }
    return { ok: true, gemerkt: n };
  }

  return { lees, zet, leeg, merk, ruim, MAX_REGELS, VERVAL_MS };
};

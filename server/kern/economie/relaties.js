/* DE ECONOMISCHE RELATIES TUSSEN DE WERELDEN -- en waarom er standaard geen zijn.

   Een wereld mag een andere wereld niets in rekening brengen. Dat is de
   grondstand, en hij is leeg: er staat hier geen enkele relatie voorgeprogram-
   meerd. Wie er een wil, zet hem er expliciet in, met een grondslag, met zijn
   naam eronder en met een plafond.

   WAAROM EEN PLAFOND VERPLICHT IS. Zonder plafond is een relatie een open kraan:
   de dag dat een meetfout het verbruik van de Foundation vertienvoudigt, staat
   er een tienvoudige rekening klaar en is er niets wat hem tegenhoudt behalve
   iemand die toevallig kijkt. Het plafond maakt van "wij mogen doorbelasten"
   een bedrag, en een bedrag kan afslaan. Dat is precies het verschil tussen een
   afspraak en een risico.

   WAAROM EEN GRONDSLAG VERPLICHT IS. Een doorbelasting tussen twee
   rechtspersonen is een LEVERING, geen boekhoudkundige verschuiving. Er hoort
   een overeenkomst achter te zitten, en over een jaar moet iemand kunnen zien
   welke. Een relatie zonder grondslag is precies de post waar een accountant
   over valt, en terecht.

   WAT EEN RELATIE NIET IS. Hij is geen toestemming om een GEBRUIKER te
   factureren. Een relatie loopt tussen WERELDEN, en de rekening landt bij de
   entiteit van die wereld -- de stichting, niet een gezin. Dat onderscheid
   staat hard in ./firewall.js en niet alleen in dit commentaar.

   Opslag: db.data.economie.relaties. Geen historie-array maar een journaal:
   een relatie die verdwijnt hoort na te lezen te zijn, want er zijn facturen op
   gebaseerd. */
'use strict';

const { wereld } = require('./werelden');

const MAX_PLAFOND = 100000000000;   // 1 miljard euro in centen: een grens op het doel
const JOURNAAL_MAX = 500;

module.exports = (ctx) => {
  const { d, save, nu } = ctx;

  function bak() {
    const e = d();
    if (!e.relaties || typeof e.relaties !== 'object') e.relaties = {};
    if (!Array.isArray(e.relatiejournaal)) e.relatiejournaal = [];
    return e;
  }
  const sleutel = (van, naar) => String(van) + '>' + String(naar);

  function zicht(r) {
    return { van: r.van, naar: r.naar, grondslag: r.grondslag, plafondCenten: r.plafondCenten,
      door: r.door, op: r.op, tot: r.tot || null, actief: !vervallen(r) };
  }
  /* Een relatie die is verlopen bestaat nog wel en geldt niet meer. Dat is niet
     hetzelfde als weg: de facturen van vorig jaar leunen erop, en een
     verdwenen grondslag maakt die onverklaarbaar. */
  const vervallen = (r) => !!(r.tot && String(r.tot) < nu());

  const relaties = () => Object.values(bak().relaties).map(zicht)
    .sort((a, b) => (a.van + a.naar).localeCompare(b.van + b.naar));
  const journaal = () => bak().relatiejournaal.slice().reverse();

  /* De relatie die NU geldt tussen twee werelden, of null. Null is hier een
     antwoord en geen fout: geen relatie betekent dat er niets doorbelast mag
     worden, en dat is de grondstand. */
  function relatieVoor(van, naar) {
    const r = bak().relaties[sleutel(van, naar)];
    return r && !vervallen(r) ? r : null;
  }

  function schrijfJournaal(regel) {
    const j = bak().relatiejournaal;
    j.push(Object.assign({ op: nu() }, regel));
    if (j.length > JOURNAAL_MAX) j.splice(0, j.length - JOURNAAL_MAX);
  }

  function relatieZet({ van, naar, grondslag, plafondCenten, tot, door }) {
    if (!wereld(van) || !wereld(naar)) return { status: 400, error: 'Onbekende economische wereld.' };
    if (van === naar) return { status: 400, error: 'Binnen een wereld is geen relatie nodig; daar mag het al.' };
    const g = String(grondslag == null ? '' : grondslag).trim().slice(0, 300);
    if (g.length < 8) return { status: 400, error: 'Noem de grondslag: welke overeenkomst of welk bestuursbesluit maakt deze doorbelasting mogelijk? Zonder grondslag is het geen levering maar een verschuiving.' };
    const p = Math.round(Number(plafondCenten));
    if (!Number.isFinite(p) || p <= 0 || p > MAX_PLAFOND) return { status: 400, error: 'Geef een plafond in centen. Een doorbelasting zonder maximum is een open kraan.' };
    const naam = String(door == null ? '' : door).trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Zonder wie gebeurt dit niet.' };
    let einde = null;
    if (tot != null && String(tot).trim()) {
      einde = String(tot).trim().slice(0, 40);
      if (!/^\d{4}-\d{2}-\d{2}/.test(einde)) return { status: 400, error: 'Een einddatum is JJJJ-MM-DD.' };
    }
    const b = bak();
    const oud = b.relaties[sleutel(van, naar)] || null;
    b.relaties[sleutel(van, naar)] = { van, naar, grondslag: g, plafondCenten: p, tot: einde, door: naam, op: nu() };
    schrijfJournaal({ wat: oud ? 'gewijzigd' : 'geopend', van, naar, grondslag: g, plafondCenten: p, door: naam,
      vorige: oud ? { grondslag: oud.grondslag, plafondCenten: oud.plafondCenten } : null });
    save();
    return { status: 200, ok: true, relatie: zicht(b.relaties[sleutel(van, naar)]) };
  }

  function relatieWeg({ van, naar, reden, door }) {
    const b = bak();
    const r = b.relaties[sleutel(van, naar)];
    if (!r) return { status: 404, error: 'Die relatie bestaat niet.' };
    const rd = String(reden == null ? '' : reden).trim().slice(0, 300);
    if (rd.length < 8) return { status: 400, error: 'Noem de reden; er kunnen facturen op deze relatie zijn gebaseerd.' };
    delete b.relaties[sleutel(van, naar)];
    schrijfJournaal({ wat: 'gesloten', van, naar, reden: rd, door: String(door || '').slice(0, 80),
      vorige: { grondslag: r.grondslag, plafondCenten: r.plafondCenten } });
    save();
    return { status: 200, ok: true };
  }

  return { relaties, relatieVoor, relatieZet, relatieWeg, journaal, MAX_PLAFOND };
};

/* HET STREEFBEELD -- de streefstand van RTG als onderneming (besluit C7 van de
   eigenaar, 27 september 2026): de machine stelt voor, de eigenaar tekent.

   DE NAAM. AUTONOMIE.md noemt dit de streefstand, maar `streefstand` is in de code
   al een veld van elk gevolgcontract (kern/stuur/gevolgcontract/): de gewenste
   stand na EEN handeling. Een tweede betekenis onder dezelfde naam is precies de
   botsing die BEWIJSMACHINE.md telt; het heet hier daarom het streefbeeld.

   HOE HET WERKT.
   1. HET VOORSTEL wordt uitgerekend, niet opgeslagen: per dimensie het gemiddelde
      van de laatste drie AFGESLOTEN maanden uit de bedrijfsmaten, met als
      tolerantie de spreiding die er in die maanden al was. Een dimensie met minder
      dan drie toonbare maanden krijgt geen voorstel maar een reden -- onder de
      groepsgrens is er geen getal, en een gemiddelde van niets is geen doel.
   2. TEKENEN gaat over PRECIES dat voorstel: de eigenaar tekent een vingerafdruk
      van de inhoud. Is het voorstel intussen veranderd (een nieuwe maand, een
      gecorrigeerd saldo), dan weigert tekenen -- niemand tekent voor getallen die
      hij niet heeft gezien.
   3. DE TOETS: per getekende dimensie binnen, buiten (verslechterd voorbij de
      tolerantie) of onbekend. Autonoom handelen mag alleen als er een getekend
      streefbeeld is EN geen enkele dimensie buiten staat EN geen enkele onbekend is.
      Geen gewogen som (AUTONOMIE.md par. 0): een betere omzet koopt geen slechtere
      churn af. Leeg is dicht.

   WAT HET NIET IS: een handelende laag. Er is vandaag niets dat autonoom handelt;
   dit is de grammatica en de handtekening waar dat later langs moet. */
'use strict';

const crypto = require('crypto');
const NAAM = 'streefbeeld';
const DIMENSIES = Object.freeze([
  { id: 'omzet.leden-ontvangen', richting: 'hoger' },
  { id: 'marge.bruto-rtg', richting: 'hoger' },
  { id: 'churn.pas-naar-gast', richting: 'lager' },
  { id: 'acquisitie.nieuwe-leden', richting: 'hoger' },
  { id: 'uitkomst.klantwaarde-living', richting: 'hoger' },
  { id: 'uitkomst.klantwaarde-travel', richting: 'hoger' },
  { id: 'uitkomst.klantwaarde-work', richting: 'hoger' },
  { id: 'uitkomst.klantwaarde-foundation', richting: 'hoger' }
]);
const MAANDEN = 3;

module.exports = ({ db, save, bedrijfsmaat, nu }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/streefbeeld', bezit: { [NAAM]: 'kaart' } });
  const klok = () => (typeof nu === 'function' ? nu() : new Date().toISOString());
  const vorigeMaand = (m) => { const [j, mm] = m.split('-').map(Number); return new Date(Date.UTC(j, mm - 2, 1)).toISOString().slice(0, 7); };
  const waardeVan = (stand, id) => {
    const m = ((stand && stand.maten) || []).find(x => x.id === id);
    return m && m.stand === 'TOONBAAR' && Number.isFinite(m.waarde) ? m.waarde : null;
  };

  /* Het voorstel, uit de laatste drie afgesloten maanden. */
  function voorstel() {
    const maanden = [];
    let m = vorigeMaand(klok().slice(0, 7));
    for (let i = 0; i < MAANDEN; i++) { maanden.unshift(m); m = vorigeMaand(m); }
    const standen = maanden.map(x => bedrijfsmaat.stand({ maand: x }));
    const dimensies = DIMENSIES.map(d => {
      const w = standen.map(s => waardeVan(s, d.id));
      if (w.some(x => x == null)) return { id: d.id, richting: d.richting, voorstel: null,
        reden: 'Niet in alle drie de maanden een toonbaar getal (onder de groepsgrens, of niet uit te rekenen).' };
      const gem = w.reduce((a, b) => a + b, 0) / w.length;
      const tol = Math.max(...w.map(x => Math.abs(x - gem)));
      return { id: d.id, richting: d.richting, voorstel: { waarde: gem, tolerantie: tol,
        grens: d.richting === 'hoger' ? gem - tol : gem + tol }, maanden: w };
    });
    const inhoud = { maanden, dimensies };
    const id = crypto.createHash('sha256').update(JSON.stringify(inhoud)).digest('hex').slice(0, 16);
    return Object.assign({ id }, inhoud);
  }

  function getekend() { return eigen.kijk(NAAM).getekend || null; }

  /* Tekenen: alleen PRECIES het voorstel dat er nu ligt. */
  function teken(id, door) {
    if (!door) return { status: 403, error: 'Een streefbeeld tekent de eigenaar op naam.' };
    const v = voorstel();
    if (String(id || '') !== v.id) return { status: 409, error: 'Het voorstel is veranderd sinds u het zag; bekijk het opnieuw.', voorstel: v };
    if (!v.dimensies.some(d => d.voorstel)) return { status: 409, error: 'Er is geen enkele dimensie met een voorstel; er valt niets te tekenen.' };
    const k = eigen.bak(NAAM);
    k.vorige = k.getekend || null;
    k.getekend = { voorstel: v, door: String(door).slice(0, 80), op: klok() };
    save();
    return { ok: true, getekend: k.getekend };
  }

  function trekStreefbeeldIn(door) {
    if (!door) return { status: 403, error: 'Intrekken doet de eigenaar op naam.' };
    const k = eigen.bak(NAAM);
    if (!k.getekend) return { ok: true, alLeeg: true };
    k.vorige = k.getekend; k.getekend = null; k.ingetrokken = { door: String(door).slice(0, 80), op: klok() };
    save();
    return { ok: true };
  }

  /* De toets van een maand tegen het getekende streefbeeld. */
  function toets(maand) {
    const g = getekend();
    if (!g) return { magAutonoom: false, reden: 'Er is geen getekend streefbeeld; leeg is dicht.', dimensies: [] };
    const m = /^\d{4}-\d{2}$/.test(String(maand || '')) ? maand : vorigeMaand(klok().slice(0, 7));
    const s = bedrijfsmaat.stand({ maand: m });
    const dimensies = g.voorstel.dimensies.filter(d => d.voorstel).map(d => {
      const w = waardeVan(s, d.id);
      if (w == null) return { id: d.id, uitslag: 'onbekend', waarde: null };
      const buiten = d.richting === 'hoger' ? w < d.voorstel.grens : w > d.voorstel.grens;
      return { id: d.id, uitslag: buiten ? 'buiten' : 'binnen', waarde: w, grens: d.voorstel.grens };
    });
    const buiten = dimensies.filter(d => d.uitslag !== 'binnen');
    return { maand: m, magAutonoom: buiten.length === 0,
      reden: buiten.length ? buiten.length + ' dimensie(s) buiten de tolerantie of onbekend: ' + buiten.map(d => d.id).join(', ') : null,
      dimensies };
  }

  return { streefbeeld: { voorstel, getekend, teken, intrek: trekStreefbeeldIn, toets, DIMENSIES } };
};

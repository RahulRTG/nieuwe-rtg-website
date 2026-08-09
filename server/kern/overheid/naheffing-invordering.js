/* Overheid-domein "naheffing" (deelmodule): DE INVORDERING.

   Wat er gebeurt als een vastgestelde naheffing niet wordt betaald. Dit is de
   zwaarste bevoegdheid in deze hele laag, en daarom staat er meer omheen dan om
   alle vorige stappen samen.

   DE KETEN IS EEN KANT OP EN ELKE STAP HEEFT ZIJN EIGEN TERMIJN:

     vervallen -> aanmaning -> dwangbevel -> beslag

   Elke stap kan pas als de TERMIJN van de vorige echt is verstreken. Niet "na
   een dag of wat": de datum staat op de naheffing en wordt nagerekend. Een
   invorderingsstap die te vroeg mag, is een dwangmiddel zonder grond.

   ER ZIT EEN REM EN EEN STOPKNOP IN (./naheffing-rem.js), en dat is geen
   vriendelijkheid maar een voorwaarde: zonder die twee is dit een ratel die maar
   een kant op kan.

   BESLAG IS DE ENIGE STAP MET VIER OGEN, en met opzet de enige: hier gaat er
   geld van een rekening af zonder dat de rekeninghouder tekent. Wie het
   dwangbevel uitvaardigde, legt het beslag niet. En er wordt NOOIT meer gepakt
   dan de schuld; staat er minder op de rekening, dan is het een deelbetaling en
   blijft de rest openstaan. Een beslag dat een rekening leegtrekt tot onder de
   schuld zou geld pakken waar geen titel voor is.

   WAT ER NIET IS, EN NIET KOMT: beslag op iets anders dan de zakelijke rekening
   waarop de aanslag is opgelegd. Geen loonbeslag, geen bodembeslag, geen
   derdenbeslag. Dat zijn bevoegdheden met eigen waarborgen en eigen rechters, en
   die verzin je er niet even bij.

   De bedragen zijn een demo-benadering met een peiljaar (art. 63a IW en de
   Kostenwet); werk ze bij en vertrouw ze niet als fiscaal advies.

   Krijgt de gedeelde ctx van kern/overheid/index.js. */
'use strict';

const AANMANING_KOSTEN = { grens: 45400, laag: 800, hoog: 1900 };  // art. 63a IW (demo-peiljaar)
const DWANGBEVEL_KOSTEN_CENTEN = 5000;                             // Kostenwet (demo-peiljaar)
const AANMANING_DAGEN = 14;
const DWANGBEVEL_DAGEN = 2;
const REGELING_MAX_MAANDEN = 12;
const DAG = 86400000;

module.exports = (ctx, { vind, publiek, gelijk, teBetalen }) => {
  const { db, save, nu, schoon, notifySupplier, bankLive, bankBoek, bankSaldo, rekeningVan, TEGENREKENING } = ctx;
  const euro = (c) => (c / 100).toFixed(2).replace('.', ',');
  const vandaag = () => nu().slice(0, 10);
  const overDagen = (n) => new Date(Date.parse(nu()) + n * DAG).toISOString().slice(0, 10);

  /* Openstaand = de aanslag plus de boete plus de invorderingskosten, min wat er
     al is betaald. Op EEN plek, want elke stap hieronder rekent ermee. */
  const openstaand = (n) => Math.max(0, teBetalen(n) - (n.betaalCenten || 0));

  /* Mag er uberhaupt een invorderingsstap? Zes redenen van niet, en ze worden
     alle zes met zoveel woorden gezegd -- een stap die stil niets doet is bij
     dwangmiddelen het gevaarlijkst. */
  function magInvorderen(n, watNu) {
    if (!n) return { status: 404, error: 'Deze naheffing kennen we niet.' };
    if (!['vastgesteld', 'bezwaar', 'gehandhaafd'].includes(n.status))
      return { status: 409, error: 'Een naheffing met de stand "' + n.status + '" wordt niet ingevorderd.' };
    if (n.betaaldOp) return { status: 409, error: 'Op deze naheffing staat niets meer open; er valt niets in te vorderen.' };
    if (n.invorderingGestopt) return { status: 409,
      error: 'De invordering is stopgezet op ' + n.invorderingGestopt.op.slice(0, 10) + ' (' + n.invorderingGestopt.reden + ').' };
    if (n.regeling) return { status: 409,
      error: 'Er loopt een betalingsregeling tot ' + n.regeling.totOp + '; zolang die wordt nagekomen staat de invordering stil.' };
    if (n.vervaltOp && n.vervaltOp >= vandaag()) return { status: 409,
      error: 'De termijn loopt nog tot en met ' + n.vervaltOp + '. ' + watNu + ' kan pas daarna.' };
    return null;
  }

  const meld = (n, titel, tekst) => { if (notifySupplier) notifySupplier(n.code,
    { icon: 'overheid', title: titel, body: n.kenmerk + ': ' + tekst, scope: 'overheid' }); };

  /* ---- stap 1: de aanmaning ---- */
  function naheffingAanmaning(id, door) {
    const n = vind(id);
    const nee = magInvorderen(n, 'Een aanmaning'); if (nee) return nee;
    if (n.aanmaningOp) return { status: 409, error: 'Er is al aangemaand op ' + n.aanmaningOp.slice(0, 10) + '.' };
    const wie = schoon(door, 60);
    if (wie.length < 2) return { status: 400, error: 'Een aanmaning staat altijd op naam.' };

    const kosten = openstaand(n) < AANMANING_KOSTEN.grens ? AANMANING_KOSTEN.laag : AANMANING_KOSTEN.hoog;
    n.aanmaningOp = nu(); n.aanmaningDoor = wie;
    n.kostenCenten = (n.kostenCenten || 0) + kosten;
    n.vervaltOp = overDagen(AANMANING_DAGEN);
    save();
    meld(n, 'Aanmaning', 'er staat € ' + euro(openstaand(n)) + ' open (inclusief € ' + euro(kosten) +
      ' aanmaningskosten). Betaal voor ' + n.vervaltOp + ', of vraag een betalingsregeling aan.');
    return { ok: true, naheffing: publiek(n),
      let: 'Aangemaand. Er zijn € ' + euro(kosten) + ' aanmaningskosten bijgekomen; de zaak heeft tot ' + n.vervaltOp + '.' };
  }

  /* ---- stap 2: het dwangbevel ---- */
  function naheffingDwangbevel(id, door) {
    const n = vind(id);
    const nee = magInvorderen(n, 'Een dwangbevel'); if (nee) return nee;
    if (!n.aanmaningOp) return { status: 409,
      error: 'Er is nog niet aangemaand. Een dwangbevel zonder aanmaning slaat een stap over die de zaak de kans geeft alsnog te betalen.' };
    if (n.dwangbevelOp) return { status: 409, error: 'Er is al een dwangbevel op ' + n.dwangbevelOp.slice(0, 10) + '.' };
    const wie = schoon(door, 60);
    if (wie.length < 2) return { status: 400, error: 'Een dwangbevel staat altijd op naam.' };

    n.dwangbevelOp = nu(); n.dwangbevelDoor = wie;
    n.kostenCenten = (n.kostenCenten || 0) + DWANGBEVEL_KOSTEN_CENTEN;
    n.vervaltOp = overDagen(DWANGBEVEL_DAGEN);
    save();
    meld(n, 'Dwangbevel', 'er is een dwangbevel uitgevaardigd voor € ' + euro(openstaand(n)) +
      ' (inclusief € ' + euro(DWANGBEVEL_KOSTEN_CENTEN) + ' kosten). Betaalt u niet voor ' + n.vervaltOp +
      ', dan kan er beslag worden gelegd op uw zakelijke rekening.');
    return { ok: true, naheffing: publiek(n),
      let: 'Dwangbevel uitgevaardigd. Beslag kan pas na ' + n.vervaltOp + ', en door ANDERE ogen dan deze.' };
  }

  /* ---- stap 3: beslag, met vier ogen en een plafond ---- */
  async function naheffingBeslag(id, door) {
    const n = vind(id);
    const nee = magInvorderen(n, 'Beslag'); if (nee) return nee;
    if (!n.dwangbevelOp) return { status: 409,
      error: 'Er is geen dwangbevel. Beslag zonder titel bestaat niet.' };
    if (n.beslagOp) return { status: 409, error: 'Er is al beslag gelegd op ' + n.beslagOp.slice(0, 10) + '.' };
    const wie = schoon(door, 60);
    if (wie.length < 2) return { status: 400, error: 'Beslag staat altijd op naam.' };
    if (gelijk(wie, n.dwangbevelDoor)) return { status: 409,
      error: 'Dezelfde ogen tellen niet dubbel: wie het dwangbevel uitvaardigde legt het beslag niet.' };

    if (!bankLive || !bankLive()) return { status: 503,
      error: 'De RTG Bank is niet open; er kan niets worden afgeschreven. Er is geen beslag gelegd.' };
    const rek = rekeningVan(n.code);
    if (!rek) return { status: 409, error: 'Deze zaak heeft geen zakelijke rekening om beslag op te leggen.' };

    /* NOOIT MEER DAN DE SCHULD, en nooit meer dan er staat. Beide kanten van dat
       plafond doen ertoe: het eerste is de grens van de titel, het tweede is de
       grens van de werkelijkheid. Staat er minder, dan is dit een deelbetaling
       en blijft de rest gewoon open. */
    const schuld = openstaand(n);
    const saldo = Math.max(0, bankSaldo(rek.iban));
    const pak = Math.min(schuld, saldo);
    if (pak <= 0) return { status: 409,
      error: 'Er staat niets op de zakelijke rekening; er valt geen beslag te leggen. De naheffing blijft openstaan.' };

    const b = await bankBoek({ van: rek.iban, naar: TEGENREKENING, centen: pak,
      soort: 'belasting', oms: 'Beslag naheffing ' + n.periode, ref: n.kenmerk });
    if (b && b.error) return b;

    n.beslagOp = nu(); n.beslagDoor = wie; n.beslagCenten = pak;
    n.betaalCenten = (n.betaalCenten || 0) + pak;
    n.betaalIban = rek.iban;
    const rest = schuld - pak;
    if (rest <= 0) n.betaaldOp = nu();
    save();
    meld(n, 'Beslag gelegd', '€ ' + euro(pak) + ' is van uw zakelijke rekening afgeschreven.' +
      (rest > 0 ? ' Er staat nog € ' + euro(rest) + ' open.' : ' De naheffing is daarmee voldaan.'));
    return { ok: true, naheffing: publiek(n), volledig: rest <= 0,
      let: rest > 0 ? 'Deelbeslag: € ' + euro(pak) + ' gepakt, € ' + euro(rest) + ' blijft openstaan.'
        : 'Beslag gelegd: € ' + euro(pak) + '. De naheffing is voldaan.' };
  }

  /* De rem (een betalingsregeling) en de stopknop staan in ./naheffing-rem.js:
     andere richting, en samen met het bovenstaande zou dit bestand over de lat
     gaan. Ze delen `openstaand` en `meld`, zodat er van allebei EEN is. */
  const deelRem = require('./naheffing-rem')(ctx,
    { vind, publiek, openstaand, meld, overDagen, euro, REGELING_MAX_MAANDEN });

  return Object.assign({ naheffingAanmaning, naheffingDwangbevel, naheffingBeslag,
    AANMANING_KOSTEN, DWANGBEVEL_KOSTEN_CENTEN }, deelRem);
};

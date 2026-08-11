/* Magnaat: ONDERHANDELEN -- voorstellen, tegenvoorstellen, tekenen, afkopen.

   Afgesplitst van ./handel.js op een echte naad. Dat bestand kent het CONTRACT
   en de maand: wat er geleverd wordt, wat er betaald wordt, wanneer er een
   boete valt. Dit bestand kent het GESPREK: wie iets mag voorstellen, hoe vaak
   er heen en weer mag, en wanneer het een verplichting wordt.

   ONDERHANDELEN IS EEN VRIJE ACTIE (GAMEHALL.md 12.3). Dat is niet
   coulance maar de kern van Long Play: in een partij van zes met 24 uur per
   beurt zou een contract anders een week duren. Dat het vrij is, is precies
   waarom de GRENZEN hier scherp moeten staan -- een vrije actie die je
   ongelimiteerd mag doen, is een vrije actie waarmee je iemand kunt bestoken.

   DRIE GRENZEN, elk met een reden die niet "netjes" is:

     RONDEN (6). Een draad die eindeloos doorgaat is geen onderhandeling maar
     een uitputtingsslag, en de partij die het langst wakker is wint hem.
     OPEN DRADEN PER SPELER (5). Zonder dit stuurt iemand vijftig voorstellen
     en is het scherm van de ander onbruikbaar.
     ALLEEN NAAR WIE MEESPEELT, en alleen over vestigingen die er zijn. Wordt
     hier gecontroleerd en niet aangenomen.

   EEN VOORSTEL IS OPENBAAR VOOR DE TWEE PARTIJEN EN VOOR NIEMAND ANDERS. Dat
   is dezelfde regel als de boeken (../weergave.js): een derde ziet DAT er
   contracten lopen -- dat staat op straat, de vrachtwagens rijden -- maar niet
   tegen welke prijs. */
const H = require('./handel');

const MAX_RONDEN = 6;
const MAX_OPEN = 5;

module.exports = ({ K, mijnVestiging, rond }) => {
  const lopend = (st) => (st.contracten || []).filter(c => c.status === 'loopt');
  const vanIemand = (st, id) => {
    for (const [h, rij] of Object.entries(st.vestigingen)) {
      const v = rij.find(x => x.id === id);
      if (v) return { speler: h, v };
    }
    return null;
  };
  const draad = (st, id) => (st.contracten || []).find(c => c.id === id);
  /* Mag deze speler dit contract zien? Beide partijen, en verder niemand. Een
     kijker komt hier niet eens langs (../weergave.js geeft hem de publieke
     wereld), maar een speler die een id raadt wel. */
  const partij = (c, h) => c.leverancier === h || c.afnemer === h;

  /* Een voorstel omzetten in een contract-in-wording. Doet GEEN enkele controle
     -- die staan hieronder, op een plek, zodat een tegenvoorstel door dezelfde
     zeef gaat als een eerste voorstel. Dat is precies de fout die je anders
     maakt: streng bij het openen, laks bij het bijstellen. */
  function toets(st, h, zet, bestaand) {
    const eigenId = String(zet.mijn || '');
    const anderId = String(zet.hun || '');
    const mijn = mijnVestiging(st, h, eigenId);
    if (!mijn) return { status: 404, error: 'Die vestiging is niet van jou.' };
    const ander = vanIemand(st, anderId);
    if (!ander || ander.speler === h) return { status: 404, error: 'Die vestiging bestaat niet of is van jou.' };

    const vw = H.voorwaarden(zet);
    const fout = H.keurVoorstel(vw);
    if (fout) return { status: 400, error: fout };
    if (vw.looptijd > st.duur - st.maand)
      return { status: 400, error: 'Een contract kan niet langer lopen dan de campagne nog duurt.' };

    /* WIE LEVERT ER? Dat volgt uit de sectoren en niet uit een vinkje in het
       verzoek: een winkel levert goederen, een vervoerder ritten. Zou de
       verzender mogen zeggen wie er levert, dan kon hij zichzelf tot afnemer
       van zijn eigen contract maken. */
    const ikLever = H.levert(mijn.sector) === vw.soort;
    const leverancier = ikLever ? { speler: h, v: mijn } : ander;
    const afnemer = ikLever ? ander : { speler: h, v: mijn };
    const past = H.pastBij(leverancier.v, afnemer.v, vw.soort);
    if (past) return { status: 400, error: past };

    const botsing = H.exclusiviteitsbotsing(
      lopend(st).filter(c => c.leverancier === leverancier.speler)
        .map(c => Object.assign({}, c, { afnemerV: (vanIemand(st, c.afnemerId) || {}).v }))
        .filter(c => c.afnemerV),
      K(st), afnemer.v, vw.soort);
    if (botsing) return { status: 409, error: botsing };

    /* Een afnemer koopt een soort EEN KEER per vestiging in. Twee contracten
       voor dezelfde post is geen dubbele dekking maar dubbel betalen, en dat is
       een val en geen keuze. */
    const dubbel = lopend(st).find(c => c.afnemerId === afnemer.v.id && c.soort === vw.soort
      && (!bestaand || c.id !== bestaand.id));
    if (dubbel) return { status: 409, error: 'Voor die post loopt al een contract; zeg dat eerst op.' };
    return { ok: true, vw, leverancier, afnemer };
  }

  const ACTIES = {
    /* VRIJ: een contract voorstellen. `mijn` is jouw vestiging, `hun` die van de
       ander; wie van de twee de leverancier is volgt uit de sectoren. */
    'contract-voorstel'(potje, h, zet) {
      const st = potje.staat;
      const open = (st.contracten || []).filter(c => c.status === 'voorgesteld' && c.van === h);
      if (open.length >= MAX_OPEN) return { status: 429, error: `Je hebt al ${MAX_OPEN} voorstellen openstaan.` };
      const r = toets(st, h, zet, null);
      if (r.error) return r;
      const c = Object.assign({
        id: 'c' + (st.contractTeller = (st.contractTeller || 0) + 1),
        status: 'voorgesteld', van: h, ronde: 1,
        leverancier: r.leverancier.speler, leverancierId: r.leverancier.v.id,
        afnemer: r.afnemer.speler, afnemerId: r.afnemer.v.id,
        gesloten: null, startMaand: null, eindMaand: null,
        betaald: 0, ontvangen: 0, boetes: 0, maandenGeleverd: 0, maandenTekort: 0
      }, r.vw);
      (st.contracten = st.contracten || []).push(c);
      return { status: 200, ok: true, id: c.id, wek: c.leverancier === h ? c.afnemer : c.leverancier,
        leverancier: c.leverancier === h ? 'jij' : 'zij' };
    },

    /* VRIJ: antwoorden. `ja` tekent, `nee` trekt de streep, en een tegenvoorstel
       is hetzelfde verzoek met andere getallen -- dan draait de beurt om.

       DE BEURT DRAAIT OM, en dat is de enige reden dat dit werkt zonder chat:
       wie het laatst iets voorstelde mag niet zelf tekenen. Zonder die regel
       kon je je eigen voorstel accepteren. */
    'contract-antwoord'(potje, h, zet) {
      const st = potje.staat;
      const c = draad(st, String(zet.id || ''));
      if (!c || !partij(c, h)) return { status: 404, error: 'Dat voorstel bestaat niet.' };
      if (c.status !== 'voorgesteld') return { status: 409, error: 'Dat voorstel ligt niet meer op tafel.' };
      if (c.van === h && zet.antwoord !== 'nee')
        return { status: 409, error: 'Je bent zelf aan zet met dit voorstel; de ander moet antwoorden.' };
      const antwoord = String(zet.antwoord || '');

      const ander = c.leverancier === h ? c.afnemer : c.leverancier;
      if (antwoord === 'nee') { c.status = 'afgewezen'; return { status: 200, ok: true, wek: ander, status_: 'afgewezen' }; }

      if (antwoord === 'tegen') {
        if (c.ronde >= MAX_RONDEN) return { status: 409, error: `Na ${MAX_RONDEN} rondes is het ja of nee.` };
        const r = toets(st, h, { mijn: c.leverancier === h ? c.leverancierId : c.afnemerId,
          hun: c.leverancier === h ? c.afnemerId : c.leverancierId, soort: c.soort,
          eenheden: zet.eenheden, bedrag: zet.bedrag, looptijd: zet.looptijd,
          eis: zet.eis, boete: zet.boete, vooraf: zet.vooraf, exclusief: zet.exclusief }, c);
        if (r.error) return r;
        Object.assign(c, r.vw, { van: h, ronde: c.ronde + 1 });
        return { status: 200, ok: true, wek: ander, ronde: c.ronde };
      }

      if (antwoord !== 'ja') return { status: 400, error: 'Antwoord met ja, nee of tegen.' };

      /* TEKENEN. De vooruitbetaling gaat NU, en het contract loopt vanaf de
         volgende maand: een contract dat halverwege een al gerekende maand
         ingaat zou betekenen dat de uitkomst van die maand afhangt van het
         moment waarop iemand op de knop drukte. Dat is precies wat 12.4
         verbiedt. */
      if (c.vooraf > 0 && st.geld[c.afnemer] < c.vooraf)
        return { status: 400, error: 'De vooruitbetaling van ' + c.vooraf + ' staat niet op de rekening.' };
      const dubbel = lopend(st).find(x => x.afnemerId === c.afnemerId && x.soort === c.soort);
      if (dubbel) return { status: 409, error: 'Voor die post loopt inmiddels al een contract.' };
      if (!vanIemand(st, c.leverancierId) || !vanIemand(st, c.afnemerId))
        return { status: 409, error: 'Een van beide vestigingen bestaat niet meer.' };
      if (c.vooraf > 0) { st.geld[c.afnemer] -= c.vooraf; st.geld[c.leverancier] += c.vooraf; }
      c.status = 'loopt';
      c.gesloten = st.maand;
      c.startMaand = st.maand + 1;
      c.eindMaand = st.maand + c.looptijd;
      return { status: 200, ok: true, wek: ander, status_: 'loopt', tot: c.eindMaand };
    },

    /* VRIJ: opzeggen. Kost een afkoopsom (./handel.js) en die gaat naar de
       WEDERPARTIJ -- niet naar de bank. Wie eruit wil stapt eruit, maar de ander
       had erop gerekend. */
    'contract-opzeggen'(potje, h, zet) {
      const st = potje.staat;
      const c = draad(st, String(zet.id || ''));
      if (!c || !partij(c, h)) return { status: 404, error: 'Dat contract bestaat niet.' };
      if (c.status !== 'loopt') return { status: 409, error: 'Dat contract loopt niet.' };
      const som = H.afkoopsom(c, st.maand);
      if (st.geld[h] < som) return { status: 400, error: 'Afkopen kost ' + som + '; dat heb je niet.' };
      const tegen = c.leverancier === h ? c.afnemer : c.leverancier;
      st.geld[h] -= som;
      st.geld[tegen] += som;
      c.status = 'afgekocht';
      c.eindMaand = st.maand;
      c.afkoop = som;
      return { status: 200, ok: true, wek: tegen, afkoop: som };
    }
  };

  return { ACTIES, VRIJE_ACTIES: Object.keys(ACTIES), MAX_RONDEN, MAX_OPEN };
};

/* ============================================================================
   MEETINSTRUMENTEN -- wat een deelnemer met zijn labpas invult, en wat er dan
   precies wordt vastgelegd.

   HET VERSCHIL MET ./waarnemen.js. Daar staat de vrije observatie: iemand ziet
   iets en schrijft het op. Hier staat het tegenovergestelde: een onderzoeksleider
   stelt vooraf een PROTOCOL samen -- welke vragen, in welke vorm, met welke
   eenheid -- en de deelnemer vult dat in. Het eerste levert materiaal, het tweede
   levert vergelijkbare metingen. Een lab heeft ze allebei nodig en ze horen niet
   in elkaar te schuiven: een vrije observatie met een schaal ernaast is geen
   meting, en een meting met een tekstveld eronder is geen observatie.

   DIT IS GEEN APP UIT DE APP STORE, EN DAT IS EEN ARCHITECTONISCHE GRENS.
   Een app van derden draait in een cel zonder netwerk (APPSTORE.md grens 1); die
   kan een meting niet terugsturen, en zou dat ook niet mogen -- een meting draagt
   een toestemmingsgrond en hoort bij een studie van de stichting. Het instrument
   woont daarom hier, achter de labpas, in de software van RTG zelf.

   WAT ER BIJ ELKE METING WORDT VASTGELEGD, en waarom elk stuk:

     protocolversie      welke vragenset er is beantwoord. Zonder dit is een
                         reeks metingen over een half jaar niet te vergelijken,
                         want de vraag kan onderweg zijn veranderd.
     toestemmingsgrond   waarop deze meting rust. Bevriest bij het insturen: wat
                         later verandert, verandert niet met terugwerkende kracht
                         wat er toen gold.
     apparaat + ijkstand de kalibratiestand op het MOMENT van meten. Blijkt een
                         apparaat later ontregeld, dan is precies te zien welke
                         metingen daaronder vallen.
     meetmoment          het hoeveelste meetmoment dit is (uit het onderzoeksplan).
     ruwe waarde         wat de deelnemer invulde, ongewijzigd.

   DRIE GRENZEN DIE NIET MOGEN SNEUVELEN.

   1. GEEN TOESTEMMINGSGROND, GEEN METING. Een studie waar het toestemmingsregime
      nog op 'geen' staat, verzamelt niets van mensen. Dat is fail-closed en het
      hoort zo: de ethieklaag komt vóór het verzamelen, niet erna.

   2. EEN INGEVULDE WAARDE WORDT NOOIT STIL VERBETERD. Buiten bereik is een
      WEIGERING met de grenzen erbij, geen stille afronding naar het dichtstbijzijnde
      geldige getal. Wie meetwaarden bijschaaft, meet zijn eigen verwachting.

   3. DE DEELNEMER IS EEN ALIAS. Hij komt binnen op zijn labpas en die levert de
      alias; er gaat geen naam mee, ook niet als de invuller hem intypt.
   ========================================================================== */
'use strict';

/* De soorten instrument en het lezen van een waarde staan in
   ./instrumentsoorten.js: dat is de tabel die een onderzoeksleider leest, dit is
   de machinerie eromheen. */
const { SOORTEN, NIET_GEBOUWD, soortVan, lees } = require('./instrumentsoorten');

const MAX_INSTRUMENTEN = 12;      // een meetvenster dat langer is, wordt niet ingevuld

module.exports = (ctx) => {
  const { nu, rid, schoon, getal, audit, vindStudie, save } = ctx;

  const potje = (s) => {
    if (!s.dossier.protocol) s.dossier.protocol = { versie: 0, instrumenten: [], at: null, door: null };
    if (!Array.isArray(s.dossier.metingen)) s.dossier.metingen = [];
    return s.dossier;
  };

  /* ---------- het protocol samenstellen (de onderzoeksleider) ----------

     Elke wijziging is een NIEUWE VERSIE. Niet omdat versies mooi zijn, maar
     omdat een meting straks zegt welke versie zij beantwoordde: zonder dat is
     een reeks van een half jaar niet te vergelijken en weet niemand of vraag 3
     onderweg is veranderd. */
  function protocolZet(id, b, wie) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const d = potje(s);
    b = b || {};
    const ruw = Array.isArray(b.instrumenten) ? b.instrumenten : null;
    if (!ruw) return { status: 400, error: 'Geef de instrumenten mee als lijst.' };
    if (!ruw.length) return { status: 400, error: 'Een meetvenster zonder vragen levert niets op.' };
    if (ruw.length > MAX_INSTRUMENTEN) return { status: 400, error: 'Een meetvenster heeft hooguit ' + MAX_INSTRUMENTEN + ' vragen; langer wordt het niet ingevuld.' };

    const uit = [];
    const sleutels = new Set();
    for (const i of ruw) {
      const st = soortVan(i && i.soort);
      if (!st) {
        const reden = NIET_GEBOUWD[String((i && i.soort) || '')];
        return { status: 400, error: reden
          ? 'Een instrument van de soort "' + i.soort + '" bestaat hier niet. ' + reden
          : 'Kies een soort instrument: ' + SOORTEN.map(x => x.soort).join(', ') + '.' };
      }
      const sleutel = schoon(i.sleutel, 30).toLowerCase().replace(/[^a-z0-9-]/g, '');
      if (sleutel.length < 2) return { status: 400, error: 'Elk instrument heeft een korte sleutel (letters, cijfers, streepjes) waaronder de waarde straks wordt bewaard.' };
      if (sleutels.has(sleutel)) return { status: 400, error: 'De sleutel "' + sleutel + '" staat er twee keer in; dan is niet te zien welke waarde bij welke vraag hoort.' };
      sleutels.add(sleutel);
      const vraag = schoon(i.vraag, 160);
      if (vraag.length < 3) return { status: 400, error: 'Schrijf de vraag op die de deelnemer leest.' };
      const inst = { sleutel, vraag, soort: st.soort, verplicht: i.verplicht !== false };
      if (st.soort === 'getal') {
        inst.eenheid = schoon(i.eenheid, 20);
        if (!inst.eenheid) return { status: 400, error: 'Een getal zonder eenheid is geen meting. Zet erbij waarin gemeten wordt.' };
        inst.min = getal(i.min, -1000000, 1000000);
        inst.max = getal(i.max, -1000000, 1000000);
        if (inst.max <= inst.min) return { status: 400, error: 'Zet een bereik: waartussen ligt een geldige waarde voor "' + vraag + '"?' };
      }
      if (st.soort === 'keuze') {
        inst.opties = (Array.isArray(i.opties) ? i.opties : []).map(o => schoon(o, 60)).filter(Boolean).slice(0, 10);
        if (inst.opties.length < 2) return { status: 400, error: 'Een keuze heeft ten minste twee antwoorden.' };
      }
      uit.push(inst);
    }

    d.protocol = { versie: (d.protocol.versie || 0) + 1, instrumenten: uit,
      at: nu(), door: schoon(wie, 80) || 'lab' };
    audit(s.labId, 'protocol.zet', wie, s.id, 'versie ' + d.protocol.versie + ', ' + uit.length + ' instrumenten');
    save();
    return { ok: true, protocol: d.protocol,
      let: 'Versie ' + d.protocol.versie + ' staat klaar. Metingen die al binnen zijn, blijven bij de versie die zij hebben beantwoord.' };
  }

  /* Wat het LAB ziet. De metingen zelf, met hun context -- en zonder namen, want
     die zijn er niet: een deelnemer is zijn alias. */
  function metingen(id, { vanaf, n } = {}) {
    const s = vindStudie(id); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const d = potje(s);
    const lijst = d.metingen.filter(m => !vanaf || m.protocolversie === Number(vanaf));
    return { ok: true, protocol: d.protocol, totaal: lijst.length,
      metingen: lijst.slice(0, Math.max(1, Math.min(500, Number(n) || 100))),
      /* PER VERSIE GETELD, want dat is de vraag die een onderzoeker als eerste
         stelt: hoeveel metingen horen bij dezelfde vragenset? */
      perVersie: lijst.reduce((a, m) => { a[m.protocolversie] = (a[m.protocolversie] || 0) + 1; return a; }, {}),
      zegtNiet: 'Deze lijst zegt niets over de kwaliteit van een meting. Of een reeks iets aantoont, weegt de bewijsmotor (./bewijs.js) en niet deze teller.' };
  }

  /* De deelnemerskant (./meting.js) komt hier binnen en gaat als EEN geheel
     naar buiten: de rest van de map en de routes kennen `instrument` en hoeven
     niet te weten in welk van de twee bestanden een functie is beland -- dezelfde
     samenvoeging als ethiek + waarborg in ./index.js. `potje` gaat mee omdat
     beide helften dezelfde vorm van het dossier verwachten. */
  const deelnemer = require('./meting')(ctx, potje);

  return Object.assign({ protocolZet, metingen, SOORTEN, NIET_GEBOUWD, MAX_INSTRUMENTEN }, deelnemer);
};

/* De tabellen hangen OOK aan de fabriek, zodat een scherm en een toets ze kunnen
   lezen zonder een lab op te bouwen. Dat is hier meer dan gemak: `NIET_GEBOUWD`
   is het antwoord dat een onderzoeksleider hoort te kunnen lezen voordat hij
   iets inzendt, en dat hoort niet achter een draaiende server te zitten. */
module.exports.SOORTEN = SOORTEN;
module.exports.NIET_GEBOUWD = NIET_GEBOUWD;
module.exports.MAX_INSTRUMENTEN = MAX_INSTRUMENTEN;

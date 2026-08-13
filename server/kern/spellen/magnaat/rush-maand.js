/* Magnaat: WAT EEN DIENST DE MAAND IN STUURT.

   Hij staat los van ./rush-acties.js omdat ./maand.js hem nodig heeft en de
   actietabel niet: zou de maandkant in de actiefabriek zitten, dan moest
   ./maand.js die fabriek bouwen om een getal op te halen, en dan hangt de
   economie aan de bediening in plaats van andersom.

   EN LOS VAN ./rush-nalaten.js, dat over de andere kant gaat: wat er NA de maand
   van een dienst overblijft. Die twee hebben een verschillend tempo. Dit bestand
   levert een invoer die elke maand opnieuw gerekend wordt; dat bestand neemt een
   besluit over wat er BEWAARD wordt, en dat is de gevoeligste vraag van deze
   laag. `maandInvoer()` loopt voor de maand, `naMaand()` erna, en die volgorde
   is niet inwisselbaar. */
'use strict';

const R = require('./rush');
const D = require('./dienst');
const STORING = require('./storing');
const { SOORTEN } = require('./rush-voorvallen');

const vind = (st, id) => (st.vestigingen ? Object.values(st.vestigingen).flat()
  .find(v => v.id === id) : null) || null;

/* Elke AFGERONDE dienst van deze maand, met zijn zaak en zijn uitkomst erbij.
   Beide functies hieronder lopen langs dezelfde lijst, en dat is met opzet: zou
   `naMaand` een andere selectie maken dan `factoren`, dan staat er een dienst in
   het log die de rekening nooit raakte, of omgekeerd. */
function afgerond(potje) {
  const st = potje.staat;
  const t = R.tafel(st);
  const uit = [];
  for (const d of D.lopend(st)) {
    const s = t.diensten[d.id];
    /* NIET AFGEMAAKT IS NEUTRAAL -- wet 4, op de plek waar hij geld raakt. Een
       dienst die je begon en liet liggen telt niet mee, en kost dus niets. */
    if (!s || s.maand !== st.maand || !s.klaar) continue;
    const v = vind(st, d.vestiging);
    if (!v || !R.magRush(d.rol, v.sector)) continue;
    uit.push({ d, v, s, vv: R.bouw(potje.id, d, s.maand, d.rol, v) });
  }
  return uit;
}

/* WAT DE MAAND VAN DE WERKVLOER MEEKRIJGT: de dervingfactor per zaak, en wat er
   aan spoedwerk op de rekening komt.

   HIJ ZET OOK DE BESLUITEN OM, en dat moet HIER gebeuren en nergens eerder. Een
   vakkracht die om acht uur "repareren" kiest en daarna wegloopt, heeft geen
   dienst gedraaid -- en wet 4 zegt dat een onafgemaakte dienst neutraal is.
   Zou `rush-pak` de storing meteen dichtzetten, dan was afbreken ineens de
   goedkoopste manier om iets te repareren. Wat je vanavond besloot, staat
   morgen in de boeken; niet eerder.

   TWEE HULPKRACHTEN OP EEN ZAAK MIDDELEN, ze tellen niet op. Zou het optellen,
   dan halveert een tweede man de derving zonder iets te doen -- en dan is
   personeel aannemen een geldpomp in plaats van een kostenpost. */
function maandInvoer(potje) {
  const st = potje.staat;
  const per = {}, spoed = {};
  /* EERST WAT ER VANZELF GEBEURT: een noodoplossing die het begeeft. Voor de
     besluiten, want wie deze maand repareert hoort daar geen last van te hebben. */
  const vervallen = [];
  for (const rij of Object.values(st.vestigingen || {}))
    for (const v of rij)
      for (const t of STORING.verval(v, st.maand)) vervallen.push({ zaak: v.naam, ...t });
  for (const { d, v, s, vv } of afgerond(potje)) {
    (per[d.vestiging] = per[d.vestiging] || []).push(R.uitkomst(vv, s, v).factor);
    /* WAT DE VLOER BESLOOT, wordt hier pas een stand. GEEN GELD en GEEN
       herstelsprong: die twee horen bij `repareren`, en dat is met opzet geen
       uitweg op de werkvloer (./rush-voorvallen.js). Een vakkracht om tien uur
       's avonds belt geen monteur; hij zet een noodkoeling neer of neemt het
       ding uit bedrijf.

       DAAROM STAAT HIER GEEN TELLER EN GEEN VLAG. Een eerdere versie boekte
       hier ook `spoed` en `herstel`, met een `gedaanGeboekt`-vlag ertegen -- maar
       sinds repareren naar de zaak verhuisde was die tak onbereikbaar en dus was
       de vlag onmeetbaar. Een bewaking die niet kan zakken is erger dan geen
       bewaking (LAT.md regel 9). Wat er nu staat is idempotent omdat een stand
       zetten dat is: twee keer dezelfde stand is dezelfde stand. */
    for (const g of s.gedaan) {
      const bron = SOORTEN.find(x => x.id === g.id);
      if (!bron || !bron.storing) continue;
      /* MET EEN NAAM ERAAN. Wie er die avond stond is bekend, en zonder dat
         staat er op het zaakscherm een storing die uit de lucht komt vallen --
         terwijl er iemand voor stond die hem meldde (./storing-keten.js). */
      STORING.pas(v, bron.storing, (bron.opties || []).find(o => o.id === g.optie), st.maand,
        { wie: d.werknemer, rol: d.rol });
    }
  }
  /* EN WAT ER BUITEN DE DIENST OM BESLOTEN IS (./storing-acties.js): de
     eigenaar of de bedrijfsleider die op zijn zaakscherm heeft laten repareren.
     Hij wacht op de vestiging tot de maand hem ophaalt, want een reparatie
     hoort op het maandoverzicht en niet op een losse kasmutatie -- dan zou
     repareren vanaf het scherm iets anders kosten dan repareren op de vloer. */
  for (const rij of Object.values(st.vestigingen || {}))
    for (const v of rij)
      if (v.spoedOpen > 0) { spoed[v.id] = (spoed[v.id] || 0) + v.spoedOpen; v.spoedOpen = 0; }
  return { derving: Object.fromEntries(Object.entries(per)
    .map(([id, l]) => [id, l.reduce((a, b) => a + b, 0) / l.length])), spoed, vervallen };
}

/* De oude naam, want ./maand.js vraagt maar een ding en de toetsen leunen erop. */
const factoren = (potje) => maandInvoer(potje).derving;

module.exports = { maandInvoer, factoren, afgerond, vind };

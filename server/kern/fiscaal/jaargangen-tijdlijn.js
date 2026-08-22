/* De fiscale jaargangen (deelmodule): DE TIJDLIJN -- puur rekenwerk.

   Afgesplitst van ./jaargangen.js, dat over de 10 kB-lat ging, en de snede valt
   op een echte grens -- dezelfde als bij payroll tussen regelpakket en
   regelpakket-keuring. Hiernaast staat hoe je een wijziging BEWAART en
   TERUGVINDT; hier staat hoe je uit een basis en een reeks wijzigingen de tabel
   van EEN DAG opbouwt.

   PUUR: geen database, geen klok, geen state. Dat is geen netheid maar de reden
   dat dit te toetsen is zonder een halve server op te tuigen -- en juist deze
   som moet over tien jaar nog hetzelfde antwoord geven.

   EEN FABRIEK EN GEEN VASTE MODULE, want welke velden GENEST zijn verschilt per
   tabel. Voor de landentabel zijn dat `tarieven` en `reis`; voor de zzp-tabel
   `ahk` en `arbeidskorting`. Dat verschil in een gedeelde constante proppen zou
   betekenen dat een zzp-wijziging de tarieven van een land kan samenvoegen, en
   omgekeerd. */
'use strict';

const isDatum = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));

/* DE DIEPE KOPIE GAAT NIET DOOR JSON. Dat deed hij wel, en dat was stuk zodra
   de zzp-tabel eronder kwam: de hoogste belastingschijf staat als
   `[Infinity, 0.495]` in de tabel, en JSON.stringify maakt daar `null` van.
   De schijvenlus rekent dan `Math.min(belastbaar, null)` = 0 en kent de
   toptariefschijf ineens geen inkomen meer toe -- een belastingberekening die
   er goed uitziet en te laag is. structuredClone houdt Infinity heel.

   De terugval op JSON blijft staan voor een omgeving zonder structuredClone;
   die kent dit huis niet (Node 22+), maar een kopieerfunctie die kan ontbreken
   is geen kopieerfunctie. */
const diep = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

/* Op ingangsdatum, en bij gelijke datum op volgorde van opnemen. Twee
   wijzigingen die op dezelfde dag ingaan komen in de echte wereld voor (een
   pakket dat een eerder pakket corrigeert), en dan wint de laatst opgenomen. */
const opVolgorde = (lijst) => (Array.isArray(lijst) ? lijst : []).slice().sort((a, b) =>
  a.geldigVanaf < b.geldigVanaf ? -1 : a.geldigVanaf > b.geldigVanaf ? 1 :
    String(a.opgenomenOp) < String(b.opgenomenOp) ? -1 : 1);

/* `genest`: de velden die worden SAMENGEVOEGD in plaats van gezet. Bewust bij
   naam: een wijziging die `tarieven` als geheel zou vervangen, gooit de
   tarieven weg die er niet in stonden. Alles wat er niet in staat wordt gezet,
   en dat is juist wat je wilt bij een array als `schijven` -- een halve
   schijventabel samenvoegen met een oude levert een tabel op die niemand heeft
   vastgesteld. */
function maakTijdlijn(genest) {
  const G = Array.isArray(genest) ? genest : ['tarieven', 'reis'];

  /* Een wijzigingenset op een record leggen. Muteert het doel; het doel is
     altijd een kopie, nooit de basis zelf. */
  function voegSamen(doel, wijz) {
    for (const [veld, waarde] of Object.entries(wijz || {})) {
      if (G.includes(veld) && waarde && typeof waarde === 'object' && !Array.isArray(waarde)) {
        doel[veld] = Object.assign(doel[veld] || {}, waarde);
      } else {
        doel[veld] = waarde;
      }
    }
    return doel;
  }

  /* Uit een record de waarden lichten die een wijzigingenset gaat raken -- de
     "wat was het" bij een "wat wordt het". */
  function lichtUit(record, wijz) {
    const uit = {};
    for (const [veld, waarde] of Object.entries(wijz || {})) {
      if (G.includes(veld) && waarde && typeof waarde === 'object' && !Array.isArray(waarde)) {
        const sub = {};
        for (const k of Object.keys(waarde)) sub[k] = record && record[veld] ? record[veld][k] : undefined;
        uit[veld] = sub;
      } else {
        uit[veld] = record ? record[veld] : undefined;
      }
    }
    return uit;
  }

  /* DE OPBOUW: basis + alles wat op of voor die dag is INGEGAAN. Geeft een
     kopie terug, dus wie hier iets in wijzigt, wijzigt de geschiedenis niet. */
  function bouwOp(basisRecord, lijst, datum) {
    if (!basisRecord) return null;
    const uit = diep(basisRecord);
    for (const j of opVolgorde(lijst)) if (j.geldigVanaf <= datum) voegSamen(uit, j.wijzigingen);
    return uit;
  }

  return { voegSamen, lichtUit, bouwOp, genest: G };
}

module.exports = { isDatum, diep, opVolgorde, maakTijdlijn };

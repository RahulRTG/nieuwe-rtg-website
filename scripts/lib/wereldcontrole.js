/* ============================================================================
   STAAT DE WERELD ER NA AFLOOP NOG -- de meter over de meters.

   HET PROBLEEM, en het is hier echt gebeurd. De schoolwereld gaf de proef het
   id van haar eigen leraar mee, zodat zeven HR-routes eindelijk iets te doen
   hadden. Meteen daarna vielen er zeventien andere om: de proef roept ELKE
   route aan, en /api/foundation/school/personeel/toegang/intrek zet met dat id
   de toegang van precies die leraar stop. Zeventien klasroutes stonden daarna
   op "Onbekende klas of verkeerd token", en de wereld meldde zich nog steeds
   klaar -- want klaar was hij, aan het BEGIN.

   Dat is geen fout in een route en geen fout in een id. Het is wat er gebeurt
   als een wereld haar eigen sleutel uitdeelt aan iemand die alles probeert.
   Gemeten: er staan 26 sloopachtige routes (intrek, weg, schors, sluit) BINNEN
   de vijf werelden die de proef opzet. De schoolzaak is er een van, en hij is
   bij toeval gevonden -- aan een alfabetisch aaneengesloten blok weigeringen.

   WAT DEZE MODULE DOET is die vondst niet herhalen maar overbodig maken: na
   afloop van de meting elke wereld EEN goedkope vraag stellen die alleen
   lukt als hij er nog staat. Breekt er een, dan staat dat in de uitslag met
   de route erbij, in plaats van dat iemand het over een half jaar terugvindt
   aan een reeks routes die 'nu eenmaal' 403 geven.

   EEN SESSIE IS GEEN WERELD, en die twee uit elkaar houden was de eerste
   reparatie aan deze module zelf. De controle meldde dat de spelwereld
   gesneuveld was, met als reden wat de route zei: "Dit potje bestaat niet
   (meer)." Dat klopte niet. Een sweep over alle 3091 beproefde routes wees
   /api/logout aan (route 654): de proef logt haar eigen lid uit, en
   `spelStaat` weigert dan met dezelfde zin -- want die controleert `p.spelers
   .includes(mij)`, en zonder sessie is er geen `mij`. Het potje stond er nog.

   De proef herstelt zo'n sessie vanzelf, maar pas als een volgende route 401
   geeft; gebeurt dat niet meer, dan draait deze controle op een dood token.
   Daarom haalt zij de sessie eerst opnieuw op. Lukt dat niet, dan is dat de
   uitslag -- en niet een verzonnen oordeel over de wereld.

   WAT HET NIET DOET is repareren. Een wereld die halverwege sneuvelt, is een
   BEVINDING: misschien hoort die route niet aangeraakt te worden, misschien
   hoort de wereld een reservefiguur te krijgen (zoals de school er nu een
   heeft), en misschien is het gewoon de prijs. Dat is een besluit en geen
   automatisme. */
'use strict';

/* Per wereld een vraag die niets kapotmaakt en alleen lukt als de wortel er
   nog is. De velden komen uit de `extra` van die wereld zelf; ontbreken ze,
   dan wordt er niet gecontroleerd en zegt de uitslag dat ook. */
const CONTROLES = [
  { wereld: 'school', pad: '/api/foundation/school/klas',
    velden: ['schoolCode', 'personeelToken', 'klasCode'],
    waarom: 'de klas moet nog te lezen zijn met de sleutel van de leraar die hem geeft' },
  { wereld: 'rtfos', pad: '/api/rtfos/stad', velden: ['stad'], rol: 'kantoor-op-naam',
    lijfUit: (e) => ({ id: e.stad }),
    waarom: 'de stadsafdeling is de wortel van dat hele domein' },
  { wereld: 'festival', pad: '/api/festival/terrein', velden: ['festival', 'editie'], rol: 'supplier',
    waarom: 'zonder editie valt er in dat domein niets meer te lezen' },
  { wereld: 'lab2', pad: '/api/lab2/studie', velden: ['studie'], rol: 'kantoor-op-naam',
    lijfUit: (e) => ({ id: e.studie }),
    waarom: 'het onderzoek draagt 38 routes' },
  { wereld: 'spel', pad: '/api/member/spel/staat', velden: ['id'], rol: 'member',
    waarom: 'een potje kan door een andere route zijn afgelopen' }
];

/* Geeft per wereld { wereld, gecontroleerd, ok, waarom }. `gecontroleerd:
   false` is met opzet iets ANDERS dan `ok: false` -- niet gekeken is geen
   uitslag (LAT.md regel 3). */
async function controleerWerelden({ post, extras, tokenVoor, hernieuw }) {
  /* Eerst de sessies, dan pas de werelden -- zie de kop. Een controle die op
     een uitgelogd token draait, meet niets over de wereld en zegt het ergste. */
  const sessieStuk = new Set();
  if (hernieuw) {
    for (const rol of new Set(CONTROLES.map(c => c.rol).filter(Boolean))) {
      let ok = false;
      try { ok = await hernieuw(rol); } catch (e) { ok = false; }
      if (!ok) sessieStuk.add(rol);
    }
  }
  const uit = [];
  for (const c of CONTROLES) {
    const e = (extras && extras[c.wereld]) || null;
    const mist = !e ? c.velden : c.velden.filter(v => !e[v]);
    if (!e || mist.length) {
      uit.push({ wereld: c.wereld, gecontroleerd: false, ok: null,
        waarom: !e ? 'die wereld is niet opgezet'
                   : 'de wereld mist ' + mist.join(', ') + '; er valt niets te controleren' });
      continue;
    }
    if (c.rol && sessieStuk.has(c.rol)) {
      uit.push({ wereld: c.wereld, gecontroleerd: false, ok: null,
        waarom: 'de sessie `' + c.rol + '` was niet opnieuw op te halen; over de wereld valt zo niets te zeggen' });
      continue;
    }
    const lijf = c.lijfUit ? c.lijfUit(e) : Object.fromEntries(c.velden.map(v => [v, e[v]]));
    let a = null;
    try { a = await post(c.pad, lijf, c.rol && tokenVoor ? tokenVoor(c.rol) : null); } catch (err) { a = null; }
    const ok = !!a && a.status >= 200 && a.status < 300;
    uit.push({ wereld: c.wereld, gecontroleerd: true, ok, pad: c.pad,
      status: a ? a.status : 0,
      waarom: ok ? null
        : ((a && a.data && a.data.error) || 'geen antwoord') + ' -- ' + c.waarom });
  }
  return uit;
}

/* ---------------------------------------------------------------------------
   DE WACHT TIJDENS DE RIT.

   De controle hierboven kijkt aan het EIND, en dat is precies genoeg om te
   zien dat er iets stuk is en veel te weinig om te weten waardoor. Toen de
   spelwereld sneuvelde kostte het een sweep over alle 3091 routes -- met
   herstel na elke misser -- om /api/privacy/delete aan te wijzen. Dat werkte,
   maar het is geen manier van werken: de volgende keer is het weer een middag.

   En er is een tweede gat dat de eindcontrole per definitie niet ziet: een
   route die op plek 800 iets sloopt en op plek 2000 door een andere route
   wordt hersteld. Aan het eind staat alles overeind en toch zijn er 1200
   routes op een kapotte wereld gemeten.

   Deze wacht kijkt daarom TUSSENDOOR, elke `elke` routes. Zij meldt geen
   route maar een VENSTER -- "tussen route 1550 en 1600 ging de spelwereld
   stuk" -- want tussen twee peilingen liggen er meer. Dat is eerlijker dan
   een naam noemen die maar half klopt, en het is precies genoeg om er met
   een sweep over vijftig routes op af te gaan in plaats van over drieduizend.

   DE PRIJS is vijf goedkope oproepen per peiling. Bij `elke = 250` is dat op
   3091 routes ongeveer zestig oproepen -- een half procent van de ronde. */
function maakWereldwacht({ post, tokenVoor, extras, elke }) {
  const stap = Math.max(25, Number(elke) || 250);
  let vorige = null;
  let laatstePeiling = 0;
  const gebeurtenissen = [];
  let peilingen = 0;

  return {
    /* Aanroepen na elke route. `n` is hoeveelste route we net deden en `pad`
       welke -- die twee samen maken het venster. */
    async naRoute(n, pad) {
      if (n - laatstePeiling < stap) return;
      const stand = await controleerWerelden({ post, extras, tokenVoor });
      peilingen++;
      if (vorige) {
        for (const nu of stand) {
          const oud = vorige.find(x => x.wereld === nu.wereld);
          if (!oud || oud.ok === nu.ok) continue;
          gebeurtenissen.push({
            wereld: nu.wereld,
            van: oud.ok ? 'overeind' : 'stuk',
            naar: nu.ok ? 'overeind' : 'stuk',
            vanafRoute: laatstePeiling + 1, totRoute: n, laatstePad: pad,
            waarom: nu.waarom || null
          });
        }
      }
      vorige = stand;
      laatstePeiling = n;
    },
    verslag: () => ({ peilingen, stap, gebeurtenissen })
  };
}

module.exports = { CONTROLES, controleerWerelden, maakWereldwacht };

/* Het Privekantoor, deelbestand "briefing": de ochtend- en avondbriefing.

   Niet zevenendertig meldingen maar EEN bericht, twee keer per dag. Dat is geen
   opmaak-keuze: een melding per gebeurtenis maakt van het lid de sorteerder, en
   sorteren is precies het werk dat hij uitbesteedt.

     's OCHTENDS   wat er vandaag speelt, wat op zijn handtekening wacht, wat wij
                   vandaag voor hem doen, en wat er deze week aankomt.
     's AVONDS     wat er vandaag is afgehandeld, wat er is veranderd, en wat er
                   morgen aan hem wordt voorgelegd.

   HET VERSCHIL ZIT IN DE AVOND. Een ochtendbriefing is een vooruitblik en die
   kan iedere agenda. De avond kijkt TERUG, en dat kan alleen als er ergens is
   bijgehouden wie wat wanneer deed -- de tijdlijn van elke zaak, met `door`
   erbij (systeem, lid, kantoor). Zonder dat veld zou "vandaag afgehandeld" een
   schatting zijn, en een schatting in een dagverslag is een leugen met een
   tijdstempel.

   WAT HIER NIET IN STAAT: gezondheid en nalatenschap. Een dagverslag dat langs
   het scherm van een ander kan glijden, is de verkeerde plek voor de uitslag
   van een onderzoek. Dezelfde grens als in cases.js en orkestratie.js, hier voor
   de derde keer met een eigen reden.

   Gemount via ./index.js. */
'use strict';

const NOOIT = new Set(['gezondheid', 'nalatenschap']);

module.exports = (ctx) => {
  const { nuBeeld, tower, cases, graaf } = ctx;
  const vandaag = () => new Date().toISOString().slice(0, 10);

  const zichtbaar = z => !z.besloten && !NOOIT.has(z.domein);

  /* De regels die vandaag zijn gezet, uit de tijdlijn van elke zaak. `door`
     bepaalt hoe de regel wordt voorgelezen: wat WIJ deden is een mededeling,
     wat het LID deed is een bevestiging. */
  function vandaagGebeurd(key) {
    const t = vandaag();
    const uit = [];
    for (const z of cases(key).zaken) {
      if (!zichtbaar(z)) continue;
      for (const stap of (z.tijdlijn || [])) {
        if (String(stap.op).slice(0, 10) !== t) continue;
        uit.push({ zaak: z.titel, id: z.id, status: stap.status, notitie: stap.notitie,
          door: stap.door, op: stap.op });
      }
    }
    return uit.sort((a, b) => String(a.op).localeCompare(String(b.op)));
  }

  function ochtend(key) {
    const g = graaf(key);
    const t = tower(key, g);
    const beeld = nuBeeld(key, g, t);
    const cs = cases(key);
    const dag = vandaag();

    const week = (t.vensters.find(v => v.sleutel === 'week') || { items: [] }).items;
    return {
      status: 200, moment: 'ochtend', datum: dag,
      kop: beeld.kop, ernst: beeld.ernst,
      // vandaag, morgen, de rest van de week: drie horizonten, want "deze week"
      // alleen is te grof om je ochtend op in te richten
      vandaag: week.filter(r => r.dagen === 0),
      morgen: week.filter(r => r.dagen === 1),
      restVanDeWeek: week.filter(r => r.dagen > 1),
      achterstallig: t.achterstallig,
      beslissingen: cs.zaken.filter(z => z.beslissing.nodig && zichtbaar(z))
        .map(z => ({ id: z.id, titel: z.titel, reden: z.delegatie.reden, bedragCenten: z.bedragCenten })),
      wijDoen: cs.zaken.filter(z => z.status === 'in uitvoering' && zichtbaar(z))
        .map(z => ({ id: z.id, titel: z.titel, team: z.team.map(x => x.rol) })),
      /* Wat het lid ons heeft toevertrouwd hoort in de ochtendbriefing, want dat
         is de zin waarmee de rest van het bericht te lezen is: "wij pakken het
         op" betekent iets anders als u ons daar geen mandaat voor gaf. */
      stil: beeld.regels.length === 0
    };
  }

  function avond(key) {
    const g = graaf(key);
    const t = tower(key, g);
    const cs = cases(key);
    const gebeurd = vandaagGebeurd(key);
    const morgen = (t.vensters.find(v => v.sleutel === 'week') || { items: [] })
      .items.filter(r => r.dagen <= 1);
    const beslissingen = cs.zaken.filter(z => z.beslissing.nodig && zichtbaar(z));
    return {
      status: 200, moment: 'avond', datum: vandaag(),
      /* De kop van de avond telt wat er ECHT is gebeurd. "Een rustige dag" mag
         alleen staan als er niets in de tijdlijnen staat -- niet als er niets
         opvallends was, want dat is een oordeel en geen telling. */
      kop: gebeurd.length
        ? gebeurd.length + (gebeurd.length === 1 ? ' stap gezet vandaag' : ' stappen gezet vandaag')
        : 'Een rustige dag',
      gebeurd,
      afgerond: gebeurd.filter(x => x.status === 'geregeld'),
      doorOns: gebeurd.filter(x => x.door === 'kantoor').length,
      doorU: gebeurd.filter(x => x.door === 'lid').length,
      morgen,
      beslissingen: beslissingen.map(z => ({ id: z.id, titel: z.titel, reden: z.delegatie.reden })),
      lopend: cs.zaken.filter(z => z.status === 'in uitvoering' && zichtbaar(z)).length
    };
  }

  function dagBriefing(key, moment) {
    return moment === 'avond' ? avond(key) : ochtend(key);
  }

  return { bureauBriefing: dagBriefing };
};

/* Foundation OS, deel "publiek": de RTF-app voor de buurt.

   GEEN CODE, GEEN INLOG, DUS DE STRENGSTE GRENS VAN HET HELE SYSTEEM. Alles
   wat deze module teruggeeft, staat feitelijk op straat. De maat is daarom
   niet "wat mag een bezoeker zien" maar: WAT ZOU JE OP EEN POSTER IN HET
   BUURTHUIS HANGEN? Alles wat je daar niet zou ophangen, komt hier niet uit.

   Dat is geen voorzichtigheid om de voorzichtigheid. Een lijstje "deze week
   twee hulpvragen over schulden in de Zeewijk" is voor een buurt met driehonderd
   huizen geen statistiek maar een aanwijzing. En een activiteit met de zin
   "voor gezinnen die het niet redden" is geen uitnodiging maar een etiket dat
   iedereen ziet die er binnenloopt.

   WAT ER WEL IN STAAT:
   - welke stadsafdelingen er zijn en of ze open zijn;
   - wat er in een stad loopt: projectnaam, soort en doelgroep -- de dingen die
     ook op een flyer zouden staan;
   - welke activiteiten OPEN staan, met datum, plek en of er nog plek is;
   - hoe je hulp vraagt en hoe je meedoet als vrijwilliger of ondernemer;
   - de landelijke campagnes die lopen.

   WAT ER MET OPZET NIET IN STAAT:
   - geen enkel getal over hulpvragen. Niet per soort, niet per buurt, niet
     totaal. De gemeente krijgt die geteld en met een k-drempel (gemeente.js);
     de straat krijgt ze niet, want daar is geen drempel hoog genoeg;
   - geen namen van vrijwilligers, deelnemers, partners-contactpersonen of
     hulpverleners;
   - geen bedragen per project. Wat een project kost is verantwoording en die
     hoort bij wie het betaalde;
   - geen projecten in de aanvraagfase. Een idee dat nog niet is goedgekeurd,
     is geen belofte die je in de buurt neerlegt.

   EEN STAD DIE NIET ACTIEF IS, STAAT ER NIET OP. Verkend, in oprichting of
   geblokkeerd: dan is er niets te melden en zeggen we dat ook zo. */

module.exports = (ctx) => {
  const { S, stadVan } = ctx;

  const openbaar = s => s.status === 'actief';

  /* Het overzicht: waar is RTF, en wat kun je daar. Zonder cijfers over mensen. */
  function steden() {
    return { ok: true,
      wat: 'De RTFoundation werkt per stad samen met lokale stichtingen, buurthuizen, scholen en ondernemers.',
      steden: S().steden.filter(openbaar).map(s => ({
        id: s.id, naam: s.naam, land: s.land,
        // wat er in deze stad te doen is, uitgedrukt in soorten werk en niet in
        // aantallen: "hier is een huiswerkklas" is nuttig, "hier zijn 31 kinderen
        // met huiswerkachterstand" is een etiket op een wijk
        soorten: [...new Set(S().projecten.filter(p => p.stad === s.id && p.status === 'actief')
          .map(p => p.soort))].sort()
      })) };
  }

  function stad(id) {
    const s = stadVan(id);
    if (!s) return { status: 404, error: 'Deze stadsafdeling kennen we niet.' };
    if (!openbaar(s)) {
      return { status: 404, error: 'RTF ' + s.naam + ' is nog niet open. Zodra de afdeling van start gaat, staat hier wat er te doen is.' };
    }
    const vandaag = new Date().toISOString().slice(0, 10);
    const projecten = S().projecten.filter(p => p.stad === s.id && p.status === 'actief')
      .map(p => ({ naam: p.naam, soort: p.soort, doelgroep: p.doelgroep, van: p.van, tot: p.tot }));
    /* Alleen activiteiten die OPEN staan voor inschrijving en nog moeten
       komen. Een volle of afgelopen activiteit in een publiek scherm levert
       alleen teleurstelling op; dat "vol" wordt hier wel gemeld, want anders
       staat er iemand voor niets voor de deur. */
    const activiteiten = S().activiteiten.filter(a => a.stad === s.id &&
      ['open', 'vol'].includes(a.status) && (!a.wanneer || a.wanneer >= vandaag))
      .map(a => ({ naam: a.naam, soort: a.soort, wanneer: a.wanneer, tijd: a.tijd,
        locatie: a.locatie, vol: a.status === 'vol',
        plekVrij: Math.max(0, a.capaciteit - (a.inschrijvingen || [])
          .filter(i => i.status === 'ingeschreven' || i.status === 'aanwezig').length) }));
    return { ok: true,
      stad: { naam: s.naam, land: s.land },
      projecten, activiteiten,
      meedoen: {
        hulp: 'Hulp nodig? Loop binnen bij een activiteit hierboven of vraag ernaar bij het buurthuis. ' +
          'Wij leggen niets vast zonder dat u weet wat er wordt vastgelegd en waarvoor.',
        vrijwilliger: 'Meedoen als vrijwilliger kan in elke stad. Voor werk met kinderen en ouderen ' +
          'vragen we een VOG; die regelen we samen en betalen wij.',
        ondernemer: 'Ondernemers doen mee met geld, producten, ruimte, vervoer, stageplekken of maaltijden. ' +
          'Wat u geeft, koppelen we aan een project en u hoort waar het terechtkwam.'
      } };
  }

  /* De landelijke campagnes die lopen. Zonder opgehaalde bedragen: een
     thermometer werkt als aansporing en dat is precies het soort druk dat we
     niet op mensen willen zetten (zie de merkregels: geen kunstmatige urgentie). */
  function campagnes() {
    return { ok: true, campagnes: S().campagnes.filter(c => c.status === 'live')
      .map(c => ({ naam: c.naam, doel: c.doel, van: c.van, tot: c.tot,
        steden: (c.sleutel || []).map(x => (stadVan(x.stad) || {}).naam).filter(Boolean) })) };
  }

  return { steden, stad, campagnes };
};

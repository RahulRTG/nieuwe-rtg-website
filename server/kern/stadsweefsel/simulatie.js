/* RTG Stadsweefsel, deel "simulatie": de wat-als-vraag, op één plek.

   De afhankelijkheidsgraaf beantwoordde er al een: wat valt er mee om als DIT
   object uitvalt. Maar een bestuurder stelt de vraag zelden zo. Hij vraagt: wat
   gebeurt er als deze weg een week dicht is, hoeveel drukte geeft dat
   evenement, welke wijken worden kwetsbaar bij een storing, wat als het drie
   dagen hard regent.

   Vier vormen, één ingang (`scenarioDraai`), zodat de boardroom één knop heeft en
   niet vier schermen die elk net iets anders rekenen:

     uitval        een object valt weg -> de keten eronder
     wegafsluiting een straatsegment dicht -> wat staat eraan, wat verliest zijn
                   halte, welke omweg blijft er binnen de zone
     evenement     bezoekers in een zone -> de belasting per domein, afgezet
                   tegen wat er FYSIEK staat (containers, haltes, laadpunten)
     klimaat       extreme regen, hitte, droogte, hoogwater (via ./klimaat.js)

   DE EERLIJKHEID ZIT IN DE NOEMER. Een simulatie die zegt "de afvaldruk stijgt
   met 240%" klinkt precies en betekent niets. Deze rekent met wat er ECHT in
   het register staat -- zoveel containers, zoveel liter, zoveel bezoekers per
   container -- en zet het resultaat naast die aantallen, zodat je kunt zien
   waarop het rust en waar het onzin wordt. De aannames staan bij elke uitkomst
   met naam en getal.

   NIETS HIERVAN VERANDERT DE STAD. Geen regime, geen scenario, geen werkorder.
   Krijgt de gedeelde ctx van kern/stadsweefsel/index.js. */

// aannames, met naam, zodat ze te bestrijden zijn in plaats van verstopt
const AANNAME = {
  afvalPerBezoeker: 0.35,      // liter restafval per bezoeker per dagdeel
  containerLiter: 3000,        // inhoud van een ondergrondse container
  bezoekersPerHalte: 900,      // wat een halte per dagdeel aankan
  kwPerHonderdBezoekers: 4,    // extra netbelasting (verlichting, horeca, geluid)
  dbBijDrukte: 6               // hoeveel dB drukte er in een zone bovenop komt
};

module.exports = (ctx) => {
  const { geo, obj, afh, kli } = ctx;

  /* Een weg dicht. Wat staat eraan, welke haltes vallen weg, en blijft er
     binnen de zone nog een verbinding over? Die laatste vraag is de enige die
     ertoe doet en tegelijk de enige die een kaart zonder netwerk niet kan
     beantwoorden. */
  function wegafsluiting({ gebied, dagen }) {
    const seg = geo.gebied(gebied);
    if (!seg || seg.niveau !== 'straatsegment')
      return { status: 400, error: 'Kies een straatsegment; een hele zone afsluiten is geen wegafsluiting.' };
    const zone = geo.pad(seg.id).find(g => g.niveau === 'zone');
    const eraan = obj.zoek({ gebied: seg.id });
    const haltes = eraan.filter(o => o.soort === 'halte');
    const anders = geo.kinderen(zone.id).filter(g => g.id !== seg.id);
    const kritiek = eraan.filter(o => ['hoog', 'kritiek'].includes(o.risico));
    const meesleep = eraan.map(o => ({ o, n: afh.benedenstrooms(o.id).rij.length })).filter(x => x.n > 0);
    return {
      status: 200, soort: 'wegafsluiting', straat: seg.naam, zone: zone ? zone.naam : null,
      dagen: Number(dagen) > 0 ? Math.round(Number(dagen)) : 7,
      objecten: eraan.length, haltesWeg: haltes.map(h => h.naam),
      kritiek: kritiek.map(o => ({ naam: o.naam, soort: o.soort, risico: o.risico })),
      alternatieven: anders.map(g => g.naam),
      gevolgen: [
        eraan.length + ' geregistreerde objecten staan aan dit segment' + (eraan.length ? ' (' + eraan.slice(0, 4).map(o => o.naam).join(', ') + (eraan.length > 4 ? ', ...' : '') + ')' : ''),
        haltes.length ? haltes.length + ' OV-halte(s) vervallen; reizigers wijken uit naar een andere halte in ' + (zone ? zone.naam : 'de zone') : 'Er vervalt geen OV-halte',
        anders.length ? 'Binnen ' + zone.naam + ' blijft ' + anders.map(g => g.naam).join(' en ') + ' als verbinding over'
          : 'LET OP: dit is het enige geregistreerde segment in deze zone; er blijft geen alternatief over',
        meesleep.length ? meesleep[0].o.naam + ' voedt of stuurt ' + meesleep[0].n + ' ander(e) object(en); werk aan dit segment raakt die ook' : null
      ].filter(Boolean),
      let_op: 'Gerekend op het geregistreerde wegennet van het weefsel, niet op verkeersintensiteiten -- er zit geen verkeersmodel onder.'
    };
  }

  /* Een evenement. De vraag is niet "hoeveel mensen" maar "houdt wat er staat
     dat vol": genoeg containers, genoeg haltes, past het op het net. */
  function evenement({ gebied, bezoekers, uren }) {
    const g = geo.gebied(gebied);
    if (!g) return { status: 404, error: 'Onbekend gebied.' };
    const n = Number(bezoekers) > 0 ? Math.round(Number(bezoekers)) : 2000;
    const u = Number(uren) > 0 ? Math.round(Number(uren)) : 6;
    const containers = obj.zoek({ gebied: g.id, soort: 'container' });
    const haltes = obj.zoek({ gebied: g.id, soort: 'halte' });
    const laadpalen = obj.zoek({ gebied: g.id, soort: 'laadpaal' });

    const afvalLiter = Math.round(n * AANNAME.afvalPerBezoeker);
    const capaciteit = containers.length * AANNAME.containerLiter;
    const halteDruk = haltes.length ? Math.round(n / (haltes.length * AANNAME.bezoekersPerHalte) * 100) : null;
    const extraKw = Math.round(n / 100 * AANNAME.kwPerHonderdBezoekers);

    const knelpunten = [];
    if (afvalLiter > capaciteit) knelpunten.push('Afval: ' + afvalLiter + ' liter tegen ' + capaciteit + ' liter containerinhoud (' + containers.length + ' containers). Plan een extra ophaalronde tijdens en na afloop.');
    if (halteDruk == null) knelpunten.push('Er staat geen OV-halte in dit gebied; alle bezoekers komen te voet, per fiets of met de auto aan.');
    else if (halteDruk > 100) knelpunten.push('OV: de haltes hier zitten op ' + halteDruk + '% van wat ze aankunnen (' + haltes.length + ' halte(s)). Extra ritten of een tijdelijke halte.');
    if (!laadpalen.length && n >= 2000) knelpunten.push('Geen laadpunten in dit gebied terwijl er duizenden bezoekers komen.');
    if (!knelpunten.length) knelpunten.push('Wat er staat lijkt toereikend voor dit aantal bezoekers.');

    return { status: 200, soort: 'evenement', gebied: g.id, gebiedNaam: g.naam, bezoekers: n, uren: u,
      staat: { containers: containers.length, haltes: haltes.length, laadpalen: laadpalen.length },
      verwacht: { afvalLiter, containercapaciteitLiter: capaciteit, halteBezettingPct: halteDruk,
        extraNetbelastingKw: extraKw, geluidBovenopDb: AANNAME.dbBijDrukte },
      knelpunten, aannames: AANNAME,
      advies: 'Het scenario "evenement" op het stadsbord zet verkeer op streng, ophalen op intensief en de netten op piek; dat is de knop die hierbij hoort.',
      let_op: 'De aannames staan er met naam en getal bij. Klopt er een niet voor dit evenement, dan klopt de uitkomst ook niet -- dat is beter dan een getal zonder herkomst.' };
  }

  /* Eén ingang. Een boardroom die vier verschillende knoppen heeft voor
     dezelfde vraag, krijgt vier verschillende antwoorden. */
  function scenarioDraai(inv) {
    inv = inv || {};
    const soort = String(inv.soort || '');
    if (soort === 'uitval') return afh.api.weefselUitval({ id: inv.id, minuten: inv.minuten });
    if (soort === 'wegafsluiting') return wegafsluiting(inv);
    if (soort === 'evenement') return evenement(inv);
    if (soort === 'klimaat') return kli.api.weefselKlimaatScenario({ naam: inv.naam, ernst: inv.ernst });
    return { status: 400, error: 'Kies een simulatie: uitval, wegafsluiting, evenement of klimaat.' };
  }

  return {
    AANNAME, wegafsluiting, evenement,
    api: {
      weefselSimuleer: scenarioDraai,
      weefselSimulaties: () => ({ status: 200, soorten: [
        { soort: 'uitval', vraagt: 'id (een object)', wat: 'wat valt er mee om' },
        { soort: 'wegafsluiting', vraagt: 'gebied (een straatsegment), dagen', wat: 'wat staat eraan en blijft er een verbinding over' },
        { soort: 'evenement', vraagt: 'gebied, bezoekers, uren', wat: 'houdt wat er staat het vol' },
        { soort: 'klimaat', vraagt: 'naam (extreme-regen, hittegolf, droogte, hoogwater), ernst', wat: 'welke objecten staan als eerste onder druk' }
      ], aannames: AANNAME })
    }
  };
};

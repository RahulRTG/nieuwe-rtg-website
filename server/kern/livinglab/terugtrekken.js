/* ============================================================================
   TERUGTREKKEN -- wat er verdwijnt, wat er blijft, en wat dat met de conclusies
   doet.

   EEN KNOP "VERWIJDER MIJN GEGEVENS" IS EEN HALVE BELOFTE. Wie zich terugtrekt
   uit een onderzoek hoort te weten wat dat werkelijk betekent: welk deel echt
   weg kan, welk deel al is opgegaan in iets dat niet meer uit elkaar te halen
   is, en -- het belangrijkste -- wat er verandert aan wat het onderzoek beweert.

   DAT LAATSTE IS HIER GEEN STATISTIEK MAAR DE BEWIJSLADDER VAN DIT LAB. Een
   conclusie draagt bewijs (./bewijs.js), en dat bewijs kan een observatie van
   deze deelnemer zijn. Valt die weg, dan zakt het plafond van die conclusie
   (./graden.js) -- en dat is exact narekenbaar, vooraf, zonder iets te wissen.
   Wat hier NIET gebeurt is een steekproefomvang, een effectgrootte of een
   p-waarde herrekenen: die analyse gebeurt buiten dit systeem, en een getal
   verzinnen dat wetenschappelijk klinkt is erger dan geen getal (BESTUUR.md).

   DE VOLGORDE IS HET ONTWERP. Eerst `gevolg()` -- kijken zonder iets te
   veranderen. Dan pas `voerUit()`. Een deelnemer die pas ná het wissen hoort wat
   er is gebeurd, heeft geen keuze gehad maar een mededeling gekregen.

   DRIE DINGEN DIE BLIJVEN, EN WAAROM:

     de auditregel   dát er is teruggetrokken, met aantallen -- nooit met inhoud.
                     Een intrekking zonder spoor is niet te controleren; een spoor
                     mét inhoud maakt de intrekking ongedaan.
     de datasets     een dataset is een momentopname. Wat erin is opgegaan, is er
                     niet meer los uit te halen -- en dat wordt hier gezegd in
                     plaats van stilzwijgend gelaten.
     de conclusies   die blijven staan, maar zakken waar hun bewijs wegvalt. Een
                     conclusie wissen omdat een deelnemer vertrekt, zou het
                     onderzoek herschrijven; hem laten staan op een graad die
                     niet meer klopt, zou liegen.
   ========================================================================== */
'use strict';

const graden = require('./graden');
const kader = require('./kader');
const rangVan = (g) => (kader.graad(g) || kader.graad('aanname')).rang;

module.exports = (ctx) => {
  const { nu, rid, schoon, audit, vindStudie, save } = ctx;

  const van = (s, alias) => ({
    observaties: s.dossier.observaties.filter(o => o.door === alias),
    metingen: (s.dossier.metingen || []).filter(m => m.alias === alias)
  });

  /* WAT ER GEBEURT ALS DEZE DEELNEMER ZICH TERUGTREKT -- gerekend, niet gewist.

     De conclusies worden nagerekend met het bewijs dat OVERBLIJFT: elke
     bewijsdrager die naar een observatie van deze deelnemer wijst, valt weg, en
     daarna zegt ./graden.js wat het plafond dan nog is. Dat is dezelfde
     rekensom die na het wissen echt loopt -- niet een schatting ernaast. */
  function gevolg(studieId, alias) {
    const s = vindStudie(studieId); if (!s) return { status: 404, error: 'Dit onderzoek bestaat niet.' };
    const a = schoon(alias, 40);
    const deelnemer = s.dossier.deelnemers.find(x => x.alias === a);
    if (!deelnemer) return { status: 404, error: 'Deze deelnemer staat niet op dit onderzoek.' };
    const mijn = van(s, a);
    const ids = new Set(mijn.observaties.map(o => o.id));

    const conclusies = s.dossier.conclusies.map(c => {
      const weg = (c.bewijs || []).filter(w => w.soort === 'observatie' && ids.has(w.ref));
      const na = Object.assign({}, c, { bewijs: (c.bewijs || []).filter(w => !weg.includes(w)) });
      const nu_ = graden.plafond(s, c).graad;
      const straks = graden.plafond(s, na).graad;
      /* De HUIDIGE graad van de conclusie telt ook mee: een conclusie die al
         lager staat dan haar plafond, zakt niet verder door dit vertrek. */
      const staat = c.graad || 'aanname';
      /* Zakt hij ECHT? Alleen als het nieuwe plafond onder de graad ligt die er
         nu staat. Een conclusie die al lager staat dan haar plafond, zakt niet
         door dit vertrek -- en dan hoort er ook niet te staan dat het gebeurt. */
      const zakt = !!(weg.length && straks.rang < rangVan(staat));
      return { id: c.id, tekst: c.tekst, graad: staat,
        dragersWeg: weg.length,
        graadNa: zakt ? straks.graad : staat,
        zakt,
        reden: weg.length ? graden.plafond(s, na).reden : null };
    });

    return { ok: true, alias: a, studie: { id: s.id, nummer: s.nummer || null, titel: s.titel },
      verdwijnt: {
        observaties: mijn.observaties.length,
        metingen: mijn.metingen.length,
        metingenPerVersie: mijn.metingen.reduce((o, m) => { o[m.protocolversie] = (o[m.protocolversie] || 0) + 1; return o; }, {}),
        deelname: 'uw plek in dit onderzoek en de koppeling met uw labpas'
      },
      conclusies: conclusies.filter(c => c.dragersWeg > 0),
      conclusiesTotaal: conclusies.length,
      blijft: {
        datasets: s.dossier.datasets.length,
        datasetUitleg: s.dossier.datasets.length
          ? 'Een dataset is een momentopname. Wat daarin is opgegaan, is er niet meer los uit te halen; uw bijdrage aan die ' + s.dossier.datasets.length + ' dataset(s) verdwijnt dus niet.'
          : 'Er zijn nog geen datasets gemaakt, dus er is niets waarin uw bijdrage al is opgegaan.',
        spoor: 'Er blijft een regel staan DAT u zich heeft teruggetrokken, met aantallen en zonder inhoud. Zonder die regel is een intrekking niet te controleren; mét inhoud zou hij de intrekking ongedaan maken.'
      },
      nietTeZeggen: 'Wat dit met de statistiek van het onderzoek doet -- steekproef, effectgrootte, betrouwbaarheid -- rekent RTG niet uit. Die analyse gebeurt buiten dit systeem, en een getal verzinnen dat wetenschappelijk klinkt is erger dan geen getal.',
      let: 'Dit is een vooruitblik. Er is nog niets weggehaald.' };
  }

  /* HET UITVOEREN. Alles wat `gevolg()` aankondigt gebeurt hier, in die volgorde,
     en de conclusies worden na afloop herijkt zodat een graad niet blijft staan
     op bewijs dat er niet meer is. */
  function voerUit(studieId, alias, wie) {
    const g = gevolg(studieId, alias);
    if (g.error) return g;
    const s = vindStudie(studieId);
    const a = g.alias;
    const ids = new Set(s.dossier.observaties.filter(o => o.door === a).map(o => o.id));

    s.dossier.observaties = s.dossier.observaties.filter(o => o.door !== a);
    if (Array.isArray(s.dossier.metingen)) s.dossier.metingen = s.dossier.metingen.filter(m => m.alias !== a);
    s.dossier.deelnemers = s.dossier.deelnemers.filter(x => x.alias !== a);
    /* Het bewijs dat naar zijn observaties wees, valt mee weg -- anders wijst een
       conclusie naar iets dat niet meer bestaat, en dat is erger dan een lagere
       graad: dan lijkt het bewijs er nog te zijn. */
    const gezakt = [];
    for (const c of s.dossier.conclusies) {
      const voor = (c.graad || 'aanname');
      c.bewijs = (c.bewijs || []).filter(w => !(w.soort === 'observatie' && ids.has(w.ref)));
      const p = graden.plafond(s, c).graad;
      if (rangVan(voor) > p.rang) {
        c.graad = p.graad; c.herijkt = nu();
        if (c.tekenaar && !graden.handtekeningNodig(s, p)) c.tekenaar = null;
        gezakt.push({ id: c.id, van: voor, naar: p.graad });
      }
    }

    /* DE TERUGTREKKING ZELF WORDT GETELD, en dat is meer dan boekhouding: een
       onderzoek waaruit twaalf mensen zijn vertrokken, is een ander onderzoek dan
       een waaruit niemand vertrok. ./impact.js kan dit later tonen naast de
       gestopte studies en de herziene conclusies. */
    if (!Array.isArray(s.dossier.terugtrekkingen)) s.dossier.terugtrekkingen = [];
    s.dossier.terugtrekkingen.unshift({ id: rid(), at: nu(),
      observaties: g.verdwijnt.observaties, metingen: g.verdwijnt.metingen,
      conclusiesGezakt: gezakt.length, door: schoon(wie, 80) || 'deelnemer zelf' });

    if (ctx.mensen && ctx.mensen.koppelWeg) ctx.mensen.koppelWeg(a, s.id);
    audit(s.labId, 'mens.weg', wie, s.id,
      a + ': ' + g.verdwijnt.observaties + ' observaties en ' + g.verdwijnt.metingen + ' metingen gewist, '
      + gezakt.length + ' conclusie(s) gezakt');
    s.dossier.logboek.unshift({ id: rid(),
      tekst: 'Deelnemer ' + a + ' trok zich terug; ' + g.verdwijnt.observaties + ' observaties en '
        + g.verdwijnt.metingen + ' metingen zijn gewist'
        + (gezakt.length ? ', ' + gezakt.length + ' conclusie(s) zakten in bewijsgraad' : '') + '.',
      wie: schoon(wie, 80) || 'lab', at: nu() });
    save();
    return { ok: true, gewist: g.verdwijnt.observaties, metingen: g.verdwijnt.metingen, gezakt,
      let: 'U bent uit dit onderzoek gehaald. Wat in een dataset was opgegaan, blijft daarin zitten; de regel dat u zich terugtrok blijft staan, zonder inhoud.' };
  }

  return { gevolg, voerUit };
};

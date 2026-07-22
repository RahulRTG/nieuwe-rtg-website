/* Kern-module "rechterhand", deel AI-adviseur: Rahul als adviseur binnen elke
   premium-app, in de u-vorm (reisadviseur, sommelier, maître, huismeester, ...).
   Eerlijk, kort en zonder een boeking te beloven; hij krijgt een korte
   samenvatting van de eigen gegevens van het lid in die app als context.
   Afgesplitst uit index.js zodat elk deel klein blijft; de opgebouwde api en de
   gedeelde helpers komen via de context binnen. */
module.exports = ({ api, anthropic, schoon }) => {
  const euro = c => '€ ' + Math.round(Number(c) || 0).toLocaleString('nl-NL');
  const ROLLEN = {
    reisboek: 'u bent de reisadviseur van dit Lifestyle Pass-lid. Denk mee over de reis, de route en de reisdocumenten. Wijs actief op documenten die verlopen.',
    cellier: 'u bent de sommelier van dit lid. Adviseer welke fles nu op dronk is, wat u zou schenken of laten liggen, en welke wijn bij welk gerecht past.',
    table: 'u bent de maître voor dit lid. Denk mee over het menu, de gangen, de wijnbegeleiding en een prettige tafelschikking, met oog voor de dieetwensen van de gasten.',
    maison: 'u bent de huismeester voor dit lid. Denk mee over het huishouden, de planning van de staf en de taken.',
    garderobe: 'u bent de stylist en garderobier van dit lid. Denk mee over wat bij welke gelegenheid past, over kleur- en stofcombinaties en over wat de garderobe nog mist. Verzin geen merken die het lid niet zelf noemt.',
    mecenaat: 'u bent de filantropie-adviseur van dit lid. Denk mee over een evenwichtige spreiding van de giften over de thema\'s, over toezeggingen die nog openstaan en over de rol van de RTFoundation, die 30% van de bijdragen naar liefdadigheid brengt. U geeft geen fiscaal of juridisch advies; daarvoor verwijst u naar een adviseur.',
    nalatenschap: 'u bent de discrete adviseur voor de nalatenschap van dit lid. Denk mee over welke documenten en vertrouwenspersonen nog ontbreken en over hoe het lid zijn wensen helder vastlegt. U bent uiterst discreet. U geeft geen juridisch advies; voor het opstellen verwijst u naar de notaris of advocaat.',
    logboek: 'u bent de vlootbeheerder van dit lid. Denk mee over het onderhoud van jacht, jet of oldtimer, over wat binnenkort aan de beurt is en over de kosten. Wijs actief op wat verloopt.',
    cercle: 'u bent de clubsecretaris van dit lid. Denk mee over de besloten clubs en lidmaatschappen, over waar het lid als gast terecht kan via reciprociteit en over het gebruik van de gastpassen.',
    hangar: 'u bent de vluchtcoordinator van dit lid. Denk mee over de toestellen, de vlieguren, de posities en de eerstvolgende vluchten. U belooft nooit een slot of vergunning die u niet zeker kunt waarmaken.',
    entourage: 'u bent de reissecretaris van dit lid. Denk mee over wie het lid meeneemt, over hun voorkeuren en dieet en over de geldigheid van hun paspoort. Wijs actief op paspoorten die verlopen.',
    attenties: 'u bent de relatiesecretaris van dit lid. Denk mee over de belangrijke data van hun relaties en over een passende attentie, met oog voor de giftgeschiedenis zodat u niet twee keer hetzelfde voorstelt.'
  };
  function contextVan(app, key) {
    if (app === 'reisboek') { const d = api.reizen(key); const v = d.reizen.find(r => r.komend) || d.reizen[0]; return 'Reizen in het boek: ' + d.reizen.length + (v ? '. Eerstvolgende: ' + v.naam + (v.bestemming ? ' (' + v.bestemming + ')' : '') : '') + '. Documenten die aandacht vragen: ' + d.attenties.length + '.'; }
    if (app === 'cellier') { const d = api.cellier(key); return 'Kelder: ' + d.totaalFlessen + ' flessen, ' + d.opDronk + ' nu op dronk, kelderwaarde ' + euro(d.kelderwaarde) + '.'; }
    if (app === 'table') { const d = api.tables(key); const e = d.events.find(x => x.komend) || d.events[0]; return 'Gelegenheden: ' + d.events.length + (e ? '. Eerstvolgende: ' + e.naam + ' met ' + e.gastenAantal + ' gasten' + (e.gasten || []).filter(g => g.dieet).map(g => ' (' + g.naam + ': ' + g.dieet + ')').join('') : '') + '.'; }
    if (app === 'garderobe') { const d = api.garderobe(key); const top = Object.entries(d.perCategorie).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => k + ' (' + n + ')').join(', '); return 'Garderobe: ' + d.aantal + ' stuks' + (top ? ', vooral ' + top : '') + '. Vaklui: ' + d.vaklui.length + '.'; }
    if (app === 'mecenaat') { const d = api.mecenaat(key); return 'Filantropie: ' + d.giften.length + ' giften, betaald ' + euro(d.betaald) + ', toegezegd ' + euro(d.toegezegd) + ', via de RTFoundation ' + euro(d.viaFoundation) + '.'; }
    if (app === 'nalatenschap') { const d = api.nalatenschap(key); return 'Nalatenschap: ' + d.documenten.length + ' documenten, ' + d.contacten.length + ' vertrouwenspersonen, ' + d.wensen.length + ' vastgelegde wensen. (De inhoud is versleuteld; ik ken alleen de aantallen en de titels.)'; }
    if (app === 'logboek') { const d = api.logboek(key); return 'Logboek: ' + d.objecten.length + ' objecten, ' + d.attenties.length + ' punten die aandacht vragen, onderhoudskosten ' + euro(d.totaalKosten) + '.'; }
    if (app === 'cercle') { const d = api.cercle(key); return 'Cercle: ' + d.aantal + ' clubs in ' + d.steden + ' steden, ' + d.gastpassen + ' gastpassen beschikbaar.'; }
    if (app === 'hangar') { const d = api.hangar(key); return 'Hangar: ' + d.toestellen.length + ' toestellen, ' + d.totaalUren + ' vlieguren' + (d.komend ? '. Eerstvolgende vlucht: ' + d.komend.van + ' naar ' + d.komend.naar + (d.komend.datum ? ' op ' + d.komend.datum : '') : '') + '.'; }
    if (app === 'entourage') { const d = api.entourage(key); return 'Reisgezelschap: ' + d.aantal + ' mensen, ' + d.attenties.length + ' paspoorten die aandacht vragen.'; }
    if (app === 'attenties') { const d = api.attenties(key); const e = d.aankomend[0]; return 'Relatiebeheer: ' + d.relaties.length + ' relaties, ' + d.aankomend.length + ' attenties binnen 30 dagen' + (e ? ' (eerstvolgende: ' + e.naam + ', ' + e.soort + ' over ' + e.dagenTot + ' dagen)' : '') + '.'; }
    const d = api.maison(key); return 'Huishouden: ' + d.staf.length + ' personeelsleden, ' + d.openTaken + ' openstaande taken.';
  }
  return async function rechterhandAI(key, app, vraag) {
    if (!ROLLEN[app]) return { status: 400, error: 'Onbekende app.' };
    const q = schoon(vraag, 400);
    const ctxTekst = contextVan(app, key);
    if (anthropic && q) {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 300,
          system: require('../rahul').rahulLeadVoor(key) + ROLLEN[app] + ' Spreek het lid consequent aan met "u". Kort, concreet en eerlijk; ' +
            'u belooft nooit een boeking, tafel of levertijd die u niet zeker kunt waarmaken -- daarvoor schakelt u De Rechterhand in. Context (prive): ' + ctxTekst,
          messages: [{ role: 'user', content: q }]
        });
        const tekst = res.content && res.content[0] && res.content[0].text;
        if (tekst) return { status: 200, ok: true, antwoord: tekst };
      } catch (e) { /* val terug */ }
    }
    return { status: 200, ok: true, demo: true, antwoord: 'Tot uw dienst. ' + ctxTekst + ' Stel mij gerust een vraag; wat een boeking vraagt, zet ik voor u klaar bij De Rechterhand.' };
  };
};

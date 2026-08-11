/* Life Command, deel "voorstellen": wat Rahul klaarzet, en wat de mens bevestigt.

   HIER STAAT HET WERKWOORD VAN DEZE WERELD IN CODE (LIFE.md par. 3):

   > Life OS stelt samen en zet klaar. Bevestigen doet de mens.

   RTG Geld mag binnen beleid uitvoeren omdat de grens daar het EIGEN TEGOED is.
   Hier is de grens een ANDER MENS, en dat is een wezenlijk verschil: een
   antwoord op een bijeenkomst wordt door een groep gezien, en bij een volle
   bijeenkomst kost uw "ja" iemand anders zijn plaats. Zoiets loopt nooit
   vanzelf, ongeacht welke regel een lid ooit instelt.

   EEN VOORSTEL WORDT NIET BEWAARD, en dat is de belangrijkste keuze in dit
   bestand. Hij wordt elke keer opnieuw AFGELEID uit het beeld van de graaf, met
   een id dat uit de zaak zelf volgt. Een voorraad openstaande voorstellen zou
   verouderen: de bijeenkomst is afgelast, de groep is verlaten, iemand anders
   nam de laatste plaats -- en dan bevestigt een mens iets dat niet meer bestaat.
   Nu is een voorstel dat niet meer geldt er simpelweg niet meer, en bevestigen
   loopt schoon stuk in plaats van stilletjes goed.

   WAT ER GEEN VOORSTEL MAG ZIJN, en dit is de grens die telt. Alles wat de
   RELATIE stuurt: "u sprak Sam al drie maanden niet, stuur eens iets", "tijd om
   deze groep weer eens bijeen te roepen", "nodig X ook uit". Dat is precies de
   trechter uit LIFE.md par. 4.1 en het aandacht-bedelen uit CLAUDE.md. Een
   voorstel hangt aan een OPENSTAANDE ZAAK die er al ligt -- iemand vroeg iets en
   u heeft nog niet geantwoord -- en nooit aan een gevoel over hoe het gaat
   tussen twee mensen. */
'use strict';

/* De soorten voorstel die dit huis kent. Meer zijn het er niet, en een soort
   erbij is een besluit: elke soort hier voert iets uit dat een ANDER mens
   bereikt, en hoort dus tegen par. 3 en par. 4.1 gehouden te worden voordat hij
   erin komt.

   `keuzes` is wat de mens moet kiezen om te bevestigen. Een voorstel zonder
   keuze bestaat niet: dan zou bevestigen een enkele knop zijn die het systeem
   al had ingevuld, en dat is klaarzetten dat stiekem uitvoeren werd. */
const SOORTEN = {
  antwoord: {
    wat: 'Laten weten of u komt',
    keuzes: ['ja', 'misschien', 'nee']
  }
};

module.exports = ({ kern }) => {

  /* De openstaande zaken van dit lid, als voorstel. Vandaag is dat er een: een
     bijeenkomst uit een eigen genootschap waar nog geen antwoord op staat. Hij
     komt uit dezelfde bron als de graaf (bijeenkomst.mijnAgenda) en wordt hier
     niet nog een keer opgehaald uit de ruwe opslag. */
  function voorstellen(key) {
    const uit = [], stil = [];
    try {
      const a = kern.bijeenkomst.mijnAgenda({ key }) || {};
      for (const b of (a.komt || [])) {
        if (b.afgelast) continue;
        if (b.mijnAntwoord) continue;
        uit.push({
          id: 'antwoord:' + b.groepId + ':' + b.id,
          soort: 'antwoord',
          wat: SOORTEN.antwoord.wat,
          keuzes: SOORTEN.antwoord.keuzes.slice(),
          titel: b.wat,
          wanneer: b.datum,
          tijd: b.tijd || null,
          wie: b.groep,
          /* DE VERANTWOORDING REIST MEE (GELD.md par. 5). Niet "Rahul stelt
             voor" maar: dit staat er omdat DIT er ligt. Zonder die regels is een
             voorstel een opdracht met een vriendelijke toon. */
          gegevens: [
            'Genootschap ' + b.groep + ': bijeenkomst "' + b.wat + '" op ' + b.datum,
            'uw antwoord: nog geen',
            b.vol ? 'let op: het is vol' : 'gastheer: ' + (b.gastheer || 'onbekend')
          ],
          /* WAT ER GEBEURT ALS U BEVESTIGT, in gewone taal en vooraf. Een mens
             hoort te weten wat een knop doet voordat hij hem indrukt, en zeker
             als er een ander mens achter zit. */
          gevolg: 'Uw antwoord komt bij ' + b.groep + ' te staan; de anderen zien dat u ' +
            'wel of niet komt.'
        });
      }
    } catch (e) { stil.push('bijeenkomsten'); }
    return { voorstellen: uit, stil };
  }

  /* UITVOEREN, en alleen na een expliciete keuze van de mens. Dit is de enige
     functie in de hele sociale wereld die iets verandert, en ze doet het via het
     DOMEIN -- niet met een eigen schrijfactie erlangs. Zou ze zelf schrijven,
     dan bestond een antwoord op twee plekken.

     Het voorstel wordt opnieuw afgeleid en niet uit een voorraad gehaald: wat
     niet meer op de lijst staat, kan niet bevestigd worden. */
  function bevestig(key, id, keuze) {
    const lijst = voorstellen(key).voorstellen;
    const v = lijst.find(x => x.id === String(id || ''));
    if (!v) return { status: 404, error: 'Dit voorstel staat niet (meer) open.' };
    if (!v.keuzes.includes(String(keuze || ''))) {
      return { status: 400, error: 'Kies een van: ' + v.keuzes.join(', ') + '.' };
    }
    const deel = v.id.split(':');
    const r = kern.bijeenkomst.antwoord({ key }, deel[1], deel[2], String(keuze));
    if (r && r.error) return { status: r.status || 400, error: r.error };
    return { status: 200, ok: true, voorstel: v, keuze: String(keuze) };
  }

  return { voorstellen, bevestig, SOORTEN };
};

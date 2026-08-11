/* Geldbeleid, deel "evalueer": de wandeling langs het AANstaande beleid.

   De aanroeper (de cockpit-route) geeft een beeld uit de geldgraaf mee:
   { vrijCenten, bufferMaanden, maandUitCenten, feiten }. De uitkomst is een
   kale lijst uitzonderingen [{ id, soort, titel, centen, uitleg, gegevens,
   niveau, actie }] -- uitzonderingsgestuurd (ONTWERP.md): een leeg antwoord
   betekent "alles binnen beleid", en dat is de beste uitkomst die er is.

   Er is EEN plek waar hier echt iets gebeurt: de maandelijkse reservering met
   niveau 'automatisch', en dat is een oormerk binnen het eigen tegoed, nooit
   een betaling. Uitzonderingen dragen daarom nooit het niveau 'automatisch':
   wat automatisch liep staat in het actielog, wat hier staat vraagt een mens.

   De bedragen in de gegevens-regels staan bewust in centen met de eenheid
   erbij: alleen het scherm maakt er euro's van, precies een keer. */

module.exports = (ctx) => {
  const { kijk, nu, potReserveer, save } = ctx;

  const getal = x => { const n = Math.round(Number(x)); return Number.isFinite(n) ? n : null; };

  function evalueer(codenaam, beeld) {
    const rec = kijk(codenaam);
    if (!rec) return [];
    const b = beeld && typeof beeld === 'object' ? beeld : {};
    const feiten = Array.isArray(b.feiten) ? b.feiten : [];
    const vrij = getal(b.vrijCenten), maandUit = getal(b.maandUitCenten);
    const uit = [];
    /* een regel zonder cijfer valt niet stil (LAT.md regel 3): een buffer die
       niet te meten is, is geen gezonde buffer maar een onbekende */
    const zonderCijfer = (regel, bron) => uit.push({ id: 'uz-' + regel.id, soort: regel.soort,
      titel: 'Regel niet te toetsen', centen: null,
      uitleg: 'De bron die deze regel nodig heeft, leverde geen cijfer; de regel is deze ronde niet beoordeeld.',
      gegevens: ['beleid: ' + regel.soort, bron + ': geen cijfer'], niveau: 'kijken', actie: null });

    for (const regel of rec.regels) {
      if (!regel.aan) continue;

      if (regel.soort === 'minimumbuffer') {
        if (vrij == null) { zonderCijfer(regel, 'graaf'); continue; }
        if (vrij < regel.drempelCenten) uit.push({ id: 'uz-' + regel.id, soort: regel.soort,
          titel: 'Vrije ruimte onder de minimumbuffer', centen: regel.drempelCenten - vrij,
          uitleg: 'De vrij besteedbare ruimte ligt onder de minimumbuffer uit het beleid.',
          gegevens: ['beleid: minimumbuffer ' + regel.drempelCenten + ' centen', 'graaf: vrij besteedbaar ' + vrij + ' centen'],
          niveau: regel.niveau, actie: null });

      } else if (regel.soort === 'maanddrempel') {
        if (maandUit == null) { zonderCijfer(regel, 'graaf'); continue; }
        if (maandUit > regel.drempelCenten) uit.push({ id: 'uz-' + regel.id, soort: regel.soort,
          titel: 'Maandbesteding boven de drempel', centen: maandUit - regel.drempelCenten,
          uitleg: 'De uitgaven van deze maand liggen boven de bestedingsdrempel uit het beleid.',
          gegevens: ['beleid: maanddrempel ' + regel.drempelCenten + ' centen', 'graaf: deze maand ' + maandUit + ' centen uit'],
          niveau: regel.niveau, actie: null });

      } else if (regel.soort === 'reserveer-maandelijks') {
        // kalendermaand in UTC: dezelfde grens op elke server, en 'laatst' maakt herhaald aanroepen idempotent
        const m = nu().toISOString().slice(0, 7);
        if (regel.laatst === m) continue;
        const pot = rec.potten.find(x => x.id === regel.potId);
        if (!pot) {
          // de pot is weg maar de regel leeft nog: dat hoort luid op het scherm, niet stil in een log (LAT.md regel 5)
          uit.push({ id: 'uz-' + regel.id, soort: regel.soort, titel: 'Reservering kan niet lopen',
            centen: regel.drempelCenten, uitleg: 'De pot van deze regel bestaat niet meer; er is niets gereserveerd.',
            gegevens: ['beleid: regel ' + regel.id, 'potten: pot ' + (regel.potId || '?') + ' onbekend'],
            niveau: 'kijken', actie: null });
          continue;
        }
        // een bereikt doel wordt niet doorgevuld: rust is de uitkomst, en het begrenst wat een regel ooit kan oormerken
        if (pot.doelCenten > 0 && pot.standCenten >= pot.doelCenten) continue;
        if (regel.niveau === 'automatisch') {
          const r = potReserveer(codenaam, pot.id, regel.drempelCenten,
            { wie: 'rahul', waarom: 'maandelijkse reservering volgens regel ' + regel.id + ', door het lid vooraf op automatisch gezet' });
          if (r.ok) { regel.laatst = m; save(); }
          else uit.push({ id: 'uz-' + regel.id, soort: regel.soort, titel: 'Reservering kan niet lopen',
            centen: regel.drempelCenten, uitleg: 'De maandelijkse reservering is niet uitgevoerd: ' + r.error,
            gegevens: ['beleid: regel ' + regel.id, 'potten: ' + pot.naam + ' staat op ' + pot.standCenten + ' centen'],
            niveau: 'kijken', actie: null });
        } else {
          uit.push({ id: 'uz-' + regel.id, soort: regel.soort,
            titel: 'Maandelijkse reservering voor ' + pot.naam, centen: regel.drempelCenten,
            uitleg: regel.niveau === 'klaarzetten' ? 'De reservering staat klaar; met een bevestiging wordt het bedrag geoormerkt.'
              : regel.niveau === 'voorstellen' ? 'Rahul stelt voor het maandbedrag te oormerken; de beslissing blijft bij het lid.'
              : 'Het maandbedrag voor deze pot is deze maand nog niet geoormerkt.',
            gegevens: ['beleid: reserveer-maandelijks ' + regel.drempelCenten + ' centen',
              'potten: ' + pot.naam + ' staat op ' + pot.standCenten + ' van ' + pot.doelCenten + ' centen'],
            niveau: regel.niveau,
            /* #potten is een ANKER VOOR HET SCHERM en geen stand: de potten
               wonen in het beleid-paneel van het overzicht, dat de cockpit op
               deze klik opendoet (public/apps/geld/overzichtc.js). Wie hem
               ooit als hash naar de schil stuurt, komt op de eerste stand uit
               en denkt dat er niets gebeurde. */
            actie: regel.niveau === 'kijken' ? null : { label: 'Reserveer nu', link: '#potten' } });
        }

      } else if (regel.soort === 'gift-bevestiging') {
        /* De handeling blijft ALTIJD bij het lid: dit signaleert alleen dat
           een gift boven de drempel om een extra bevestiging vraagt. Daarom
           geen actie-knop en nooit een uitvoering, wat het niveau ook is --
           Rahul belooft en verwerkt hier niets (huisregel). 'boven' is strikt
           erboven; een richting 'in' is nooit een gift van het lid. */
        let n = 0;
        for (const f of feiten) {
          if (!f || f.richting === 'in') continue;
          const c = getal(f.centen);
          if (!(f.soort === 'gift' || f.bron === 'mecenaat') || c == null || c <= regel.drempelCenten) continue;
          uit.push({ id: 'uz-' + regel.id + '-' + (n++), soort: regel.soort,
            titel: 'Gift vraagt een extra bevestiging', centen: c,
            uitleg: 'Deze gift ligt boven de drempel uit het beleid; de beslissing blijft volledig bij het lid.',
            gegevens: ['beleid: gift-bevestiging boven ' + regel.drempelCenten + ' centen',
              (f.bron || 'mecenaat') + ': ' + String(f.titel || 'gift').slice(0, 80) + ', ' + c + ' centen'],
            niveau: regel.niveau, actie: null });
        }
      }
    }
    return uit;
  }

  return evalueer;
};

/* DE DOORBELASTING OP DE FACTUUR DIE ER AL IS.

   Eén regel op de maandfactuur van het lid, en geen tweede geldstroom. Dat is de
   regel uit WAARDE.md en hij geldt hier letterlijk: dit bestand maakt geen
   nieuwe betaalweg, geen incasso en geen eigen nummerreeks met een eigen
   boekhouding. Het zet een regel in dezelfde `invoices`-lijst waar de
   maandbijdrage ook in staat, zodat alles wat er al omheen gebouwd is -- betalen
   met de kaart, met munten, uit het RTG Pay-saldo, de PDF, de btw-aangifte --
   er zonder wijziging bij kan.

   HET IS GEEN CONTRIBUTIE, EN DAT MOET ZO BLIJVEN. kern/fonds.js herkent een
   lidmaatschapsregel aan de omschrijving en houdt daar 30% van af voor de
   RTFoundation. Verbruik is geen bijdrage: die 30% hoort er niet af, en de
   omschrijving hieronder bevat de woorden waar fonds.js op let dus bewust niet.
   Wie die tekst ooit verandert, verandert stilletjes een geldstroom.

   DE BTW KOMT UIT kern/fiscaal/tarief.js en wordt hier niet ingetikt. Een 1,21
   in dit bestand zou de vierde plek zijn waar het standaardtarief staat, en die
   lopen uiteen zodra er één verandert.

   BEDRAGEN IN EURO'S MET TWEE DECIMALEN, want dat is de vorm van de bestaande
   facturen (zie server/seed/leden.js). De kostenlaag rekent in millicenten en
   rondt hier één keer af, aan het eind, op de regel die de klant ziet. */
'use strict';

const { tariefVan } = require('../fiscaal/tarief');
const { ontleed } = require('./haak');

const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

function maandNaam(periode) {
  const m = Number(String(periode).slice(5, 7));
  return (MAAND[m - 1] || String(periode).slice(5, 7)) + ' ' + String(periode).slice(0, 4);
}

module.exports = (ctx) => {
  const { db, save, accounts, economie } = ctx;

  /* Waar woont de factuurlijst van deze drager? Een echt account heeft zijn
     eigen ledenstaat; een demo-sessie deelt de gedeelde demo -- dezelfde twee
     regels als in routes/member/betalen.js, en om dezelfde reden dat ze daar op
     één plek staan. Een zaak of een gezin komt hier nooit: die standen
     factureren niet (zie ./doorbelasting.js). */
  function lijstVan(drager) {
    const w = ontleed(drager);
    if (w.soort !== 'lid') return { error: 'Alleen leden krijgen een doorbelastingsregel.' };
    const m = /^user-(\d+)$/.exec(w.id);
    if (!m) return { md: db.data, bewaar: () => save() };
    const id = Number(m[1]);
    const md = accounts.getMemberState(id);
    if (!md) return { error: 'Dit lid heeft geen ledendossier.' };
    return { md, bewaar: () => accounts.saveMemberState(id, md) };
  }

  /* Boek één regel. Idempotent op (periode, drager): het factuurnummer is
     afgeleid en niet geteld, dus een tweede poging vindt de bestaande regel en
     maakt er geen tweede. Dat is dezelfde zekering als de idem-sleutel in
     kern/factuursaldo.js, en hier hard nodig: een dubbele doorbelasting is niet
     met een creditnota te repareren maar met vertrouwen. */
  function boekDoorbelasting({ drager, periode, centen, graad, wereld }) {
    const c = Math.round(Number(centen) || 0);
    if (!(c > 0)) return { error: 'Geen bedrag om door te belasten.' };
    /* DE LAATSTE POORT VOOR DE FACTUUR, en met opzet niet dezelfde controle als
       die in ./doorbelasting.js. Daar wordt gevraagd of RTG deze WERELD iets in
       rekening mag brengen; hier of DEZE GEBRUIKER een rekening mag krijgen voor
       kosten uit die wereld. Dat zijn twee vragen, en de tweede is strenger: een
       open relatie naar de RTFoundation is geen open deur naar een gezin.

       De wereld wordt hier ONAFHANKELIJK opnieuw bepaald en met de meegegeven
       wereld vergeleken. Dat is met opzet een dubbele berekening: op deze plek
       is dat geen dubbeling maar een controle, en het is de enige plek waar een
       verwisseling van werelden nog kan worden gezien voordat er een bedrag op
       iemands rekening staat. */
    if (!economie) return { error: 'De economielaag is niet gemount; zonder firewall wordt er niets gefactureerd.' };
    const poort = economie.magDragerBelasten({ drager, vanWereld: wereld || economie.wereldVan(drager) });
    if (!poort.ok) return { error: poort.uitleg, code: poort.code };
    const doel = lijstVan(drager);
    if (doel.error) return doel;
    const md = doel.md;
    if (!Array.isArray(md.invoices)) md.invoices = [];
    const nummer = 'RTG-VERBRUIK-' + String(periode).replace('-', '') + '-' + String(drager).replace(/[^a-zA-Z0-9]/g, '');
    const bestaand = md.invoices.find(i => i.id === nummer);
    if (bestaand) return { id: bestaand.id, alGeboekt: true };
    const btw = tariefVan(null, 'standaard');
    const inclusief = Math.round(c * (1 + btw / 100)) / 100;
    md.invoices.push({
      id: nummer,
      /* De graad staat in de omschrijving en niet alleen in een veld dat de
         PDF niet meeneemt: een lid dat deze regel op papier ziet, hoort te
         kunnen lezen dat er een schatting in zit. */
      desc: 'Eigen verbruik ' + maandNaam(periode) + (graad === 'vermoed' ? ' (deels toegerekend)' : ''),
      netto: 0, bijdrage: inclusief, status: 'open',
      date: 'Vervalt aan het eind van ' + maandNaam(periode),
      verbruik: { periode, centenExBtw: c, btwPct: btw, graad: graad || 'onbekend',
        wereld: economie.wereldVan(drager) }
    });
    doel.bewaar();
    return { id: nummer, centenExBtw: c, bijdrage: inclusief, btwPct: btw };
  }

  return { boekDoorbelasting, maandNaam };
};

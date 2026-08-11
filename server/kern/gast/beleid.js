/* Hospitality Guest OS (deelmodule): HET BELEID VAN DE ZAAK.

   HET PROBLEEM DAT DIT OPLOST. Een gastbestelling kan om een stuk of tien
   redenen niet doorgaan, en die redenen zijn geen techniek maar bedrijfsvoering:
   deze zaak wil allergieen door een mens laten bevestigen, die zaak schenkt geen
   alcohol via de telefoon, een derde wil boven de vijfhonderd euro een
   handtekening. Zonder deze laag komen die regels als losse `if`-jes in tien
   routes terecht, elk met hun eigen tekst, en dan is "waarom kan dit niet" niet
   meer te beantwoorden -- niet voor de gast, en niet voor de zaak die het
   beleid dacht te hebben ingesteld.

   Hier staat dus niet WAT er gebeurt maar WAT ER MAG, en elke uitkomst draagt
   drie dingen: of het mag, een machineleesbare reden, en de zin die de gast
   leest. Die laatste is geen sierlaag. "Dit gerecht is door de keuken op
   uitverkocht gezet" is een ander antwoord dan "dit kan niet", en het verschil
   tussen die twee is of iemand zich serieus genomen voelt.

   HET STANDAARDBELEID IS EEN BESLUIT. Een verse zaak staat op: de gast mag
   bestellen, een ernstige allergie gaat langs een medewerker, alcohol vereist
   een geverifieerde leeftijd. Dat is bewust de voorzichtige kant -- wie het
   ruimer wil, zet het ruimer en dat staat dan als keuze in de instellingen in
   plaats van als stilte. */
'use strict';

/* De woorden waarmee een gast een allergie kan aangeven die altijd langs een
   mens moet. Bewust een korte, expliciete lijst en geen slimme tekstanalyse:
   een gemiste ernstige allergie is geen zoekfout maar een ziekenhuisopname. */
const ERNSTIG = ['anafyla', 'ernstig', 'pinda', 'noot', 'noten', 'schaaldier', 'sesam',
  'gluten', 'coeliak', 'soja', 'lupine', 'selderij', 'mosterd', 'ei', 'melk', 'vis', 'weekdier'];

const STANDAARD = {
  bestellen: true,              // mag de gast zelf bestellen
  /* WAT DEZE LIJST IS, en dat is twee keer verkeerd begrepen -- eerst door
     mijzelf bij bezorging, daarna bij roomservice. Hij is de UITSCHAKELAAR van
     de zaak, niet de toegangscontrole. Elk kanaal heeft zijn eigen echte poort
     en die staat ergens anders: een tafel heeft de QR, een kamer de open
     gastrekening (geen folio, geen roomservice), bezorging de zones (geen
     zones, geen bezorging), afhalen de ledensessie. Wie die poorten al passeert
     hoort niet daarna op een lijst te stuiten die nog uit een vorige ronde
     stamt -- dan stelt een zaak bezorgzones in waarop niemand kan bestellen.
     Daarom staat hier alles wat bereikbaar is AAN, en zet een zaak uit wat hij
     niet wil. */
  kanalen: ['tafel', 'qr', 'bar', 'terras', 'bezorging', 'afhaal', 'roomservice'],
  allergieBevestiging: 'ernstig', // nooit | ernstig | altijd
  alcoholLeeftijd: 18,
  orderPlafondCenten: 50000,    // hierboven moet een medewerker bevestigen
  zelfAfrekenen: true,
  fooiVoorstellen: false        // nooit voorvullen; dit staat hier zodat de keuze zichtbaar is
};

module.exports = ({ horeca }) => {
  const { H } = horeca;

  function beleidVan(zaakcode) {
    const h = H(zaakcode);
    const eigen = (h.instel && h.instel.gastbeleid) || {};
    return Object.assign({}, STANDAARD, eigen);
  }

  function zet(zaakcode, invoer) {
    const h = H(zaakcode);
    const b = Object.assign({}, beleidVan(zaakcode));
    const v = invoer || {};
    if (v.bestellen != null) b.bestellen = !!v.bestellen;
    if (v.zelfAfrekenen != null) b.zelfAfrekenen = !!v.zelfAfrekenen;
    if (Array.isArray(v.kanalen)) b.kanalen = v.kanalen.filter(k => horeca.KANALEN.includes(String(k)));
    if (v.allergieBevestiging != null && ['nooit', 'ernstig', 'altijd'].includes(String(v.allergieBevestiging)))
      b.allergieBevestiging = String(v.allergieBevestiging);
    if (v.alcoholLeeftijd != null) b.alcoholLeeftijd = Math.max(0, Math.min(25, parseInt(v.alcoholLeeftijd, 10) || 0));
    if (v.orderPlafondCenten != null) b.orderPlafondCenten = Math.max(0, horeca.centen(v.orderPlafondCenten));
    if (!h.instel) h.instel = {};
    h.instel.gastbeleid = b;
    return b;
  }

  const ja = () => ({ mag: true });
  const nee = (code, uitleg, extra) => Object.assign({ mag: false, code, uitleg }, extra || {});

  const ernstigeAllergie = (tekst) => {
    const t = String(tekst || '').toLowerCase();
    return !!t && ERNSTIG.some(w => t.includes(w));
  };

  /* ---------- de vragen die het beleid beantwoordt ---------- */

  function magBestellen(zaakcode, kanaal) {
    const b = beleidVan(zaakcode);
    if (!b.bestellen) return nee('bestellen-uit',
      'Deze zaak neemt bestellingen alleen via de bediening aan. Vraag een medewerker.');
    if (!b.kanalen.includes(String(kanaal))) return nee('kanaal-dicht',
      'Zelf bestellen kan hier niet op dit kanaal (' + kanaal + '). Vraag een medewerker.');
    return ja();
  }

  function magAfrekenen(zaakcode) {
    const b = beleidVan(zaakcode);
    if (!b.zelfAfrekenen) return nee('afrekenen-uit',
      'Deze zaak rekent af aan de kassa of aan tafel. Vraag om de rekening.');
    return ja();
  }

  /* Een item mag op de rekening als het bestaat, niet uitverkocht is en de
     leeftijd klopt. De uitkomst kan ook `bevestiging` dragen: dan MAG het wel,
     maar loopt de bestelling langs een medewerker. Dat is geen weigering en
     hoort dus niet als fout terug te komen. */
  function magItem(zaakcode, item, gast) {
    if (!item) return nee('item-onbekend', 'Dit gerecht staat niet op de kaart van deze zaak.');
    const h = H(zaakcode);
    const uit = (h.instel && h.instel.uitverkocht) || {};
    if (uit[item.id]) return nee('uitverkocht',
      'Dit gerecht is door de keuken op uitverkocht gezet.', { sinds: uit[item.id].at || null });
    const b = beleidVan(zaakcode);
    if (item.alcohol && b.alcoholLeeftijd) {
      /* De grendel hangt aan het DOEL en niet aan de aanvrager (LAT-regel 7):
         niet "heeft deze gast gezegd dat hij 18 is" maar "is de leeftijd
         geverifieerd". Een niet-geverifieerde gast valt dus terug op de
         bediening in plaats van dat hij het zelf mag beweren. */
      if (!gast || !gast.leeftijdGeverifieerd || (gast.leeftijd || 0) < b.alcoholLeeftijd)
        return nee('leeftijd', 'Alcohol schenken we hier vanaf ' + b.alcoholLeeftijd +
          ' jaar, en dat moet geverifieerd zijn. Een medewerker kan dit voor je opnemen.');
    }
    return ja();
  }

  /* Moet deze bestelling langs een medewerker voordat de keuken begint? Geeft
     een reden terug of null. Dit is geen weigering: de bestelling komt op de
     rekening te staan met `bevestiging: 'wacht'`. */
  function bevestigingNodig(zaakcode, { allergie, totaalCenten }) {
    const b = beleidVan(zaakcode);
    if (b.allergieBevestiging === 'altijd' && allergie)
      return { code: 'allergie', uitleg: 'Deze zaak laat elke allergiemelding door een medewerker bevestigen.' };
    if (b.allergieBevestiging === 'ernstig' && ernstigeAllergie(allergie))
      return { code: 'allergie-ernstig',
        uitleg: 'Je hebt een allergie opgegeven die deze zaak altijd handmatig laat bevestigen. ' +
          'Een medewerker loopt hem na met de keuken voordat er iets bereid wordt.' };
    if (b.orderPlafondCenten && totaalCenten > b.orderPlafondCenten)
      return { code: 'plafond', uitleg: 'Bestellingen boven € ' + (b.orderPlafondCenten / 100).toFixed(2) +
        ' laat deze zaak door een medewerker bevestigen.' };
    return null;
  }

  return { STANDAARD, beleidVan, zet, magBestellen, magAfrekenen, magItem, bevestigingNodig, ernstigeAllergie };
};

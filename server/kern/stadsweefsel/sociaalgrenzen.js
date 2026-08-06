/* DE GRENZEN VAN HET SOCIAAL DOMEIN, met naam en met reden.

   Pure tekst, en dat is precies de bedoeling: dit bestand somt op wat het
   stadsplatform met OPZET niet kan in het sociaal domein, en wat er eerst zou
   moeten gebeuren om het wel te mogen. Geen disclaimer onderaan een scherm
   maar een lijst die je kunt lezen, tegenspreken en afvinken.

   Een systeem dat zijn eigen grenzen niet kan opnoemen, heeft ze niet. */
module.exports = () => {

  /* DE GRENS, MET NAAM. Wat deze laag met opzet niet kan, staat hier -- niet
     als disclaimer maar als lijst, met per vraag wat er eerst nodig zou zijn.
     Een systeem dat zijn eigen grenzen niet kan opnoemen, heeft ze niet. */
  function grenzen() {
    return {
      status: 200,
      wat: 'Wat deze laag met opzet NIET kan, en wat er eerst nodig zou zijn om het wel te mogen.',
      vragen: [
        { vraag: 'Wie zit er in de schuldhulp?', kan: false,
          waarom: 'Deze laag kent geen personen; er is geen dossier en geen sleutel naar een inwoner.',
          nodig: 'Een wettelijke grondslag per stroom, een doelbinding per rol, en een besluit van RTG over bewaartermijnen -- geen van drieen bestaat.' },
        { vraag: 'Geef deze inwoner een risicoscore.', kan: false,
          waarom: 'Er wordt niets over personen gecombineerd en geen enkele regel vormt een oordeel over iemand.',
          nodig: 'Dit valt onder niveau 4 van kern/stadsweefsel/ainiveau.js: verboden zonder een expliciete menselijke beslissing, en ook dan alleen met een grondslag die er nu niet is.' },
        { vraag: 'Combineer betalingsachterstand met zorggebruik.', kan: false,
          waarom: 'De stromen staan naast elkaar als TELLINGEN per wijk; ze zijn niet aan elkaar te koppelen omdat er niets in staat om op te koppelen.',
          nodig: 'Dat is geen technische stap maar een politieke: koppeling van sociale stromen vraagt een besluit dat buiten de code valt.' },
        { vraag: 'Sorteer de wachtlijst op naam.', kan: false,
          waarom: 'Er is geen wachtlijst in dit systeem, alleen een wachtTIJD per voorziening.',
          nodig: 'Wachtlijsten horen bij de uitvoerende organisatie en haar eigen dossierplicht, niet bij een stadsplatform.' },
        { vraag: 'In welke wijk loopt de vraag naar schuldhulp op?', kan: true,
          waarom: 'Dat is een telling per wijk per maand: genoeg om beleid op te maken, te weinig om iemand mee te vinden.', nodig: null }
      ],
      fijnheid: 'Tellingen gaan per wijk per maand. Fijner (per straat, per week) zou preciezer lijken en herleidbaar zijn; dat maken we dus niet.'
    };
  }

  return { grenzen };
};

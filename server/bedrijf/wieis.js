/* RTG Werk OS (deellaag): van een NAAM naar een lid-id.

   HET GAT DAT DIT DICHT, en het was het zwaarste dat deze hele reeks
   achterliet. De modules noemen mensen bij naam: `eigenaar`, `wie`, `door` zijn
   vrije tekstvelden. Daardoor moest de soort `lid` in het register op NAAM
   worden gevonden -- de enige soort in dit huis die dat doet -- en daar hangt
   een risico aan dat met geen enkele hoeveelheid waarschuwing verdwijnt: twee
   medewerkers die Pia heten leveren elkaars werk op.

   WAT HIER GEBEURT: bij het vastleggen van een naam wordt er ook een ID
   opgeslagen, als dat ID ONDUBBELZINNIG is. `wieIs()` geeft alleen een lid terug
   als er precies EEN actief lid met die naam is. Bij nul (een naam van buiten,
   een externe, een typefout) en bij twee of meer geeft hij null MET DE REDEN,
   en dan blijft alleen de naam staan.

   DRIE DINGEN DIE HIER MET OPZET NIET GEBEUREN.

   1. ER WORDT NIETS AFGEDWONGEN. De naam blijft een vrij veld: je moet een taak
      kunnen toewijzen aan een stagiair die volgende week begint, of aan iemand
      van een ander bedrijf. Een id eisen zou dat kapotmaken, en dan wordt het
      veld omzeild in plaats van gevuld.
   2. ER WORDT NIETS MET TERUGWERKENDE KRACHT INGEVULD. Rijen van voor deze
      ronde dragen alleen een naam. Ze alsnog aan een id knopen zou precies de
      gok zijn die dit oplost -- op de dag dat er twee Pia's zijn, kiest zo'n
      migratie er stilletjes een.
   3. DE NAAM WORDT NIET VERVANGEN. Het id komt ERNAAST te staan. Wie later
      hernoemt of vertrekt, laat het werk leesbaar staan zoals het was; een
      dossier waarin de naam is weggehaald ten gunste van een sleutel, is voor
      een mens niet meer te lezen.

   WAT HET OPLEVERT. Zodra een rij een id draagt, vindt het objectdossier hem via
   dat veld (`wieId`, `eigenaarId`) in plaats van via de naam -- en omdat de
   afhankelijkhedenscan het VELD meldt waarop hij matchte, kan de lezer per rij
   zien of het exact was of op naam. De naamgok verdwijnt niet met een knop; hij
   krimpt, en hoeveel er nog van over is, is af te lezen. */
'use strict';

module.exports = (sctx) => {
  /* Precies EEN actief lid met deze naam, of null met de reden. Actief en niet
     "elk lid": iemand die uit dienst is, hoort geen nieuw werk meer toegewezen
     te krijgen, en een aanmelding die nog niet is toegelaten al helemaal niet. */
  function wieIs(w, naam) {
    const n = String(naam || '').trim().toLowerCase();
    if (!n) return { id: null, reden: 'geen naam opgegeven' };
    const raak = Object.values((w && w.leden) || {})
      .filter(l => l && l.status === 'actief' && String(l.naam || '').trim().toLowerCase() === n);
    if (raak.length === 1) return { id: raak[0].id, naam: raak[0].naam, reden: null };
    if (!raak.length) return { id: null, reden: 'geen actief lid met deze naam; alleen de naam wordt bewaard' };
    return { id: null, reden: raak.length + ' actieve leden heten zo; er wordt er geen gekozen' };
  }

  /* De vorm waarin een module hem gebruikt: zet `<veld>` en `<veld>Id` naast
     elkaar op de rij. Eén helper, zodat vier modules niet vier keer dezelfde
     twee regels schrijven (LAT-regel 4). Geeft de reden terug voor het antwoord
     aan de gebruiker -- die hoort te weten dat zijn naam niet is thuisgebracht. */
  function zetWie(w, rij, veld, naam) {
    rij[veld] = naam || null;
    const uit = wieIs(w, naam);
    rij[veld + 'Id'] = uit.id;
    return uit;
  }

  return { wieIs, zetWie };
};

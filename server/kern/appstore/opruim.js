/* ============================================================================
   WEGGOOIEN -- verwijderen, wissen, en de cel vernietigen.

   Afgesplitst van ./winkel.js toen die over de 10 KB-keuringsgrens ging, en
   langs de naad die er inhoudelijk al lag: alles in winkel.js gaat over wat een
   lid GEEFT, alles hier over wat hij TERUGNEEMT. Dat zijn twee verschillende
   vragen met twee verschillende lezers, en de tweede is de gevoeligste -- hier
   verdwijnt iets van iemand.

   DRIE HANDELINGEN DIE MET OPZET NIET HETZELFDE ZIJN:

     verwijder   de app van je startscherm en al zijn machtigingen weg. Wat hij
                 voor jou bewaarde blijft staan: dat is JOUW inhoud, en die is er
                 weer als je hem terugzet (APPSTORE.md grens 5).
     wisOpslag   die inhoud weg, plus je plaats op het bord van deze app.
     vernietig   allebei, in een handeling, met de opgave van wat er verdween.

   Waarom die derde bestaat naast de eerste twee: een tijdelijke app -- toegevoegd
   voor een reis of een klus -- hoort in EEN handeling weg te kunnen, en die
   handeling hoort te zeggen wat je kwijtraakt in plaats van te vragen "weet u het
   zeker?". Twintig bevestigingsvragen leren mensen op ja drukken (GRAMMATICA.md);
   een zin die zegt hoeveel er wordt gewist, leest iemand wel.
   ========================================================================== */
'use strict';

module.exports = function maakOpruim({ kern, S, eigen, rijVan, noteer, save }) {
  /* Verwijderen haalt de app van je startscherm EN haalt elke machtiging weg. Wat
     de app voor jou had opgeslagen blijft staan -- dat is jouw inhoud, niet die
     van de app -- en is er weer als je hem terugzet. Wie het echt weg wil, gooit
     het weg met wisOpslag; dat staat als eigen handeling in de app-kaart. */
  function verwijder(key, sleutel) {
    const rij = rijVan(key);
    if (!eigen(rij, sleutel)) return { status: 404, error: 'Deze app staat niet op je startscherm.' };
    delete rij[String(sleutel)];
    save();
    noteer(key, 'verwijderd', sleutel, null);
    return { status: 200, ok: true, aantal: Object.keys(rij).length,
      let: 'De app staat niet meer op je startscherm en heeft geen enkele machtiging meer. Wat hij voor jou had opgeslagen staat er nog: dat is jouw inhoud. Wis het als je het echt weg wilt.' };
  }

  function wisOpslag(key, sleutel) {
    /* EN ZIJN PLAATS OP HET BORD. Zonder deze regel blijft er een score met een
       codenaam staan van iemand die alles heeft laten wissen -- en dat is
       precies het soort restant waar een wisknop voor bestaat. */
    if (kern.arena) kern.arena.wisLid(sleutel, key);
    const bak = eigen(S().opslag, sleutel);
    if (bak && Object.prototype.hasOwnProperty.call(bak, String(key))) { delete bak[String(key)]; save(); }
    const bakjes = eigen(S().bakjes, String(key));
    const hadBerichten = !!(bakjes && Object.prototype.hasOwnProperty.call(bakjes, String(sleutel)));
    if (hadBerichten) { delete bakjes[String(sleutel)]; save(); }
    /* Dat er is GEWIST komt wel in de tijdlijn; wat er stond niet. De regel dat
       iets verwijderd is, is zelf geen persoonsgegeven -- en zonder die regel is
       "ik heb dat laten wissen" achteraf niet te staven. */
    noteer(key, 'gewist', sleutel, { sleutels: bak ? Object.keys(bak).length : 0, berichten: hadBerichten });
    return { status: 200, ok: true,
      let: 'Weg. Er bestaat geen tweede kopie bij de uitgever: een app in de cel heeft geen netwerk, dus er is nooit iets zijn kant op gegaan.' };
  }


  /* DE CEL VERNIETIGEN. Verwijderen haalt de app weg en laat je inhoud staan
     (dat is grens 5); dit haalt allebei weg, in een handeling, en zegt WAT er
     verdwijnt in plaats van het te vragen met "weet u het zeker?". Dat is de
     regel uit GRAMMATICA.md: liever iets ongedaan kunnen maken dan twintig keer
     bevestigen -- en waar dat niet kan, hoort er te staan wat je kwijtraakt. */
  function vernietig(key, sleutel) {
    const rij = rijVan(key);
    const had = eigen(rij, sleutel);
    if (!had) return { status: 404, error: 'Deze app staat niet op je startscherm.' };
    const bak = eigen(S().opslag, sleutel);
    const mijnBak = bak && Object.prototype.hasOwnProperty.call(bak, String(key)) ? bak[String(key)] : null;
    const bytes = mijnBak ? Object.entries(mijnBak).reduce((n, [k, v]) => n + k.length + String(v).length, 0) : 0;
    const sleutels = mijnBak ? Object.keys(mijnBak).length : 0;
    wisOpslag(key, sleutel);
    verwijder(key, sleutel);
    return { status: 200, ok: true, sleutels, bytes,
      let: 'De cel is weg. ' + (sleutels
        ? sleutels + ' bewaarde waarden (' + bytes + ' tekens) zijn gewist, en je plaats op het bord van deze app ook.'
        : 'Er stond niets bewaard.') + ' Er bestaat geen kopie bij de uitgever: een app in de cel heeft geen netwerk.' };
  }


  return { verwijder, wisOpslag, vernietig };
};

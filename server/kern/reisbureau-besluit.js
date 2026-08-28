/* HET BESLUIT OVER EEN REISAANVRAAG -- de kantoorkant van kern/reisbureau.js.

   Afgesplitst op de 10 kB-grens, en op een echte naad: hierboven staat wat een
   LID met het reisbureau doet (kijken, boeken, intrekken, zijn eigen aanvragen
   zien), hier staat wat het KANTOOR met zo'n aanvraag doet. Die twee veranderen
   om verschillende redenen -- de ene met het aanbod, de andere met de manier
   waarop een adviseur werkt -- en ze delen alleen de aanvraag zelf.

   Wat hier binnenkomt zijn de bouwstenen van het reisbureau: de opslag, het
   dossier van het lid en de visumtaak. Zo blijft er EEN plek waar een aanvraag
   van stand verandert, ook al zijn er drie ingangen. */
'use strict';

module.exports = ({ db, save, nu, dossier, visum }) => {

  /* DE REISADVISEUR BESLIST, EN DAT IS EEN MENS.

     De aanvraag stond op 'aangevraagd' en er was geen enkele weg naar een
     andere stand: het reisbureau kon reizen aannemen maar nooit bevestigen of
     afwijzen. Daarmee kon een reis nooit rond komen, en het dossier van het lid
     kon dus ook nooit meer worden dan een aanvraag. Dit sluit die lus, op het
     kantoor (officeAuth) en dus achter een mens -- de merkregel is dat de AI
     hier niets beslist.

     DRIE INGANGEN, EEN REGEL. besluit() is de kantooringang: die kent maar twee
     uitkomsten, eist een reden bij afwijzen, en krijgt WIE besliste uit de
     sessie. bevestig() en wijsAf() zijn de losse ingangen, met hun eigen naam
     voor het bericht aan het lid ('reden' in plaats van 'bericht'). Wat ze
     DELEN staat hieronder een keer: de aanvraag zoeken, maar een keer besluiten,
     het dossier van het lid bijwerken en de visumtaak intrekken. Twee kopieen
     van die stappen lopen uiteen, en dan bevestigt de ene ingang een reis die in
     het dossier van het lid nooit aankomt (LAT-regel 4).

     Er wordt niets geboekt en niets betaald: dat loopt langs de facturen,
     zoals overal in dit huis. */
  function pakAanvraag(ref) {
    const a = (db.data.reisAanvragen || []).find(x => x.ref === String(ref || '').trim());
    if (!a) return { status: 404, error: 'Reisaanvraag niet gevonden.' };
    if (a.status !== 'aangevraagd') return { status: 409, error: 'Deze aanvraag is al ' + a.status + '.' };
    return { aanvraag: a };
  }

  /* De stand vastleggen en het dossier van het lid meenemen. Synchroon, want de
     bevestiging loopt langs veilig() in routes/kantoren, en die wacht niet. De
     enige stap die wel moet wachten -- de visumtaak bij een afwijzing -- staat
     daarom bij de ingangen die afwijzen, en niet hier. */
  function boekBesluit(a, stand, door, tekst, veld) {
    a.status = stand;
    a.besluit = { door: String(door || 'reisadviseur').replace(/[<>]/g, '').trim().slice(0, 60), at: nu() };
    if (veld) a.besluit[veld] = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 300) || null;
    save();
    if (dossier) {
      if (stand === 'bevestigd') dossier.bevestig(a.customerKey, a.ref);
      else dossier.weghalen(a.customerKey, a.ref);
    }
    return { ok: true, aanvraag: a };
  }

  /* Een afgewezen reis gaat niet door, dus de visumtaak eromheen ook niet --
     dezelfde redenering als bij een ingetrokken aanvraag: een taak voor een reis
     die niet doorgaat is ruis in de agenda. Bij een bevestiging blijft de taak
     juist staan; die wordt vanaf nu pas echt urgent. */
  async function trekVisumIn(a) {
    const vt = visum();
    if (vt) await vt.bijAnnulering(a.customerKey, a.ref);
  }

  function bevestig(ref, door) {
    const g = pakAanvraag(ref);
    if (g.error) return g;
    return boekBesluit(g.aanvraag, 'bevestigd', door, null, null);
  }

  async function wijsAf(ref, door, reden) {
    const g = pakAanvraag(ref);
    if (g.error) return g;
    const uit = boekBesluit(g.aanvraag, 'afgewezen', door, reden, 'reden');
    await trekVisumIn(g.aanvraag);
    return uit;
  }

  /* WIE beslist komt van de aanroeper uit de SESSIE en niet uit het verzoek;
     zie de kop van routes/kantoren/index.js bij de identiteitskluis. Een naam
     die de aanvrager zelf invult is geen naam.

     Afwijzen kan alleen met een reden. Een lid dat "afgewezen" leest zonder te
     weten waarom, belt -- en dan is de balie alsnog aan zet, maar nu met een
     boos lid. Bevestigen mag zonder bericht: de bevestiging IS het bericht. */
  async function besluit(ref, stand, door, bericht) {
    if (stand !== 'bevestigd' && stand !== 'afgewezen')
      return { status: 400, error: 'Een reisaanvraag wordt bevestigd of afgewezen; een andere uitkomst kent het reisbureau niet.' };
    const wie = String(door || '').replace(/[<>]/g, '').trim().slice(0, 60);
    if (!wie) return { status: 400, error: 'Een besluit zonder naam eronder is geen besluit.' };
    const tekst = String(bericht || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (stand === 'afgewezen' && !tekst)
      return { status: 400, error: 'Afwijzen kan alleen met een reden voor het lid.' };
    const g = pakAanvraag(ref);
    if (g.error) return g;
    const uit = boekBesluit(g.aanvraag, stand, wie, tekst, 'bericht');
    if (stand === 'afgewezen') await trekVisumIn(g.aanvraag);
    return uit;
  }

  return { pakAanvraag, boekBesluit, trekVisumIn, bevestig, wijsAf, besluit };
};

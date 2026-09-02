/* Foundation OS, deel "ruil": de buurtruil -- spullen die een lid weggeeft of
   zoekt, binnen zijn eigen RTF-stad.

   WAAROM DIT GEEN WINKEL IS EN ER OOK GEEN BEDRAG IN STAAT. De vraag die hier
   lag was "een winkel"; de meting eronder wees drie kanten op die alle drie een
   besluit van de eigenaar vragen (een doneerknop bestaat met opzet niet, een
   RTF-codenaam om aan te betalen is er niet, en de voorraad van de stichting is
   geen publieke informatie -- zie kern/rtfos/publiek.js). Wat er WEL kan zonder
   dat iemand iets terugdraait, is de helft zonder geld. Die staat hier, en er
   is nergens een prijsveld: zodra dat er komt, is dit een marktplaats en gelden
   er btw-, retour- en consumentenregels die deze module niet draagt.

   VIJF GRENDELS:

   1. EEN AANBOD HANGT AAN EEN CODENAAM, NOOIT AAN EEN NAAM. Zoals overal in dit
      huis: de echte naam staat in de kluis en komt hier niet langs. Wie iets
      wil regelen, doet dat buiten dit scherm om -- dat is geen gebrek maar de
      grens uit LIFE.md par. 4: wat een tweede persoon bereikt, gaat nooit
      automatisch.

   2. INTERESSE IS EEN SIGNAAL DAT DE EIGENAAR OPHAALT, GEEN BERICHT DAT VERTREKT.
      Er wordt niets verstuurd, niets gepusht en niemand gebeld. De eigenaar ziet
      dat er belangstelling is en beslist zelf wat hij ermee doet. Dat is precies
      hetzelfde werkwoord als in LIFE.md: samenstellen en klaarzetten.

   3. DE MELDING VERBERGT, MAAR OORDEELT NIET. Twee meldingen van verschillende
      leden halen een aanbod uit de lijst; wat er daarna gebeurt, doet een mens
      van de stichting. Een teller die zelf verwijdert, is een knop waarmee twee
      mensen iemand anders kunnen laten verdwijnen.

   4. ALLEEN IN EEN STAD DIE ECHT OPEN IS. Het aanbod hangt aan een RTF-afdeling
      met status actief; een vrij tekstveld zou een landelijke marktplaats
      opleveren waar niemand de buurt meer in staat.

   5. DE LIJST IS EINDIG EN DE TELLERS HANGEN AAN HET DING. Stemmen, meldingen en
      interesse dedupliceren op codenaam (LAT.md regel 7): wie tien keer klikt,
      telt een keer.

   Wat hier NIET in zit en ook niet hoort: bezorgen, betalen, waarderen en een
   score op een mens. De eerste twee zijn een andere laag, de laatste twee zijn
   in dit huis verboden (LIFE.md par. 4). */
'use strict';

/* De standen van een aanbod. `verborgen` is geen verwijdering: de rij blijft
   staan zodat een mens van de stichting kan zien waarover het ging. */
const STANDEN = ['open', 'weg', 'ingetrokken', 'verborgen'];
const SOORTEN = [
  { soort: 'geef', naam: 'Ik geef weg' },
  { soort: 'zoek', naam: 'Ik zoek' }
];
/* Twee meldingen van VERSCHILLENDE leden. Een is te weinig (dan is elke ruzie
   een verwijderknop) en vijf is te veel (dan staat er een week iets fouts). */
const MELDGRENS = 2;

module.exports = (ctx) => {
  const { nu, rid, schoon, S, audit, stadVan } = ctx;

  const soortOk = s => SOORTEN.some(x => x.soort === s);

  /* Wat een ANDER lid van een aanbod ziet. De melders komen er niet in voor --
     wie iets meldde is niemands zaak, en zeker niet die van de gemelde. */
  const pub = (r, ikBenEigenaar) => ({
    id: r.id, stad: r.stad, soort: r.soort, titel: r.titel, wat: r.wat,
    staat: r.staat, status: r.status, at: r.at,
    van: r.codenaam,
    interesse: r.interesse.length,
    // alleen de eigenaar ziet WIE er belangstelling heeft, en dat is een
    // codenaam en geen mens
    belangstellenden: ikBenEigenaar ? r.interesse.slice(0, 50) : undefined,
    ikBenEigenaar: !!ikBenEigenaar
  });

  function lijst(b) {
    b = b || {};
    const stad = stadVan(b.stad);
    if (!stad) return { status: 404, error: 'Deze stadsafdeling kennen we niet.' };
    if (stad.status !== 'actief') {
      return { status: 409, error: 'RTF ' + stad.naam + ' is nog niet open. Zodra de afdeling van start gaat, kan hier geruild worden.' };
    }
    const ik = schoon(b.codenaam, 60) || '';
    const soort = soortOk(b.soort) ? b.soort : null;
    const rijen = S().ruil
      .filter(r => r.stad === stad.id && r.status === 'open' && (!soort || r.soort === soort))
      .sort((x, y) => String(y.at).localeCompare(String(x.at)))
      .slice(0, 200)
      .map(r => pub(r, ik && r.codenaam === ik));
    return { ok: true, stad: { id: stad.id, naam: stad.naam }, soorten: SOORTEN, totaal: rijen.length, ruil: rijen };
  }

  function mijn(codenaam) {
    const ik = schoon(codenaam, 60);
    if (!ik) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    const rijen = S().ruil.filter(r => r.codenaam === ik)
      .sort((x, y) => String(y.at).localeCompare(String(x.at)))
      .slice(0, 100).map(r => pub(r, true));
    return { ok: true, ruil: rijen };
  }

  function plaats(codenaam, b) {
    b = b || {};
    const ik = schoon(codenaam, 60);
    if (!ik) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    const stad = stadVan(b.stad);
    if (!stad) return { status: 404, error: 'Deze stadsafdeling kennen we niet.' };
    if (stad.status !== 'actief') return { status: 409, error: 'RTF ' + stad.naam + ' is nog niet open.' };
    if (!soortOk(b.soort)) return { status: 400, error: 'Geef je iets weg of zoek je iets?' };
    const titel = schoon(b.titel, 80);
    if (titel.length < 3) return { status: 400, error: 'Wat is het? Een paar woorden is genoeg.' };
    const wat = schoon(b.wat, 600);

    /* EEN LID HOUDT ER TWINTIG TEGELIJK OPEN. Geen wet, wel een rem: wie er
       honderd plaatst, gebruikt de buurtruil als etalage en dan staat er voor
       de buurt niets meer tussen. */
    const open = S().ruil.filter(r => r.codenaam === ik && r.status === 'open').length;
    if (open >= 20) {
      return { status: 429, error: 'Je hebt er twintig openstaan. Sluit er eerst een voordat je een nieuwe plaatst.' };
    }

    const rij = { id: rid(), stad: stad.id, codenaam: ik, soort: b.soort, titel,
      wat, staat: schoon(b.staat, 40), status: 'open',
      interesse: [], meldingen: [], at: nu() };
    S().ruil.push(rij);
    audit(ik, 'ruil.plaats', rij.id, stad.naam + ' / ' + rij.soort);
    return { ok: true, ruil: pub(rij, true) };
  }

  function sluit(codenaam, b) {
    b = b || {};
    const ik = schoon(codenaam, 60);
    const rij = S().ruil.find(r => r.id === String(b.id || ''));
    if (!rij) return { status: 404, error: 'Dit aanbod bestaat niet (meer).' };
    if (!ik || rij.codenaam !== ik) return { status: 403, error: 'Dit is niet van jou.' };
    const stand = STANDEN.includes(b.status) && b.status !== 'open' && b.status !== 'verborgen'
      ? b.status : 'weg';
    rij.status = stand;
    rij.dichtAt = nu();
    audit(ik, 'ruil.sluit', rij.id, stand);
    return { ok: true, ruil: pub(rij, true) };
  }

  /* Belangstelling: een signaal, geen bericht. Zie grendel 2 in de kop. */
  function interesse(codenaam, b) {
    b = b || {};
    const ik = schoon(codenaam, 60);
    if (!ik) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    const rij = S().ruil.find(r => r.id === String(b.id || ''));
    if (!rij) return { status: 404, error: 'Dit aanbod bestaat niet (meer).' };
    if (rij.status !== 'open') return { status: 409, error: 'Dit aanbod staat niet meer open.' };
    if (rij.codenaam === ik) return { status: 400, error: 'Dit is je eigen aanbod.' };
    if (rij.interesse.includes(ik)) return { status: 409, error: 'Je liet al weten dat je belangstelling hebt.' };
    if (rij.interesse.length >= 200) return { status: 409, error: 'Hier hebben genoeg mensen op gereageerd.' };
    rij.interesse.push(ik);
    audit(ik, 'ruil.interesse', rij.id, '');
    return { ok: true, ruil: pub(rij, false) };
  }

  /* Melden verbergt en oordeelt niet. Zie grendel 3. */
  function meld(codenaam, b) {
    b = b || {};
    const ik = schoon(codenaam, 60);
    if (!ik) return { status: 401, error: 'Hiervoor is een eigen RTG-account nodig.' };
    const rij = S().ruil.find(r => r.id === String(b.id || ''));
    if (!rij) return { status: 404, error: 'Dit aanbod bestaat niet (meer).' };
    if (rij.codenaam === ik) return { status: 400, error: 'Dit is je eigen aanbod; je kunt het intrekken.' };
    if (rij.meldingen.some(m => m.door === ik)) return { status: 409, error: 'Je hebt dit al gemeld.' };
    rij.meldingen.push({ door: ik, reden: schoon(b.reden, 200), at: nu() });
    let verborgen = false;
    if (rij.meldingen.length >= MELDGRENS && rij.status === 'open') {
      rij.status = 'verborgen';
      verborgen = true;
    }
    audit(ik, 'ruil.meld', rij.id, verborgen ? 'verborgen na ' + rij.meldingen.length : String(rij.meldingen.length));
    return { ok: true, verborgen,
      /* Wat de melder terugkrijgt is wat ER GEBEURDE en geen dankwoord: bij
         een melding onder de grens gebeurt er nog niets, en dat hoort hij te
         weten in plaats van te denken dat het weg is. */
      bericht: verborgen
        ? 'Dit aanbod staat niet meer in de lijst. Iemand van de stichting kijkt ernaar.'
        : 'Genoteerd. Er is nog niets verborgen: daar is meer dan een melding voor nodig.' };
  }

  /* De werkvoorraad van de stichting: wat is er verborgen en waarom. Alleen
     voor wie in die stad iets te zoeken heeft -- de poort staat op de route. */
  function gemeld(stadId) {
    const stad = stadVan(stadId);
    if (!stad) return { status: 404, error: 'Deze stadsafdeling kennen we niet.' };
    const rijen = S().ruil.filter(r => r.stad === stad.id && r.meldingen.length)
      .sort((x, y) => y.meldingen.length - x.meldingen.length)
      .slice(0, 200)
      .map(r => ({ id: r.id, titel: r.titel, wat: r.wat, van: r.codenaam, status: r.status,
        meldingen: r.meldingen.map(m => ({ reden: m.reden, at: m.at })) }));
    return { ok: true, stad: { id: stad.id, naam: stad.naam }, gemeld: rijen };
  }

  return { lijst, mijn, plaats, sluit, interesse, meld, gemeld, SOORTEN, STANDEN, MELDGRENS };
};
module.exports.SOORTEN = SOORTEN;
module.exports.MELDGRENS = MELDGRENS;

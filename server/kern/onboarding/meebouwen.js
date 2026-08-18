/* Onboarding (deelmodule): MEEBOUWEN -- de twee dingen die een nieuw lid aan het
   platform zelf kan bijdragen, elk met zijn eigen toestemming.

   WAAROM DIT ER IS. Sinds de demo-inhoud eruit is (kern/demostand.js) begint een
   installatie leeg: De Salon heeft geen berichten en de catalogus geen zaken.
   Dat is de bedoeling -- wat er staat hoort van mensen te komen -- maar dan moet
   er wel een deur zijn waardoor dat naar binnen kan. Die deur is de onboarding.

   HIER STAAT WEL EEN VINKJE, EN IN ./inrichten.js NIET. Dat is geen slordigheid
   maar het verschil. De velden daar (telefoon, adres) verlaten het lid nergens;
   een schakelaar die toestemming vraagt voor iets wat niet gebeurt, is een
   belofte die de code niet waarmaakt (LAT-regel 6). Deze twee dingen verlaten
   het lid WEL, en allebei op een plek die te handhaven is:

   - een Salon-bericht kan door RTG worden UITGELICHT en komt dan als beeld op de
     site en in de campagne terecht, met naamsvermelding. Het vinkje zet
     `promoMag` op de post; kern/salonpromo.js gebruikt geen ledenpost zonder
     dat. Uit staat uit: wie iets voor zijn kring plaatst, geeft daarmee geen
     campagnebeeld weg.
   - een bedrijf kan in de RTG-catalogus komen. Het vinkje legt die WENS vast,
     meer niet: er wordt niets geplaatst en niets beloofd. Een partnerplek is er
     alleen voor bedrijven met een Business Pass en een mens beslist erover
     (routes/member/partnerkanaal.js, en het kantoor keurt). Rahul zegt dat er
     dus ook eerlijk bij in plaats van "geregeld".

   BEIDE ZIJN VRIJWILLIG. Wie ze overslaat merkt er niets van; er is geen poort,
   geen herinnering en geen tweede vraag. */
'use strict';

module.exports = (ctx) => {
  const { db, save, schoon } = ctx;
  const scho = (v, n) => schoon(String(v == null ? '' : v), n);

  /* DE HAKEN NAAR LAGEN DIE LATER WORDEN GEBOUWD. De Salon en de bedrijvenkant
     bestaan nog niet als de onboarding wordt opgezet, dus ze komen laat binnen:
     server.js roept zetHaken() zodra ze er zijn -- hetzelfde draadje als de
     visumtaak-haak bij het reisbureau. Tot die tijd is alles null en zegt
     meebouwen netjes dat het even niet kan, in plaats van om te vallen. */
  const haken = { salon: null, ondernemingNieuw: null, ondernemingVanEigenaar: null };
  const zetHaken = (h) => Object.assign(haken, h || {});
  const salonVan = () => haken.salon;
  const ondernemingNieuwVan = () => haken.ondernemingNieuw;
  const ondernemingenVan = (key) => (haken.ondernemingVanEigenaar ? haken.ondernemingVanEigenaar(key) : []);

  const posts = () => (Array.isArray(db.data.posts) ? db.data.posts : []);

  /* Wat staat er voor dit lid nog open? Iemand die al een bericht plaatste of al
     een onderneming heeft, krijgt de vraag niet: dit is een startzet en geen
     terugkerende aansporing (geen engagement-patronen, zie CLAUDE.md). */
  function meebouwStatus(sess) {
    const key = sess && sess.key;
    const acc = sess && sess.account;
    if (!acc || !key) return { ok: true, klaar: true, open: [] };
    const heeftPost = posts().some(p => p && p.authorKey === key);
    let heeftZaak = false;
    try { heeftZaak = ((ondernemingenVan && ondernemingenVan(key)) || []).length > 0; } catch (e) {}
    const open = [];
    if (!heeftPost) open.push({
      id: 'salon',
      vraag: 'De Salon is van de leden, en hij begint leeg. Wil je er meteen iets neerzetten?',
      toestemming: 'Mag RTG dit bericht ook uitlichten? Dan kan het als beeld op de site en in de campagne komen, altijd met je naam erbij. Zeg je nee, dan blijft het in De Salon.',
      standaard: false
    });
    if (!heeftZaak) open.push({
      id: 'bedrijf',
      vraag: 'Heb je een bedrijf? Dan kan het hier zijn eigen plek krijgen.',
      toestemming: 'Zal ik het aanmelden voor de RTG-catalogus? Ik leg de wens vast; RTG kijkt ernaar en een mens beslist. Voor een partnerplek is een Business Pass nodig, dus het staat er niet vanzelf.',
      standaard: false
    });
    return { ok: true, klaar: open.length === 0, open };
  }

  /* Het eerste bericht in De Salon. Loopt via dezelfde salon.plaats als elk
     ander bericht -- geen tweede weg naar dezelfde bak -- en geeft alleen het
     toestemmingsvinkje door. */
  async function meebouwSalon(sess, invoer) {
    const salon = salonVan && salonVan();
    if (!salon || typeof salon.plaats !== 'function') return { status: 503, error: 'De Salon is nu niet bereikbaar.' };
    return salon.plaats(sess, {
      tekst: (invoer && invoer.tekst) || '',
      plaats: (invoer && invoer.plaats) || '',
      media: (invoer && invoer.media) || [],
      promoMag: (invoer && invoer.promoMag) === true
    });
  }

  /* Het bedrijf. De onderneming zelf is van het lid en ontstaat langs de gewone
     weg (kern/onderneming). Het vinkje legt de catalogus-WENS vast op diezelfde
     onderneming, met een tijdstempel, zodat het kantoor hem ziet staan en er een
     mens over kan beslissen. Er wordt niets geplaatst en niets bevestigd. */
  function meebouwBedrijf(sess, invoer) {
    const key = sess && sess.key;
    if (!key) return { status: 401, error: 'Log in om een onderneming te beginnen.' };
    const naam = scho((invoer || {}).naam, 80);
    if (!naam) return { status: 400, error: 'Hoe zou het bedrijf heten? Een werktitel is genoeg.' };
    const maak = ondernemingNieuwVan && ondernemingNieuwVan();
    if (typeof maak !== 'function') return { status: 503, error: 'De bedrijvenkant is nu niet bereikbaar.' };
    const r = maak(key, { naam });
    if (r.error) return r;
    if ((invoer || {}).catalogus === true) {
      const o = ((ondernemingenVan && ondernemingenVan(key)) || []).find(x => x.naam === naam);
      if (o) {
        o.catalogusWens = { at: new Date().toISOString() };
        save();
      }
    }
    return { ok: true, onderneming: r.onderneming,
      // wat er NU echt gebeurt, in plaats van "geregeld"
      vervolg: (invoer || {}).catalogus === true
        ? 'Je bedrijf staat op je naam en de wens voor de catalogus is vastgelegd. RTG kijkt ernaar; een mens beslist, en voor een partnerplek is een Business Pass nodig.'
        : 'Je bedrijf staat op je naam. Wil je het later in de catalogus, dan zeg je het en leg ik die wens vast.' };
  }

  return { meebouwStatus, meebouwSalon, meebouwBedrijf, zetHaken };
};

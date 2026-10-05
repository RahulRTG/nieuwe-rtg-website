/* RTFoundation (deelmodule): HET GEZIN AAN EEN OUDERACCOUNT.

   WAAROM. Tot 5 oktober 2026 hing een gezin aan niets: iedereen maakte er
   anoniem een met een gezinscode van zes tekens en een pincode, en een ouder
   kon zijn kinderen niet vanuit zijn eigen RTG-account beheren. Die deur
   (code + PIN) staat in productie met reden dicht
   (middleware/foundation-nog-gesloten.js), en daarmee was de hele gezinskant
   van FoundationOS onbruikbaar. De eigenaar besloot: wat niet aan een stad
   hangt gaat open na het aanmaken van een account, en een minderjarige komt
   alleen binnen via het account van een ouder.

   DE TWEE TREDEN (besluit van de eigenaar, zelfde dag):

     gezin maken   direct, met een eigen RTG-account en een OPGEGEVEN leeftijd
                   van 18 of ouder. Ook een gratis account.
     kind          pas als RTG het paspoort van de ouder heeft gezien
                   (volwassen(): account + A3 + 18). Een kinderprofiel aanmaken
                   en een kind een sessie geven, eisen allebei die poort; en
                   gezinshulp.js profielVan() rekent hem bij ELK verzoek
                   opnieuw, zodat een ingetrokken keuring ook een lopende
                   kindersessie raakt.

   WAT HIER NIET GEBEURT. De ouder logt niet in met code of PIN: zijn account
   IS de sleutel. Een kind krijgt geen eigen pincode van deze route: de ouder
   opent zijn sessie op het toestel dat het kind gebruikt, en kan die altijd
   intrekken (gezinssessie.js). Er wordt geen echte naam opgeslagen: de
   eigenaar is een account-id en een codenaam, de naam in het profiel is wat
   de ouder zelf intypt. En deze module opent niets in productie zonder het
   externe vrijgavedossier: de routes erachter blijven dan 503. */
'use strict';

const MAX_PROFIELEN = 12;

module.exports = (gctx, ctx, plicht) => {
  const { G, save, nu, rid, schoon, nieuweGezinscode, geboorteInfo, groepVanLeeftijd,
    schoonAvatar, schoonKleur, ensureCodenaam, pubProfiel, pubGezin, gezinstoken, isBeschermd } = gctx;

  function accountGezin(userId) {
    if (userId == null) return null;
    return Object.values(G()).find(g => g.eigenaar && g.eigenaar.userId === userId) || null;
  }
  function beheerderVanAccount(g, userId) {
    return Object.values(g.profielen || {}).find(p => p.rol === 'beheerder' && p.account && p.account.userId === userId) || null;
  }
  function overzicht(g, userId) {
    return { gezin: pubGezin(g), eigenaar: true,
      profielen: Object.values(g.profielen || {}).map(p => Object.assign(pubProfiel(p, true), { beschermd: isBeschermd(p) })),
      beheerder: (beheerderVanAccount(g, userId) || {}).id || null };
  }

  /* leeftijd: de OPGEGEVEN leeftijd van het account (md.geboren). Wie die niet
     heeft of jonger is dan 18, maakt geen gezin -- dit is de eerste trede en
     hij zegt ook niets meer dan dat. */
  function maak({ userId, codenaam, leeftijd, gezinsnaam, naam, avatar, kleur, bevoegdGezin, privacyAkkoord }) {
    if (userId == null) return { status: 403, error: 'Log in met je eigen RTG-account om een gezin te maken.' };
    if (leeftijd == null || leeftijd < 18)
      return { status: 403, error: 'Een gezin maken kan vanaf 18 jaar. Ben je jonger? Vraag je ouder of verzorger om je toe te voegen.' };
    if (accountGezin(userId)) return { status: 409, error: 'Je hebt al een gezin aan dit account. Open het via Mijn gezin.' };
    const gNaam = schoon(gezinsnaam, 40), bNaam = schoon(naam, 40);
    if (!gNaam) return { status: 400, error: 'Geef je gezin een naam.' };
    if (!bNaam) return { status: 400, error: 'Vul de naam in waarmee je gezin je ziet.' };
    if (bevoegdGezin !== true || privacyAkkoord !== true)
      return { status: 400, error: 'Bevestig dat je dit gezin mag aanmaken en de privacy-uitleg begrijpt.' };
    const pid = rid(4);
    const profiel = { id: pid, naam: bNaam, rol: 'beheerder', avatar: schoonAvatar(avatar) || 'pas', kleur: schoonKleur(kleur),
      groep: 'volw', account: { userId, at: nu() }, at: nu() };
    ensureCodenaam(profiel);
    const g = { id: rid(4), code: nieuweGezinscode(), naam: gNaam, at: nu(), profielen: { [pid]: profiel }, berichten: [],
      eigenaar: { userId, codenaam: codenaam || null, at: nu() },
      registratie: { door: pid, bevoegdVerklaard: true, privacyAkkoord: true, via: 'account', at: nu() } };
    G()[g.code] = g;
    const token = gezinstoken.geef(g, profiel); save();
    try { gctx.welkomRtf(profiel.codenaam); } catch (e) {}
    return Object.assign(overzicht(g, userId), { code: g.code, token, profiel: pubProfiel(profiel, true) });
  }

  /* De sessie van de ouder zelf, of -- met volwassen -- die van een kind. */
  function sessie({ userId, profielId, volwassen }) {
    const g = accountGezin(userId);
    if (!g) return { status: 404, error: 'Er hangt nog geen gezin aan dit account.' };
    const p = profielId ? g.profielen[String(profielId)] : beheerderVanAccount(g, userId);
    if (!p || !Object.prototype.hasOwnProperty.call(g.profielen, p.id))
      return { status: 404, error: 'Dit profiel bestaat niet in je gezin.' };
    if (p.rol === 'gast') return { status: 409, error: 'Een oppas of familielid logt in met een eigen account en uitnodiging.' };
    if (p.rol === 'beheerder' && !(p.account && p.account.userId === userId))
      return { status: 403, error: 'Een andere beheerder logt zelf in.' };
    if (isBeschermd(p) && volwassen !== true)
      return { status: 403, error: 'Kinderfuncties gaan open zodra RTG je paspoort heeft gecontroleerd.', hoe: 'paspoort' };
    const token = gezinstoken.geef(g, p); save();
    return { code: g.code, token, profiel: pubProfiel(p, true), gezin: pubGezin(g) };
  }

  /* Een kind toevoegen: alleen met een gecontroleerd paspoort. */
  function kind({ userId, volwassen, naam, geboortedatum, avatar, kleur }) {
    const g = accountGezin(userId);
    if (!g) return { status: 404, error: 'Maak eerst je gezin aan.' };
    if (volwassen !== true)
      return { status: 403, error: 'Een kind toevoegen kan zodra RTG je paspoort heeft gecontroleerd.', hoe: 'paspoort' };
    const n = schoon(naam, 40);
    if (!n) return { status: 400, error: 'Vul een naam in voor je kind.' };
    const geboorte = geboorteInfo(geboortedatum);
    if (!geboorte) return { status: 400, error: 'Vul een geldige geboortedatum in, zodat de leeftijdspas klopt.' };
    if (geboorte.leeftijd >= 18) return { status: 409, error: 'Wie 18 of ouder is, maakt een eigen account en wordt uitgenodigd.' };
    /* Een dubbeltik is geen tweede kind: dezelfde naam met dezelfde
       geboortedatum geeft het profiel terug dat er al staat. */
    const al = Object.values(g.profielen).find(x => x.rol === 'kind' && x.naam === n && x.geboren === geboorte.datum);
    if (al) return { profiel: pubProfiel(al, true), bestond: true };
    if (Object.keys(g.profielen).length >= MAX_PROFIELEN) return { status: 400, error: 'Een gezin kan tot 12 profielen hebben.' };
    const p = { id: rid(4), naam: n, rol: 'kind', avatar: schoonAvatar(avatar), kleur: schoonKleur(kleur),
      geboren: geboorte.datum, groep: groepVanLeeftijd(geboorte.leeftijd), at: nu() };
    ensureCodenaam(p);
    g.profielen[p.id] = p; save();
    try { gctx.welkomRtf(p.codenaam); } catch (e) {}
    return { profiel: pubProfiel(p, true) };
  }

  function mijn(userId) {
    const g = accountGezin(userId);
    return g ? overzicht(g, userId) : { gezin: null };
  }

  /* "Verwijder mijn account" (kern/vergeten.js): het gezin dat AAN dit account
     hangt gaat mee, en de koppelingen als oppas of familie bij een ander gezin
     gaan los. Laat het gezin staan en er blijven gegevens van kinderen achter
     zonder iemand die ze kan inzien of wissen. Gooit als een wisser ontbreekt:
     een stille no-op zou "verwijderd" zeggen over een gezin dat er nog staat. */
  function vergeetAccount(userId) {
    const g = accountGezin(userId);
    if (g) {
      if (typeof ctx.wisGezin !== 'function') throw new Error('gezinswisser ontbreekt');
      ctx.wisGezin(g);
    }
    if (typeof ctx.unlinkGast !== 'function') throw new Error('gastkoppeling-wisser ontbreekt');
    ctx.unlinkGast({ userId });
    return { gezinGewist: !!g };
  }
  /* volwassen() komt laat binnen (server.js), want kern/volwassen.js bestaat
     pas na de foundation-router. */
  function setVolwassen(fn) { ctx.volwassenSleutel = typeof fn === 'function' ? fn : null; }

  return { accountGezin, eigenGezinMaak: maak, eigenGezinSessie: sessie, eigenGezinKind: kind, eigenGezin: mijn,
    vergeetAccount, setVolwassen, volwassenAccount: plicht.volwassenAccount };
};

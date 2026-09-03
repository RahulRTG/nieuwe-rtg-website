/* ============================================================================
   RTMAIL ALS INGANG -- een bericht van buiten wordt een Servicezaak.

   HET GAT. `klassen.js` droeg voor het kanaal `mail` de reden "RTMail heeft geen
   ingang die post aan een zaak koppelt". Post kwam wel binnen, maar belandde in
   een postvak waar niemand een wachtrij van maakt.

   HET BESLUIT VAN DE EIGENAAR was: de melder wordt teruggevonden VIA DE
   IDENTITEITSKLUIS. Dat is een echte keuze met een echte prijs, en die prijs
   staat hier uitgeschreven in plaats van in een toelichting:

     de mailingang wordt daarmee een LEESWEG NAAR DE KLUIS. Een adres omzetten
     naar een codenaam is precies wat de scheiding uit CLAUDE.md tegenhoudt, dus
     deze weg draagt dezelfde plichten als elke andere inzage: een reden, een
     regel in het inzagejournaal, en een aanroeper die te noemen is. Dat de
     aanroeper hier een systeem is en geen mens, maakt de regel niet lichter --
     het maakt hem alleen makkelijker te vergeten.

   EN DE SCHERPSTE VRAAG IS NIET DE KLUIS MAAR DE AFZENDER. `From:` is door
   iedereen te typen. Wie op een vervalste From vertrouwt, opent een zaak op
   naam van een ANDER lid -- en die zaak verschijnt daarna in de app van dat lid,
   met de tekst van een vreemde erin, en alles wat de behandelaar erover schrijft
   gaat naar de verkeerde. Dat is geen ongemak maar een lek.

   Daarom: de kluis wordt pas geraadpleegd als de STEMPEL het adres draagt. DKIM
   of DMARC moet geslaagd zijn (`kern/mailin`-stempel, overgenomen door
   `kern/mailaanname.js`); SPF alleen is niet genoeg, want die spreekt over de
   envelop-afzender en niet over de From die het lid ziet en die wij opzoeken.
   Zonder die stempel wordt er niet opgezocht en geen zaak geopend -- en dat
   wordt GEMELD, niet stil weggegooid: post die verdwijnt is erger dan post die
   geweigerd wordt.

   WAT ER GEBEURT ALS WIJ HET ADRES NIET KENNEN: geen zaak. Niet omdat het niet
   kan, maar omdat er dan geen weg terug is -- deze laag kent geen mensen en kan
   niemand mailen die zij niet als melder kan noemen. Een wachtrij vullen waar
   niemand uit komt is erger dan hem niet vullen (dezelfde regel als in de
   hulp-la). Het antwoord zegt dat, met de weg die wel werkt.
   ========================================================================== */
'use strict';

/* HET ADRES STAAT HIER EN NERGENS ANDERS. Eén plek, om dezelfde reden als in
   kern/rtmail-wie.js: zodra een tweede bestand uitrekent welk adres "de
   servicebus" is, kijken twee ingangen in een andere bus. Bij post is dat geen
   schoonheidsfout maar een lek. Het domein komt uit kern/rtmail-adres.js en
   wordt hier niet overgetypt. */
const HULPLOKAAL = 'hulp';
const hulpAdres = () => HULPLOKAAL + '@' + require('../rtmail-adres').domeinVoor('kantoor');
const isHulpAdres = (a) => String(a || '').trim().toLowerCase() === hulpAdres();

/* De stempels waarop wij een From durven te geloven. `geslaagd` is het woord dat
   kern/mailaanname.js gebruikt; de ruwe uitslag ernaast is er niet altijd. */
const GELOOFD = (c) => {
  const g = (v) => String(v || '').toLowerCase() === 'geslaagd';
  return g(c && c.dmarc) || g(c && c.dkim);
};

module.exports = function maakServicePost({ zaken, loop, accounts, inzagelog }) {

  /* DE KLUISVRAAG, en de enige plek waar deze laag hem stelt. Een treffer levert
     een CODENAAM en niets anders -- de rij zelf blijft in de kluis. */
  function melderVoor(adres, { reden } = {}) {
    const a = String(adres || '').trim().toLowerCase();
    if (!a || a.indexOf('@') < 1) return { gevonden: false, waarom: 'Dit is geen adres.' };
    let u = null;
    try { u = accounts && accounts.findByLogin ? accounts.findByLogin(a) : null; } catch (e) { u = null; }
    if (!u || !u.codename) return { gevonden: false, waarom: 'Dit adres hoort bij geen RTG-account.' };

    /* DE JOURNAALREGEL HOORT BIJ DE OPZOEKING, NIET BIJ DE ZAAK. Ook als er
       daarna geen zaak ontstaat, is er in de kluis gekeken -- en juist die
       gevallen zijn de interessante. Wie hem pas bij een geslaagde zaak schrijft,
       maakt de mislukte pogingen onzichtbaar. */
    try {
      if (inzagelog && inzagelog.noteer) {
        inzagelog.noteer({ door: 'systeem:service-post', over: { id: u.id, codenaam: u.codename },
          waarom: reden || 'Een bericht aan het servicepostvak, om de melder te kunnen terugvinden.',
          bron: 'service/post' });
      }
    } catch (e) {}
    return { gevonden: true, melder: u.codename };
  }

  /* Een bericht aannemen. `controles` komt van kern/mailaanname.js en is de
     stempel; hij wordt hier gelezen en nooit overgeschreven. */
  function ontvang({ van, onderwerp, tekst, controles, bericht } = {}) {
    const titel = String(onderwerp || '').replace(/[<>]/g, '').trim().slice(0, 120);
    if (!GELOOFD(controles)) {
      return { status: 403, geweigerd: 'afzender',
        error: 'Wij openen geen zaak op een afzender die niet is bevestigd. DKIM en DMARC zijn ' +
          'allebei niet geslaagd, en op een niet-bevestigde afzender zou deze zaak in de app van ' +
          'iemand anders kunnen verschijnen. Meld het in de app; daar staat u al vast.' };
    }
    const w = melderVoor(van, { reden: 'Bericht aan het servicepostvak: "' + titel.slice(0, 60) + '"' });
    if (!w.gevonden) {
      return { status: 404, geweigerd: 'onbekend', waarom: w.waarom,
        error: 'Wij kennen dit adres niet als RTG-account, en zonder melder kan niemand deze ' +
          'melding beantwoorden. Meld het in de app, of gebruik het adres waarmee u bij RTG bekend bent.' };
    }

    const r = zaken.open({
      melder: w.melder, doelgroep: 'lid', kanaal: 'mail', bron: 'rtmail',
      titel: titel || 'Bericht per e-mail', tekst: String(tekst || '').slice(0, 4000),
      /* HET BERICHT ALS VERWIJZING EN NOOIT ALS INHOUD-ERBIJ. De zaak draagt een
         soort plus een code; wat er in dat bericht staat blijft in RTMail, waar
         het al onder zijn eigen recht valt. `zaken.verwijzing()` gooit al het
         andere weg -- dat is de grens uit par. 2 van SERVICE.md en niet een
         voorzorg van deze module. */
      betrokken: bericht ? { soort: 'bericht', code: String(bericht) } : null
    });
    if (r.error) return r;

    /* De afzender leest zijn eigen zaak in de app en niet in zijn mailbox: deze
       laag stuurt geen post terug. Wat er WEL gebeurt staat op de tijdlijn, zodat
       een behandelaar ziet waar dit vandaan kwam. */
    try {
      const z = zaken.vind(r.zaak.id);
      if (z) loop.noteer(z, { soort: 'notitie', van: 'systeem',
        tekst: 'Binnengekomen per e-mail. De afzender is bevestigd met ' +
          ((controles && String(controles.dmarc).toLowerCase() === 'geslaagd') ? 'DMARC' : 'DKIM') +
          '; het adres is via de identiteitskluis teruggevoerd op deze codenaam.' });
    } catch (e) {}
    return Object.assign({}, r, { let: 'Deze melding staat nu ook in de app van het lid.' });
  }

  return { ontvang, melderVoor, GELOOFD, hulpAdres, isHulpAdres };
};

/* DE RTG-KANT VAN EEN BIJSTANDSSESSIE -- betreden, kijken, voorstellen,
   uitvoeren, afsluiten.

   Er staat hier met opzet GEEN functie die een sessie aanmaakt. Die staat in
   ./bijstand-klant.js, en dat is de vorm van de belofte: RTG kan zichzelf geen
   toegang geven. Wie dat wil veranderen, moet een route bijbouwen in het andere
   bestand -- en dat valt op.

   EEN GEDEELDE CODE BETREEDT GEEN KLANTOMGEVING. Wie met de gedeelde
   kantoorcode binnenkomt heet in het journaal `kantoor (gedeelde code)`, één
   naam voor iedereen die zo binnenkomt. Zo'n naam kan niet in een verslag staan
   als degene die het deed, dus hij komt er niet in. Dezelfde grendel als bij de
   vier-ogen-goedkeuring in ./beleid.js.

   EN DEZE LAAG VOERT ZELF NIETS UIT. `voerUit()` bewaakt de toestemming en
   schrijft de uitslag op; wat er werkelijk aan gegevens verandert, loopt door
   de hersteltransactie (./transactie.js). Een tweede schrijfpad zou betekenen
   dat er wijzigingen zijn die de voorcontrole en de verificatie overslaan --
   precies wat die laag moet voorkomen. */
'use strict';

const niveaus = require('./bijstand-niveaus');
const GEDEELD = /gedeelde code/i;

function maakRtgkant(C) {
  const { vind, levend, stand, kort, dossier, spoor, noteer, nu, save, diagnose } = C;

  /* Elke handeling hieronder stelt dezelfde drie vragen. Ze staan hier één keer,
     want drie kopieën lopen uiteen zodra er een vierde handeling bij komt. */
  function poort(id, medewerker, watMag) {
    const s = vind(id);
    if (!s) return { error: 'Die sessie bestaat niet.', status: 404 };
    if (!levend(s)) return { error: 'Die sessie loopt niet meer (' + stand(s) + ').', status: 409 };
    if (s.medewerker !== String(medewerker)) return { error: 'Deze sessie is van iemand anders.', status: 403 };
    if (watMag && !niveaus.mag(s.niveau, watMag)) {
      return { error: 'Op het niveau "' + s.niveau + '" mag er niets worden ' +
        (watMag === 'uitvoeren' ? 'uitgevoerd' : 'voorgesteld') + '.', status: 403 };
    }
    return { s };
  }

  function betreed(id, medewerker) {
    const s = vind(id);
    if (!s) return { error: 'Die sessie bestaat niet.', status: 404 };
    if (!levend(s)) return { error: 'Die sessie loopt niet meer (' + stand(s) + ').', status: 409 };
    const wie = String(medewerker || '');
    if (!wie || GEDEELD.test(wie)) {
      return { error: 'Een gedeelde kantoorcode betreedt geen klantomgeving. Log in met uw eigen RTG-account.',
        status: 403 };
    }
    if (s.medewerker && s.medewerker !== wie) {
      return { error: 'Deze sessie is al betreden door ' + s.medewerker + '.', status: 409 };
    }
    s.medewerker = wie; s.status = 'bezig'; s.betredenAt = s.betredenAt || nu();
    noteer(s, wie, 'bijstand betreden', 'niveau ' + s.niveau + ' bij ' + s.org);
    spoor(s, wie + ' van RTG is verbonden.');
    save();
    return { sessie: dossier(s.id) };
  }

  /* Kijken. Wat er te zien is hangt aan de inhoudsstand, en die wordt HIER
     gerekend en niet door de aanroeper meegegeven. */
  function kijk(id, medewerker, wat) {
    const p = poort(id, medewerker, null);
    if (p.error) return p;
    const s = p.s;
    const d = diagnose.voor(s.org, { inhoud: s.inhoud.open, wat });
    spoor(s, String(medewerker) + ' bekeek ' + (d.watIkKeek || 'de diagnose') + '.');
    save();
    return { sessie: kort(s), diagnose: d };
  }

  function stelVoor(id, medewerker, h) {
    const p = poort(id, medewerker, 'voorstellen');
    if (p.error) return p;
    const s = p.s;
    const wat = String((h && h.wat) || '').trim();
    if (wat.length < 5) return { error: 'Een voorstel zonder omschrijving kan niemand goedkeuren.', status: 400 };
    /* Bij `nood` gaf de klant zijn akkoord vooraf. Dat wordt hier VASTGELEGD als
       de reden waarom deze handeling goedgekeurd staat, en niet stil
       overgeslagen: in het verslag moet leesbaar zijn wie wanneer ja zei. */
    const rij = { wat: wat.slice(0, 300), waarom: String((h && h.waarom) || '').slice(0, 500),
      door: String(medewerker), at: nu(),
      status: s.voorafAkkoord ? 'goedgekeurd' : 'voorgesteld',
      besluitDoor: s.voorafAkkoord ? 'vooraf, bij het openen van de noodsessie' : null,
      besluitAt: s.voorafAkkoord ? s.at : null, uitslag: null };
    s.handelingen.push(rij);
    noteer(s, String(medewerker), 'bijstand voorstel', wat);
    spoor(s, String(medewerker) + ' stelt voor: ' + wat);
    save();
    return { sessie: dossier(s.id), index: s.handelingen.length - 1 };
  }

  function voerUit(id, medewerker, index, uitslag) {
    const p = poort(id, medewerker, 'uitvoeren');
    if (p.error) return p;
    const s = p.s;
    const h = s.handelingen[Number(index)];
    if (!h) return { error: 'Die handeling bestaat niet.', status: 404 };
    if (h.status !== 'goedgekeurd') {
      return { error: 'Deze handeling is niet goedgekeurd door de organisatie (' + h.status + ').', status: 403 };
    }
    h.status = 'uitgevoerd'; h.uitAt = nu();
    h.uitslag = String(uitslag || '').slice(0, 500) || 'geen uitslag opgegeven';
    noteer(s, String(medewerker), 'bijstand uitgevoerd', h.wat + ' -- ' + h.uitslag);
    spoor(s, String(medewerker) + ' voerde uit: ' + h.wat);
    save();
    return { sessie: dossier(s.id) };
  }

  function vraagInhoud(id, medewerker, reden) {
    const p = poort(id, medewerker, null);
    if (p.error) return p;
    const s = p.s;
    const r = String(reden || '').trim();
    if (r.length < 15) return { error: 'Waarom is de inhoud nodig? Zonder reden gaat er niets open.', status: 400 };
    s.inhoud.verzoek = { reden: r.slice(0, 500), door: String(medewerker), at: nu() };
    s.inhoud.besluitAt = null; s.inhoud.besluitDoor = null;
    noteer(s, String(medewerker), 'bijstand inhoud gevraagd', r);
    spoor(s, String(medewerker) + ' vraagt toegang tot inhoud: ' + r);
    save();
    return { sessie: dossier(s.id) };
  }

  /* Afsluiten met een verslag, en dat is verplicht om dezelfde reden als bij een
     incident: een sessie die sluit met een leeg veld laat een klant achter met
     "er is iemand binnen geweest" en verder niets. */
  function sluit(id, medewerker, tekst) {
    const s = vind(id);
    if (!s) return { error: 'Die sessie bestaat niet.', status: 404 };
    if (s.status === 'gesloten') return { error: 'Die sessie is al afgesloten.', status: 409 };
    const t = String(tekst || '').trim();
    if (t.length < 15) {
      return { error: 'Sluit af met een verslag: wat was er, wat is er gedaan, wat was de uitkomst.', status: 400 };
    }
    const dicht = nu();
    s.status = 'gesloten'; s.geslotenAt = dicht;
    if (s.tot > dicht) s.tot = dicht;
    s.verslag = { tekst: t.slice(0, 4000), door: String(medewerker || 'onbekend'), at: dicht,
      handelingen: s.handelingen.length,
      uitgevoerd: s.handelingen.filter(h => h.status === 'uitgevoerd').length,
      geweigerd: s.handelingen.filter(h => h.status === 'geweigerd').length,
      /* Deze twee horen in het verslag omdat ze de enige twee zijn die een klant
         achteraf niet meer kan nazoeken zonder het spoor door te lezen. */
      inhoudGeopend: !!s.inhoud.open, voorafAkkoord: !!s.voorafAkkoord,
      duurMinuten: Math.round((Date.parse(dicht) - Date.parse(s.at)) / 60000) };
    noteer(s, s.verslag.door, 'bijstand afgesloten', t.slice(0, 200));
    spoor(s, 'De sessie is afgesloten met een verslag.');
    save();
    return { sessie: dossier(s.id) };
  }

  return { betreed, kijk, stelVoor, voerUit, vraagInhoud, sluit };
}

module.exports = { maakRtgkant };

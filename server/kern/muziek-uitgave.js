/* RTG Klankwerk (deelmodule): uitgeven, en de plek waar het te horen is.

   Een stuk dat af is wil ergens heen. Hier is dat twee dingen tegelijk: een
   UITGAVE (het staat officieel op naam) en een PLEK waar andere makers het
   horen. Geen aparte "sociale app" ernaast -- dat zou betekenen dat je twee
   keer hetzelfde moet doen.

   ONDER WIENS NAAM. Twee mogelijkheden, en het verschil is wezenlijk:

   1. ONDER JE CODENAAM. Dat doe je zelf, meteen. Het is jouw werk en je hoeft
      niemand om toestemming te vragen. De echte naam blijft in de kluis: een
      uitgave reist, en wat reist draagt geen echte naam (server/accounts).
   2. ONDER DE RTG-NAAM. Dat is een AANVRAAG, geen knop. RTG die zijn naam
      ergens onder zet, is RTG die ergens voor instaat -- en dat kan alleen een
      MENS bij het kantoor besluiten. Rahul niet, de app niet, en de maker
      evenmin. Dezelfde regel als bij de Lifestyle- en Business Pass: de AI
      belooft nooit zelf toegang of een naam.

   Wordt zo'n aanvraag afgewezen, dan blijft de uitgave gewoon staan onder de
   codenaam. Afwijzen betekent hier "niet onder onze naam", niet "weg ermee".

   DE MAKERS STAAN ER ALLEMAAL BIJ. Wie meewerkte, met welke rol, wordt bij het
   uitgeven VASTGELEGD -- niet later opnieuw opgezocht. Zo verdwijnt niemand uit
   de aftiteling doordat hij daarna uit het stuk gehaald wordt.

   Wat hier NIET komt: een hitlijst, een teller "meest beluisterd van de week",
   of een volgorde op populariteit. Dezelfde ranglijst die Genootschap, De Salon
   en de RTMAIL-teams al weigerden. De zaal is chronologisch, eindig, en heeft
   een bodem. */
const ONDER = ['codenaam', 'rtg'];
const ZAAL = 30;                 // wat je in één keer te horen krijgt
const MAX_REACTIES = 200;

module.exports = ({ db, save, crypto, schoon, trackMet, codenaamVan, makersVan, publiekeTrack, notify, nieuwWerk }) => {
  const nu = () => new Date().toISOString();
  const rid = () => 'u' + crypto.randomBytes(5).toString('hex');

  const eigen = require('./eigencollectie')({ db, domein: 'kern/muziek-uitgave', bezit: { muziekUitgaven: 'kaart' } });
  function U() {
    const u = eigen.bak('muziekUitgaven');
    if (!Array.isArray(u.lijst)) u.lijst = [];
    if (!u.reacties || typeof u.reacties !== 'object') u.reacties = {};
    return u;
  }
  const uitgaveMet = (id) => U().lijst.find(x => x.id === String(id || '')) || null;
  const vanTrack = (trackId) => U().lijst.find(x => x.trackId === trackId) || null;

  /* Uitgeven. Het stuk wordt HIER GEKOPIEERD, niet gelinkt: wie later in de
     studio verder sleutelt, verandert niet met terugwerkende kracht wat er is
     uitgegeven. Een uitgave hoort vast te liggen; dat is het hele idee. */
  function geefUit(sess, trackId, invoer) {
    const t = trackMet(trackId);
    if (!t) return { status: 404, error: 'Dit stuk bestaat niet.' };
    if (t.key !== sess.key) return { status: 403, error: 'Alleen de eigenaar geeft een stuk uit.' };
    if (!t.klaar) return { status: 400, error: 'Noem het stuk eerst klaar.' };
    const v = invoer || {};
    const onder = ONDER.includes(String(v.onder || '')) ? v.onder : 'codenaam';
    const bestaand = vanTrack(t.id);
    if (bestaand) return { status: 409, error: 'Dit stuk is al uitgegeven.', uitgave: publiek(bestaand, sess.key) };

    const makers = (makersVan(t) || []).map(m => ({ codenaam: m.codenaam, rol: m.rol, eigenaar: !!m.eigenaar }));
    const u = {
      id: rid(), trackId: t.id, key: sess.key,
      naam: t.naam, bpm: t.bpm, maten: t.maten,
      // de klinkende inhoud, bevroren op het moment van uitgeven
      kanalen: JSON.parse(JSON.stringify(t.kanalen || [])),
      secties: JSON.parse(JSON.stringify(t.secties || [])),
      toelichting: schoon(v.toelichting, 300),
      makers,
      onder: onder === 'rtg' ? 'codenaam' : 'codenaam',   // tot een mens anders beslist
      rtgAanvraag: onder === 'rtg' ? 'gevraagd' : null,
      rtgReden: '',
      mooi: {}, at: nu()
    };
    U().lijst.unshift(u);
    save();
    if (onder === 'rtg' && notify) {
      try { notify('kantoor', 'Klankwerk: aanvraag om uit te geven onder de RTG-naam ("' + u.naam + '").'); } catch (e) {}
    }
    /* Nieuw werk: de Media OS wekt de volgers die MUZIEK van deze maker aan
       hebben staan. Laat gebonden en optioneel -- het Klankwerk hoeft niet te
       weten dat er een laag boven hem hangt, en werkt zonder hem gewoon door. */
    if (nieuwWerk) { try { nieuwWerk(sess.key, 'muziek', u.naam); } catch (e) {} }
    return { status: 200, ok: true, uitgave: publiek(u, sess.key) };
  }

  // Terugtrekken. Je eigen werk, dus je eigen besluit -- ook na een aanvraag.
  function trekIn(sess, id) {
    const u = uitgaveMet(id);
    if (!u || u.key !== sess.key) return { status: 404, error: 'Deze uitgave bestaat niet.' };
    U().lijst = U().lijst.filter(x => x.id !== u.id);
    delete U().reacties[u.id];
    save();
    return { status: 200, ok: true };
  }

  /* De RTG-naam alsnog aanvragen voor iets dat al uitkwam onder je codenaam.
     Ook dit is een aanvraag; er verandert niets tot een mens ja zegt. */
  function vraagRtg(sess, id) {
    const u = uitgaveMet(id);
    if (!u || u.key !== sess.key) return { status: 404, error: 'Deze uitgave bestaat niet.' };
    if (u.onder === 'rtg') return { status: 409, error: 'Dit staat al onder de RTG-naam.' };
    if (u.rtgAanvraag === 'gevraagd') return { status: 409, error: 'De aanvraag ligt al bij het kantoor.' };
    u.rtgAanvraag = 'gevraagd';
    u.rtgReden = '';
    save();
    if (notify) { try { notify('kantoor', 'Klankwerk: aanvraag om uit te geven onder de RTG-naam ("' + u.naam + '").'); } catch (e) {} }
    return { status: 200, ok: true, uitgave: publiek(u, sess.key) };
  }

  /* De kantoorkant. ALLEEN HIER kan de RTG-naam eronder komen, en alleen door
     een mens die met een kantoorinlog is binnengekomen. */
  const kantoorLijst = () => ({ status: 200,
    aanvragen: U().lijst.filter(u => u.rtgAanvraag === 'gevraagd').map(u => ({
      id: u.id, naam: u.naam, makers: u.makers, toelichting: u.toelichting, at: u.at
    })) });

  function kantoorBeslis(id, ja, reden) {
    const u = uitgaveMet(id);
    if (!u) return { status: 404, error: 'Deze uitgave bestaat niet.' };
    if (u.rtgAanvraag !== 'gevraagd') return { status: 409, error: 'Hier ligt geen aanvraag.' };
    u.rtgAanvraag = ja ? 'ja' : 'nee';
    u.rtgReden = schoon(reden, 300);
    if (ja) u.onder = 'rtg';
    save();
    if (notify) {
      try {
        notify(u.key, ja
          ? 'Uw stuk "' + u.naam + '" komt uit onder de RTG-naam.'
          : 'Uw stuk "' + u.naam + '" blijft onder uw codenaam staan.' + (u.rtgReden ? ' ' + u.rtgReden : ''));
      } catch (e) {}
    }
    return { status: 200, ok: true, onder: u.onder, aanvraag: u.rtgAanvraag };
  }

  /* De zaal: wat er te horen is. Chronologisch, eindig, met een bodem -- geen
     volgorde op populariteit, want dan zou het een wedstrijd worden. */
  function zaal(sess, opties) {
    const o = opties || {};
    let rij = U().lijst.slice();
    if (o.alleenRtg) rij = rij.filter(u => u.onder === 'rtg');
    if (o.vanMij) rij = rij.filter(u => u.key === sess.key);
    const totaal = rij.length;
    const uit = rij.slice(0, ZAAL).map(u => publiek(u, sess.key));
    return { status: 200, uitgaven: uit, totaal,
      einde: uit.length >= totaal ? 'Dat is alles wat er nu staat.' : 'Meer staat er nog niet voor u klaar.',
      uitleg: 'Op volgorde van wanneer ze uitkwamen. Er is geen hitlijst en geen aanbevolen volgorde: ' +
        'wie er bovenaan staat, staat daar omdat hij de laatste was.' };
  }

  const luister = (sess, id) => {
    const u = uitgaveMet(id);
    if (!u) return { status: 404, error: 'Deze uitgave bestaat niet.' };
    return { status: 200, uitgave: Object.assign(publiek(u, sess.key),
      { kanalen: u.kanalen, secties: u.secties, bpm: u.bpm, maten: u.maten, stappen: 16 * u.maten }) };
  };

  /* "Mooi" is één keer per persoon en zonder ranglijst: het is een schouderklop
     aan de maker, geen score. Je kunt hem ook weer weghalen. */
  function mooi(sess, id, aan) {
    const u = uitgaveMet(id);
    if (!u) return { status: 404, error: 'Deze uitgave bestaat niet.' };
    if (!u.mooi || typeof u.mooi !== 'object') u.mooi = {};
    if (aan === false) delete u.mooi[sess.key]; else u.mooi[sess.key] = true;
    save();
    return { status: 200, ok: true, mooi: Object.keys(u.mooi).length, ikVindHem: !!u.mooi[sess.key] };
  }

  function reageer(sess, id, tekst) {
    const u = uitgaveMet(id);
    if (!u) return { status: 404, error: 'Deze uitgave bestaat niet.' };
    const t = schoon(tekst, 300);
    if (!t) return { status: 400, error: 'Schrijf eerst iets.' };
    const rij = U().reacties[u.id] = U().reacties[u.id] || [];
    const r = { codenaam: codenaamVan(sess.key), tekst: t, at: nu() };
    rij.push(r);
    if (rij.length > MAX_REACTIES) U().reacties[u.id] = rij.slice(-MAX_REACTIES);
    save();
    return { status: 200, ok: true, reactie: r };
  }
  const reacties = (id) => ({ status: 200, reacties: (U().reacties[String(id || '')] || []).slice(-60) });

  /* Wat een uitgave naar buiten toont, en alles van één maker: dat staat in
     ./muziek-uitgave-beeld.js. Apart, omdat het een eigen onderwerp is (welke
     velden mogen naar buiten, en welke nooit) en omdat dit bestand anders over
     de omvangregel van de keuring gaat. */
  const { publiek, vanMaker } = require('./muziek-uitgave-beeld')({ U, codenaamVan });

  return { muziekGeefUit: geefUit, muziekTrekIn: trekIn, muziekVraagRtg: vraagRtg,
    muziekZaal: zaal, muziekLuister: luister, muziekMooi: mooi, muziekReageer: reageer,
    muziekReacties: reacties, muziekUitgavenVan: vanMaker,
    // "is dit stuk al uitgegeven?" -- de studio moet dat kunnen vragen zonder de
    // hele zaal op te halen en op naam te gaan raden
    muziekUitgaveVan: (sess, trackId) => {
      const u = vanTrack(String(trackId || ''));
      return { status: 200, uitgave: u ? publiek(u, sess.key) : null };
    },
    muziekKantoorLijst: kantoorLijst, muziekKantoorBeslis: kantoorBeslis, MUZIEK_ONDER: ONDER };
};

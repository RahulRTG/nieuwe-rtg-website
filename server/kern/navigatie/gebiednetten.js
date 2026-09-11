/* DE MOTOREN PER GEBIED -- welk pakket hoort bij dit punt, en is het geladen.

   Hiervoor kende de navigatie precies EEN pakket: Nederland, met een vak en
   een bestandsnaam in de code. Daarbuiten viel alles terug op het
   demonstratieraster, ook als er een gebouwd pakket naast lag. Deze module is
   de schakel die dat opent: ./gebieden.js zegt WAT er is, ./gebiednet.js kan
   er een motor van maken, en hier wordt het gekoppeld en onthouden.

   DRIE REGELS, EN ALLE DRIE ZIJN ZE EEN KEUZE:

     HET EIGEN PAKKET GAAT VOOR. Ligt er een OSM-pakket over Nederland naast
     het NWB-pakket, dan wint het NWB: dat bouwt RTG zelf uit een CC0-bron en
     het wordt dagelijks ververst. De aanroeper geeft dat pakket mee als
     `eersteKeus`; deze module kiest niet tussen bronnen op kwaliteit -- dat
     zou een oordeel zijn dat nergens is gemeten.

     DE LICENTIEPOORT STAAT HIER OOK. Een pakket waarvan de naamsvermelding
     niet meekomt, wordt niet geladen (`gebieden.mag()`), en de reden gaat mee
     naar boven. Een kaart tonen zonder de vermelding die de licentie eist, is
     geen kleine slordigheid maar het overtreden van de voorwaarde waaronder
     wij de data mogen gebruiken.

     EEN MOTOR DIE NIET LAADT WORDT ONTHOUDEN, en wel MET zijn reden. Anders
     probeert elk volgend verzoek opnieuw een bestand te openen dat er niet is,
     en dat is precies het soort stille kosten dat niemand terugvindt. De
     sleutel is de gebiedscode; een nieuw pakket vraagt dus een herstart -- dat
     staat in het antwoord (`herstartNodig`) en niet alleen hier.

     "HIER IS GEEN GEBIED" IS NIET "HIER IS GEEN MOTOR", en dat verschil is
     gemeten en geen fijnzinnigheid: toen `laad()` bij een niet-gebouwd pakket
     nog `null` gaf, viel een punt in Frankrijk door naar het
     demonstratieraster en kwam er een route van 1583 km met een echte
     reistijd uit. Een aangeboden gebied zonder pakket levert daarom een gebied
     ZONDER net plus de reden, en de aanroeper weigert daarop. */
'use strict';

const gebieden = require('./gebieden');
const { maakGebiedNet } = require('./gebiednet');

function maakGebiedNetten({ haversine, eersteKeus, eersteKeusBinnen, maakRouteMotor }) {
  /* code -> { code, naam, net, reden, stempel }. `net: null` betekent BEPROEFD
     EN NIET GELUKT, met de reden erbij. */
  const geladen = new Map();
  /* De routemotor wordt LUI gemaakt en onthouden. Hij werd eerst bij elke
     `voorPunt()` gebouwd, en die wordt door navKaart, navBestemmingen en navPoi
     aangeroepen: dan bouwt elk verzoek van een lid een hele route-engine die
     meteen wordt weggegooid. Alleen `routeVoor()` heeft hem nodig. */
  const motoren = new Map();
  function motorVan(post) {
    if (!post || !post.net || !maakRouteMotor) return null;
    if (!motoren.has(post.code)) motoren.set(post.code, maakRouteMotor(post.net));
    return motoren.get(post.code);
  }

  function laad(gebied) {
    const code = gebied && gebied.code;
    if (!code) return null;
    const stempel = gebieden.pakketStempel();
    const eerder = geladen.get(code);
    /* EEN GELUKTE MOTOR BLIJFT STAAN; een MISLUKKING wordt opnieuw beproefd
       zodra de pakketmap verandert. Dat is geen fijnzinnigheid: de catalogus
       ziet een nieuw pakket wel (hij hangt aan diezelfde stempel), dus zonder
       dit zou het scherm van een lid "Gebouwd" tonen terwijl de route bleef
       weigeren -- twee schermen die op een dag iets anders zeggen over
       hetzelfde, en dat is precies wat BESTUUR.md verbiedt. */
    if (eerder && (eerder.net || eerder.stempel === stempel)) return eerder;
    const stuk = (reden) => {
      const uit = { code, naam: gebied.naam, net: null, reden, stempel };
      geladen.set(code, uit);
      return uit;
    };
    const poort = gebieden.mag(gebied);
    if (!poort.ok) return stuk(poort.reden);
    const pakket = gebieden.pakketVan(code);
    const net = pakket && maakGebiedNet({ bestand: pakket.db, graafMap: pakket.graafMap,
      gebied: { code, naam: gebied.naam, netwerk: 'OSM', vak: gebied.vak }, haversine });
    if (!net) {
      return stuk('De kaart van ' + (gebied.naam || code) + ' is aangeboden maar niet geladen: het pakket ' +
        'staat niet in RTG_DATA_DIR. Bouw hem, of kies een gebied dat wel gebouwd is.');
    }
    const uit = { code, naam: gebied.naam, net, reden: null, stempel };
    geladen.set(code, uit);
    return uit;
  }

  /* Het eigen pakket EEN keer: hij is al geladen door kern/navigatie.js, dus
     hier hoort alleen de post eromheen -- en die hoort niet per verzoek
     opnieuw te ontstaan. */
  let eigenPost = null;
  const eigen = () => {
    if (!eigenPost) eigenPost = { code: 'nederland', naam: 'Nederland', net: eersteKeus, reden: null, eigen: true };
    return eigenPost;
  };

  /* Welk gebied hoort bij dit punt? Het eigen pakket eerst, daarna de
     catalogus. Geen gebied is GEEN fout: dan blijft het demonstratieraster
     over, en dat is wat er vandaag ook gebeurt. */
  function voorPunt(punt) {
    if (!punt || punt.lat == null) return null;
    if (eersteKeus && eersteKeusBinnen && eersteKeusBinnen(punt)) return eigen();
    const keuze = gebieden.gebiedVoor(punt);
    if (!keuze || !keuze.gebied) return null;
    return laad(keuze.gebied);
  }

  /* EEN ROUTE LOOPT BINNEN EEN PAKKET. Twee punten in verschillende gebieden
     zijn niet te verbinden: de grafen raken elkaar niet, en een route die aan
     de grens ophoudt zou als een volledige route worden gepresenteerd. Dat is
     dezelfde melding die de Nederlandse dekking al gaf, nu met de naam van het
     gebied erin. */
  function routeVoor(van, naar) {
    const a = voorPunt(van), b = voorPunt(naar);
    if (!a && !b) return { geen: true };
    if (!a || !b || a.code !== b.code) {
      const namen = [a && a.naam, b && b.naam].filter(Boolean);
      return { status: 422, error: namen.length
        ? 'Deze route kruist de rand van ' + namen.join(' en ') + '; RTG rekent binnen een kaart.'
        : 'Deze route kruist de rand van de huidige kaartdekking.' };
    }
    const motor = motorVan(a);
    if (!a.net || !motor) return { status: 503, error: a.reden || 'Voor dit gebied is geen routemotor.',
      gebied: { code: a.code, naam: a.naam } };
    return { motor, gebied: { code: a.code, naam: a.naam } };
  }

  /* Wat er geladen IS, voor de status. Met opzet geen telling van wat er
     aangeboden wordt -- dat weet ./gebieden.js, en twee tellingen van
     hetzelfde ding gaan uit elkaar lopen. */
  const stand = () => ({
    geladen: [...geladen.values()].filter(v => v && v.net).map(v => ({ code: v.code, naam: v.naam })),
    nietGeladen: [...geladen.values()].filter(v => !v || !v.net).map(v => ({ code: v.code, reden: v.reden || null })),
    /* De eerlijke restvoorwaarde. Een pakket dat er NOG NIET was en erna
       gebouwd wordt, verschijnt gewoon (de mislukking wordt opnieuw beproefd);
       een pakket dat AL geladen was en daarna op schijf verandert, blijft de
       oude lezen tot een herstart. */
    herstartNodig: 'Een pakket dat al geladen was en daarna op schijf verandert, wordt pas na een herstart opnieuw gelezen.'
  });

  return { voorPunt, routeVoor, stand };
}

module.exports = { maakGebiedNetten };

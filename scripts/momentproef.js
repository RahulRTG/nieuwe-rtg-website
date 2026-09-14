#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE MOMENTPROEF -- de vierde gouden keten, en de eerste die over een PROJECTIE
   gaat in plaats van over een levering.

   WAAROM DEZE EN NIET EEN VIERDE LEVERKETEN. De tafel, de rit en de toelating
   meten alle drie hetzelfde soort ding: actor A handelt, ziet actor B dat, en
   houdt de keten zijn belofte als het misgaat. Ze eindigen alle drie bij een
   geleverde dienst of een verleende toegang. Deze keten eindigt bij IEMAND DIE
   HET WEET -- er wordt niets geleverd, en aan de bron verandert niets.

   DE WET DIE HIER BEPROEFD WORDT (STAGE.md par. 3):

     De BRON bepaalt DAT iets gebeurd is; Stage bepaalt alleen HOE dat publieke
     feit in deze context wordt gepresenteerd.

   Daaruit volgt de tweede helft van dit script, en die staat in geen van de drie
   bestaande proeven: naast de schakels en de storingen draait er een
   ARCHITECTUURPROEF. Blijft de bron onaangeraakt door alles wat Stage doet, en
   draagt de projectie iets dat alleen zij weet? Een keten die sluit terwijl de
   projectie ondertussen een tweede waarheid is geworden, heeft niets bewezen --
   dat is de `Asset`-fout, een laag later.

   WAT DEZE KETEN ANDERS DOET DAN DE DRIE BESTAANDE, en daarom is hij nuttig als
   vierde meting:

     - er wordt NIETS GELEVERD; de uitkomst is dat iemand iets weet;
     - de ontvanger heeft geen ZAAK met de bron. Hij is geen klant, geen gast en
       geen aanvrager -- alleen volger, en die relatie zegt hij eenzijdig op;
     - er zitten DRIE BRONNEN in EEN keten (een festivalboeking, een
       festivalproduct en een uitlichting in De Salon). Dat is de eigenlijke
       vraag: gedragen drie verschillende domeinen zich hetzelfde als publiek
       moment?
     - de bron mag NIETS MERKEN. Bij de tafel en de rit is de tegenpartij juist
       de bedoeling.

   Draaien:  npm run momentproef           (print, zakt op een open schakel)
             npm run momentproef:vast      (schrijft MOMENTPROEF.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'MOMENTPROEF.json');
/* Een zaak met de capability `tickets`: daar hangt het festival aan, en niet aan
   het genre (zie de kop van routes/festival.js). NACHT is in de zaaiset een club
   en draagt hem. */
const ZAAK = 'NACHT';
const KANTOORCODE = 'RTG-OFFICE-PROEF';

async function post(basis, pad, lijf, tok) {
  const r = await fetch(basis + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {})
  }).catch(() => null);
  if (!r) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

function schakel(nr, van, naar, wat, bekend) { return { nr, van, naar, wat, bekend: bekend || null }; }

/* EEN OPEN SCHAKEL MET EEN UITGESCHREVEN REDEN IS EEN BEVINDING, GEEN DEFECT.
   Dezelfde vorm en dezelfde reden als in scripts/ritproef.js: zonder deze uitweg
   heeft een proef die iets echts vindt maar twee uitgangen -- altijd zakken (dan
   zet iemand hem uit) of de bevinding wegpoetsen (dan meet hij niets meer).
   `bekend` moet een REDEN zijn en geen etiket; test/momentproef.test.js eist een
   minimumlengte en een verwijzing naar waar het besluit hoort te vallen. */

/* De meldingen van een lid, jongste eerst. Deze vorm staat hier een keer omdat
   bijna elke schakel hem nodig heeft -- en omdat er een naad onder zit:
   opzet/meldingen.js schrijft op de sleutel die hij meekrijgt, en
   /api/notifications leest de bak van de TIER EN die van de SLEUTEL en voegt ze
   samen. Wie hier maar een van beide zou lezen, meet de helft (zie REIZEN.md
   par. 9a, waar precies dat een persoonlijk bericht liet verdwijnen). */
async function meldingen(basis, tok) {
  const r = await post(basis, '/api/notifications', {}, tok);
  return ((r.data && r.data.notifications) || []);
}
const media = (lijst) => lijst.filter(n => n && n.title === 'RTG Media');
const noemt = (lijst, stuk) => media(lijst).filter(n => String(n.body || '').includes(stuk));

/* Het kantoor OP NAAM. De gedeelde kantoorcode komt de boardroomdeur niet door
   -- ook niet om te lezen -- en dat is geen hindernis maar de grens zelf: een
   spoor dat eindigt bij een gedeelde code is geen spoor (KANTOOR.md). Storing 4
   meet dat apart; hier wordt de weg gelopen die een medewerker ook loopt. */
async function kantoorOpNaam(basis) {
  const eig = await post(basis, '/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' });
  const tok = eig.data && eig.data.token;
  if (!tok) return null;
  const k = await post(basis, '/api/account/start', { rol: 'kantoor' }, tok);
  return (k.data && k.data.token) || null;
}

/* Wat de BRON van zichzelf zegt. Deze momentopname is het meetinstrument van de
   architectuurproef: hij wordt voor en na een reeks Stage-handelingen genomen en
   moet teken voor teken gelijk zijn. */
async function bronBeeld(basis, S, w) {
  const b = await post(basis, '/api/festival/boekingen', { festival: w.fid, editie: w.eid }, S);
  const p = await post(basis, '/api/festival/producten', { festival: w.fid, editie: w.eid }, S);
  const t = await post(basis, '/api/festival/terrein', { festival: w.fid, editie: w.eid }, S);
  return JSON.stringify({ boekingen: b.data, producten: p.data, terrein: t.data });
}

/* STAP STAAT HIER EN NIET IN loop(), want de sportclubketen hieronder draait op
   een EIGEN server en heeft hem ook nodig. Hem daar overschrijven zou twee
   definities geven van wat een schakel is, en die lopen binnen een week uiteen
   (LAT.md regel 4). */
function maakStap(uit) {
  return async (s, doe, zien) => {
    const t0 = Date.now();
    let r, gezien = null, fout = null;
    try {
      r = await doe();
      if (!r || r.status < 200 || r.status >= 300) {
        /* EEN WEIGERING OP EEN SCHAKEL MET EEN UITGESCHREVEN REDEN IS DEZELFDE
           BEVINDING als een verkeerd antwoord: de keten gaat daar niet verder, en
           er staat opgeschreven waarom. Het onderscheid `stuk` blijft dus voor
           schakels waarvan niemand wist dat ze open stonden -- en het antwoord van
           de server gaat mee in de uitslag, zodat de reden naast het bewijs staat
           en niet in de plaats ervan. */
        uit.schakels.push(Object.assign({}, s, { stand: s.bekend ? 'openBekend' : 'stuk',
          status: r ? r.status : 0,
          antwoord: r && r.data && (r.data.error || null), ms: Date.now() - t0 }));
        return null;
      }
      gezien = zien ? await zien(r) : null;
    } catch (e) { fout = String(e && e.message || e); }
    let stand = fout ? 'stuk' : (!zien ? 'gesloten' : (gezien && gezien.klopt ? 'gesloten' : 'open'));
    if (stand === 'open' && s.bekend) stand = 'openBekend';
    uit.schakels.push(Object.assign({}, s, { stand, status: r ? r.status : 0,
      ziet: gezien ? gezien.wat : null, fout, ms: Date.now() - t0 }));
    return r;
  };
}

async function loop(basis, uit) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const stap = maakStap(uit);

  /* ---- drie mensen en een zaak ----

     DRIE VERSCHILLENDE PASSEN EN NIET DRIE TOKENS. /api/login geeft per pas
     dezelfde demo-SLEUTEL terug: een tweede token op dezelfde pas is dezelfde
     mens met een andere sleutelbos, en een volgerstelling wordt daar stil fout
     van. test/aanwezigheid-routes.e2e.js vond dat door erop te zakken. */
  const fan = (await P('/api/login', { tier: 'rtg' })).data;
  const fan2 = (await P('/api/login', { tier: 'business' })).data;
  const maker = (await P('/api/login', { tier: 'lifestyle' })).data;
  const zaak = (await P('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data;
  if (!fan || !fan.token || !fan2 || !fan2.token || !maker || !maker.token)
    throw new Error('geen drie ledensessies -- draait de server in de testomgeving?');
  if (!zaak || !zaak.token)
    throw new Error('geen zaaksessie -- draait de server met DEMO_SUPPLIER=' + ZAAK + '?');
  const F = fan.token, F2 = fan2.token, M = maker.token, S = zaak.token;
  const persoon = await kantoorOpNaam(basis);
  if (!persoon) throw new Error('geen kantoorsessie op naam -- zonder mens kan er niets worden uitgelicht');

  /* ---- de wereld: een festival met een editie, een dag, een terrein en een
     podium. De zaaiset heeft geen festival, en zonder festival is er niets te
     bevestigen -- dan zou schakel 1 "stuk" heten terwijl de opstelling de oorzaak
     is. Zelfde ingreep als de chauffeur in scripts/ritproef.js, met dezelfde
     grens: de wereld klaarzetten is geen valsspelen, een uitslag klaarzetten wel.
     Alles hieronder loopt langs de gewone routes. */
  const fes = await P('/api/festival/nieuw', { naam: 'Proeffestival' }, S);
  const fid = fes.data && fes.data.festival && fes.data.festival.id;
  if (!fid) throw new Error('geen festival (status ' + fes.status + '): ' + JSON.stringify(fes.data).slice(0, 200));
  const ed = await P('/api/festival/editie', { festival: fid, naam: 'Proef 2027', jaar: 2027 }, S);
  const eid = ed.data && ed.data.editie && ed.data.editie.id;
  const dg = await P('/api/festival/dag', { festival: fid, editie: eid, datum: '2027-07-03', open: '12:00', sluit: '23:00' }, S);
  const dagId = dg.data && dg.data.dag && dg.data.dag.id;
  const tr = await P('/api/festival/plek', { festival: fid, editie: eid, naam: 'Terrein', soort: 'terrein', capaciteit: 5000 }, S);
  const terreinId = tr.data && tr.data.plek && tr.data.plek.id;
  const pd = await P('/api/festival/plek', { festival: fid, editie: eid, naam: 'Hoofdpodium', soort: 'podium', ouder: terreinId, capaciteit: 3000 }, S);
  const podiumId = pd.data && pd.data.plek && pd.data.plek.id;
  if (!eid || !dagId || !podiumId)
    throw new Error('de wereld kwam niet rond (editie ' + eid + ', dag ' + dagId + ', podium ' + podiumId + ')');
  const w = { fid, eid, dagId, podiumId };
  uit.wereld = {
    festival: 'via /api/festival/nieuw + /editie + /dag + /plek, want de zaaiset heeft geen festival',
    zaak: ZAAK + ', want die draagt de capability tickets',
    mensen: 'drie leden op drie verschillende passen, en het kantoor op naam van een mens'
  };

  /* ================= 1 -- de bron maakt een publiek feit =================

     De zaak bevestigt een boeking. De BEVESTIGING is de aanleiding; het moment is
     het gevolg. Wat hier bewezen wordt is dat de publieke aanwezigheid van de
     zaak ONTSTAAT zonder dat iemand haar heeft aangemaakt: er is geen knop "word
     publiek", er is alleen een feit dat publiek is.

     EN ER ZIJN NOG GEEN VOLGERS, want de aanwezigheid bestond een tel geleden nog
     niet. Dat is geen storing maar de vorm van de keten, en de architectuurproef
     hieronder maakt er een bewering van. */
  const b1 = await P('/api/festival/boeking', { festival: fid, editie: eid, dag: dagId,
    podium: podiumId, artiest: 'Mila Vermeer', van: '20:00', tot: '21:30' }, S);
  const boekingId = b1.data && b1.data.boeking && b1.data.boeking.id;
  if (!boekingId) throw new Error('geen boeking (status ' + b1.status + '): ' + JSON.stringify(b1.data).slice(0, 200));
  w.boekingId = boekingId;

  await stap(
    schakel(1, 'festival', 'publieke wereld', 'bevestigt een boeking; de publieke aanwezigheid van de ZAAK ontstaat'),
    () => P('/api/festival/boeking/stand', { festival: fid, editie: eid, id: boekingId,
      stand: 'bevestigd', hoe: 'getekend contract van 3 juni' }, S),
    async () => {
      const a = await P('/api/mediaos/aanwezig', { id: 'zaak:' + ZAAK }, F);
      const aw = a.data && a.data.aanwezigheid;
      return { klopt: a.status === 200 && !!aw && aw.drager === 'zaak' && aw.soorten.includes('optreden'),
        wat: 'aanwezigheid "' + (aw && aw.naam) + '" (drager: ' + (aw && aw.drager) + '), zendt uit: ' +
          ((aw && aw.watUKrijgt) || []).join(', ') };
    });

  /* ================= 2 -- kan de fan die aanwezigheid VINDEN? =============

     STOND OPEN TOT 13 SEPTEMBER 2026, en het besluit is genomen: Discovery komt
     er, maar achter de LEDENdeur. Er is dus geen publieke kant bijgekomen -- de
     waarschuwing in routes/festival/gast.js gaat over een PUBLIEKE line-up, en
     die is er nog steeds niet.

     WAT HIER GEMETEN WORDT is niet "geeft de route 200" maar of de fan het
     festival werkelijk VINDT zonder het id te kennen: hij zoekt op een stuk van
     de naam, en de aanwezigheid die hij nog niet volgt moet erbij staan met
     `volgIk: false`. Zou de zoeker alleen teruggeven wat je al volgt, dan gaf
     hij 200 en was de schakel nog steeds dicht. */
  await stap(
    schakel(2, 'publieke wereld', 'fan', 'de fan vindt de aanwezigheid van het festival'),
    /* ZOEKEN OP DE NAAM VAN DE DRAGER EN NIET VAN HET FESTIVAL. De eerste versie
       zocht op "Proeffestival" en vond niets -- terecht, want de aanwezigheid
       hangt aan de ZAAK en draagt dus haar naam ("Sal Nocturna"). Dat is precies
       het besluit dat deze tak eerder heeft rechtgezet: de naam van het festival
       hoort in de TITEL van het moment, de naam van de aanwezigheid gaat over wie
       er spreekt. De proef hield zich daar zelf niet aan. */
    async () => {
      const a = await P('/api/mediaos/aanwezig', { id: 'zaak:' + ZAAK }, F);
      const naam = a.data && a.data.aanwezigheid && a.data.aanwezigheid.naam;
      return P('/api/mediaos/aanwezig/zoek', { q: String(naam || '').slice(0, 4) }, F);
    },
    async (r) => {
      const lijst = (r.data && r.data.aanwezigheden) || [];
      const raak = lijst.find(a => a.id === 'zaak:' + ZAAK);
      return { klopt: !!raak && raak.volgIk === false && !!(raak.watUKrijgt || []).length,
        wat: 'zoeken op de naam geeft ' + lijst.length + ' treffer(s); de aanwezigheid van het festival ' +
          (raak ? 'staat erbij met volgIk=' + raak.volgIk + ' en zendt uit: ' + (raak.watUKrijgt || []).join(', ')
                : 'ontbreekt') };
    });

  /* ================= 3 -- de fan volgt, expliciet ========================

     VOLGEN IS ALTIJD EXPLICIET (kern/mediaos/aanwezigheid.js): een kaartje kopen
     is geen volgen, lid zijn is geen volgen, ergens werken is geen volgen. Wat
     hier daarnaast gemeten wordt is de tweede helft van dat besluit -- de fan
     ziet VOORAF wat hij krijgt. Een aanwezigheid die acht dingen kan uitzenden en
     dat niet zegt, laat iemand op een knop drukken zonder te weten waarvoor, en
     dan activeert een tik ongemerkt acht kanalen. */
  await stap(
    schakel(3, 'fan', 'publieke wereld', 'volgt de zaak, en leest vooraf waarvoor hij tekent'),
    () => P('/api/mediaos/aanwezig/volg', { id: 'zaak:' + ZAAK, aan: true }, F),
    async (r) => {
      const mijn = await P('/api/mediaos/aanwezig/mijn', {}, F);
      const lijst = (mijn.data && mijn.data.aanwezigheden) || [];
      const krijgt = (r.data && r.data.aanwezigheid && r.data.aanwezigheid.watUKrijgt) || [];
      return { klopt: lijst.length === 1 && lijst[0].id === 'zaak:' + ZAAK && krijgt.length > 0,
        wat: 'volgt er ' + lijst.length + ', en kreeg vooraf te lezen: ' + krijgt.join(', ') };
    });

  /* ================= 4 -- het tweede publieke feit wekt de fan ============

     Nu is de keten pas rond: bron -> moment -> volger. Het product is een aparte
     aanleiding en met opzet niet dezelfde als de boeking -- een festival OPENT de
     verkoop niet, het zet een product klaar en dan is het koopbaar
     (kern/festival/product.js). */
  const voorMelding = (await meldingen(basis, F)).length;
  await stap(
    schakel(4, 'festival', 'fan', 'zet een kaart klaar; de volger wordt gewekt'),
    () => P('/api/festival/product', { festival: fid, editie: eid, naam: 'Weekendpas',
      prijs: 149, voorraad: 500, rechten: [{ soort: 'terrein.toegang' }] }, S),
    async (r) => {
      w.productId = r.data && r.data.product && r.data.product.id;
      const na = await meldingen(basis, F);
      const kaart = noemt(na, 'kaartverkoop');
      return { klopt: na.length > voorMelding && kaart.length === 1,
        wat: (kaart[0] ? '"' + kaart[0].body + '"' : 'geen melding over kaartverkoop') +
          ' (' + voorMelding + ' -> ' + na.length + ' meldingen)' };
    });

  /* ================= 5 -- en dan? ========================================

     De fan weet nu dat de kaartverkoop open is. Wat hij daarmee KAN, was de
     tweede bevinding van deze proef, en het besluit is genomen: de Fan Inbox.

     DE MELDING IS GEEN LINK GEWORDEN, en dat is de kern van de gekozen vorm.
     `notify()` is niet aangeraakt -- de melding draagt nog steeds geen
     bestemming, en dat wordt hieronder ook GEMETEN in plaats van aangenomen.
     Wat erbij kwam is de andere helft: het lid opent zelf de tijdlijn van wat
     hij volgt, en daar staat het moment. Zo is "moment is geen notificatie" uit
     STAGE.md par. 3 eindelijk in twee helften waar in plaats van in een.

     DEZE SCHAKEL MEET DUS TWEE DINGEN TEGELIJK, en beide moeten kloppen: de wek
     draagt GEEN adres, en de fan komt er tOch. Was alleen het tweede gemeten,
     dan had een bestemming in de melding er stil bij kunnen sluipen. */
  await stap(
    schakel(5, 'fan', 'festival', 'handelt naar aanleiding van de wek: hij vindt het moment terug'),
    () => P('/api/mediaos/momenten', {}, F),
    async (r) => {
      const melding = noemt(await meldingen(basis, F), 'kaartverkoop')[0] || {};
      const extra = Object.keys(melding).filter(k => !['id', 'read', 'at', 'title', 'body', 'scope', 'icon'].includes(k));
      const mom = (r.data && r.data.momenten) || [];
      const kaart = mom.find(m => m.soort === 'kaartverkoop' && m.aanwezigheid === 'zaak:' + ZAAK);
      return { klopt: extra.length === 0 && !!kaart && !!kaart.naam && !!kaart.at,
        wat: 'de melding draagt geen bestemming (velden buiten de vaste zes: ' +
          (extra.length ? extra.join(', ') : 'geen') + '), en de tijdlijn van wat hij volgt geeft ' +
          mom.length + ' moment(en) -- de kaartverkoop staat erbij als "' +
          (kaart ? kaart.naam + ': ' + kaart.wat : 'ONTBREEKT') + '"' };
    });

  /* ================= 6 -- plaatsen is geen publiek moment ================

     De tweede bron, en de eerste die aan een MENS hangt. Het lid plaatst in De
     Salon. Dat is een handeling en met opzet geen moment: De Salon is een
     besloten sociaal netwerk, en wie daar plaatst publiceert niet.

     Deze schakel bewijst een NEGATIEF, en daar zit de hele waarde: werd elke
     handeling een moment, dan was "moment" een ander woord voor "gebeurtenis" en
     had de laag geen betekenis. */
  const p1 = await P('/api/salon/plaats', { tekst: 'Een middag in Kyoto, en het regende precies goed.' }, M);
  w.postId = p1.data && (p1.data.post ? p1.data.post.id : p1.data.id);
  if (!w.postId) throw new Error('het lid kon niet plaatsen (status ' + p1.status + ')');
  await stap(
    schakel(6, 'lid', 'publieke wereld', 'plaatst in De Salon; er ontstaat GEEN publieke aanwezigheid'),
    () => P('/api/salon/plaats', { tekst: 'En de tweede middag was stiller.' }, M),
    async (r) => {
      w.postId2 = r.data && (r.data.post ? r.data.post.id : r.data.id);
      /* De maker is de enige die weet of hij een aanwezigheid heeft; zijn sleutel
         kennen we hier niet, en dat is precies de bedoeling van de codenaamlaag.
         Dus vragen we het hem. */
      const mijn = await P('/api/mediaos/aanwezig/mijn', {}, M);
      const n = ((mijn.data && mijn.data.aanwezigheden) || []).length;
      /* Het bord heet `lopend` en `geschiedenis`. De eerste versie van deze
         schakel las `uitlichtingen`, en die bestaat niet -- een lege lijst die
         altijd leeg is, bewijst niets (scripts/tandeloos.js telt precies zulke
         beweringen). Gevonden door de proef te draaien en het veld na te slaan. */
      const bord = await P('/api/office/salon/uitlicht/bord', {}, persoon);
      const lopend = ((bord.data && bord.data.lopend) || []).length;
      return { klopt: n === 0 && lopend === 0 && !!bord.data,
        wat: 'twee posts, ' + lopend + ' lopende uitlichtingen, en de maker draagt ' + n + ' aanwezigheden' };
    });

  /* ================= 7 -- de redactie licht uit, op naam ==================

     De derde bron, en het besluit van 13 september: uitlichten is een EXPLICIETE
     menselijke redactiehandeling met een verplichte grond uit een gesloten lijst.
     Geen algoritme, geen "viraal", geen automatische promotie.

     EN HET MOMENT DRAAGT DE AANWEZIGHEID VAN DE AUTEUR, niet die van de redactie.
     Dat is de wet in het klein: de redactie stelt vast DAT het publiek wordt, en
     het blijft het werk van de maker. */
  const uitlicht1 = await stap(
    schakel(7, 'kantoor', 'publieke wereld', 'licht de post uit, op naam en met een grond; de aanwezigheid van de AUTEUR ontstaat'),
    () => P('/api/office/salon/uitlicht', { postId: w.postId, grond: 'bijzonder' }, persoon),
    async (r) => {
      const aid = r.data && r.data.moment && r.data.moment.aanwezigheid;
      const a = aid ? await P('/api/mediaos/aanwezig', { id: aid }, F2) : null;
      const aw = a && a.data && a.data.aanwezigheid;
      return { klopt: !!aid && String(aid).startsWith('lid:') && !!aw && aw.drager === 'lid',
        wat: 'moment op ' + aid + ' -- drager: ' + (aw && aw.drager) + ', naam: ' + (aw && aw.naam) };
    });
  w.makerAanwezig = uitlicht1 && uitlicht1.data && uitlicht1.data.moment && uitlicht1.data.moment.aanwezigheid;

  /* ================= 8 -- een tweede fan volgt de MAKER ==================

     Dezelfde relatie op een andere drager, en dat is de kern van besluit 1: een
     lid volgt een publieke AANWEZIGHEID, of die nu door een mens of door een
     organisatie wordt gedragen. Ajax wordt geen mens en Mila wordt geen zaak. */
  const voor2 = (await meldingen(basis, F2)).length;
  await stap(
    schakel(8, 'publieke wereld', 'tweede fan', 'volgt de maker; de volgende uitlichting wekt hem'),
    async () => {
      const v = await P('/api/mediaos/aanwezig/volg', { id: w.makerAanwezig, aan: true }, F2);
      if (v.status !== 200) return v;
      return P('/api/office/salon/uitlicht', { postId: w.postId2, grond: 'talent' }, persoon);
    },
    async () => {
      const na = await meldingen(basis, F2);
      const raak = noemt(na, 'uitgelicht werk');
      return { klopt: na.length > voor2 && raak.length === 1,
        wat: raak[0] ? '"' + raak[0].body + '"' : 'geen melding over uitgelicht werk (' + voor2 + ' -> ' + na.length + ')' };
    });

  /* ================= 9 -- ontvolgen stopt de wek ========================

     De relatie is van de VOLGER en niet van de maker. Wie hem opzegt, hoort de
     volgende keer niets meer -- en dat is een handeling van Stage die de bron
     niet raakt (de architectuurproef meet dat apart). */
  await stap(
    schakel(9, 'fan', 'publieke wereld', 'ontvolgt; het volgende feit van dezelfde bron bereikt hem niet'),
    async () => {
      const v = await P('/api/mediaos/aanwezig/volg', { id: 'zaak:' + ZAAK, aan: false }, F);
      if (v.status !== 200) return v;
      return P('/api/festival/product', { festival: fid, editie: eid, naam: 'Dagticket zaterdag',
        prijs: 79, voorraad: 300, rechten: [{ soort: 'terrein.toegang' }] }, S);
    },
    async () => {
      const na = await meldingen(basis, F);
      const kaarten = noemt(na, 'kaartverkoop');
      return { klopt: kaarten.length === 1 && !kaarten.some(n => String(n.body).includes('Dagticket')),
        wat: kaarten.length + ' melding(en) over kaartverkoop, en het Dagticket zit er niet bij' };
    });

  return { F, F2, M, S, persoon, w };
}

/* ============================================================================
   DE STORINGEN -- en dit is de helft die telt.

   Een keten die alleen bij goed weer sluit, bewijst niets. Elke storing draagt
   een BELOFTE in gewone woorden, en de proef meet of die belofte gehouden wordt.
   ========================================================================== */
/* ================= 10 -- DE VIERDE AANLEIDING, OP EEN EIGEN SERVER =========

   WAT HIER IS RECHTGEZET (13 september 2026), en het is een fout van de PROEF en
   niet van de code. Deze schakel stond `openBekend` met als reden: "de zaaiset
   heeft geen enkele zaak van type `sportclub`". Dat klopte niet. FC RTG staat er
   gewoon in (kern/sportclub/index.js) -- alleen LUI gezaaid, diep in zijn eigen
   wereldmodule, en de proef heeft die wereld nooit aangeraakt. Nagemeten met een
   sessie op DEMO_SUPPLIER=FCRTG: supplier-login 200 met `type: 'sportclub'`,
   /api/sport/cockpit 200, /api/sport/wedstrijd/maak 200.

   Dat is precies de vergissing waar deze proef tegen bestaat, nu in haarzelf: ze
   telde "geen zaak van dat type" als een eigenschap van het HUIS, terwijl het een
   eigenschap was van haar eigen opstelling. "Geteld is niet gelopen" gold dus
   dubbel.

   WAAROM EEN EIGEN SERVER. De demo-inlog koppelt precies EEN zaak aan het
   eigenaarsaccount, op grond van DEMO_SUPPLIER (server.js). Twee zaken op een
   server is er dus niet bij, en het festival heeft NACHT nodig. Deze schakel is
   bovendien een eigen mini-keten -- club legt vast, fan vindt, fan volgt, club
   legt opnieuw vast, fan wordt gewekt -- dus hij heeft aan zijn eigen wereld
   genoeg. Wat hij NIET deelt met de hoofdketen is met opzet: een tweede server
   is een tweede database, en daar niets van lenen houdt de uitslagen los. */
async function sportclubKeten(uit) {
  const stap = maakStap(uit);
  const srv = await start({ naam: 'momentproef-sport', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', DEMO_SUPPLIER: 'FCRTG', OFFICE_CODE: KANTOORCODE } });
  try {
    const basis = srv.basis;
    const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
    const club = (await P('/api/supplier/login', { username: 'rahul', password: 'Imran' })).data;
    const fan = (await P('/api/login', { tier: 'rtg' })).data;
    if (!club || !club.token) throw new Error('geen clubsessie -- draait de server met DEMO_SUPPLIER=FCRTG?');
    if (!fan || !fan.token) throw new Error('geen ledensessie op de sportserver');
    const C = club.token, FS = fan.token;

    /* De aanwezigheid ONTSTAAT door publiek te worden en niet door een knop:
       deze eerste wedstrijd is wat FC RTG een publiek adres geeft. Hij staat
       daarom vóór de schakel en telt zelf niet mee -- de wereld klaarzetten is
       geen valsspelen, een uitslag klaarzetten wel. */
    await P('/api/sport/wedstrijd/maak', { tegenstander: 'Es Vedra FC', thuis: false }, C);

    /* De supporter vindt de club langs dezelfde Discovery als de fan van het
       festival, en volgt hem expliciet. */
    const gevonden = await P('/api/mediaos/aanwezig/zoek', { q: 'FC RTG' }, FS);
    const club_a = ((gevonden.data && gevonden.data.aanwezigheden) || []).find(a => a.id === 'zaak:FCRTG');
    if (club_a) await P('/api/mediaos/aanwezig/volg', { id: 'zaak:FCRTG', aan: true }, FS);
    const voor = (await meldingen(basis, FS)).length;

    await stap(
      schakel(10, 'sportclub', 'publieke wereld', 'legt een wedstrijd vast; de supporters worden gewekt'),
      () => P('/api/sport/wedstrijd/maak', { tegenstander: 'CD Salinas', thuis: true }, C),
      async () => {
        const na = await meldingen(basis, FS);
        const wed = na.filter(n => /wedstrijd/i.test(String(n.body || '')));
        const tijdlijn = await P('/api/mediaos/momenten', {}, FS);
        const mom = ((tijdlijn.data && tijdlijn.data.momenten) || [])
          .filter(m => m.soort === 'wedstrijd' && m.aanwezigheid === 'zaak:FCRTG');
        return {
          klopt: !!club_a && na.length > voor && wed.length >= 1 && mom.length >= 1,
          wat: 'de supporter vond "' + (club_a ? club_a.naam : 'NIETS') + '" via de zoeker, en na de wedstrijd ' +
            voor + ' -> ' + na.length + ' meldingen (' + wed.length + ' over een wedstrijd); zijn tijdlijn draagt ' +
            mom.length + ' wedstrijdmoment(en) van de club'
        };
      });
  } finally { srv.klaar(); }
}

async function storingen(basis, uit, s) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const { F, F2, M, S, persoon, w } = s;
  const noteer = (naam, belofte, klopt, wat) =>
    uit.storingen.push({ naam, belofte, stand: klopt ? 'gehouden' : 'gebroken', wat });

  /* 1 -- EEN VOORNEMEN IS GEEN FEIT. Een boeking die nog geen bevestiging is,
     wekt niemand. Dezelfde reden als waarom hij buiten het gastprogramma blijft:
     anders koopt iemand een kaartje voor een naam die er niet staat. */
  {
    await P('/api/mediaos/aanwezig/volg', { id: 'zaak:' + ZAAK, aan: true }, F);
    const voor = (await meldingen(basis, F)).length;
    const b = await P('/api/festival/boeking', { festival: w.fid, editie: w.eid, dag: w.dagId,
      podium: w.podiumId, artiest: 'Twijfelgeval', van: '22:00', tot: '22:45' }, S);
    const na = (await meldingen(basis, F)).length;
    noteer('een voornemen is geen publiek feit',
      'een boeking die nog niet bevestigd is, wekt geen enkele volger',
      b.status === 200 && na === voor,
      'boeking aangemaakt op stand "' + ((b.data && b.data.boeking && b.data.boeking.stand) || '?') +
        '", meldingen ' + voor + ' -> ' + na);
    w.twijfelId = b.data && b.data.boeking && b.data.boeking.id;
  }

  /* 2 -- BEVESTIGEN ZONDER BEWIJS KAN NIET. Het moment hangt aan een feit, en
     het feit hangt aan iets dat na te gaan is. Zonder die grendel zou Stage een
     publieke bewering uitzenden die op niets berust. */
  {
    const r = await P('/api/festival/boeking/stand', { festival: w.fid, editie: w.eid,
      id: w.twijfelId, stand: 'bevestigd' }, S);
    const na = noemt(await meldingen(basis, F), 'Twijfelgeval').length;
    noteer('geen bevestiging zonder bewijs',
      'wie "bevestigd" zet zonder te zeggen waaruit dat blijkt, wordt geweigerd -- en er gaat niets uit',
      r.status === 400 && na === 0,
      'status ' + r.status + ' "' + ((r.data && r.data.error) || '') + '", meldingen over Twijfelgeval: ' + na);
  }

  /* 3 -- BIJWERKEN IS GEEN TWEEDE MOMENT. Een product dat al bestond en wordt
     aangepast, is geen nieuwe kaartverkoop. Zonder deze regel wekt een tikfout in
     een prijs alle volgers. */
  {
    const voor = noemt(await meldingen(basis, F), 'kaartverkoop').length;
    const r = await P('/api/festival/product', { festival: w.fid, editie: w.eid, id: w.productId,
      naam: 'Weekendpas', prijs: 159, voorraad: 500, rechten: [{ soort: 'terrein.toegang' }] }, S);
    const na = noemt(await meldingen(basis, F), 'kaartverkoop').length;
    noteer('bijwerken is geen tweede moment',
      'een bestaand product aanpassen wekt niemand opnieuw',
      r.status === 200 && na === voor,
      'prijs bijgewerkt (status ' + r.status + '), meldingen over kaartverkoop ' + voor + ' -> ' + na);
  }

  /* 4 -- DE GEDEELDE KANTOORCODE LICHT NIETS UIT. Een spoor dat eindigt bij een
     gedeelde code is geen spoor (KANTOOR.md). Uitlichten is een redactiebesluit
     en dus een handeling van een MENS, niet van een kamer. */
  {
    const gedeeld = (await P('/api/office/login', { code: KANTOORCODE })).data;
    const uitslagen = [];
    for (const pad of ['/api/office/salon/uitlicht/bord', '/api/office/salon/uitlicht', '/api/office/salon/uitlicht/intrek']) {
      const r = await P(pad, { postId: w.postId, grond: 'redactie', reden: 'x' }, gedeeld && gedeeld.token);
      uitslagen.push(pad.split('/').pop() + '=' + r.status);
    }
    noteer('uitlichten gebeurt op naam',
      'met de gedeelde kantoorcode lukt uitlichten niet -- ook lezen niet',
      !!(gedeeld && gedeeld.token) && uitslagen.every(u => u.endsWith('=403')),
      'met de gedeelde code: ' + uitslagen.join(', '));
  }

  /* 5 -- GEEN GROND, GEEN UITLICHTING. De reden is verplicht en komt uit een
     gesloten lijst; hij hoeft niet publiek te zijn, maar hij moet er zijn. */
  {
    const p = await P('/api/salon/plaats', { tekst: 'Een derde middag.' }, M);
    const id3 = p.data && (p.data.post ? p.data.post.id : p.data.id);
    const zonder = await P('/api/office/salon/uitlicht', { postId: id3 }, persoon);
    const verzonnen = await P('/api/office/salon/uitlicht', { postId: id3, grond: 'viraal' }, persoon);
    noteer('geen grond, geen uitlichting',
      'uitlichten zonder grond wordt geweigerd, en een verzonnen grond ook',
      zonder.status === 400 && verzonnen.status === 400,
      'zonder grond: ' + zonder.status + ', grond "viraal": ' + verzonnen.status);
    w.postId3 = id3;
  }

  /* 6 -- HOOGUIT EEN KEER, EN DAT HEEFT TWEE DEUREN.

     Op de ROUTE staat de dubbeltikpoort ervoor (server/lib/idemsleutels-stage.js
     zet deze route in het venster van vijf seconden), en in de MODULE staat de
     toestandscontrole. Deze storing eiste onvoorwaardelijk 409 en zag daardoor
     alleen de tweede deur -- terwijl de eerste als eerste antwoordt.

     Allebei bewaren ze dezelfde invariant, en die is wat hier telt: er ontstaat
     NOOIT een tweede uitlichting. Een woordelijk gelijk verzoek krijgt het
     antwoord van de eerste terug (200 met `herhaald`), een ander verzoek --
     dezelfde post, een andere grond -- loopt tegen de 409. Wie alleen het
     tweede meet, laat de eerste deur ongemeten; wie alleen het eerste meet, mist
     dat de stand uberhaupt bewaakt wordt. */
  {
    const herhaald = await P('/api/office/salon/uitlicht', { postId: w.postId, grond: 'bijzonder' }, persoon);
    const ander = await P('/api/office/salon/uitlicht', { postId: w.postId, grond: 'talent' }, persoon);
    const bord = await P('/api/office/salon/uitlicht/bord', {}, persoon);
    const lopend = ((bord.data && bord.data.lopend) || []).filter(x => String(x.post) === String(w.postId)).length;
    noteer('hooguit een keer uitgelicht',
      'een woordelijk gelijk verzoek is een herhaling, een ander verzoek stuit op de toestandscontrole, en er loopt precies EEN uitlichting',
      herhaald.status === 200 && herhaald.data && herhaald.data.herhaald === true &&
        ander.status === 409 && lopend === 1,
      'herhaling gaf ' + herhaald.status + (herhaald.data && herhaald.data.herhaald ? ' (herhaald)' : '') +
        ', een andere grond gaf ' + ander.status + ' "' + ((ander.data && ander.data.error) || '') +
        '", en er loopt ' + lopend + ' uitlichting');
  }

  /* 7 -- INTREKKEN VRAAGT EEN REDEN, net als uitlichten. Een redactiebesluit
     terugdraaien is zelf ook een redactiebesluit. */
  {
    const zonder = await P('/api/office/salon/uitlicht/intrek', { postId: w.postId }, persoon);
    const met = await P('/api/office/salon/uitlicht/intrek', { postId: w.postId, reden: 'De auteur wilde het niet.' }, persoon);
    noteer('intrekken vraagt een reden',
      'een uitlichting intrekken zonder reden wordt geweigerd; met reden lukt het',
      zonder.status === 400 && met.status === 200,
      'zonder reden: ' + zonder.status + ', met reden: ' + met.status);
  }

  /* 8 -- EEN WEK IS NIET TERUG TE NEMEN, EN DAT WORDT NIET VERZWEGEN. Intrekken
     haalt de uitlichting weg; de melding die al verstuurd is, blijft staan. Een
     laag die zijn eigen verleden opruimt, liegt over wat er gebeurd is. */
  {
    const na = noemt(await meldingen(basis, F2), 'uitgelicht werk').length;
    const bord = await P('/api/office/salon/uitlicht/bord', {}, persoon);
    const lopend = (bord.data && bord.data.lopend) || [];
    const hist = (bord.data && bord.data.geschiedenis) || [];
    const weg = hist.find(r => String(r.post) === String(w.postId));
    const blijft = lopend.some(r => String(r.post) === String(w.postId2));
    noteer('een wek wordt niet met terugwerkende kracht gewist',
      'de ingetrokken uitlichting staat met haar reden in de geschiedenis, de andere loopt door, en de al verstuurde melding blijft staan',
      na >= 1 && !!weg && !!weg.ingetrokken && blijft &&
        !lopend.some(r => String(r.post) === String(w.postId)),
      'meldingen bij de tweede fan: ' + na + ', ingetrokken in de geschiedenis: ' + !!(weg && weg.ingetrokken) +
        ', nog lopend: ' + lopend.length);
  }

  /* 9 -- DE MAKER WORDT NIET OVER ZIJN EIGEN WERK GEWEKT. Geen enkele laag hier
     is een kanaal om aandacht mee te kopen, ook niet bij jezelf. */
  {
    const eigen = media(await meldingen(basis, M)).length;
    const zelf = await P('/api/mediaos/aanwezig/volg', { id: w.makerAanwezig, aan: true }, M);
    noteer('de maker wekt zichzelf niet',
      'de auteur krijgt geen melding over zijn eigen uitgelichte werk, en kan zichzelf niet volgen',
      eigen === 0 && zelf.status === 400,
      'eigen media-meldingen: ' + eigen + ', zichzelf volgen gaf ' + zelf.status +
        ' "' + ((zelf.data && zelf.data.error) || '') + '"');
  }

  /* 10 -- EEN VERZONNEN AANWEZIGHEID BESTAAT NIET. Geen stille 200 op een id dat
     nergens heen wijst: dan zou een volgerslijst vol adressen komen te staan die
     nooit iets uitzenden. */
  {
    const op = await P('/api/mediaos/aanwezig', { id: 'zaak:BESTAATNIET' }, F);
    const vg = await P('/api/mediaos/aanwezig/volg', { id: 'zaak:BESTAATNIET', aan: true }, F);
    const mn = await P('/api/mediaos/aanwezig/mijn', {}, F);
    const lijst = (mn.data && mn.data.aanwezigheden) || [];
    noteer('een verzonnen aanwezigheid bestaat niet',
      'opzoeken en volgen van een onbekend adres geven 404, en er komt niets in de volglijst',
      op.status === 404 && vg.status === 404 && !lijst.some(a => a.id === 'zaak:BESTAATNIET'),
      'opzoeken ' + op.status + ', volgen ' + vg.status + ', en het verzonnen adres staat niet in de volglijst van ' +
        lijst.length);
  }

  /* 11 -- EEN GAST KOMT ER NIET IN. De publieke laag is voor leden; een gast
     heeft geen relatie om op te zeggen. */
  {
    const gast = (await P('/api/login', { tier: 'guest' })).data;
    const r = gast && gast.token ? await P('/api/mediaos/aanwezig/mijn', {}, gast.token) : { status: 0 };
    noteer('een gast heeft geen publieke relaties',
      'zonder lidmaatschap geen volglijst',
      !!(gast && gast.token) && r.status === 403,
      'gast kreeg ' + r.status + ' op /aanwezig/mijn');
  }

  /* 12 -- EEN TWEEDE FESTIVAL HERNOEMT DE AANWEZIGHEID NIET.

     DIT IS DE BEVINDING VAN DE EERSTE RONDE, en hij staat hier zodat hij niet
     terugkomt. De aanwezigheid hangt aan de DRAGER (`zaak:NACHT`) en een zaak kan
     meer dan een festival draaien. De haak gaf eerst de FESTIVALnaam mee, en dus
     hernoemde het tweede festival de aanwezigheid van het eerste: een volger
     drukte op de ene naam en zag daarna de andere in zijn lijst staan, zonder dat
     hij iets had gedaan. De naam van het festival hoort in de titel van het
     moment; de naam van de aanwezigheid gaat over wie er spreekt. */
  {
    const voor = (await P('/api/mediaos/aanwezig', { id: 'zaak:' + ZAAK }, F)).data;
    const naamVoor = voor && voor.aanwezigheid && voor.aanwezigheid.naam;
    await P('/api/mediaos/aanwezig/volg', { id: 'zaak:' + ZAAK, aan: true }, F);
    const f3 = (await P('/api/festival/nieuw', { naam: 'Heel Ander Festival' }, S)).data;
    const fid3 = f3 && f3.festival && f3.festival.id;
    const e3 = (await P('/api/festival/editie', { festival: fid3, naam: 'Ander 2028', jaar: 2028 }, S)).data;
    const eid3 = e3 && e3.editie && e3.editie.id;
    await P('/api/festival/product', { festival: fid3, editie: eid3, naam: 'Anderkaart',
      prijs: 20, voorraad: 9, rechten: [{ soort: 'terrein.toegang' }] }, S);
    const na = (await P('/api/mediaos/aanwezig', { id: 'zaak:' + ZAAK }, F)).data;
    const naamNa = na && na.aanwezigheid && na.aanwezigheid.naam;
    const mijn = (await P('/api/mediaos/aanwezig/mijn', {}, F)).data;
    const inLijst = ((mijn && mijn.aanwezigheden) || []).map(a => a.naam);
    noteer('een tweede festival hernoemt de aanwezigheid niet',
      'de naam in de volglijst van een fan verandert niet doordat de zaak iets anders begint',
      !!naamVoor && naamVoor === naamNa && inLijst.includes(naamVoor),
      'voor: "' + naamVoor + '", na een tweede festival: "' + naamNa + '", in de volglijst: ' + JSON.stringify(inLijst));
  }

  /* 13 -- ER STAAT GEEN AANTAL IN. "3.000 mensen wachten op u" is precies het
     lokkertje dat dit huis nergens gebruikt (CLAUDE.md: geen verslavende
     engagement-patronen). De wek noemt de bron, het feit en verder niets. */
  {
    const alle = media(await meldingen(basis, F)).concat(media(await meldingen(basis, F2)));
    const metGetal = alle.filter(n => /\b\d{2,}\b/.test(String(n.body || '')));
    const metTeller = alle.filter(n => /(volgers|mensen|wachten|anderen)/i.test(String(n.body || '')));
    noteer('een wek draagt geen publiek',
      'geen enkele melding noemt een aantal volgers of gebruikt aandrang',
      metGetal.length === 0 && metTeller.length === 0,
      alle.length + ' media-meldingen, ' + metGetal.length + ' met een getal, ' + metTeller.length + ' met een telwoord');
  }
}

/* ============================================================================
   DE ARCHITECTUURPROEF -- blijft Stage een projectie?

   De schakels bewijzen dat de keten loopt. Dit bewijst dat hij de goede KANT op
   loopt. Drie beweringen, elk met een meting erachter, en geen ervan is uit de
   schakels af te leiden:

     A  de bron werkt zonder Stage      -- "niemand gewekt" is niet "niets gebeurd"
     B  het ANTWOORD van de bron staat stil  -- teken voor teken hetzelfde
     C  de projectie weet niets eigens  -- alles erin is uit de bron af te leiden
     D  Stage SCHRIJFT alleen bij zichzelf   -- gelezen uit de bron van de laag

   C is de meetbare vorm van "gooi de projectie weg en bouw hem opnieuw": er is
   geen route die de projectie wist, maar wel een manier om te laten zien dat er
   niets in staat dat verloren zou gaan.

   EN WAAROM D ERBIJ STAAT, want dat is een vondst van deze proef zelf. B is met
   een mutatie nagetrokken: de volgroute kreeg er een regel bij die een
   volgersteller TERUGSCHREEF in de producten van het festival -- precies de
   creep waar deze laag tegen ontworpen is. B bleef groen. De reden is dat de
   bron zijn antwoord VORMT: een onbekend veld haalt /api/festival/producten
   nooit, dus van buiten is er niets te zien. B meet daarom wat hij meet -- het
   antwoord van de bron -- en niet meer dan dat. D meet het andere: welke
   collecties de Stage-laag aanraakt, gelezen uit haar eigen bron. Zwart-doos en
   bron zijn hier geen keuze maar twee helften, en ze worden apart gemeld.
   ========================================================================== */
async function architectuur(basis, uit, s) {
  const P = (pad, lijf, tok) => post(basis, pad, lijf, tok);
  const { F, S, w } = s;
  const zet = (id, bewering, klopt, gemeten) =>
    uit.architectuur.push({ id, bewering, stand: klopt ? 'gehouden' : 'gebroken', gemeten });

  /* A -- DE BRON BEPAALT DAT IETS GEBEURD IS. Een derde festival, zonder een
     enkele volger: het feit staat er, en er wordt niemand gewekt. Wie `gewekt: []`
     als "er is niets gebeurd" leest, heeft de wet omgedraaid. */
  {
    /* NIEMAND LUISTERT, en dat is het hele punt: de volgrelatie gaat er eerst af.
       Zo meet deze bewering het geval waar de wet over gaat, en niet het makkelijke
       geval waarin er toevallig iemand volgt. */
    await P('/api/mediaos/aanwezig/volg', { id: 'zaak:' + ZAAK, aan: false }, F);
    const f2 = (await P('/api/festival/nieuw', { naam: 'Stil Festival' }, S)).data;
    const fid2 = f2 && f2.festival && f2.festival.id;
    const e2 = (await P('/api/festival/editie', { festival: fid2, naam: 'Stil 2027', jaar: 2027 }, S)).data;
    const eid2 = e2 && e2.editie && e2.editie.id;
    const voor = (await meldingen(basis, F)).length;
    const pr = await P('/api/festival/product', { festival: fid2, editie: eid2, naam: 'Stille kaart',
      prijs: 10, voorraad: 5, rechten: [{ soort: 'terrein.toegang' }] }, S);
    const na = (await meldingen(basis, F)).length;
    const lijst = await P('/api/festival/producten', { festival: fid2, editie: eid2 }, S);
    const staat = ((lijst.data && lijst.data.producten) || []).some(p => p.naam === 'Stille kaart');
    zet('A', 'de bron legt het feit vast terwijl er niemand luistert -- "niemand gewekt" is niet "niets gebeurd"',
      pr.status === 200 && staat && na === voor,
      'zonder een enkele volger staat het product in de bron: ' + staat +
        ', en er ging niets uit (meldingen ' + voor + ' -> ' + na + ')');
  }

  /* B -- STAGE LEEST WERKELIJKHEID; STAGE WORDT NIET DE WERKELIJKHEID. Neem het
     volledige antwoord van de bron, doe er een reeks Stage-handelingen overheen
     (volgen, ontvolgen, meldingen lezen en wegzetten), en neem het opnieuw. */
  {
    const voor = await bronBeeld(basis, S, w);
    await P('/api/mediaos/aanwezig/volg', { id: 'zaak:' + ZAAK, aan: false }, F);
    await P('/api/mediaos/aanwezig/volg', { id: 'zaak:' + ZAAK, aan: true }, F);
    await P('/api/mediaos/aanwezig/mijn', {}, F);
    await P('/api/notifications', {}, F);
    await P('/api/notifications/read', {}, F);
    const na = await bronBeeld(basis, S, w);
    zet('B', 'geen enkele handeling van Stage verandert iets aan het ANTWOORD van de bron',
      voor === na,
      voor === na ? 'het beeld van de bron is teken voor teken gelijk (' + voor.length + ' tekens)'
        : 'HET BEELD VAN DE BRON VERSCHOOF: ' + voor.length + ' -> ' + na.length + ' tekens');
  }

  /* C -- DE PROJECTIE WEET NIETS DAT DE BRON NIET WEET. Twee metingen: de VORM is
     gesloten (geen veld waarmee een aanwezigheid iets KAN -- dat zou een tweede
     identiteitssysteem zijn, HDI.md par. 5.1), en de INHOUD is afleidbaar (de id
     is letterlijk drager plus code, en er staat geen verwijzing in naar een
     boeking, een product of een post). */
  {
    const a = await P('/api/mediaos/aanwezig', { id: 'zaak:' + ZAAK }, F);
    const aw = (a.data && a.data.aanwezigheid) || {};
    const VELDEN = ['id', 'naam', 'drager', 'soorten', 'watUKrijgt'];
    const extra = Object.keys(aw).filter(k => !VELDEN.includes(k));
    const afleidbaar = aw.id === aw.drager + ':' + ZAAK;
    const tekst = JSON.stringify(aw);
    const verwijst = [w.boekingId, w.productId, w.postId, w.fid, w.eid]
      .filter(Boolean).filter(id => tekst.includes(String(id)));
    zet('C', 'de projectie draagt geen veld en geen verwijzing die de bron niet al heeft',
      extra.length === 0 && afleidbaar && verwijst.length === 0,
      'velden buiten de vaste vijf: ' + (extra.length ? extra.join(', ') : 'geen') +
        ', id afleidbaar uit de drager: ' + afleidbaar +
        ', verwijzingen naar bronrecords: ' + (verwijst.length ? verwijst.join(', ') : 'geen'));
  }

  /* D -- STAGE SCHRIJFT ALLEEN BIJ ZICHZELF, en dit is de enige bewering die de
     BRON leest in plaats van de server te bevragen.

     Dat is geen uitzondering op de zwart-doosvorm maar het antwoord op een gat
     dat B aantoonbaar heeft: een terugschrijving in een veld dat de bron niet
     uitzendt, is van buiten onzichtbaar. De meting is smal en hard -- welke
     `db.data.<collectie>` komt er voor in de twee bestanden die samen de
     Stage-laag zijn -- en zij leest en beslist niets over de code
     (CODE.md, CODE-AI-001: meters lezen de bron en bedienen niets). */
  {
    /* DE EIGEN COLLECTIES VAN DEZE LAAG. `mediaMomenten` kwam er op 13 september
       bij (het momentregister onder de Fan Inbox) en hoort hier omdat hij VAN
       Stage is -- deze bewering gaat over VREEMDE collecties, niet over het
       aantal eigen. Wat hij blijft vangen is Stage die in festival, salon of
       sportclub schrijft, en dat is precies waar hij voor bestaat. */
    const EIGEN = ['mediaAanwezig', 'mediaVolgt', 'mediaMomenten'];
    /* VIER BESTANDEN SINDS DE SPLITSING, en die lijst hoort mee te groeien: een
       nieuw bestand in deze laag dat niet hier staat, is een bestand dat deze
       bewering niet leest. ./tijdlijn.js bezit `mediaMomenten`, ./zoeken.js
       raakt db.data met opzet niet aan. */
    const BESTANDEN = ['server/kern/mediaos/aanwezigheid.js', 'server/kern/mediaos/wekken.js',
      'server/kern/mediaos/tijdlijn.js', 'server/kern/mediaos/zoeken.js'];
    const vreemd = [];
    for (const rel of BESTANDEN) {
      const bron = fs.readFileSync(path.join(WORTEL, rel), 'utf8');
      for (const m of bron.matchAll(/\bdb\.data\.([A-Za-z_$][\w$]*)/g))
        if (!EIGEN.includes(m[1])) vreemd.push(rel.split('/').pop() + ' -> db.data.' + m[1]);
    }
    zet('D', 'de Stage-laag schrijft en leest alleen in haar eigen twee collecties',
      vreemd.length === 0,
      vreemd.length ? 'raakt ook: ' + [...new Set(vreemd)].join(', ')
        : 'alleen ' + EIGEN.join(' en ') + ', in ' + BESTANDEN.length + ' bestanden');
  }
}

async function meet() {
  const uit = {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Een publieke keten van een feit bij de bron tot een melding bij iemand die daar zelf ja tegen zei, gemeten per SCHAKEL (handelt actor A, en weet actor B het?) en per STORING (houdt de keten zijn belofte als het misgaat?). Vierde keten naast tafelproef, ritproef en toelatingsproef -- zie STAGE.md par. 6.',
    grens: 'Alle vier de Moment-aanleidingen lopen hier echt: festivalboeking, festivalproduct en de uitlichting in De Salon op de hoofdserver, de wedstrijd van een sportclub op een eigen server (schakel 10 -- zie de kop van sportclubKeten voor waarom dat een tweede server vraagt). Wat hier NIET gemeten is: er komt geen browser aan te pas, en er wordt niets betaald -- dat een fan werkelijk een kaart KAN kopen blijft ongemeten, want die route bestaat aan de ledenkant niet. Schakel 5 meet dat hij het moment TERUGVINDT, niet dat hij het kan afrekenen.',
    schakels: [], storingen: [], architectuur: [], wereld: null
  };
  const srv = await start({ naam: 'momentproef', gereed: 'ready',
    env: { NODE_ENV: 'test', RTG_DEMO: '1', DEMO_SUPPLIER: ZAAK, OFFICE_CODE: KANTOORCODE } });
  try {
    const s = await loop(srv.basis, uit);
    await storingen(srv.basis, uit, s);
    await architectuur(srv.basis, uit, s);
  } finally { srv.klaar(); }

  /* De vierde aanleiding draait op een eigen server -- zie de kop van
     sportclubKeten() voor waarom dat moet en waarom het mag. */
  await sportclubKeten(uit);

  /* DRIE TELLERS EN NIET EEN. De eerste versie liet de architectuurbeweringen in
     dezelfde `gehouden` lopen als de storingen, en dan meldde de proef twaalf
     storingen waarvan er vijftien gehouden waren. Een teller die meer telt dan er
     is, is niet alleen verkeerd -- hij verbergt welke van de twee bewoog. */
  const t = { schakels: uit.schakels.length, gesloten: 0, open: 0, openBekend: 0, stuk: 0,
    storingen: uit.storingen.length, gehouden: 0, gebroken: 0,
    architectuur: uit.architectuur.length, architectuurGehouden: 0, architectuurGebroken: 0 };
  for (const x of uit.schakels) t[x.stand]++;
  for (const x of uit.storingen) t[x.stand]++;
  for (const x of uit.architectuur) t[x.stand === 'gehouden' ? 'architectuurGehouden' : 'architectuurGebroken']++;
  uit.telling = t;
  /* `openBekend` telt NIET als defect, maar de keten heet dan ook niet gesloten:
     hij is `sluitMetBevinding`. Twee velden en geen samengesteld cijfer, want een
     proef die "sluit: true" meldt terwijl er een gat in staat, is precies de
     scorecard die LAT.md regel 11 verbiedt. */
  const heel = t.open === 0 && t.stuk === 0 && t.gebroken === 0 &&
    t.architectuurGebroken === 0 && t.schakels >= 7 && t.architectuur === 4;
  uit.sluit = heel && t.openBekend === 0;
  uit.sluitMetBevinding = heel;
  uit.bevindingen = uit.schakels.filter(x => x.stand === 'openBekend')
    .map(x => ({ schakel: x.nr, van: x.van, naar: x.naar, wat: x.wat,
      gemeten: x.ziet || x.antwoord || null, status: x.status, reden: x.bekend }));
  return uit;
}

function druk(u) {
  console.log('momentproef: ' + u.telling.schakels + ' schakels (' + u.telling.gesloten + ' gesloten, ' +
    u.telling.openBekend + ' open met reden, ' + u.telling.open + ' open, ' + u.telling.stuk + ' stuk), ' +
    u.telling.storingen + ' storingen (' + u.telling.gehouden + ' gehouden, ' + u.telling.gebroken + ' gebroken), ' +
    u.telling.architectuur + ' architectuurbeweringen (' + u.telling.architectuurGehouden + ' gehouden, ' +
    u.telling.architectuurGebroken + ' gebroken).');
  for (const s of u.schakels)
    console.log('  ' + String(s.nr).padStart(2) + ' ' + (s.van + '->' + s.naar).padEnd(26) +
      s.stand.padEnd(11) + s.wat + (s.ziet ? '\n      ziet: ' + s.ziet : '') +
      (s.bekend ? '\n      BEVINDING: ' + s.bekend : '') +
      (s.antwoord ? '\n      antwoord: ' + s.antwoord : '') + (s.fout ? '\n      FOUT: ' + s.fout : ''));
  for (const s of u.storingen)
    console.log('  -- ' + s.stand.padEnd(9) + s.naam + '\n      belooft: ' + s.belofte + '\n      gaf: ' + s.wat);
  for (const a of u.architectuur)
    console.log('  ' + a.id + '  ' + a.stand.padEnd(9) + a.bewering + '\n      gemeten: ' + a.gemeten);
  console.log(u.sluit ? '\nDe keten sluit.'
    : u.sluitMetBevinding ? '\nDe keten loopt door, met ' + u.telling.openBekend + ' bevinding(en) die een besluit vragen.'
      : '\nDE KETEN SLUIT NIET.');
}

module.exports = { meet, DOEL, ZAAK };

if (require.main === module) {
  meet().then(u => {
    if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exitCode = u.sluitMetBevinding ? 0 : 1; return; }
    druk(u);
    if (process.argv.includes('--vastleggen')) {
      fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
      console.log('geschreven: MOMENTPROEF.json');
    }
    process.exit(u.sluitMetBevinding ? 0 : 1);
  }).catch(e => { console.error('de momentproef kon niet draaien: ' + (e && e.message || e)); process.exit(1); });
}

/* DE ZWARE POORT AAN DE ROUTEKANT -- één plek waar een handeling om een verse
   passkey vraagt, zodat er niet zes bijna-gelijke controles ontstaan.

   ../kern/webauthn-actie.js doet de ceremonie; dit bestand doet de bedrading:
   waar komt de origin vandaan, waar de sessiesleutel voor de binding, en wat
   gebeurt er als het bewijs ontbreekt. Zes routes gebruiken hem (zie
   ./webauthn-acties.js), en zes eigen varianten van deze vijf regels zou exact
   de vorm zijn die dit huis al vaker duur heeft betaald (LAT.md regel 4).

   DE RATEL -- en waarom er hier een terugval in zit die ergens anders een gat
   zou heten. Een account zonder passkey kan niets bevestigen. Zou de zware
   poort dan weigeren, dan sluit de eerste installatie zichzelf buiten: de
   eigenaar heeft vandaag nul passkeys en heeft juist de technische pagina nodig
   om er een te zetten. De terugval is dus noodzakelijk, maar hij is nooit
   STIL: elke zware handeling die zonder passkeybewijs doorgaat, schrijft een
   regel in het logboek en een kritieke melding op het beveiligingsbord. Zodra
   er één passkey staat, is de bevestiging hard -- en omlaag komt hij niet
   vanzelf, want `passkey-weg` zit zelf in de zware lijst.

   WAT DEZE POORT NIET IS. Hij zegt niets over of iemand MAG (dat doen
   techAuth/eigenaarAlleen en boardroomAuth, en die staan ervoor). Hij zegt
   alleen of DEZE handeling, nu, opnieuw met een vinger is bevestigd. Twee
   vragen, twee lagen; ze mogen niet worden samengevoegd, want dan zou een
   geslaagde bevestiging ook toegang gaan betekenen. */
'use strict';
const crypto = require('crypto');

/* Het voorvoegsel van de binding, en het woont hier omdat DEZE poort hem maakt
   -- niet in ./webauthn-acties.js, dat de woordenlijsten draagt. Het draagt een
   versienummer: verandert de vorm ooit, dan verlopen oude ceremonies vanzelf in
   plaats van half te passen. */
const ZWAAR_BINDING = 'rtg-zwaar-v1';

/* DE SESSIESLEUTEL VOOR DE BINDING -- een vingerafdruk van het bearer-token en
   niet het token zelf, want dat zou daarmee in de ceremonie-opslag terechtkomen.
   Hij staat hier omdat drie plekken hem nodig hebben (de technische pagina, de
   boardroom, het passkeybeheer) en drie eigen afleidingen betekent dat er ooit
   twee hetzelfde token op een ander getal afbeelden -- en dan past een assertie
   uit de ene sessie stilletjes in de andere. */
const sessieSleutel = req => crypto.createHash('sha256')
  .update(String((req && req.get && req.get('authorization') || '').replace(/^Bearer\s+/i, '')))
  .digest('hex').slice(0, 24);

/* `beveiligVan` is met opzet een getter en geen module. De beveiligingsmodule
   komt op een ander moment in de montage beschikbaar dan de routes die deze
   poort bedraden; een waarde meegeven zou hem op `undefined` vastzetten en dan
   verdwijnt juist de melding die de terugval zichtbaar moet houden -- stil, en
   precies bij het geval dat niemand mag missen. */
module.exports = ({ zwaarBeveiliging, appUrl, log, beveiligVan, accounts, envelopWie }) => {
  const beveiligNu = () => { try { return typeof beveiligVan === 'function' ? beveiligVan() : null; } catch (e) { return null; } };
  const oorsprong = req => { try { return new URL(appUrl(req)).origin; } catch (e) { return ''; } };
  const gastheer = req => { try { return new URL(oorsprong(req)).hostname; } catch (e) { return req.hostname; } };

  /* De binding draagt de actienaam EN de sessiesleutel. De sleutel komt van de
     aanroeper en wordt hier niet geraden: de technische pagina, de boardroom en
     het passkeybeheer kennen elk hun eigen sessie, en een verkeerd geraden
     sleutel zou een binding opleveren die altijd klopt -- dat is een binding
     die niets bindt. */
  const binding = (actie, sleutel) => ZWAAR_BINDING + '|' + actie + '|' + String(sleutel || '');

  async function opties(user, actie, sleutel, req) {
    if (!user) return { status: 403, error: 'Deze bevestiging hoort bij een eigen RTG-account.' };
    return zwaarBeveiliging.opties(user, actie, binding(actie, sleutel), gastheer(req));
  }

  /* Geeft { ok:true, bewezen:true|false } als de handeling door mag, of een
     { status, error } die de route ongewijzigd doorgeeft. `bewezen:false`
     betekent: doorgelaten op de terugval, en dat staat inmiddels in het log. */
  async function eis(user, actie, sleutel, req, omschrijving) {
    if (!user) return { status: 403, error: 'Deze handeling hoort bij een eigen RTG-account.' };

    if (!zwaarBeveiliging.nodig(user)) {
      const zin = 'Zware handeling "' + actie + '" uitgevoerd ZONDER passkeybevestiging: '
        + 'dit account heeft nog geen passkey. Zet er een, dan is deze handeling voortaan '
        + 'alleen met een vinger te doen.';
      if (log && log.warn) log.warn('zwaar-zonder-passkey', { actie, door: user.id });
      const bz = beveiligNu();
      if (bz) bz.meld('zwaar-zonder-passkey', 'kritiek', zin, { bron: 'user:' + user.id });
      return { ok: true, bewezen: false };
    }

    /* Wél passkeys, maar niets meegestuurd: dat is geen verlopen ceremonie maar
       een client die de stap niet heeft gedaan. Een eigen antwoord, zodat het
       scherm weet dat het de ceremonie moet starten in plaats van het opnieuw
       te proberen. */
    if (!req.body || !req.body.ceremonie || !req.body.antwoord) {
      return { status: 401, bevestigingNodig: true, actie,
        error: 'Bevestig deze handeling met uw passkey.' };
    }

    const r = await zwaarBeveiliging.maak(user, actie, binding(actie, sleutel),
      req.body.ceremonie, req.body.antwoord, oorsprong(req), gastheer(req));
    if (r.error) return r;

    if (log && log.info) log.info('zwaar-bevestigd', { actie, door: user.id });
    const bb = beveiligNu();
    if (bb) bb.meld('zwaar-bevestigd', 'info',
      (omschrijving || ('De handeling "' + actie + '"')) + ' is met een passkey bevestigd.',
      { bron: 'user:' + user.id });
    return { ok: true, bewezen: true };
  }

  /* Een geweigerd bewijs teruggeven zonder de statuscode in de body te laten
     lekken. Staat hier en niet in vier routes, want vier kopieën van dit regeltje
     lopen uiteen zodra er een veld bij komt (`bevestigingNodig` was er zo een). */
  function stuur(res, r) {
    const { status, ok, bewezen, ...rest } = r;
    return res.status(status || 401).json(rest);
  }

  /* HET ACCOUNT ACHTER EEN BOARDROOM-SESSIE, en de reden dat hij HIER staat en
     niet in routes/kantoren/: dan zou het kantoordomein `accounts` in zijn
     domeingrens moeten opschrijven (GRENZEN.json), en dat is precies de reikte
     die de codenaam-scheiding uit CLAUDE.md niet wil -- het kantoor werkt op
     codenamen en hoort niet rechtstreeks in de identiteitskluis te kunnen.
     De boardroom-poort heeft het zware werk al gedaan: een anonieme kantoorcode
     komt daar nooit doorheen, dus de actor draagt hier altijd `user-<id>`.

     HIJ LAS `req.boardroomKey`, EN DAT VELD BESTAAT NIET MEER. Het is weggehaald
     door TAKEN.md 4.72 (het enige echte duplicaat van de actorvormen), en
     kern/kantoor/boardroom.js zegt op de plek waar het stond met zoveel woorden
     waar het naartoe is: "wie er handelt staat in de envelop hieronder, en daar
     leest envelop.wie(req) hem generiek uit". Deze module is geschreven tegen
     een boom waarin dat veld er nog was, en beide takken waren apart groen --
     samen gaf `boardroomUser` altijd null, en dan zakt ELKE zware handeling op
     de boardroom met "Deze handeling hoort bij een eigen RTG-account": toegang
     geven, de terugstortstand omzetten, de veegronde. Niet alleen in de toets.

     De generieke lezer wordt INGESPOTEN en niet hier gerequired: deze module
     hoort in kern en `opzet/` is de laag erboven. Ontbreekt hij, dan is de
     uitkomst null en dus de veilige kant -- een zware handeling die niet kan
     vaststellen wie er handelt, hoort niet door te gaan. */
  function boardroomUser(req) {
    const k = String((envelopWie && req ? envelopWie(req) : null) || '');
    if (!k.startsWith('user-') || !accounts) return null;
    try { return accounts.getUserById(Number(k.slice(5))) || null; } catch (e) { return null; }
  }

  return { opties, eis, binding, stuur, sessieSleutel, boardroomUser };
};

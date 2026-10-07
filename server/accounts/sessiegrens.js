/* Accounts, deel "sessiegrens": EEN OPVATTING VAN `sessies_vanaf`, voor
   sessie- en actietokens, en onderaan een van een uitgezet account.

   Per account staat een moment, en wat daarvoor is uitgegeven telt niet meer.
   Dat geldt voor een sessietoken (./tokens.js) en sinds RTG-V1 N12 ook voor
   een actietoken (./actietokens.js).

   WIE DE GRENS ZET. Vier wegen (paden vanaf server/), niet allemaal op
   verzoek van het lid:
     wachtwoord        accounts/herstel.js setPassword (en de zaaiweg in
                       accounts/users.js zetWachtwoordHash): het lid wijzigt
                       zijn wachtwoord, dus wat hij eerder uitgaf telt niet meer;
     herstel           accounts/herstel.js consumeReset: hetzelfde, via de link;
     eigenaarsherstel  routes/eigenaarherstel.js, via accounts/users.js
                       zetSessiegrens: na een quorum, want een herstel dat de
                       sessie van een indringer laat staan, herstelt niets;
     pas naar gast     kern/aanmeldingen/naargast.js, via zetSessiegrens: het
                       lid, het kantoor of een regel van de eigenaar verlaagt de
                       pas, en een ingelogde telefoon hield anders de oude.

   Bij die laatste gaat de grens over de PAS in de sessie en niet over wat het
   lid uitgaf. Dat een openstaande verify-email- of mailwissellink dan ook
   afvalt, is een bijgevolg: de grens kent geen soort zetter, en het lid vraagt
   een nieuwe link aan. De toets van N12 (actietoken-sessiegrens) houdt het
   blok hierboven tegen de bron.

   WAT DE GRENS NIET ZET: "sluit alle andere sessies" van het lid
   (routes/member/sessies.js sluit-overige). Die knop trekt per sessie-id in en
   laat `sessies_vanaf` staan, dus een openstaand actietoken overleeft hem. De
   mail aan het oude adres bij een mailwissel zegt daarom terecht OOK "wijzig
   uw wachtwoord".

   NIET DE ENIGE LEZER. ./staff-sessie.js vergelijkt het inlogmoment van een
   leverancierssessie (lidInlogOp) nog met een eigen regel. Voor elk geldig
   moment geeft die hetzelfde antwoord; een ontbrekend moment behandelt hij
   anders, en dat valt buiten deze module.

   WAAROM HIER EN NIET INLINE. De vergelijking stond in verifyToken. Een tweede
   kopie in de actietokens zou op een dag een ander antwoord geven op "vanaf
   wanneer telt een token niet meer" (LAT.md regel 4), en dat merkt niemand
   tot een token na een wachtwoordwijziging blijft werken.

   ONTBREEKT HET UITGIFTEMOMENT OF IS HET GEEN GETAL, dan geldt het als moment
   0: het token valt af zodra er ooit een grens is gezet. Dat is de kant
   waarheen een grens hoort te falen. Zonder die terugval maakt NaN elke
   vergelijking false, en dan laat de grens het token juist DOOR.

   GEEN ACCOUNT: false, en geen TypeError. Of het account bestaat, beslist de
   aanroeper; beide aanroepers geven dan zelf al null terug. */
'use strict';

function voorGrens(u, uitgegeven) {
  if (!u) return false;
  const t = Number(uitgegeven);
  return Number(u.sessies_vanaf || 0) > (Number.isFinite(t) ? t : 0);
}

/* EN EEN OPVATTING VAN "UITGEZET" (RTG-V1 N20). De tweede reden waarom een
   geldig getekend token niet meer telt: het account staat op non-actief,
   bijvoorbeeld uit dienst gemeld door de organisatie via SCIM
   (accounts/users.js zetActief). Staatloze tokens zijn niet allemaal terug te
   halen, een vlag op het account wel. Uitzetten is geen wissen: zet de
   organisatie het account weer aan, dan telt een token dat nog niet verlopen
   of ingetrokken is gewoon weer.

   Het gold alleen voor een sessietoken. Een actietoken (2FA-bewijs,
   mailboxlink, sso-overdracht) gaf bij een uitgezet account de gebruiker
   terug, dus een openstaande mailwissel ging door en een bewijs uit stap een
   leverde een (meteen weer geweigerd) sessietoken op, met een verbruikte code
   en een vastgelegde inlog. Nu lezen verifyToken, verifyActionToken en
   accounts.isActief alle drie deze functie, zodat "uit dienst" binnen
   server/accounts/ niet per deur iets anders kan betekenen (de toets van N20,
   actietoken-uitgezet, houdt dat tegen de bron).

   NIET DE ENIGE LEZER, ook hier niet. Buiten server/accounts/ vergelijken
   deze bestanden `actief` nog zelf met 0 (paden vanaf server/):
     bedrijf/deuren.js                (twee keer)
     bedrijf/productie-identiteit.js
     kern/mail-publiek.js
     scim/user-sync.js
     scim/vorm.js
   en routes/scim.js logt daarnaast `actief === 1`. De vergelijkingen met 0
   betekenen vandaag hetzelfde als uitgezet(). Dat ze accounts.isActief gaan
   lezen, valt buiten N20; dat deze lijst klopt, houdt de toets van N20 tegen
   de bron.

   ALLEEN DE WAARDE 0 IS UIT. De kolom staat standaard op 1, en een account
   zonder kolom (van voor de migratie) of zonder account (dat beslist de
   aanroeper, zoals bij voorGrens) is niet uitgezet. */
const uitgezet = (u) => !!u && u.actief === 0;

module.exports = { voorGrens, uitgezet };

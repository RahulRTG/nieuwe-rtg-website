/* Het concierge-bureau, de VORM van de werkvloer van de concierge-lus: wat de
   case-eigenaar ziet. Geknipt uit ./concierge-lus.js (dat de knoppen bedient)
   op de grens tussen tekenen en doen; zie daar voor wat het scherm NIET zelf
   beslist. Alles wat hier staat komt uit lusKantoor() op de server: de stand
   van een aanbod, de klaargezette berichten en of de zaak mag sluiten. */
(function () {
  'use strict';

  var BRON = { normaal: 'Gewone route', beslisser: 'Na doorzetten naar de beslisser', alternatief: 'Alternatief', tijd: 'Andere tijd' };
  var taal = function () { return document.documentElement.lang || undefined; };
  var euro = function (c) { return '€ ' + (Number(c || 0) / 100).toLocaleString(taal(), { minimumFractionDigits: 0, maximumFractionDigits: 2 }); };
  function onderdeelRij(o, zaak) {
    var kapot = o.stand === 'kapot', vervangen = !!o.vervangenDoor;
    return '<div class="meta" data-onderdeel="' + esc(o.id) + '"><b>' + esc(o.wat) + '</b>'
      + (o.van ? ' · ' + esc(o.van) : '') + (o.duurMin ? ' · ' + o.duurMin + ' min' : '')
      + (o.deelnemer ? ' · zaak ' + esc(o.deelnemer.code) : '') + ' · <span class="status">' + esc(vervangen ? 'vervangen' : o.stand) + '</span>'
      + (kapot ? '<br>Gaat niet door: ' + esc(o.reden || '') : '')
      + (kapot || vervangen ? '' : '<div class="acties">'
        + (o.stand !== 'bevestigd' ? '<button class="knop" data-l-bevestig>Bevestigd</button>' : '')
        + '<input class="veld js-min" type="number" min="-240" max="240" placeholder="Minuten later (of eerder: -)" aria-label="Minuten vertraging voor ' + esc(o.wat) + '">'
        + '<button class="knop" data-l-vertraging>Doorrekenen</button>'
        + '<input class="veld js-reden" maxlength="300" placeholder="Wat is er gebeurd?" aria-label="Reden waarom ' + esc(o.wat) + ' omvalt">'
        + '<button class="knop af" data-l-kapot>Valt om</button></div>')
      + '</div>';
  }

  function tekenWerk(el, d) {
    var z = d.zaak;
    var eig = z.eigenaar || {};
    var wens = [z.van, z.tijd, z.plaats, z.personen ? z.personen + ' personen' : '', z.gelegenheid].filter(Boolean).join(' · ');
    var kapotte = (z.onderdelen || []).filter(function (o) { return o.stand === 'kapot' && !o.vervangenDoor; });
    var h = '<div class="veldblok">'
      + '<div class="meta"><b>Eigenaar:</b> ' + esc(eig.naam || 'nog niemand op naam') + ' (' + esc(eig.rol || 'Lead Rechterhand') + ')'
      + ' <button class="knop" data-l-neem>Ik pak dit op</button></div>'
      + '<div class="meta"><b>De wens:</b> ' + esc(z.wat) + (wens ? '<br>' + esc(wens) : '')
      + ((z.harde || []).length ? '<br>Harde wensen: ' + esc(z.harde.join(', ')) : '')
      + '<br>Speelruimte in tijd: ' + (z.speelruimteMin || 0) + ' min'
      + (z.verrassing ? '<br><b>Verrassing.</b> Er gaat niets naar het gezin of een gedeeld kanaal; een zaak ziet "discreet".' : '') + '</div>'
      + '<div class="meta"><b>Wat het lid nu leest:</b> ' + esc(d.bericht && d.bericht.tekst) + '</div>'
      + (z.voorstel ? '<div class="meta"><b>Ligt bij het lid:</b> ' + esc(z.voorstel.reden) + '</div>' : '')

      + '<div class="sectie"><span>Stap 3</span></div><div class="meta">Lukt de gewone route niet? Dan wordt dit een bijzonder verzoek, met de weigering in de tijdlijn.</div>'
      + '<input class="veld js-weigering" maxlength="300" placeholder="Wat zei de gewone route?" aria-label="Wat zei de gewone route">'
      + '<div class="acties"><button class="knop" data-l-weigering>Gewone route lukt niet</button></div>'

      + '<div class="sectie"><span>Mogelijkheden</span></div>'
      + ((d.mogelijkheden || []).length ? d.mogelijkheden.map(function (a) {
        var kies = (a.stand === 'vastgehouden' || a.stand === 'zonder-termijn') && !z.voorstel;
        return '<div class="meta" data-aanbod="' + esc(a.id) + '"><b>' + esc(a.wat) + '</b>' + (a.van ? ' · ' + esc(a.van) : '')
          + (a.bedragCenten ? ' · ' + euro(a.bedragCenten) : '') + (a.zaak ? ' · zaak ' + esc(a.zaak.code) : '')
          + ' · ' + esc(BRON[a.bron] || a.bron) + '<br>' + esc(a.label)
          + (a.geldigTot && a.stand === 'vastgehouden' ? ' tot ' + esc(String(a.geldigTot).slice(11, 16)) + ' UTC' : '')
          + (kies ? '<div class="acties"><button class="knop doe" data-l-kies>Kiezen</button></div>' : '') + '</div>';
      }).join('') : '<div class="meta">Nog niets aangeboden.</div>')
      + '<div class="veldblok"><input class="veld js-a-wat" maxlength="160" placeholder="Wat wordt er aangeboden?" aria-label="Wat wordt er aangeboden">'
      + '<input class="veld js-a-van" placeholder="Tijd (uu:mm)" aria-label="Tijd van het aanbod">'
      + '<input class="veld js-a-duur" type="number" min="0" max="720" placeholder="Duur in minuten" aria-label="Duur in minuten">'
      + '<input class="veld js-a-bedrag" type="number" min="0" placeholder="Bedrag in euro" aria-label="Bedrag in euro">'
      + '<input class="veld js-a-zaak" maxlength="40" placeholder="Zaakcode van de partner (optioneel)" aria-label="Zaakcode van de partner">'
      + '<input class="veld js-a-geldig" type="number" min="0" max="1440" placeholder="Vastgehouden voor minuten (leeg: geen termijn)" aria-label="Vastgehouden voor minuten">'
      + '<select class="veld js-a-bron" aria-label="Waar komt het aanbod vandaan">' + Object.keys(BRON).map(function (b) { return '<option value="' + b + '">' + esc(BRON[b]) + '</option>'; }).join('') + '</select>'
      + (kapotte.length ? '<select class="veld js-a-vervangt" aria-label="Vervangt"><option value="">Vervangt niets</option>'
        + kapotte.map(function (o) { return '<option value="' + esc(o.id) + '">Vervangt: ' + esc(o.wat) + '</option>'; }).join('') + '</select>' : '')
      + '</div><div class="acties"><button class="knop" data-l-aanbod>Aanbod vastleggen</button></div>'

      + '<div class="sectie"><span>Programma</span></div>'
      + ((z.onderdelen || []).length ? z.onderdelen.map(function (o) { return onderdeelRij(o, z); }).join('') : '<div class="meta">Nog niets vastgezet.</div>')
      + '<div class="veldblok"><input class="veld js-o-wat" maxlength="160" placeholder="Onderdeel" aria-label="Onderdeel">'
      + '<input class="veld js-o-van" placeholder="Tijd (uu:mm)" aria-label="Tijd van het onderdeel">'
      + '<input class="veld js-o-duur" type="number" min="0" max="720" placeholder="Duur in minuten" aria-label="Duur van het onderdeel">'
      + '<input class="veld js-o-reis" type="number" min="0" max="240" placeholder="Reistijd ervoor in minuten" aria-label="Reistijd ervoor">'
      + '<input class="veld js-o-zaak" maxlength="40" placeholder="Zaakcode van de partner (optioneel)" aria-label="Zaakcode van de partner voor dit onderdeel">'
      + '<label class="meta"><input type="checkbox" class="js-o-bev"> Al bevestigd door de partner</label></div>'
      + '<div class="acties"><button class="knop" data-l-onderdeel>Onderdeel toevoegen</button></div>';

    if (d.klaar) {
      h += '<div class="sectie"><span>Klaargezet, nog niet verstuurd</span></div>'
        + (d.klaar.berichten.length ? d.klaar.berichten.map(function (m) {
          return '<label class="meta"><input type="checkbox" class="js-gezien" value="' + esc(m.id) + '"> Aan zaak ' + esc(m.deelnemer.code) + ': ' + esc(m.bericht) + '</label>';
        }).join('') : '<div class="meta">Deze verschuiving raakt geen partner.</div>')
        + '<div class="acties"><button class="knop doe" data-l-verstuur' + (d.klaar.berichten.length ? ' disabled' : '') + '>Verstuur wat ik heb gezien</button></div>';
    }

    h += '<div class="sectie"><span>Afsluiten</span></div>'
      + (d.afsluitbaar && d.afsluitbaar.ok
        ? '<input class="veld js-slot" maxlength="300" placeholder="Wat is er voor het lid geregeld?" aria-label="Wat is er geregeld">'
          + '<div class="acties"><button class="knop doe" data-l-geregeld>Geregeld</button><button class="knop af" data-l-afgewezen>Afwijzen</button></div>'
        : '<div class="meta">Nog niet af te sluiten: ' + esc(d.afsluitbaar && d.afsluitbaar.reden) + '</div>'
          + '<div class="acties"><button class="knop af" data-l-afgewezen>Afwijzen</button></div>')
      + '</div>';
    el.innerHTML = h;
  }


  window.RTGLusVorm = { tekenWerk: tekenWerk };
})();

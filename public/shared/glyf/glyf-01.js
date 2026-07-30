/* RTG Glyfen: één gedeelde, ingetogen lijn-iconenset in huisstijl - de plek van
   de vroegere emoji op de app-tegels. Geen kleur, geen vulling: dunne lijnen in
   currentColor, zodat elke tegel de tekstkleur van zijn omgeving erft en het
   beeld rustig en premium blijft (AP/Rolex-taal, niet speels).

   Gebruik:  var node = RTGGlyf.svg('bellen');   // <svg> of null
             RTGGlyf.heeft('bellen');            // true/false
   Wie geen glyf heeft, valt in de tegel terug op een Bodoni-monogram (25-os).
   Geen afhankelijkheden, geen extern beeld. */
(function () {
  if (window.RTGGlyf) return;
  var NS = 'http://www.w3.org/2000/svg';


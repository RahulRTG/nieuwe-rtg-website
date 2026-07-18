/* Supplier-events (deelmodule): receptkaarten, keukenkennis, 86-lijst en de keukencoach.
   De twee lagen staan als deelmodules in keuken/; hier alleen de mounts.
   Draait op de gedeelde kern; gemount vanuit routes/supplier/events.js. */
module.exports = (kern) => {
  require('./keuken/recepten')(kern);
  require('./keuken/coach')(kern);
};

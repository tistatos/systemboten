'use strict';

exports.parseStore = function(data) {
  var days = data.split(/;;;[-0];/g);
  days = days.slice(0,7);
  var openingHours = []
  for(var i = 0; i < 7; i++) {
    var parts = days[i].split(';');
    var d = { day: new Date(parts[0].replace(/^[^\d]+/, '')),
      from: parts[1],
      to: parts[2]
    };
    openingHours.push(d);
  }
  return openingHours;
}


var Twit = require('twit')
  , getenv = require('getenv')
  , _ = require('underscore')
  , parseString = require('xml2js').parseString
  , http = require('http')
  , parser = require('./parser')
;

if(getenv('NODE_ENV' === 'development')) {
  console.log("DEV");
  var devEnv = require('./env.json');
  _.forEach(devEnv, function(value, key) {
    process.env[key] = value;
  });
}


var dayNames = [ 'Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

var T = new Twit({
    consumer_key: getenv('CONSUMER_KEY'),
    consumer_secret: getenv('CONSUMER_SECRET'),
    access_token: getenv('ACCESS_TOKEN'),
    access_token_secret: getenv('ACCESS_TOKEN_SECRET')
});

var options = {
  host: "www.systembolaget.se",
  path: "/api/assortment/stores/xml",
  port:80,
};

var req = http.get(options, function(res) {
  var output = '';
  console.log(options.host + ':' + res.statusCode);
  res.setEncoding('utf8');
  res.on('data', function (chunk) {
    output += chunk;
  });
  res.on('end', function() {
    parseString(output, function (err, result) {
     parseData(result);
    });
  });
  req.on('error', function(err) {
    res.send('error: ' + err.message);
  });

  req.end();
});


var parseData = function(data) {
  var anomalies = []
  var numberOfStores = 0;
   _.forEach(data.ButikerOmbud['ButikOmbud'], function(stuff) {
      if(stuff.Typ[0] === 'Butik') {
        numberOfStores++;
        var hours = parser.parseStore(stuff.Oppettider[0]);
        for(var i = 0; i < 7; i++) {
            var day = hours[i].day.getDay();
            var opens = hours[i].from.split(":")[0];
            var closes = hours[i].to.split(":")[0];
            if(day == 0) {
              //sundays always closed
              continue;
            }
            else {
              if(closes-opens == 0) {
                console.log("Stängd dag!");
                anomalies.push(day);
              }
            }
        }
      }
  });


  var today = new Date();


  if(today.getDay() == 1) {
    var tweetText = "Trevlig måndag! Denna vecka är Systemet ";
    if(anomalies.length == 0) {
      tweetText += "öppet Mån-Lörd";
      T.post('statuses/update', { status: tweetText }, function() {});
      console.log(tweetText)
    }
    else if(anomalies.length == numberOfStores) {
      //All stores are closed one day in the week
      var firstAnom = anomalies[0];
      var same = true;
      for(var i = 0; i < anomalies.length; i++) {
        if(firstAnom != anomalies[i]) {
          same = false;
          break;
        }
      }
      if(same) {
        tweetText += "stängt på " + dayNames[firstAnom];
        T.post('statuses/update', { status: tweetText }, function() {});
        console.log(tweetText)
      }
      else{
        tweetText += "stängt under vissa dagar";
        T.post('statuses/update', { status: tweetText }, function() {});
        console.log(tweetText)
      }
    }
    else{
      //stores are closed more or less than one day in the week
      tweetText += "stängt på vissa ställe på vissa dagar";
      T.post('statuses/update', { status: tweetText }, function() {});
      console.log(tweetText)
    }
  }
  else {
    console.log("Not monday: only warn if its closed tomorrow");
    if(anomalies.length == numberOfStores) {
      //All stores are closed one day in the week
      var firstAnom = anomalies[0];
      var same = true;
      for(var i = 0; i < anomalies.length; i++) {
        if(firstAnom != anomalies[i]) {
          same = false;
          break;
        }
      }
      if(same && firstAnom-1 == today.getDay()) {
        tweetText = "OBS! OBS! OBS! OBS! Gå till systemet idag ty imorgon är det stängt! OBS! OBS! OBS! OBS!";
        T.post('statuses/update', { status: tweetText }, function() {});
        console.log(tweetText)
      }
    }
  }
}


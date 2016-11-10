var Twit = require('twit')
, getenv = require('getenv')
, _ = require('underscore')
, parseString = require('xml2js').parseString
, request = require('request')
, parser = require('./parser')
;

if(getenv('NODE_ENV' === 'development')) {
  console.log("dev!");
  console.log(getenv('NODE_ENV');
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


if(getenv('NODE_ENV' === 'development')) {
	//if were developing - dont tweet!
	T = undefined;
}


var options = {
	url: "http://www.systembolaget.se/api/assortment/stores/xml/",
	method:"GET",
	encoding: "utf8"
};

var req = request(options, function(error, response, body) {
	if(!error) {
		console.log(response.statusCode);
		output = response.body;
		parseString(output, function (err, result) {
			parseData(result);
		});
	}
	else {
		console.log(error);
	}
});


var parseData = function(data) {
	var anomalies = []
	var numberOfStores = 0;
	_.forEach(data.ButikerOmbud['ButikOmbud'], function(stuff) {
		if(stuff.Typ[0] === 'Butik') {
			numberOfStores++;
			var hours = parser.parseStore(stuff.Oppettider[0]);
			if(hours.length == 0) {
				console.log("no data!");
			}

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
			console.log(tweetText)
			T.post('statuses/update', { status: tweetText }, function() {});
		}
		else if(anomalies.length == numberOfStores) {
			//All stores are closed one day in the week
			var firstAnom = anomalies[0];
			var same = true;
			//Check if all anomalies occur the same day
			for(var i = 0; i < anomalies.length; i++) {
				if(firstAnom != anomalies[i]) {
					same = false;
					break;
				}
			}

			if(same) {
				tweetText += "stängt på " + dayNames[firstAnom];
				console.log(tweetText)
				T.post('statuses/update', { status: tweetText }, function() {});
			}
			else {
				tweetText += "stängt under vissa dagar. ";
				tweetText += "Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/"
				console.log(tweetText)
				T.post('statuses/update', { status: tweetText }, function() {});
			}
		}
		else {
			//stores are closed more or less than one day in the week
			tweetText += "stängt på vissa ställe på vissa dagar. ";
			tweetText += "Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/"
			console.log(tweetText)
			T.post('statuses/update', { status: tweetText }, function() {});
		}
	}
	else {
		console.log("Not monday: only warn if its closed tomorrow");
		var tomorrow = anomalies.filter( function(value) { return (value == today.getDay()+1);})

		if(tomorrow.length >= numberOfStores-2) { //magic number from somewhere :/
			if(today.getDay() == 0)
				tweetText = "OBS! OBS! OBS! OBS! Systemet är stängt imorgon! OBS! OBS! OBS! OBS!";
			else
				tweetText = "OBS! OBS! OBS! OBS! Gå till systemet idag ty imorgon är det stängt! OBS! OBS! OBS! OBS!";
			console.log(tweetText);
			T.post('statuses/update', { status: tweetText }, function() {});
		}
		else if(today.getDay() == 6) {
			tweetText = "Imorgon är det söndag. Systemet är stängt på söndagar";

			console.log(tweetText);
			T.post('statuses/update', { status: tweetText }, function() {});
		}
		else {
			var tomorrow = anomalies.filter( function(value) { return (value == today.getDay()+1);})
			if(tomorrow.length == 0) {
				tweetText = "Systemet är öppet imorgon";
				console.log(tweetText);
				T.post('statuses/update', { status: tweetText }, function() {});
			}
			else {
				tweetText = "Systemet är stängt på vissa ställen imorgon. ";
				tweetText += "Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/"
				console.log(tweetText);
				T.post('statuses/update', { status: tweetText }, function() {});
			}
		}
	}
}

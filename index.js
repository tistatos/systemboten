var Twit = require('twit')
, getenv = require('getenv')
, _ = require('underscore')
, SystemParser = require('./systemParser.js').SystemParser
, Systemboten = require('./systemboten.js').Systemboten

var twitterAPI = undefined


if(getenv('NODE_ENV') === 'development') {
	var devEnv = require('./env.json')
	_.forEach(devEnv, function(value, key) {
		process.env[key] = value
	})

	twitterAPI = {
		post: function(tweetText) {
			console.log("Tweeting: \"" + tweetText + "\"")
		},

		dm: function(tweetText, userId) {
			console.log("DMing user:" + userId + " with text \"" + tweetText + "\"")
		}
	}
}
else {
  twitterAPI = {

		T: new Twit({
				consumer_key: getenv('CONSUMER_KEY'),
				consumer_secret: getenv('CONSUMER_SECRET'),
				access_token: getenv('ACCESS_TOKEN'),
				access_token_secret: getenv('ACCESS_TOKEN_SECRET')
		}),

		post: function(tweetText) {
			this.T.post('statuses/update', { status: tweetText }, function() {})
		},

		dm: function(tweetText, userID) {
			this.T.post('direct_messages/events/new', {
				event: {
					type: "message_create",
					message_create: {
						target: {
							recipient_id: userID
						},
						message_data: {
							text: tweetText
						}
					}
				}
			},
			function() {})
		}
	}
}

var apiUrl = "http://www.systembolaget.se/api/assortment/stores/xml/"
var today = new Date()

var parser = new SystemParser(apiUrl)
var systemboten = new Systemboten(twitterAPI, parser)
systemboten.determineStoreStatus()

'use strict'
var assert = require('chai').assert
, _ = require('underscore')
, expect = require('chai').expect
, Systemboten = require('../systemboten.js').Systemboten

class MockParser {
	constructor() {
		this.stores = 10
		this.data = []
		this.startDate = new Date()
	}

	addStores() {
		for (var i = 0; i < this.stores; ++i) {
			this.data.push(
				{
					name: "Store #" + i,
					hours: []
				})
		}
		var that = this
		_.each(this.data, function(store) {
			for (var i = 0; i < 7; ++i) {
					that.addDayOpen(i)
			}
		})

		var that = this
		this.storeData = new Promise(function(resolve, reject) {
			resolve(that.data)
		})
	}

	addDayOpen(day) {
		var openingTime = new Date(this.startDate), closingTime = new Date(this.startDate)

		openingTime.setDate(openingTime.getDate() + day)
		openingTime.setHours(10)
		openingTime.setMinutes(0)
		openingTime.setSeconds(0)

		closingTime.setDate(closingTime.getDate() + day)
		closingTime.setHours(20)
		closingTime.setMinutes(0)
		closingTime.setSeconds(0)

		_.each(this.data, function(store) {
			store.hours[day] = { from: openingTime, to: closingTime }
		})
	}

	addDayClosedAndOpen(day) {
		var openingTime = new Date(this.startDate), closingTime = new Date(this.startDate)

		openingTime.setDate(openingTime.getDate() + day)
		openingTime.setHours(10)
		openingTime.setMinutes(0)
		openingTime.setSeconds(0)

		closingTime.setDate(closingTime.getDate() + day)
		closingTime.setHours(20)
		closingTime.setMinutes(0)
		closingTime.setSeconds(0)


		var closedStore = Math.round(this.stores * 0.33);
		_.each(this.data, function(store) {
			if(closedStore-- > 0) {
				store.hours[day] = { from: openingTime, to: openingTime }
			}
			else {
				store.hours[day] = { from: openingTime, to: closingTime }
			}
		})
	}

	addDayClosed(day) {
		var time = new Date(this.startDate)
		time.setDate(time.getDate() + day)
		time.setHours(2)
		time.setMinutes(0)
		time.setSeconds(0)
		_.each(this.data, function(store) {
			store.hours[day] = { from: time, to: time }
		})
	}
}

class MockTwitterAPI {
	constructor() {
		this.lastTweet = ""
	}

	post(tweetText) {
		this.lastTweet = tweetText
	}

	dm(tweetText) {
		this.lastTweet = "DM user: " +tweetText
	}
}

describe('Systemboten', function() {

	var mockParser = undefined
	var mockTwitter = undefined
	var systemboten = undefined

	beforeEach(function() {
		mockParser = new MockParser()
		mockParser.addStores()
		mockTwitter = new MockTwitterAPI()
		systemboten = new Systemboten(mockTwitter, mockParser)
	}),


	describe('Single days', function() {
		it('should not tweet on a regular', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"DM user: Nothing to do today")
			})
		}),

		it('should tweet that tomorrow will be closed', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosed(1)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Gå till Systemet idag ty imorgon är det stängt! OBS!")
			})
		}),

		it('Should not tweet on sundays', function() {
			mockParser.startDate = new Date("2019-06-23T00:00:00Z") //sunday
			mockParser.addDayClosed(1)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"DM user: I dont tweet on sundays!")
			})
		}),

		it('should tweet that tomorrow will be partially closed', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosedAndOpen(1)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Systemet är stängt på vissa orter imorgon! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		}),


		it('should not tweet about sundays', function() {
			mockParser.startDate = new Date("2019-06-22T00:00:00Z") //saturday
			mockParser.addDayClosed(1)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"")
			})
		})
	})

	describe('Multiple days', function() {
		it('should not tweet on a closed day about tomorrow', function() {
			mockParser.startDate = new Date("2019-06-20T00:00:00Z") //thursday
			mockParser.addDayClosed(0)
			mockParser.addDayClosed(1)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"DM user: Store is closed, nothing to do today")
			})
		}),

		it('should tweet on a partial closed day about tomorrow', function() {
			mockParser.startDate = new Date("2019-06-20T00:00:00Z") //thursday
			mockParser.addDayClosedAndOpen(0)
			mockParser.addDayClosed(1)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Gå till Systemet idag ty imorgon är det stängt! OBS!")
			})
		}),

		it('should tweet about consecutive days closed', function() {
			mockParser.startDate = new Date("2019-06-20T00:00:00Z") //friday
			mockParser.addDayClosed(1)
			mockParser.addDayClosed(2)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Gå till Systemet idag ty det är stängt i 2 dagar efter det! OBS!")
			})
		}),

		it('should tweet on saturday about monday being closed', function() {
			mockParser.startDate = new Date("2019-06-22T00:00:00Z") //saturday
			mockParser.addDayClosed(1)
			mockParser.addDayClosed(2)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Gå till Systemet idag ty det är stängt i 2 dagar efter det! OBS!")
			})
		})
	})

	describe('Partial fully closed mix days', function() {
		it('should tweet that tomorrow will be partially closed and they day after closed', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosedAndOpen(1)
			mockParser.addDayClosed(2)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Systemet är stängt på vissa orter imorgon! Dagen efter är det helt stängt! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		}),

		it('should tweet that tomorrow will be closed and the day after partially closed', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosed(1)
			mockParser.addDayClosedAndOpen(2)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Gå till Systemet idag ty imorgon är det stängt! Dagen efter är det stängt på vissa orter! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		}),

		it('should tweet that two days partially closed ', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosedAndOpen(1)
			mockParser.addDayClosedAndOpen(2)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Systemet är stängt på vissa orter i 2 dagar framöver! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		}),

		it('should tweet that two days partially closed and the day after closed', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosedAndOpen(1)
			mockParser.addDayClosedAndOpen(2)
			mockParser.addDayClosed(3)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Systemet är stängt på vissa orter i 2 dagar framöver! Sen är det helt stängt i 1 dag! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		}),

		it('should tweet that tomorrow will be partially closed and the following two days are closed', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosedAndOpen(1)
			mockParser.addDayClosed(2)
			mockParser.addDayClosed(3)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Systemet är stängt på vissa orter imorgon! Sen är det helt stängt i 2 dagar! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		}),

		it('should tweet that tomorrow will be closed and following two days after will be partially closed', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosed(1)
			mockParser.addDayClosedAndOpen(2)
			mockParser.addDayClosedAndOpen(3)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Gå till Systemet idag ty imorgon är det stängt! Sen är det stängt på vissa orter i 2 dagar! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		}),

		it('should tweet that two days closed followed by partially closed day', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosed(1)
			mockParser.addDayClosed(2)
			mockParser.addDayClosedAndOpen(3)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Gå till Systemet idag ty det är stängt i 2 dagar efter det! Sen är det stängt på vissa orter i 1 dag! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		}),

		it('should tweet that two days closed followed by two days partially closed', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosed(1)
			mockParser.addDayClosed(2)
			mockParser.addDayClosedAndOpen(3)
			mockParser.addDayClosedAndOpen(4)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Gå till Systemet idag ty det är stängt i 2 dagar efter det! Sen är det stängt på vissa orter i 2 dagar! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		}),

		it('should tweet that two days partially closed and the day after closed', function() {
			mockParser.startDate = new Date("2019-06-21T00:00:00Z") //friday
			mockParser.addDayClosedAndOpen(1)
			mockParser.addDayClosedAndOpen(2)
			mockParser.addDayClosed(3)
			mockParser.addDayClosed(4)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"OBS! Systemet är stängt på vissa orter i 2 dagar framöver! Sen är det helt stängt i 2 dagar! OBS! Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
			})
		})
	})

	describe('Week Summaries', function() {
		it('should not tweet on regular week', function(done) {
			mockParser.startDate = new Date("2019-06-17T00:00:00Z") //monday
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"DM user: Nothing special about this week")
				done()
			})
		})
		it('should tweet on monday if friday is closed', function(done) {
			mockParser.startDate = new Date("2019-06-17T00:00:00Z") //monday
			mockParser.addDayClosed(4)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"Trevlig Måndag! Denna veckan är Systemet helt stängt på Fredag.")
				done()
			})
		})

		it('should not tweet on monday about sunday', function(done) {
			mockParser.startDate = new Date("2019-06-17T00:00:00Z") //monday
			mockParser.addDayClosed(6)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"DM user: Nothing special about this week")
				done()
			})
		})

		it('should tweet on monday if wednesday and friday is closed', function(done) {
			mockParser.startDate = new Date("2019-06-17T00:00:00Z") //monday
			mockParser.addDayClosed(2)
			mockParser.addDayClosed(4)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"Trevlig Måndag! Denna veckan är Systemet helt stängt på Onsdag och Fredag.")
				done()
			})
		})

		it('should tweet on monday if wednesday is closed and friday is partially closed', function(done) {
			mockParser.startDate = new Date("2019-06-17T00:00:00Z") //monday
			mockParser.addDayClosed(2)
			mockParser.addDayClosedAndOpen(4)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"Trevlig Måndag! Denna veckan är Systemet helt stängt på Onsdag. Det är också delvis stängt på vissa platser på Fredag. Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
				done()
			})
		})

		it('should tweet on monday if friday is partially closed', function(done) {
			mockParser.startDate = new Date("2019-06-17T00:00:00Z") //monday
			mockParser.addDayClosedAndOpen(4)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"Trevlig Måndag! Denna veckan är Systemet delvis stängt på vissa platser på Fredag. Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/")
				done()
			})
		})

		it('should tweet not on monday if monday is closed', function(done) {
			mockParser.startDate = new Date("2019-06-17T00:00:00Z") //monday
			mockParser.addDayClosed(0)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"DM user: Store is closed, nothing to do today")
				done()
			})
		})

		it('should tweet on monday if wednesday to friday is closed', function(done) {
			mockParser.startDate = new Date("2019-06-17T00:00:00Z") //monday
			mockParser.addDayClosed(2)
			mockParser.addDayClosed(3)
			mockParser.addDayClosed(4)
			var systemboten = new Systemboten(mockTwitter, mockParser)
			systemboten.today = mockParser.startDate
			systemboten.determineStoreStatus().then(function() {
				expect(mockTwitter.lastTweet).equal(
				"Trevlig Måndag! Denna veckan är Systemet helt stängt på Onsdag, Torsdag och Fredag.")
				done()
			})
		})
	})
})

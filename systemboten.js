'use strict'
var _ = require('underscore')

const MONDAY = 1
const SATURDAY = 6
const SUNDAY = 0

exports.Systemboten = class Systemboten {
	constructor(twitterAPI, parser) {
		this.tweetAPI = twitterAPI
		this.parser = parser
		this.dayNames = [ 'Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag']
		this.today = new Date()
	}

	getWeekDayNumber(i) {
		return (this.today.getDay() + i) % 7
	}

	getWeekDay(i) {
		return this.dayNames[this.getWeekDayNumber(i)]
	}

	getAllStoresAreClosed(data, day) {
		return this.getStoresOpenOnDayCount(data, day) == 0
	}

	getStoresPartiallyClosed(data, day) {
		const totalStoreCount = data.length
		var storesOpen = this.getStoresOpenOnDayCount(data, day)
		return storesOpen > 0 && storesOpen != totalStoreCount
	}

	getStoresOpenOnDayCount(data, day) {
		return _.filter(data, function(store) {
			return store.hours[day].to - store.hours[day].from > 0
		}).length
	}

	getWeekStatus(data) {
		var daysFullyClosed = []
		var daysPartiallyClosed = []
		const DAYS_WITHOUT_SUNDAY = 6
		const totalStoreCount = data.length
		for (var i = 1; i < DAYS_WITHOUT_SUNDAY; ++i) {
			var storesOpenThisDay = this.getStoresOpenOnDayCount(data, i)
			if (this.getWeekDayNumber(i) != SUNDAY) {
				if (storesOpenThisDay == 0) {
					daysFullyClosed.push(this.getWeekDay(i))
				}
				else if (storesOpenThisDay != totalStoreCount) {
						daysPartiallyClosed.push(this.getWeekDay(i))
				}
			}
		}
		return {daysFullyClosed: daysFullyClosed, daysPartiallyClosed: daysPartiallyClosed}
	}

	determineStoreStatus() {
		var boten = this
		var parsing = this.parser.storeData.then(function(data) {

			if (boten.getAllStoresAreClosed(data, 0)) {
				boten.tweetAPI.dm("Store is closed, nothing to do today")
				return //dont tweet if it is closed today, the bot should ahve already warned about this!
			}
			var week = boten.getWeekStatus(data)
			if (boten.today.getDay() == MONDAY) {
				//Potentially tweet a summary of the week
				if (week.daysFullyClosed.length > 0 || week.daysPartiallyClosed.length > 0) {
					boten.tweetWeekSummary(week.daysFullyClosed, week.daysPartiallyClosed)
				}
				else {
					boten.tweetAPI.dm("Nothing special about this week")
				}
			}
			else {
				var daysAhead = 1
				if (boten.getAllStoresAreClosed(data, daysAhead)) {
					var daysInARowClosedFromToday = 1
					while (boten.getAllStoresAreClosed(data, ++daysAhead)) {
						++daysInARowClosedFromToday
					}

					--daysAhead;
					var daysPartiallyClosed = 0
					while (boten.getStoresPartiallyClosed(data, ++daysAhead)) {
						++daysPartiallyClosed
					}

					if (daysInARowClosedFromToday == 1 &&
						daysPartiallyClosed == 0 &&
						boten.today.getDay() != SATURDAY) {
						//one day closed, not any partially following
						boten.tweetSingleDayAnomaly()
					}
					else if (daysPartiallyClosed > 0){
						boten.tweetClosedAndPartiallyClosedAnomaly(daysInARowClosedFromToday, daysPartiallyClosed)
					}
					else if (daysInARowClosedFromToday > 1){
						//more than one day closed, not any partially following
						boten.tweetMultiDayAnomaly(daysInARowClosedFromToday)
					}
				}
				else if (boten.getStoresPartiallyClosed(data, daysAhead)) {
					var daysPartiallyClosed = 1
					while (boten.getStoresPartiallyClosed(data, ++daysAhead)) {
						++daysPartiallyClosed
					}
					--daysAhead;
					var daysInARowClosedFromToday = 0
					while (boten.getAllStoresAreClosed(data, ++daysAhead)) {
						++daysInARowClosedFromToday
					}

					if (daysPartiallyClosed == 1 &&
						daysInARowClosedFromToday == 0) {
						//one day partially closed, none after that
						boten.tweetSingleDayPartialAnomaly()
					}
					else if (daysInARowClosedFromToday > 0){
						//one day partially closed, then closed after that
						boten.tweetPartiallyClosedAndClosedAnomaly(daysPartiallyClosed, daysInARowClosedFromToday)
					}
					else if (daysPartiallyClosed > 1 ){
						//more than one day partially closed
						boten.tweetMultiPartiallyClosedAnomaly(daysPartiallyClosed)
					}
				}
				else {
					boten.tweetAPI.dm("Nothing to do today")
				}
			}
		})
		return parsing
	}

	tweetWeekSummary(allClosed, partiallyClosed) {
		var concatedDays = function(days) {
			var concated = _.reduce(allClosed.slice(0, allClosed.length), function(mem, day, index) {
				var substr = mem
				substr += index == allClosed.length - 1 ? " och " : ", "
				substr += day
				return substr
			})
			return concated
		}

		var tweetText = "Trevlig Måndag! Denna veckan är Systemet "
		if (allClosed.length > 0) {
			tweetText += "helt stängt på "
			if (allClosed.length > 1) {
				tweetText += concatedDays(allClosed.slice(0, allClosed.length))
			}
			else {
				tweetText += allClosed[allClosed.length - 1]
			}
			tweetText += "."
		}

		if (allClosed.length > 0 && partiallyClosed.length > 0) {
			tweetText += " Det är också "
		}
		if (partiallyClosed.length > 0) {
			tweetText += "delvis stängt på vissa platser på "
			if (partiallyClosed.length > 1) {
				tweetText += concatedDays(partiallyClosed.slice(0, partiallyClosed.length))
			}
			else {
				tweetText += partiallyClosed[partiallyClosed.length - 1]
			}
			tweetText += ". "
			tweetText += this.moreInfoText()
		}

		this.tweetAPI.post(tweetText)
	}

	singleDayAnomalyText() {
		return "Gå till Systemet idag ty imorgon är det stängt!"
	}

	multiDayAnomalyText(days) {
		return "Gå till Systemet idag ty det är stängt i " + days + (days > 1 ? " dagar " : " dag ") + "efter det!"
	}

	singleDayPartialAnomalyText() {
		return "Systemet är stängt på vissa orter imorgon!"
	}

	multiDayPartialAnomalyText(days) {
		return "Systemet är stängt på vissa orter i " + days + " dagar framöver!"
	}

	moreInfoText() {
	 return "Ta reda på specifika öppettider här: https://www.systembolaget.se/butiker-ombud/"
	}

	tweetSingleDayAnomaly() {
		var tweetText = "OBS! " + this.singleDayAnomalyText() + " OBS!"
		this.tweetAPI.post(tweetText)
	}

	tweetSingleDayPartialAnomaly() {
		var tweetText = "OBS! " + this.singleDayPartialAnomalyText() + " OBS!"
		tweetText += " " + this.moreInfoText()

		this.tweetAPI.post(tweetText)
	}

	tweetMultiDayAnomaly(days) {
		var tweetText = "OBS! " + this.multiDayAnomalyText(days) + " OBS!"
		this.tweetAPI.post(tweetText)
	}

	tweetPartiallyClosedAndClosedAnomaly(daysPartiallyClosed, daysClosed) {
		var tweetText = "OBS! "
		if (daysPartiallyClosed == 1 && daysClosed == 1) {
			tweetText += this.singleDayPartialAnomalyText() + " Dagen efter är det helt stängt! "
		}
		else {
			if (daysPartiallyClosed == 1) {
				tweetText += this.singleDayPartialAnomalyText()
			}
			else {
				tweetText += this.multiDayPartialAnomalyText(daysPartiallyClosed)
			}
			tweetText += " Sen är det helt stängt i " + daysClosed + (daysClosed > 1 ? " dagar! " : " dag! ")
		}

		tweetText += "OBS! "
		tweetText += this.moreInfoText()
		this.tweetAPI.post(tweetText)
	}

	tweetClosedAndPartiallyClosedAnomaly(daysClosed, daysPartiallyClosed) {
		var tweetText = "OBS! "
		if (daysClosed == 1 && daysPartiallyClosed == 1) {
			tweetText += this.singleDayAnomalyText() +
				" Dagen efter är det stängt på vissa orter! "
		}
		else {
			if (daysClosed == 1) {
				tweetText += this.singleDayAnomalyText()
			}
			else {
				tweetText += this.multiDayAnomalyText(daysClosed)
			}
			tweetText += " Sen är det stängt på vissa orter i " + daysPartiallyClosed + (daysPartiallyClosed > 1 ? " dagar! " : " dag! ")
		}
		tweetText += "OBS! "
		tweetText += this.moreInfoText()
		this.tweetAPI.post(tweetText)
	}

	tweetMultiPartiallyClosedAnomaly(daysPartiallyClosed) {
		var tweetText = "OBS! "
		tweetText += this.multiDayPartialAnomalyText(daysPartiallyClosed)
		tweetText += " OBS! "
		tweetText += this.moreInfoText()
		this.tweetAPI.post(tweetText)
	}
}

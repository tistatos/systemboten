'use strict'
var request = require('request')
var rp = require('request-promise-native')
, parseString = require('xml2js').parseString
, _ = require('underscore')

var parseString = require("xml2js").parseString

exports.SystemParser = class SystemParser {
	constructor(address) {
		this.address = address
		this.storeData = this.getStoreData(this.reduceDataToStoresAndHours)
	}

	reduceDataToStoresAndHours(storeData) {
		storeData = _.filter(storeData.ButikerOmbud['ButikOmbud'], function(store) {
			return store.Typ[0] === 'Butik'
		})
		storeData = _.map(storeData, function(store) {
			store = {
				type: store.Typ[0],
				name: (store.Namn[0] ? store.Namn[0] : store.Address1[0]),
				hours: (function() {
					var days = store.Oppettider[0].split(/;;;[^;]*;/g);
					days = days.slice(0,7)
					var openingHours = []
					for(var i = 0; i < 7; i++) {
						var parts = days[i].split(';')
						var date = parts[0].replace(/^[^\d]+/, '')
						var d = {
							from: new Date(date + "T" + parts[1] + "Z"),
							to: new Date(date + "T" + parts[2] + "Z"),
						}
						openingHours.push(d)
					}
					return openingHours
				})()
			}
			return store
		})
		return storeData
	}


	getStoreData(storeReducer) {
		var options = {
			url: this.address,
			method:"GET",
			encoding: "utf8"
		}

		var req = rp(options)
			.then(function(response, body) {
				var storeData = undefined
				var parsedData = parseString(response, function (err, result) {
					storeData = storeReducer(result)
				})
				return storeData
			})
		return req
	}
}

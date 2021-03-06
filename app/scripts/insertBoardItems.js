'use strict';

var BoardItem = require('../models/boardItem.server.model.js');
var querystring = require('querystring');
var inserter = require('./insertBoardItems');

var mongoose = require('mongoose'),
	BoardItem = mongoose.model('BoardItem'),
	_ = require('lodash'),
	http = require('http');

var config = {db: {
		uri: 'mongodb://localhost/mean-dev',
		options: {
			user: '',
			pass: ''
		}
	}};

if (false) {
var db = mongoose.connect(config.db.uri, config.db.options, function(err) {
	if (err) {
		console.error('Could not connect to MongoDB!');
		console.log(err);
	}
});
}
//Date, #, Team, Open, Spread, ML, Total, Bet#, Spread%, ML%, Total%, Exotics
//{"seq" : 22, "grouping" : 11, "sport" : "NFL", "description" : "SHORTEST MADE FIELD GOAL OF GAME UNDER25.5", "juice" : "+105 ", "expired" : false, "winner" : false }
function processRow (obj) {
	obj.winner = false;
	obj.processed = false;

	BoardItem.find({'type' : obj.type, 'eventDate' : obj.eventDate, 'sport' : obj.sport, 'expired' : false, 'teams' : {'$all' : obj.teams}}, function(err, boardItems) {
		// this means we have not processed this game before - easy, add it
		if (boardItems.length === 0) {
			var bitem = new BoardItem(obj);
			bitem.expired = false;
			bitem.save();
		}
		else if (boardItems.length === 1){
			// check to see if anything actually changed
			var bi = boardItems[0];
			if (!(bi.expired === obj.expired && bi.eventDate === obj.eventDate && bi.description === obj.description && bi.juice === obj.juice)) {
				// something changed, expire the existing board item and create another one
				bi.expired = true;
				bi.save();
				var newbi = new BoardItem(obj);
				newbi.expired = false;
				newbi.save();
			}
		}
		else {
			console.log('ERROR: this find should only return 0 or 1 rows, we have a problem');
		}
	});
}

function runToday(rows, dateString) {
	var sport = '';
	var j = 0;
	var lastRow = {};
	var seq = 1;
	var grouping = 1;
console.log('running for ' + dateString);
	for (var i in rows) {
		var row = rows[i].split(',');
		var date = rows[i].split('/');
		if (date.length === 1 && row.length === 1) {
			sport = row[0];
			j = 0;
		}
		if (row.length > 4 && row[0] !== 'Date') {
			var oddEntry = (j % 2 === 1);
			if (oddEntry) {
				if (row.length === 13 && lastRow.length === 13) {
					var eventDate = lastRow[0] + row[0];
					var d = lastRow[0].split('/');
					var t = row[0].split(':');
					if (t[1].indexOf('PM') > -1 && parseInt(t[0]) !== 12)
						t[0] = parseInt(t[0]) + 12;
					var jsDate = new Date('20' + d[2], parseInt(d[0])-1, d[1], t[0], t[1].charAt(0) + t[1].charAt(1), 0, 0);
					console.log(jsDate);
					eventDate = jsDate.toISOString();
					var team1 = lastRow[2];
					var team2 = row[2];
				 	var spread1 = lastRow[4];
					var spread2 = row[4];
					var moneyLine1Juice = lastRow[5];
					var moneyLine2Juice = row[5];
					var total = parseFloat(row[6].split(' ')[1]);
					var thisGrouping = parseInt(dateString + grouping);
					var thisSeq = parseInt(dateString + seq);
					var description = '';
					if (moneyLine1Juice.trim().length > 0) {
						if (parseInt(moneyLine1Juice) > 0)
							moneyLine1Juice = '+' + parseInt(moneyLine1Juice);
						else if (parseInt(moneyLine2Juice) > 0)
							moneyLine2Juice = '+' + parseInt(moneyLine2Juice);
			
						// ML ONE
						description = team1 + ' Moneyline';
						processRow({'type' : 'awayml', 'teams' : [team1, team2], 'sport' : sport, 'seq' : thisSeq++, 'grouping' : thisGrouping, 'description' : description, 'juice' : moneyLine1Juice, 'eventDate' : eventDate});
						seq++;
						// ML TWO
						description = team2 + ' Moneyline';
						processRow({'type' : 'homeml', 'teams' : [team1, team2], 'sport' : sport, 'seq' : thisSeq++, 'grouping' : thisGrouping, 'description' : description, 'juice' : moneyLine2Juice, 'eventDate' : eventDate});
						seq++;
					}
					if (spread1.length > 0) {
						var juiceOne = '-110';
						var juiceTwo = '-110';
						// indicates alternate juice
						if (spread1.charAt(spread1.length - 1) === ')') {
							spread1 = spread1.split('(');
							juiceOne = spread1[1].substring(0, spread1[1].length - 1);
							spread1 = spread1[0];

							spread2 = spread2.split('(');
							juiceTwo = spread2[1].substring(0, spread2[1].length - 1);
							spread2 = spread2[0];
						}
						// do not enter empty spreads anymore, a pk must be present
						if (spread1.length > 0 && spread1 !== ' ') {
							// SPREAD ONE
							description = team1 + ' ' + spread1;
							processRow({'type' : 'awayspread', 'teams' : [team1, team2], 'sport' : sport, 'seq' : thisSeq++, 'grouping' : thisGrouping, 'description' : description, 'spread' : spread1, 'juice' : juiceOne, 'eventDate' : eventDate});
							seq++;
							// SPREAD TWO
							description = team2 + ' ' + spread2;
							processRow({'type' : 'homespread', 'teams' : [team1, team2], 'sport' : sport, 'seq' : thisSeq++, 'grouping' : thisGrouping, 'description' : description, 'spread' : spread2, 'juice' : juiceTwo, 'eventDate' : eventDate});
							seq++;
						}
					}
					if (total > 0) {
						// OVER
						description = team1 + '-' + team2 + ' Over: ' + total;
						processRow({'type' : 'over', 'teams' : [team1, team2], 'sport' : sport, 'seq' : thisSeq++, 'grouping' : thisGrouping, 'description' : description, 'over' : true,  'total' : total, 'juice' : '-110', 'eventDate' : eventDate});
						seq++;
						// UNDER
						description = team1 + '-' + team2 + ' Under: ' + total;
						processRow({'type' : 'under', 'teams' : [team1, team2], 'sport' : sport, 'seq' : thisSeq++, 'grouping' : thisGrouping, 'description' : description, 'under' : true, 'total' : total, 'juice' : '-110', 'eventDate' : eventDate});
						seq++;
					}

					grouping++;
				}
			}
			j++;
			lastRow = row;
		}
	}
	console.log('Its done');
}

exports.insertBoardItems = function (rawCsv) {
	var rows = rawCsv.split('\r\n');
	var dateObject = new Date();
	var dateString = String(dateObject.getMonth() + 1) + String(dateObject.getDate()) + String(dateObject.getFullYear());
	runToday(rows, dateString);
};


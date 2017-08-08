'use strict';

var Controllers = {},
db = require.main.require('./src/database'),
meta = require.main.require('./src/meta'),
cron = require.main.require('cron').CronJob,
async = require('async'),
nconf = require('nconf'),
parser = require('cron-parser'),
_ = require('lodash'),
cronJobs = [];

const {PubgAPI, PubgAPIErrors} = require('pubg-api-redis')

Controllers.renderAdminPage = function (req, res, next) {
	/*
		Make sure the route matches your path to template exactly.

		If your route was:
			myforum.com/some/complex/route/
		your template should be:
			templates/some/complex/route.tpl
		and you would render it like so:
			res.render('some/complex/route');
	*/

	res.render('admin/plugins/pubgstats', {});
};

Controllers.updateStatsSocket = function(callback){
	Controllers.updateStats(function(err,result){
		if(err){
			callback(err)
		}
		else{
			callback(null, result)
		}
	})
}

Controllers.updateStats = function(next){
	var settings = {}
	async.waterfall([
		function(callback){
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  UPDATE STATS START')
			callback()
		},
		function(callback){ // get pubgstats settings
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  RETRIVING PUBGSTATS SETTINGS')
			meta.settings.get('pubgstats', function (err, results){
				settings = results
				callback()
			})
		},
		function(callback){ //get uids
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  RETRIVING UIDS')
			db.getSortedSetRangeWithScores('username:uid', 0, -1,function(err, uids){
				if (err) return console.log(err)
				// console.log(uids)
				var userKeys = []
				uids.forEach(function(u,i){
					userKeys.push('user:' + u.score + ':ns:custom_fields')
				})
				settings['userKeys'] = userKeys
				callback()
			})
		},
		function(callback){ //get user platform info
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  RETRIVING USER PLATFORM INFORMATION')
			db.getObjects(settings.userKeys, function(err, result){
				if (err) return console.log(err)
				var users = []
				// console.dir(result)
				result.forEach(function(u,i){
					if(typeof u !== 'undefined' && u.hasOwnProperty('uplay_id')){
						if(u.uplay_id !== ''){
							users.push({
								_key: 'user:' + settings.userKeys[i].replace('user:','').replace(':ns:custom_fields','') + ':pubgstats',
								uid: settings.userKeys[i].replace('user:','').replace(':ns:custom_fields',''),
								steam_id: u.steam_id,
							})
						}
					}
				})
				settings['users'] = users
				callback()
			})
		},
		function(callback){ // get users forum info
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  RETRIVING USER FORUM INFORMATION')
			var userKeys = []
			settings.users.forEach(function(u,i){
				userKeys.push('user:' + u.uid)
			})
			db.getObjects(userKeys, function(err, result){
				if (err) return console.log(err)
				async.forEachOf(result, function(user, index, cb){
					settings.users.forEach(function(u,i){
						if(user.uid == u.uid){
							settings.users[i].username = user.username
							settings.users[i].picture = user.picture
						}
					})
					cb()
				},function(err){
					callback()
				})
			})
		},
		function(callback){ // get PUBGSTATS
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  RETRIVING STATS START')
			var options = {
				apikey : settings.apiKey
			}
			const api = new PubgAPI(options)
			async.forEachOf(settings.users, function(user, index, cb){
					api.profile.byNickname(user.steam_id)
					.then((data) => {
						user.avatar  = data.Avatar
						user.selectedRegion = data.selectedRegion
						user.season = data.defaultSeason
						user.seasonName = data.seasonDisplay
						user.playerName = data.PlayerName
						user.stats = []
						data.Stats.forEach(function(s){
							if(s.Region == user.selectedRegion && s.Season == user.season){
							 user.stats.push(s)
							}
						})
						cb()
					})
					.catch(error => {
						cb()
					})
			},function(err){
				console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  RETRIVING STATS END')
				callback()
			})
		},
		function(callback){
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  SAVING STATS START')
			async.forEachOf(settings.users, function(user, index, cb){
				if(user.hasOwnProperty('stats')){
					db.setObject(user._key,user,function(err,result){
						console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  STATS SAVED FOR  ' + settings.users[index].username + ' ')
						cb()
					})
				}
				else{
					cb()
				}
			},function(err){
				console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  SAVING STATS END')
				callback()
			})
		}
	],function(err, result){
		console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  UPDATE STATS END')
		next(null, { complete : true, users: settings.users })
	})
}

Controllers.startJobs = function(){
	var settings = {}
	// console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  CRONJOB STARTED')
	async.waterfall([
		function(callback){
			meta.settings.get('pubgstats', function (err, results){
				settings = results
				callback()
			})
		},
		function(callback){
			if(settings.hasOwnProperty('updateTime')){
				settings.validCron = parser.parseString(settings.updateTime)
				console.log(_.isEmpty(settings.validCron.errors))
				callback()
			}
			else{
				return
			}
		},
		function(callback){
			settings.started = false;
			if(_.isEmpty(settings.validCron.errors) && settings.updateTime != ''){
				cronJobs.push(new cron(settings.updateTime, function(){
					Controllers.updateStats(function(err,result){
						console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  CRON RUN COMPLETE')
					})
				}, null, false));
				settings.started = true;
			}
			callback()
		},
		function(callback){
			cronJobs.forEach(function(job) {
				console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  STARTING CRON JOBS')
				job.start()
			})
			callback()
		}
	],function(err, result){
		if(settings.started){
			settings.validCron = parser.parseExpression(settings.updateTime)
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  CRON JOBS STARTED')
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  NEXT UPDATE @ ' + settings.validCron.next().toString())
		}
		else{
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  CRON JOBS NOT STARTED')
			console.log('[' + new Date().toISOString() + '][PUBGSTATS] 🔫  CHECK SETTINGS')
		}
	})
}

module.exports = Controllers;

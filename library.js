"use strict";

var controllers = require('./lib/controllers'),
socketPlugins = require.main.require('./src/socket.io/plugins'),
pubgsockets = require('./lib/pubgsockets'),
plugin = {};

plugin.init = function(params, callback) {
	var router = params.router,
		hostMiddleware = params.middleware,
		hostControllers = params.controllers;
	// We create two routes for every view. One API call, and the actual route itself.
	// Just add the buildHeader middleware to your route and NodeBB will take care of everything for you.

	router.get('/admin/plugins/pubgstats', hostMiddleware.admin.buildHeader, controllers.renderAdminPage);
	router.get('/api/admin/plugins/pubgstats', controllers.renderAdminPage);
	// create socket name space
	socketPlugins.PUBGSTATS = pubgsockets
	//schedule cron jobs
	controllers.startJobs();
	callback();
};

plugin.addAdminNavigation = function(header, callback) {
	header.plugins.push({
		route: '/plugins/pubgstats',
		icon: 'fa-tint',
		name: 'PUBGSTATS'
	});

	callback(null, header);
};

module.exports = plugin;

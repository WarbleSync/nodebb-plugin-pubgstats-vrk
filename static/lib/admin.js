'use strict';
/* globals $, app, socket */

define('admin/plugins/pubgstats', ['settings'], function(Settings) {

	var ACP = {};

	ACP.init = function() {
		Settings.load('pubgstats', $('.pubgstats-settings'));

		$('#save').on('click', function() {
			Settings.save('pubgstats', $('.pubgstats-settings'), function() {
				// console.log('save')
				app.alert({
					type: 'success',
					alert_id: 'pubgstats-saved',
					title: 'Settings Saved',
					message: 'Please restart the forum before running update',
					clickfn: function() {
						socket.emit('admin.reload');
					}
				});
			});
		});

		$('#updateStats').on('click', function(){
			app.alert({
				type: 'info',
				alert_id: 'pubgstats-update',
				title: 'Update Started',
				message: 'Please wait while stats are calculated'
			});
			socket.emit('plugins.PUBGSTATS.updateStats', {}, function (err, data) {
			  // console.log(data)
				app.alert({
					type: 'success',
					alert_id: 'pubgstats-update',
					title: 'Update Complete',
					message: 'Success! Stats calculated!',
				});
			})
			return false;
		})

	};

	return ACP;
});

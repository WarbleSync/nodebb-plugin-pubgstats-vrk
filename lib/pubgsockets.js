'use strict';
var pubgsockets = {},
controllers = require('./controllers')

pubgsockets.updateStats = function(socket, data, callback){
  controllers.updateStatsSocket(function(err,result){
    // console.log(result)
    callback(null, result)
  })
}

module.exports = pubgsockets;

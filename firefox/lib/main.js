
const {Cc, Ci, Cr} = require("chrome");
var tabs = require("sdk/tabs");
var timers = require("sdk/timers");
var prefs = require("sdk/simple-prefs").prefs;
var self = require("sdk/self");

var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);

// Will save the login/password from http://broadcast/
var loginPass = '';

// This is a transition page useful for a callback after the request http://broadcast
var bridgeUrl = 'http://umw.fr/startBot';

// Redirect from broadcast/XXX to bridgeUrl/XXX
observerService.addObserver({
  observe: function(subject, topic, data)
  {
    var httpChannel = subject.QueryInterface(Ci.nsIHttpChannel);
	if (httpChannel.URI.host != 'broadcast')
		return;
	loginPass = httpChannel.URI.path;
	var uri = ioService.newURI(bridgeUrl, 'UTF-8', null);
	httpChannel.redirectTo(uri);
  }
}, 'http-on-modify-request', false);

// Close all grooveshark tabs
function closeGSinstance()
{
	for each (var tab in tabs)
	{
		if (tab.url.indexOf('grooveshark.com') != -1)
		{
			tab.attach({contentScript:'document.body.innerHTML = "";'});
			timers.setTimeout(function(currTab){currTab.close()}, 100, tab);
		}
	}
}

// Inject the parameters & script inside the grooveshark page
function injectBot(tab, forceName, forcePass)
{
	var injection = 'document.body.appendChild(document.createElement(\'script\')).innerHTML='
		+ JSON.stringify(
			'var GUParams = JSON.parse(' + JSON.stringify(JSON.stringify(prefs)) + ');'
			+ 'GUParams.userReq = ' + JSON.stringify(forceName != undefined ? forceName : prefs.forceLoginUsername) + ';'
			+ 'GUParams.passReq = ' + JSON.stringify(forcePass != undefined ? forcePass : prefs.forceLoginPassword) + ';'
			+ 'GUParams.version = ' + JSON.stringify(self.version) + ';'
			) + ';'
			+ "document.body.appendChild(document.createElement('script')).src='"
			+ self.data.url("content_script.js") +"';";
	console.log(injection);
	tab.attach({contentScript:injection});
}

// do some action when bridgeUrl/XXX is called
tabs.on('load', function(tab){
	if (tab.url.indexOf(bridgeUrl) == 0)
	{
		var regexp = RegExp('(/([a-zA-Z0-9_-]+)(/(.*)$)?)?');
		var regResult = regexp.exec(loginPass);
		var forceName, forcePassword = null;
		if (regResult != null)
		{
			var forceName = regResult[2];
			var forcePassword = regResult[4];
		}
		if (prefs.closeAllTabsOnStartup)
			closeGSinstance();
		tab.url = 'http://grooveshark.com';
		timers.setTimeout(injectBot, 5000, tab, forceName, forcePassword);
	}
});

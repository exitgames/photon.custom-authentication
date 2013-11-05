var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var DemoMasterAddress = this["AppInfo"] && this["AppInfo"]["MasterAddress"] ? this["AppInfo"]["MasterAddress"] : "localhost:9090";
var DemoAppId = this["AppInfo"] && this["AppInfo"]["AppId"] ? this["AppInfo"]["AppId"] : "<no-app-id>";
var DemoAppVersion = this["AppInfo"] && this["AppInfo"]["AppVersion"] ? this["AppInfo"]["AppVersion"] : "1.0";
var DemoFbAppId = this["AppInfo"] && this["AppInfo"]["FbAppId"];

var client = new Photon.LoadBalancing.LoadBalancingClient(DemoMasterAddress, DemoAppId, DemoAppVersion)
// client.onFbToken = function (token) {
    // client.setCustomAuthentication("token=" + token, 2);
    // client.output("Got fb token. Setting custom fb authentication.");
    // client.output("Connect...");
    // client.connect(true);
// };

client.onError = function (errorCode, errorMsg) {
    this.output("Error " + errorCode + ": " + errorMsg);
};
client.onStateChange = function (state) {
    var LBC = Photon.LoadBalancing.LoadBalancingClient;
    this.output("State: " + LBC.StateToName(state));
};
client.onJoinRoom = function () {
    this.output("Game " + this.myRoom().name + " joined");
};
client.onActorJoin = function (actor) {
    this.output("actor " + actor.actorNr + " joined");
};
client.onActorLeave = function (actor) {
    this.output("actor " + actor.actorNr + " left");
};
client.output = function (str, color) {
    var out = document.getElementById("output");
    var escaped = str.replace(/&/, "&amp;").replace(/</, "&lt;").replace(/>/, "&gt;").replace(/"/, "&quot;");
    out.innerHTML = out.innerHTML + escaped + "<br>";
};

window.onload = function () {
    client.output("Init: " + DemoMasterAddress + " / " + DemoAppId + " / " + DemoAppVersion);
    //client.output("Connect: " + DemoMasterAddress + " / " + DemoAppId + " / " + DemoAppVersion);
    //client.connect();
};


//@ sourceMappingURL=app.js.map
// new comment version //# sourceMappingURL=app.js.map

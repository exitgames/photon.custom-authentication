/**
Photon
@namespace Photon
*/
var Photon;
(function (Photon) {
    var PhotonPeer = (function () {
        /**
        @classdesc Instances of the PhotonPeer class are used to connect to a Photon server and communicate with it.
        A PhotonPeer instance allows communication with the Photon Server, which in turn distributes messages to other PhotonPeer clients.
        An application can use more than one PhotonPeer instance, which are treated as separate users on the server.
        Each should have its own listener instance, to separate the operations, callbacks and events.
        @constructor Photon.PhotonPeer
        @param {string} url Server address:port.
        @param {string} [subprotocol=""] WebSocket protocol.
        @param {string} [debugName=""] Log messages prefixed with this value.
        */
        function PhotonPeer(url, subprotocol, debugName) {
            if (typeof subprotocol === "undefined") { subprotocol = ""; }
            if (typeof debugName === "undefined") { debugName = ""; }
            this.url = url;
            this.subprotocol = subprotocol;
            /**
            @summary Peer sends 'keep alive' message to server as this timeout exceeded after last send operation.
            Set it < 1000 to disable 'keep alive' operation
            @member Photon.PhotonPeer#keepAliveTimeoutMs
            @type {number}
            @default 5000
            */
            this.keepAliveTimeoutMs = 5000;
            this._frame = "~m~";
            this._isConnecting = false;
            this._isConnected = false;
            this._isClosing = false;
            this._peerStatusListeners = {
            };
            this._eventListeners = {
            };
            this._responseListeners = {
            };
            this.keepAliveTimer = 0;
            this._logger = new Exitgames.Common.Logger(debugName && debugName != "" ? debugName + ": " : "");
        }
        PhotonPeer.prototype.isConnecting = /**
        @summary Checks if peer is connecting.
        @method Photon.PhotonPeer#isConnecting
        @returns {bool} True if peer is connecting.
        */
        function () {
            return this._isConnecting;
        };
        PhotonPeer.prototype.isConnected = /**
        @summary Checks if peer is connected.
        @method Photon.PhotonPeer#isConnected
        @returns {bool} True if peer is connected.
        */
        function () {
            return this._isConnected;
        };
        PhotonPeer.prototype.isClosing = /**
        @summary Checks if peer is closing.
        @method Photon.PhotonPeer#isClosing
        @returns {bool} True if peer is closing.
        */
        function () {
            return this._isClosing;
        };
        PhotonPeer.prototype.connect = /**
        @summary Starts connection to server.
        @method Photon.PhotonPeer#connect
        */
        function () {
            var _this = this;
            if(this.subprotocol == "") {
                this._socket = new WebSocket(this.url);
            } else {
                this._socket = new WebSocket(this.url, this.subprotocol);
            }
            this._onConnecting();
            // Set event handlers.
            this._socket.onopen = function (ev) {
                //this.logger.debug("onopen");
                            };
            this._socket.onmessage = function (ev) {
                var message = _this._decode(ev.data);
                _this._onMessage(message.toString());
            };
            this._socket.onclose = function (ev) {
                _this._logger.debug("onclose: wasClean =", ev.wasClean, ", code=", ev.code, ", reason =", ev.reason);
                if(_this._isConnecting) {
                    _this._onConnectFailed(ev);
                } else {
                    if(1006 == ev.code) {
                        //TODO: avoid using constants. what is the 1006
                        _this._onTimeout();
                    }
                    _this._onDisconnect();
                }
            };
            this._socket.onerror = function (ev) {
                _this._onError(ev);
            };
        };
        PhotonPeer.prototype.disconnect = /**
        @summary Disconnects from server.
        @method Photon.PhotonPeer#disconnect
        */
        function () {
            this._isClosing = true;
            this._socket.close();
        };
        PhotonPeer.prototype.sendOperation = /**
        @summary Sends operation to the Photon Server.
        @method Photon.PhotonPeer#sendOperation
        @param {number} code Code of operation.
        @param {object} [data] Parameters of operation as key-value pairs.
        @param {bool} [sendReliable=false] Selects if the operation must be acknowledged or not. If false, the operation is not guaranteed to reach the server.
        @param {number} [channelId=0] The channel in which this operation should be sent.
        */
        function (code, data, sendReliable, channelId) {
            if (typeof sendReliable === "undefined") { sendReliable = false; }
            if (typeof channelId === "undefined") { channelId = 0; }
            var sndJSON = {
                req: code,
                vals: []
            };
            if(Exitgames.Common.Util.isArray(data)) {
                sndJSON.vals = data;
            } else {
                if(data === undefined) {
                    sndJSON.vals = [];
                } else {
                    throw new Error(this._logger.format("PhotonPeer[sendOperation] - Trying to send non array data:", data));
                }
            }
            this._send(sndJSON);
            this._logger.debug("PhotonPeer[sendOperation] - Sending request:", sndJSON);
        };
        PhotonPeer.prototype.addPeerStatusListener = /**
        @summary Registers listener for peer status change.
        @method Photon.PhotonPeer#addPeerStatusListener
        @param {PhotonPeer.StatusCodes} statusCode Status change to this value will be listening.
        @param {Function} callback The listener function that processes the status change. This function don't accept any parameters.
        */
        function (statusCode, callback) {
            this._addListener(this._peerStatusListeners, statusCode, callback);
        };
        PhotonPeer.prototype.addEventListener = /**
        @summary Registers listener for custom event.
        @method Photon.PhotonPeer#addEventListener
        @param {number} eventCode Custom event code.
        @param {Function} callback The listener function that processes the event. This function may accept object with event content.
        */
        function (eventCode, callback) {
            this._addListener(this._eventListeners, eventCode.toString(), callback);
        };
        PhotonPeer.prototype.addResponseListener = /**
        @summary Registers listener for operation response.
        @method Photon.PhotonPeer#addResponseListener
        @param {number} operationCode Operation code.
        @param {Function} callback The listener function that processes the event. This function may accept object with operation response content.
        */
        function (operationCode, callback) {
            this._addListener(this._responseListeners, operationCode.toString(), callback);
        };
        PhotonPeer.prototype.removePeerStatusListener = /**
        @summary Removes listener if exists for peer status change.
        @method Photon.PhotonPeer#removePeerStatusListener
        @param {string} statusCode One of PhotonPeer.StatusCodes to remove listener for.
        @param {Function} callback Listener to remove.
        */
        function (statusCode, callback) {
            this._removeListener(this._peerStatusListeners, statusCode, callback);
        };
        PhotonPeer.prototype.removeEventListener = /**
        @summary Removes listener if exists for custom event.
        @method Photon.PhotonPeer#removeEventListener
        @param {number} eventCode Event code to remove to remove listener for.
        @param {Function} callback Listener to remove.
        */
        function (eventCode, callback) {
            this._removeListener(this._eventListeners, eventCode.toString(), callback);
        };
        PhotonPeer.prototype.removeResponseListener = /**
        @summary Removes listener if exists for operation response.
        @method Photon.PhotonPeer#removeResponseListener
        @param {number} operationCode Operation code to remove listener for.
        @param {Function} callback Listener to remove.
        */
        function (operationCode, callback) {
            this._removeListener(this._responseListeners, operationCode.toString(), callback);
        };
        PhotonPeer.prototype.removePeerStatusListenersForCode = /**
        @summary Removes all listeners for peer status change specified.
        @method Photon.PhotonPeer#removePeerStatusListenersForCode
        @param {string} statusCode One of PhotonPeer.StatusCodes to remove all listeners for.
        */
        function (statusCode) {
            this._removeListenersForCode(this._peerStatusListeners, statusCode);
        };
        PhotonPeer.prototype.removeEventListenersForCode = /**
        @summary Removes all listeners for custom event specified.
        @method Photon.PhotonPeer#removeEventListenersForCode
        @param {number} eventCode Event code to remove all listeners for.
        */
        function (eventCode) {
            this._removeListenersForCode(this._eventListeners, eventCode.toString());
        };
        PhotonPeer.prototype.removeResponseListenersForCode = /**
        @summary Removes all listeners for operation response specified.
        @method Photon.PhotonPeer#removeResponseListenersForCode
        @param {number} operationCode Operation code to remove all listeners for.
        */
        function (operationCode) {
            this._removeListenersForCode(this._responseListeners, operationCode.toString());
        };
        PhotonPeer.prototype.setLogLevel = /**
        @summary Sets peer logger level.
        @method Photon.PhotonPeer#setLogLevel
        @param {Exitgames.Common.Logger.Level} level Logging level.
        */
        function (level) {
            this._logger.setLevel(level);
        };
        PhotonPeer.prototype.onUnhandledEvent = /**
        @summary Called if no listener found for received custom event.
        Override to relay unknown event to user's code or handle known events without listener registration.
        @method Photon.PhotonPeer#onUnhandledEvent
        @param {number} eventCode Code of received event.
        @param {object} [args] Content of received event or empty object.
        */
        function (eventCode, args) {
            this._logger.warn('PhotonPeer: No handler for event', eventCode, 'registered.');
        };
        PhotonPeer.prototype.onUnhandledResponse = /**
        @summary Called if no listener found for received operation response event.
        Override to relay unknown response to user's code or handle known responses without listener registration.
        @method Photon.PhotonPeer#onUnhandledEvent
        @param {number} operationCode Code of received response.
        @param {object} [args] Content of received response or empty object.
        */
        function (operationCode, args) {
            this._logger.warn('PhotonPeer: No handler for response', operationCode, 'registered.');
        };
        PhotonPeer.StatusCodes = {
            connecting: "connecting",
            connect: "connect",
            connectFailed: "connectFailed",
            disconnect: "disconnect",
            connectClosed: "connectClosed",
            error: "error",
            timeout: "timeout"
        };
        PhotonPeer.prototype._dispatchEvent = // TODO: lite calls this
        // protected
        function (code, args) {
            if(!this._dispatch(this._eventListeners, code.toString(), args, "event")) {
                this.onUnhandledEvent(code, args);
            }
        };
        PhotonPeer.prototype._dispatchResponse = // TODO: lite calls this
        // protected
        function (code, args) {
            if(!this._dispatch(this._responseListeners, code.toString(), args, "response")) {
                this.onUnhandledResponse(code, args);
            }
        };
        PhotonPeer.prototype._stringify = function (message) {
            if(Object.prototype.toString.call(message) == "[object Object]") {
                if(!JSON) {
                    throw new Error("PhotonPeer[_stringify] - Trying to encode as JSON, but JSON.stringify is missing.");
                }
                return "~j~" + JSON.stringify(message);
            } else {
                return String(message);
            }
        };
        PhotonPeer.prototype._encode = function (messages) {
            var ret = "", message, messages = Exitgames.Common.Util.isArray(messages) ? messages : [
                messages
            ];
            for(var i = 0, l = messages.length; i < l; i++) {
                message = messages[i] === null || messages[i] === undefined ? "" : this._stringify(messages[i]);
                ret += this._frame + message.length + this._frame + message;
            }
            return ret;
        };
        PhotonPeer.prototype._decode = function (data) {
            var messages = [], number, n, newdata = data;
            var nulIndex = data.indexOf("\x00");
            if(nulIndex !== -1) {
                newdata = data.replace(/[\0]/g, "");
            }
            data = newdata;
            do {
                if(data.substr(0, 3) !== this._frame) {
                    return messages;
                }
                data = data.substr(3);
                number = "" , n = "";
                for(var i = 0, l = data.length; i < l; i++) {
                    n = Number(data.substr(i, 1));
                    if(data.substr(i, 1) == n) {
                        number += n;
                    } else {
                        data = data.substr(number.length + this._frame.length);
                        number = Number(number);
                        break;
                    }
                }
                messages.push(data.substr(0, number));
                data = data.substr(number);
            }while(data !== "");
            return messages;
        };
        PhotonPeer.prototype._onMessage = function (message) {
            if(message.substr(0, 3) == "~j~") {
                this._onMessageReceived(JSON.parse(message.substr(3)));
            } else {
                if(!this._sessionid) {
                    this._sessionid = message;
                    this._onConnect();
                } else {
                    this._onMessageReceived(message);
                }
            }
        };
        PhotonPeer.prototype.resetKeepAlive = function () {
            var _this = this;
            //this._logger.debug("reset kep alive: ", Date.now());
            clearTimeout(this.keepAliveTimer);
            if(this.keepAliveTimeoutMs >= 1000) {
                this.keepAliveTimer = setTimeout(function () {
                    return _this._send({
                        irq: 1,
                        vals: [
                            1, 
                            Date.now()
                        ]
                    }, true);
                }, this.keepAliveTimeoutMs);
            }
        };
        PhotonPeer.prototype._send = function (data, checkConnected) {
            if (typeof checkConnected === "undefined") { checkConnected = false; }
            var message = this._encode(data);
            if(this._isConnected && !this._isClosing) {
                this.resetKeepAlive();
                //this._logger.debug("_send:", message);
                this._socket.send(message);
            } else {
                if(!checkConnected) {
                    throw new Error(this._logger.format('PhotonPeer[_send] - Operation', data.req, '- failed, "isConnected" is', this._isConnected, ', "isClosing" is', this._isClosing, "!"));
                }
            }
        };
        PhotonPeer.prototype._onMessageReceived = function (message) {
            if(typeof message === "object") {
                this._logger.debug("PhotonPeer[_onMessageReceived] - Socket received message:", message);
                var msgJSON = message;
                var msgErr = msgJSON.err ? msgJSON.err : 0;
                msgJSON.vals = msgJSON.vals !== undefined ? msgJSON.vals : [];
                if(msgJSON.vals.length > 0) {
                    msgJSON.vals = this._parseMessageValuesArrayToJSON(msgJSON.vals);
                }
                if(msgJSON.res !== undefined) {
                    var code = parseInt(msgJSON.res);
                    this._parseResponse(code, msgJSON);
                } else {
                    if(msgJSON.evt !== undefined) {
                        var code = parseInt(msgJSON.evt);
                        this._parseEvent(code, msgJSON);
                    } else {
                        if(msgJSON.irs !== undefined) {
                            var code = parseInt(msgJSON.irs);
                            this._parseInternalResponse(code, msgJSON);
                        } else {
                            throw new Error(this._logger.format("PhotonPeer[_onMessageReceived] - Received undefined message type:", msgJSON));
                        }
                    }
                }
            }
        };
        PhotonPeer.prototype._parseMessageValuesArrayToJSON = function (vals) {
            var parsedJSON = {
            };
            if(Exitgames.Common.Util.isArray(vals)) {
                if(vals.length % 2 == 0) {
                    var toParse = vals, key, value;
                    while(toParse.length > 0) {
                        key = toParse.shift() + "";
                        value = toParse.shift();
                        parsedJSON[key] = value;
                    }
                } else {
                    throw new Error(this._logger.format("PhotonPeer[_parseMessageValuesToJSON] - Received invalid values array:", vals));
                }
            }
            return parsedJSON;
        };
        PhotonPeer.prototype._parseEvent = function (code, event) {
            switch(code) {
                default:
                    this._dispatchEvent(code, {
                        vals: event.vals
                    });
                    break;
            }
        };
        PhotonPeer.prototype._parseResponse = function (code, response) {
            switch(code) {
                default:
                    this._dispatchResponse(code, {
                        errCode: response.err,
                        errMsg: response.msg,
                        vals: response.vals
                    });
                    break;
            }
        };
        PhotonPeer.prototype._parseInternalResponse = function (code, response) {
            this._logger.debug("internal response:", response);
        };
        PhotonPeer.prototype._onConnecting = function () {
            this._logger.debug("PhotonPeer[_onConnecting] - Starts connecting", this.url, '..., raising "connecting" event ...');
            this._isConnecting = true;
            this._dispatchPeerStatus(PhotonPeer.StatusCodes.connecting);
        };
        PhotonPeer.prototype._onConnect = function () {
            this._logger.debug('PhotonPeer[_onConnect] - Connected successfully! Raising "connect" event ...');
            this._isConnecting = false;
            this._isConnected = true;
            this._dispatchPeerStatus(PhotonPeer.StatusCodes.connect);
        };
        PhotonPeer.prototype._onConnectFailed = function (evt) {
            this._logger.error('PhotonPeer[_onConnectFailed] - Socket connection could not be created:', this.url, this.subprotocol, 'Wrong host or port?\n Raising "connectFailed event ...');
            this._isConnecting = this._isConnected = false;
            this._dispatchPeerStatus(PhotonPeer.StatusCodes.connectFailed);
        };
        PhotonPeer.prototype._onDisconnect = function () {
            var wasConnected = this._isConnected;
            var wasClosing = this._isClosing;
            this._logger.debug('PhotonPeer[_onDisconnect] - Socket closed, raising "disconnect" event ...');
            this._isClosing = this._isConnected = this._isConnecting = false;
            if(wasConnected) {
                if(wasClosing) {
                    this._dispatchPeerStatus(PhotonPeer.StatusCodes.disconnect);
                } else {
                    this._dispatchPeerStatus(PhotonPeer.StatusCodes.connectClosed);
                }
            }
        };
        PhotonPeer.prototype._onTimeout = function () {
            this._logger.debug('PhotonPeer[_onTimeout] - Client timed out! Raising "timeout" event ...');
            this._dispatchPeerStatus(PhotonPeer.StatusCodes.timeout);
        };
        PhotonPeer.prototype._onError = function (ev) {
            this._logger.error("PhotonPeer[_onError] - Connection error:", arguments[0]);
            this._isConnecting = this._isConnected = this._isClosing = false;
            this._dispatchPeerStatus(PhotonPeer.StatusCodes.error);
        };
        PhotonPeer.prototype._addListener = function (listeners, code, callback) {
            if(!(code in listeners)) {
                listeners[code] = [];
            }
            if(callback && typeof callback === "function") {
                this._logger.debug('PhotonPeer[_addListener] - Adding listener for event', code);
                listeners[code].push(callback);
            } else {
                this._logger.error('PhotonPeer[_addListener] - Listener', code, 'is not a function but of type', typeof callback, '. No listener added!');
            }
            return this;
        };
        PhotonPeer.prototype._dispatch = function (listeners, code, args, debugType) {
            if(code in listeners) {
                var events = listeners[code];
                for(var i = 0, l = events.length; i < l; i++) {
                    if(!Exitgames.Common.Util.isArray(args)) {
                        args = [
                            args
                        ];
                    }
                    events[i].apply(this, args === undefined ? [] : args);
                }
                return true;
            } else {
                return false;
            }
        };
        PhotonPeer.prototype._dispatchPeerStatus = function (code) {
            if(!this._dispatch(this._peerStatusListeners, code, undefined, "peerStatus")) {
                this._logger.warn('PhotonPeer[_dispatchPeerStatus] - No handler for ', code, 'registered.');
            }
        };
        PhotonPeer.prototype._removeListener = function (listeners, code, callback) {
            if((code in listeners)) {
                var prevLenght = listeners[code].length;
                listeners[code] = listeners[code].filter(function (x) {
                    return x != callback;
                });
                this._logger.debug('PhotonPeer[_removeListener] - Removing listener for event', code, "removed:", prevLenght - listeners[code].length);
            }
            return this;
        };
        PhotonPeer.prototype._removeListenersForCode = function (listeners, code) {
            this._logger.debug('PhotonPeer[_removeListenersForCode] - Removing all listeners for event', code);
            if(code in listeners) {
                listeners[code] = [];
            }
            return this;
        };
        return PhotonPeer;
    })();
    Photon.PhotonPeer = PhotonPeer;    
})(Photon || (Photon = {}));
var Exitgames;
(function (Exitgames) {
    /// --------------------------------------------------------------------------------------------------------------------------------------------------------------
    /// ------------------- Exitgames.Common
    /// --------------------------------------------------------------------------------------------------------------------------------------------------------------
    /**
    Exitgames
    @namespace Exitgames
    */
    /**
    Exitgames utilities
    @namespace Exitgames.Common
    */
    (function (Common) {
        var Logger = (function () {
            /**
            @classdesc Logger with ability to control logging level.
            Prints messages to browser console.
            Each logging method perfoms toString() calls and default formatting of arguments only after it checks logging level. Therefore disabled level logging method call with plain arguments doesn't involves much overhead.
            But if one prefer custom formatting or some calculation for logging methods arguments he should check logging level before doing this to avoid unnecessary operations:
            if(logger.isLevelEnabled(Logger.Level.DEBUG)) {
            logger.debug("", someCall(x, y), x + "," + y);
            }
            @constructor Exitgames.Common.Logger
            @param {string} [prefix=""] All log messages will be prefixed with that.
            @param {Exitgames.Common.Logger.Level} [level=Level.INFO] Initial logging level.
            */
            function Logger(prefix, level) {
                if (typeof prefix === "undefined") { prefix = ""; }
                if (typeof level === "undefined") { level = Logger.Level.INFO; }
                this.prefix = prefix;
                this.level = level;
            }
            Logger.prototype.setLevel = /**
            @summary Changes current logging level.
            @method Exitgames.Common.Logger#setLevel
            @param {Exitgames.Common.Logger.Level} level New logging level.
            */
            function (level) {
                level = Math.max(level, Logger.Level.DEBUG);
                level = Math.min(level, Logger.Level.OFF);
                this.level = level;
            };
            Logger.prototype.isLevelEnabled = /**
            @summary Checks if logging level active.
            @method Exitgames.Common.Logger#isLevelEnabled
            @param {Exitgames.Common.Logger.Level} level Level to check.
            @returns {bool} True if level active.
            */
            function (level) {
                return level >= this.level;
            };
            Logger.prototype.getLevel = /**
            @summary Returns current logging level.
            @method Exitgames.Common.Logger#getLevel
            @returns {Exitgames.Common.Logger.Level} Current logging level.
            */
            function () {
                return this.level;
            };
            Logger.prototype.debug = /**
            @summary Logs message if logging level = DEBUG, INFO, WARN, ERROR
            @method Exitgames.Common.Logger#debug
            @param {string} mess Message to log.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of log message after space character.
            */
            function (mess) {
                var optionalParams = [];
                for (var _i = 0; _i < (arguments.length - 1); _i++) {
                    optionalParams[_i] = arguments[_i + 1];
                }
                this.log(Logger.Level.DEBUG, mess, optionalParams);
            };
            Logger.prototype.info = /**
            @summary Logs message if logging level = INFO, WARN, ERROR
            @method Exitgames.Common.Logger#info
            @param {string} mess Message to log.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of log message after space character.
            */
            function (mess) {
                var optionalParams = [];
                for (var _i = 0; _i < (arguments.length - 1); _i++) {
                    optionalParams[_i] = arguments[_i + 1];
                }
                this.log(Logger.Level.INFO, mess, optionalParams);
            };
            Logger.prototype.warn = /**
            @summary Logs message if logging level = WARN, ERROR
            @method Exitgames.Common.Logger#warn
            @param {string} mess Message to log.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of log message after space character.
            */
            function (mess) {
                var optionalParams = [];
                for (var _i = 0; _i < (arguments.length - 1); _i++) {
                    optionalParams[_i] = arguments[_i + 1];
                }
                this.log(Logger.Level.WARN, mess, optionalParams);
            };
            Logger.prototype.error = /**
            @summary Logs message if logging level = ERROR
            @method Exitgames.Common.Logger#error
            @param {string} mess Message to log.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of log message after space character.
            */
            function (mess) {
                var optionalParams = [];
                for (var _i = 0; _i < (arguments.length - 1); _i++) {
                    optionalParams[_i] = arguments[_i + 1];
                }
                this.log(Logger.Level.ERROR, mess, optionalParams);
            };
            Logger.prototype.format = /**
            @summary Applies default logger formatting to arguments
            @method Exitgames.Common.Logger#format
            @param {string} mess String to start formatting with.
            @param {...any} optionalParams For every additional parameter toString() applies and result added to the end of formatted string after space character.
            @returns {string} Formatted string.
            */
            function (mess) {
                var optionalParams = [];
                for (var _i = 0; _i < (arguments.length - 1); _i++) {
                    optionalParams[_i] = arguments[_i + 1];
                }
                return this.format0(mess, optionalParams);
            };
            Logger.prototype.formatArr = /**
            @summary Applies default logger formatting to array of objects.
            @method Exitgames.Common.Logger#format
            @param {string} mess String to start formatting with.
            @param {any[]} optionalParams For every additional parameter toString() applies and result added to the end of formatted string after space character.
            @returns {string} Formatted string.
            */
            function (mess, optionalParams) {
                return this.format0(mess, optionalParams);
            };
            Logger.Level = {
                DEBUG: //TRACE : 0,
                1,
                INFO: 2,
                WARN: 3,
                ERROR: 4,
                OFF: //_FATAL : 5,
                6
            };
            Logger.log_types = [
                "debug", 
                "debug", 
                "info", 
                "warn", 
                "error"
            ];
            Logger.prototype.log = function (level, msg, optionalParams) {
                if(level >= this.level) {
                    // for global vars console !== undefined throws an error
                    if(typeof console !== "undefined" && msg !== undefined) {
                        try  {
                            var logMethod = console[Logger.log_types[level]];
                            if(!logMethod) {
                                logMethod = console["log"];
                            }
                            if(logMethod) {
                                if(logMethod.call) {
                                    logMethod.call(console, this.format0(msg, optionalParams));
                                } else {
                                    logMethod(console, this.format0(msg, optionalParams));
                                }
                            }
                        } catch (error) {
                            // silently fail
                                                    }
                    }
                }
            };
            Logger.prototype.format0 = function (msg, optionalParams) {
                return this.prefix + msg + " " + optionalParams.map(function (x) {
                    if(x !== undefined) {
                        switch(typeof x) {
                            case "object":
                                try  {
                                    return JSON.stringify(x);
                                } catch (error) {
                                    return x.toString() + "(" + error + ")";
                                }
                                break;
                            default:
                                return x.toString();
                                break;
                        }
                    }
                }).join(" ");
            };
            return Logger;
        })();
        Common.Logger = Logger;        
        var Util = (function () {
            function Util() { }
            Util.indexOf = function indexOf(arr, item, from) {
                for(var l = arr.length, i = from < 0 ? Math.max(0, l + from) : from || 0; i < l; i++) {
                    if(arr[i] === item) {
                        return i;
                    }
                }
                return -1;
            };
            Util.isArray = function isArray(obj) {
                return Object.prototype.toString.call(obj) === "[object Array]";
            };
            Util.merge = //TODO: naming. could be named mergeHashtable or something more specific
            function merge(target, additional) {
                for(var i in additional) {
                    if(additional.hasOwnProperty(i)) {
                        target[i] = additional[i];
                    }
                }
            };
            Util.getPropertyOrElse = function getPropertyOrElse(obj, prop, defaultValue) {
                if(obj.hasOwnProperty(prop)) {
                    return obj[prop];
                } else {
                    return defaultValue;
                }
            };
            Util.enumValueToName = function enumValueToName(enumObj, value) {
                for(var i in enumObj) {
                    if(value == enumObj[i]) {
                        return i;
                    }
                }
                return "undefined";
            };
            return Util;
        })();
        Common.Util = Util;        
    })(Exitgames.Common || (Exitgames.Common = {}));
    var Common = Exitgames.Common;
})(Exitgames || (Exitgames = {}));
var Photon;
(function (Photon) {
    (function (Lite) {
        (function (Constants) {
            // Summary:
            //     Lite - keys for parameters of operation requests and responses (short: OpKey).
            //
            // Remarks:
            //     These keys match a definition in the Lite application (part of the server
            //     SDK).  If your game is built as extension of Lite, don't re-use these codes
            //     for your custom events.  These keys are defined per application, so Lite
            //     has different keys than MMO or your custom application. This is why these
            //     are not an enumeration.  Lite and Lite Lobby will use the keys 255 and lower,
            //     to give you room for your own codes.  Keys for operation-parameters could
            //     be assigned on a per operation basis, but it makes sense to have fixed keys
            //     for values which are used throughout the whole application.
            Constants.LiteOpKey = {
                ActorList: // Summary:
                //     (252) Code for list of players in a room. Currently not used.
                252,
                ActorNr: //
                // Summary:
                //     (254) Code of the Actor of an operation. Used for property get and set.
                254,
                ActorProperties: //
                // Summary:
                //     (249) Code for property set (Hashtable).
                249,
                Add: //
                // Summary:
                //     (238) The "Add" operation-parameter can be used to add something to some
                //     list or set. E.g. add groups to player's interest groups.
                238,
                Broadcast: //
                // Summary:
                //     (250) Code for broadcast parameter of OpSetProperties method.
                250,
                Cache: //
                // Summary:
                //     (247) Code for caching events while raising them.
                247,
                Code: //
                // Summary:
                //     (244) Code used when sending some code-related parameter, like OpRaiseEvent's
                //     event-code.
                //
                // Remarks:
                //     This is not the same as the Operation's code, which is no longer sent as
                //     part of the parameter Dictionary in Photon 3.
                244,
                Data: //
                // Summary:
                //     (245) Code of data of an event. Used in OpRaiseEvent.
                245,
                GameId: //
                // Summary:
                //     (255) Code of the game id (a unique room name). Used in OpJoin.
                255,
                GameProperties: //
                // Summary:
                //     (248) Code for property set (Hashtable).
                248,
                Group: //
                // Summary:
                //     (240) Code for "group" operation-parameter (as used in Op RaiseEvent).
                240,
                Properties: //
                // Summary:
                //     (251) Code for property set (Hashtable). This key is used when sending only
                //     one set of properties.  If either ActorProperties or GameProperties are used
                //     (or both), check those keys.
                251,
                ReceiverGroup: //
                // Summary:
                //     (246) Code to select the receivers of events (used in Lite, Operation RaiseEvent).
                246,
                Remove: //
                // Summary:
                //     (239) The "Remove" operation-parameter can be used to remove something from
                //     a list. E.g. remove groups from player's interest groups.
                239,
                TargetActorNr: //
                // Summary:
                //     (253) Code of the target Actor of an operation. Used for property set. Is
                //     0 for game
                253
            };
            // Summary:
            //     Lite - Event codes.  These codes are defined by the Lite application's logic
            //     on the server side.  Other application's won't necessarily use these.
            //
            // Remarks:
            //     If your game is built as extension of Lite, don't re-use these codes for
            //     your custom events.
            Constants.LiteEventCode = {
                Join: // Summary:
                //     (255) Event Join: someone joined the game
                255,
                Leave: //
                // Summary:
                //     (254) Event Leave: someone left the game
                254,
                PropertiesChanged: //
                // Summary:
                //     (253) Event PropertiesChanged
                253
            };
            // Summary:
            //     Lite - Operation Codes.  This enumeration contains the codes that are given
            //     to the Lite Application's operations. Instead of sending "Join", this enables
            //     us to send the byte 255.
            //
            // Remarks:
            //     Other applications (the MMO demo or your own) could define other operations
            //     and other codes.  If your game is built as extension of Lite, don't re-use
            //     these codes for your custom events.
            Constants.LiteOpCode = {
                ChangeGroups: // Summary:
                //     (248) Operation code to change interest groups in Rooms (Lite application
                //     and extending ones).
                248,
                GetProperties: //
                // Summary:
                //     (251) Operation code for OpGetProperties.
                251,
                Join: //
                // Summary:
                //     (255) Code for OpJoin, to get into a room.
                255,
                Leave: //
                // Summary:
                //     (254) Code for OpLeave, to get out of a room.
                254,
                RaiseEvent: //
                // Summary:
                //     (253) Code for OpRaiseEvent (not same as eventCode).
                253,
                SetProperties: //
                // Summary:
                //     (252) Code for OpSetProperties.
                252
            };
        })(Lite.Constants || (Lite.Constants = {}));
        var Constants = Lite.Constants;
    })(Photon.Lite || (Photon.Lite = {}));
    var Lite = Photon.Lite;
})(Photon || (Photon = {}));
var __extends = this.__extends || function (d, b) {
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Photon;
(function (Photon) {
    /// <reference path="photon.ts"/>
    /// <reference path="photon-lite-constants.ts"/>
    /**
    Photon Lite API
    @namespace Photon.Lite
    */
    (function (Lite) {
        var LitePeer = (function (_super) {
            __extends(LitePeer, _super);
            /**
            @classdesc Extends PhotonPeer and implements the operations offered by the "Lite" Application of the Photon Server SDK.
            @constructor Photon.Lite.LitePeer
            @param {string} url Server address:port.
            @param {string} [subprotocol=""] WebSocket protocol.
            */
            function LitePeer(url, subprotocol) {
                if (typeof subprotocol === "undefined") { subprotocol = ""; }
                        _super.call(this, url, subprotocol);
                this.isJoined = false;
                this.roomName = "";
                this.room = {
                    properties: {
                    }
                };
                this.actors = {
                };
                this._myActor = {
                    photonId: null,
                    properties: {
                    }
                };
            }
            LitePeer.prototype.myActor = /**
            @summary Returns local actor data.
            @method Photon.Lite.LitePeer#myActor
            @returns {object} Local actor in form { photonId: number, properties: object }
            */
            function () {
                return this._myActor;
            };
            LitePeer.prototype.join = /**
            @summary Joins an existing room by name or create one if the name is not in use yet.
            @method Photon.Lite.LitePeer#join
            @param {string} roomName Any identifying name for a room
            @param {object} [roomProperties] Set of room properties, by convention: only used if room is new/created.
            @param {object} [actorProperties] Set of actor properties.
            @param {object} [broadcast] Broadcast actor proprties in join-event.
            */
            function (roomName, roomProperties, actorProperties, broadcast) {
                if(roomName !== undefined && this.isConnected() && !this.isJoined) {
                    this._logger.info("PhotonPeer.Lite[join] - Joining roomName:", roomName);
                    this._logger.debug("PhotonPeer.Lite[join] - actorProperties:", actorProperties, ", roomProperties:", roomProperties, ", broadcast:", broadcast);
                    var sndArr = [];
                    sndArr.push(Lite.Constants.LiteOpKey.GameId);
                    sndArr.push(roomName + "");
                    if(typeof roomProperties === "object") {
                        sndArr.push(Lite.Constants.LiteOpKey.GameProperties);
                        sndArr.push(roomProperties);
                    }
                    if(typeof actorProperties === "object") {
                        sndArr.push(Lite.Constants.LiteOpKey.ActorProperties);
                        sndArr.push(actorProperties);
                    }
                    sndArr.push(Lite.Constants.LiteOpKey.Broadcast)//TODO: broadcast defaults to false. could be skipped in that case (similar to actorProperties)
                    ;
                    sndArr.push(broadcast || false);
                    this.sendOperation(Lite.Constants.LiteOpCode.Join, sndArr);
                } else {
                    if(roomName === undefined) {
                        throw new Error("PhotonPeer.Lite[join] - Trying to join with undefined roomName!");
                    } else {
                        if(this.isJoined) {
                            throw new Error("PhotonPeer.Lite[join] - you have already joined!");
                        } else {
                            throw new Error("PhotonPeer.Lite[join] - Not connected!");
                        }
                    }
                }
            };
            LitePeer.prototype.leave = /**
            @summary Leaves a room, but keeps the connection.
            @method Photon.Lite.LitePeer#leave
            */
            function () {
                if(this.isJoined) {
                    this._logger.debug("PhotonPeer.Lite[leave] - Leaving ...");
                    this.sendOperation(Lite.Constants.LiteOpCode.Leave);
                } else {
                    throw new Error("PhotonPeer.Lite[leave] - Not joined!");
                }
            };
            LitePeer.prototype.raiseEvent = /**
            @summary Sends your custom data as event to a actors in the current Room.
            @method Photon.Lite.LitePeer#raiseEvent
            @param {number} eventCode The code of custom event.
            @param {object} data Event content
            */
            function (eventCode, data) {
                if(this.isJoined) {
                    if(data !== undefined) {
                        this._logger.debug('PhotonPeer.Lite[raiseEvent] - Event', eventCode, ":", data);
                        this.sendOperation(Lite.Constants.LiteOpCode.RaiseEvent, [
                            Lite.Constants.LiteOpKey.Code, 
                            eventCode, 
                            Lite.Constants.LiteOpKey.Data, 
                            data
                        ]);
                    } else {
                        throw new Error(this._logger.format('PhotonPeer.Lite[raiseEvent] - Event', eventCode, '- data not passed in as object!'));//bug? eventName
                        
                    }
                } else {
                    throw new Error("PhotonPeer.Lite[raiseEvent] - Not joined!");
                }
            };
            LitePeer.prototype.setActorProperties = /**
            @summary Sets or updates properties of specified actor.
            @method Photon.Lite.LitePeer#setActorProperties
            @param {number} actorNr Id of actor.
            @param {object} data Actor properties to set or update.
            @param {bool} broadcast Triggers an LiteEventCode.PropertiesChanged event if true.
            */
            function (actorNr, data, broadcast) {
                if(this.isJoined) {
                    this._logger.debug("PhotonPeer.Lite[setActorProperties] - actorNumber:" + actorNr + ", broadcast:" + broadcast + ", data:", data);
                    this.sendOperation(Lite.Constants.LiteOpCode.SetProperties, [
                        Lite.Constants.LiteOpKey.Broadcast, 
                        broadcast, 
                        Lite.Constants.LiteOpKey.Properties, 
                        data, 
                        Lite.Constants.LiteOpKey.ActorNr, 
                        actorNr
                    ]);
                } else {
                    throw new Error("PhotonPeer.Lite[setActorProperties] - Not joined!");
                }
            };
            LitePeer.prototype.getActorProperties = /**
            @summary Requests selected properties of specified actors.
            @method Photon.Lite.LitePeer#getActorProperties
            @param {object} [propertyKeys] Property keys to fetch. All properties will return if not specified.
            @param {number[]} [actorNrs] List of actornumbers to get the properties of. Properties of all actors will return if not specified.
            */
            function (propertyKeys, actorNrs) {
                if(this.isJoined) {
                    var sndArr = [];
                    sndArr.push(Lite.Constants.LiteOpKey.ActorProperties);
                    if(propertyKeys !== undefined) {
                        if(Exitgames.Common.Util.isArray(propertyKeys)) {
                            if(propertyKeys.length > 0) {
                                sndArr.push(propertyKeys);
                            }
                        }
                    }
                    if(sndArr.length !== 2) {
                        //TODO: make it an else block. this will break of order in array gets changed!
                        sndArr.push(null);
                    }
                    sndArr.push(Lite.Constants.LiteOpKey.ActorList);
                    if(actorNrs !== undefined) {
                        if(Exitgames.Common.Util.isArray(actorNrs)) {
                            if(actorNrs.length > 0) {
                                sndArr.push(actorNrs);
                            }
                        }
                    }
                    if(sndArr.length !== 4) {
                        //TODO: make it an else block. this will break of order in array gets changed!
                        sndArr.push(null);
                    }
                    sndArr.push(Lite.Constants.LiteOpKey.Properties);
                    sndArr.push(2)//TODO: what is this 2? should not be hard coded
                    ;
                    this._logger.debug("PhotonPeer.Lite[getActorProperties] -", sndArr);
                    this.sendOperation(Lite.Constants.LiteOpCode.GetProperties, sndArr);
                } else {
                    throw new Error("PhotonPeer.Lite[getProperties] - Not joined!");
                }
            };
            LitePeer.prototype.setRoomProperties = /**
            @summary Sets or updates properties of joined room.
            @method Photon.Lite.LitePeer#setRoomProperties
            @param {object} data Room properties to set or update.
            @param {bool} broadcast Triggers an LiteEventCode.PropertiesChanged event if true.
            */
            function (data, broadcast) {
                if(this.isJoined) {
                    this._logger.debug("PhotonPeer.Lite[setRoomProperties] - broadcast:" + broadcast + ", data:", data)//bug? actorNumber: " + actorNumber + ",
                    ;
                    this.sendOperation(Lite.Constants.LiteOpCode.SetProperties, [
                        Lite.Constants.LiteOpKey.Broadcast, 
                        broadcast, 
                        Lite.Constants.LiteOpKey.Properties, 
                        data
                    ]);
                } else {
                    throw new Error("PhotonPeer.Lite[setRoomProperties] - Not joined!");
                }
            };
            LitePeer.prototype.getRoomProperties = /**
            @summary Requests selected properties of joined room.
            @method Photon.Lite.LitePeer#getRoomProperties
            @param {object} [propertyKeys] Property keys to fetch. All properties will return if not specified.
            */
            function (propertyKeys) {
                if(this.isJoined) {
                    var sndArr = [];
                    sndArr.push(Lite.Constants.LiteOpKey.GameProperties);
                    if(propertyKeys !== undefined) {
                        if(Exitgames.Common.Util.isArray(propertyKeys)) {
                            if(propertyKeys.length > 0) {
                                sndArr.push(propertyKeys);
                            }
                        }
                    } else {
                        sndArr.push(null);
                    }
                    this._logger.debug("PhotonPeer.Lite[getRoomProperties] -", sndArr);
                    this.sendOperation(Lite.Constants.LiteOpCode.GetProperties, sndArr);
                } else {
                    throw new Error("PhotonPeer.Lite[getRoomProperties] - Not joined!");
                }
            };
            LitePeer.prototype._addActor = function (actorNr) {
                this.actors[actorNr] = {
                    photonId: actorNr
                };
                this._logger.debug("PhotonPeer.Lite[_addActor] - Added actorNr", actorNr, "actors known are now ", this.actors);
                return this.actors[actorNr];
            };
            LitePeer.prototype._removeActor = function (actorNr) {
                delete this.actors[actorNr];
                this._logger.debug("PhotonPeer.Lite[_removeActor] - Removed actorNr", actorNr, ", actors known are now", this.actors);
                return this;
            };
            LitePeer.prototype.actorNrFromVals = //addEventListener("disconnect", function() {
            //    this.isJoined = false;
            //});
            function (vals) {
                var actorNrVal = vals[Photon.Lite.Constants.LiteOpKey.ActorNr];
                return actorNrVal !== undefined ? parseInt(actorNrVal) : -1;//TODO?: typeof this.myActor.photonId !== "undefined" ? this.myActor.photonId : -1;
                
            };
            LitePeer.prototype._parseEvent = function (code, event) {
                var actorNr = this.actorNrFromVals(event.vals);
                switch(code) {
                    case Lite.Constants.LiteEventCode.Join:
                        this._onEventJoin(event, actorNr);
                        break;
                    case Lite.Constants.LiteEventCode.Leave:
                        this._onEventLeave(actorNr);
                        break;
                    case Lite.Constants.LiteEventCode.PropertiesChanged:
                        //TODO: bug?
                        this._onEventSetProperties(event, actorNr);
                        break;
                    default:
                        this._logger.info('PhotonPeer.Lite[_parseEvent] - Unknown event code', code, 'with JSON:', event);
                        this._dispatchEvent(code, {
                            vals: event.vals,
                            actorNr: actorNr
                        });
                        break;
                }
            };
            LitePeer.prototype._onEventJoin = function (event, actorNr) {
                if(actorNr !== this._myActor.photonId) {
                    this._logger.debug("PhotonPeer.Lite[_onEventJoin] - ActorNr", actorNr, "joined.");
                    this._addActor(actorNr);
                    this._dispatchEvent(Lite.Constants.LiteEventCode.Join, {
                        newActors: [
                            actorNr
                        ]
                    });
                } else {
                    var eventActors = event.vals[Lite.Constants.LiteOpKey.ActorList], joinedActors = [];
                    for(var i in eventActors) {
                        var actorNr = parseInt(eventActors[i]);
                        if(actorNr !== this._myActor.photonId && this.actors[actorNr] === undefined) {
                            this._logger.debug("PhotonPeer.Lite[_onEventJoin] - ActorNr", actorNr, "registered as already joined");
                            this._addActor(actorNr);
                            joinedActors.push(actorNr);
                        }
                    }
                    this._dispatchEvent(Lite.Constants.LiteEventCode.Join, {
                        newActors: joinedActors
                    });
                }
            };
            LitePeer.prototype._onEventLeave = function (actorNr) {
                this._logger.debug("PhotonPeer.Lite[_onEventLeave] - ActorNr", actorNr, "left");
                this._removeActor(actorNr);
                this._dispatchEvent(Lite.Constants.LiteEventCode.Leave, {
                    actorNr: actorNr
                });
            };
            LitePeer.prototype._onEventSetProperties = function (event, actorNr) {
                // TODO: who can listen this?
                //this._dispatchEvent("setProperties", { vals: event.vals, actorNr: actorNr })
                            };
            LitePeer.prototype._parseResponse = function (code, response) {
                var actorNr = this.actorNrFromVals(response.vals);
                switch(code) {
                    case Lite.Constants.LiteOpCode.Join:
                        this._onResponseJoin(actorNr);
                        break;
                    case Lite.Constants.LiteOpCode.Leave:
                        this._onResponseLeave(actorNr);
                        break;
                    case Lite.Constants.LiteOpCode.RaiseEvent:
                        break;
                    case Lite.Constants.LiteOpCode.GetProperties:
                        this._onResponseGetProperties(response);
                        break;
                    case Lite.Constants.LiteOpCode.SetProperties:
                        this._onResponseSetProperties(response, actorNr);
                        break;
                    default:
                        this._logger.debug('PhotonPeer.Lite[_parseResponse] - Unknown response code', code, response, "actorNr", actorNr);
                        this._dispatchResponse(code, {
                            errCode: response.err,
                            errMsg: response.msg,
                            vals: response.vals,
                            actorNr: actorNr
                        });
                        break;
                }
            };
            LitePeer.prototype._onResponseGetProperties = function (response) {
                this._logger.debug("PhotonPeer.Lite[_onResponseGetProperties] - getProperties response:", response);
                if(response.vals[Lite.Constants.LiteOpKey.ActorProperties] !== undefined) {
                    var actorProperties = response.vals[Lite.Constants.LiteOpKey.ActorProperties];
                    for(var actorNr in actorProperties) {
                        this.actors[actorNr].properties = actorProperties[actorNr];
                    }
                }
                if(response.vals[Lite.Constants.LiteOpKey.GameProperties] !== undefined) {
                    var roomProperties = response.vals[Lite.Constants.LiteOpKey.GameProperties];
                    this.room.properties = roomProperties;
                }
                this._dispatchResponse(Lite.Constants.LiteOpCode.GetProperties, {
                    vals: response.vals
                });
            };
            LitePeer.prototype._onResponseJoin = function (actorNr) {
                this.isJoined = true;
                if(typeof this._myActor === "object") {
                    this._myActor = this._addActor(actorNr);
                    this._logger.debug("PhotonPeer.Lite[_onResponseJoin] - You joined as actor number / myActor.photonId has been set to:", this._myActor.photonId);
                }
                this._dispatchResponse(Lite.Constants.LiteOpCode.Join, {
                    actorNr: actorNr
                });
            };
            LitePeer.prototype._onResponseLeave = function (actorNr) {
                this.isJoined = false;
                this._removeActor(this._myActor.photonId);
                this._logger.debug('PhotonPeer.Lite[_onResponseLeave] - You left the room', this.roomName);
                this.roomName = "";
                this.room = {
                    properties: {
                    }
                };
                this._dispatchResponse(Lite.Constants.LiteOpCode.Leave, {
                    actorNr: actorNr
                });
            };
            LitePeer.prototype._onResponseSetProperties = function (response, actorNr) {
                this._logger.debug("PhotonPeer.Lite[_onResponseSetProperties] - setProperties response:", response, "actorNr", actorNr);
                this._dispatchResponse(Lite.Constants.LiteOpCode.SetProperties, {
                    vals: response.vals,
                    actorNr: actorNr
                });
            };
            return LitePeer;
        })(Photon.PhotonPeer);
        Lite.LitePeer = LitePeer;        
    })(Photon.Lite || (Photon.Lite = {}));
    var Lite = Photon.Lite;
})(Photon || (Photon = {}));
var Photon;
(function (Photon) {
    (function (LoadBalancing) {
        /// <reference path="photon-lite-constants.ts"/>
        /**
        Photon Load Balancing API Constants
        @namespace Photon.LoadBalancing.Constants
        */
        (function (Constants) {
            Constants.LiteOpKey = Photon.Lite.Constants.LiteOpKey;
            Constants.LiteOpCode = Photon.Lite.Constants.LiteOpCode;
            Constants.LiteEventCode = Photon.Lite.Constants.LiteEventCode;
            /**
            @summary Master and game servers error codes.
            @member Photon.LoadBalancing.Constants.ErrorCode
            @readonly
            @property {number} Ok No Error.
            @property {number} OperationNotAllowedInCurrentState Operation can't be executed yet.
            @property {number} InvalidOperationCode The operation you called is not implemented on the server (application) you connect to. Make sure you run the fitting applications.
            @property {number} InternalServerError Something went wrong in the server. Try to reproduce and contact Exit Games.
            @property {number} InvalidAuthentication Authentication failed. Possible cause: AppId is unknown to Photon (in cloud service).
            @property {number} GameIdAlreadyExists GameId (name) already in use (can't create another). Change name.
            @property {number} GameFull Game is full. This can when players took over while you joined the game.
            @property {number} GameClosed Game is closed and can't be joined. Join another game.
            @property {number} NoRandomMatchFound Random matchmaking only succeeds if a room exists thats neither closed nor full. Repeat in a few seconds or create a new room.
            @property {number} GameDoesNotExist Join can fail if the room (name) is not existing (anymore). This can happen when players leave while you join.
            @property {number} MaxCcuReached Authorization on the Photon Cloud failed becaus the concurrent users (CCU) limit of the app's subscription is reached.
            @property {number} InvalidRegion Authorization on the Photon Cloud failed because the app's subscription does not allow to use a particular region's server.
            */
            Constants.ErrorCode = {
                Ok: 0,
                OperationNotAllowedInCurrentState: // server - Photon low(er) level: <: 0
                /// <summary>
                /// (-3) Operation can't be executed yet (e.g. OpJoin can't be called before being authenticated, RaiseEvent cant be used before getting into a room).
                /// </summary>
                /// <remarks>
                /// Before you call any operations on the Cloud servers, the automated client workflow must complete its authorization.
                /// In PUN, wait until State is: JoinedLobby (with AutoJoinLobby : true) or ConnectedToMaster (AutoJoinLobby : false)
                /// </remarks>
                -3,
                InvalidOperationCode: /// <summary>(-2) The operation you called is not implemented on the server (application) you connect to. Make sure you run the fitting applications.</summary>
                -2,
                InternalServerError: /// <summary>(-1) Something went wrong in the server. Try to reproduce and contact Exit Games.</summary>
                -1,
                InvalidAuthentication: // server - PhotonNetwork: 0x7FFF and down
                // logic-level error codes start with short.max
                /// <summary>(32767) Authentication failed. Possible cause: AppId is unknown to Photon (in cloud service).</summary>
                0x7FFF,
                GameIdAlreadyExists: /// <summary>(32766) GameId (name) already in use (can't create another). Change name.</summary>
                0x7FFF - 1,
                GameFull: /// <summary>(32765) Game is full. This can when players took over while you joined the game.</summary>
                0x7FFF - 2,
                GameClosed: /// <summary>(32764) Game is closed and can't be joined. Join another game.</summary>
                0x7FFF - 3,
                NoRandomMatchFound: // AlreadyMatched: 0x7FFF - 4,
                /// <summary>(32762) Not in use currently.</summary>
                // ServerFull: 0x7FFF - 5,
                /// <summary>(32761) Not in use currently.</summary>
                // UserBlocked: 0x7FFF - 6,
                /// <summary>(32760) Random matchmaking only succeeds if a room exists thats neither closed nor full. Repeat in a few seconds or create a new room.</summary>
                0x7FFF - 7,
                GameDoesNotExist: /// <summary>(32758) Join can fail if the room (name) is not existing (anymore). This can happen when players leave while you join.</summary>
                0x7FFF - 9,
                MaxCcuReached: /// <summary>(32757) Authorization on the Photon Cloud failed becaus the concurrent users (CCU) limit of the app's subscription is reached.</summary>
                /// <remarks>
                /// Unless you have a plan with "CCU Burst", clients might fail the authentication step during connect.
                /// Affected client are unable to call operations. Please note that players who end a game and return
                /// to the master server will disconnect and re-connect, which means that they just played and are rejected
                /// in the next minute / re-connect.
                /// This is a temporary measure. Once the CCU is below the limit, players will be able to connect an play again.
                ///
                /// OpAuthorize is part of connection workflow but only on the Photon Cloud, this error can happen.
                /// Self-hosted Photon servers with a CCU limited license won't let a client connect at all.
                /// </remarks>
                0x7FFF - 10,
                InvalidRegion: /// <summary>(32756) Authorization on the Photon Cloud failed because the app's subscription does not allow to use a particular region's server.</summary>
                /// <remarks>
                /// Some subscription plans for the Photon Cloud are region-bound. Servers of other regions can't be used then.
                /// Check your master server address and compare it with your Photon Cloud Dashboard's info.
                /// https://cloud.exitgames.com/dashboard
                ///
                /// OpAuthorize is part of connection workflow but only on the Photon Cloud, this error can happen.
                /// Self-hosted Photon servers with a CCU limited license won't let a client connect at all.
                /// </remarks>
                0x7FFF - 11
            };
            /// <summary>
            /// These  values define "well known" properties for an Actor / Player.
            /// </summary>
            /// <remarks>
            /// "Custom properties" have to use a string-type as key. They can be assigned at will.
            /// </remarks>
            Constants.ActorProperties = {
                PlayerName: /// <summary>(255) Name of a player/actor.</summary>
                255
            };
            // was: 1
            /** End user doesn't need this */
            /// <summary>
            /// These  values are for "well known" room/game properties used in Photon Loadbalancing.
            /// </summary>
            /// <remarks>
            /// "Custom properties" have to use a string-type as key. They can be assigned at will.
            /// </remarks>
            Constants.GameProperties = {
                MaxPlayers: /// <summary>(255) Max number of players that "fit" into this room. 0 is for "unlimited".</summary>
                255,
                IsVisible: /// <summary>(254) Makes this room listed or not in the lobby on master.</summary>
                254,
                IsOpen: /// <summary>(253) Allows more players to join a room (or not).</summary>
                253,
                PlayerCount: /// <summary>(252) Current count od players in the room. Used only in the lobby on master.</summary>
                252,
                Removed: /// <summary>(251) True if the room is to be removed from room listing (used in update to room list in lobby on master)</summary>
                251,
                PropsListedInLobby: /// <summary>(250) A list of the room properties to pass to the RoomInfo list in a lobby. This is used in CreateRoom, which defines this list once per room.</summary>
                250,
                CleanupCacheOnLeave: /// <summary>Equivalent of Operation Join parameter CleanupCacheOnLeave.</summary>
                249
            };
            /** End user doesn't need this */
            /// <summary>
            /// These values are for events defined by Photon Loadbalancing.
            /// </summary>
            /// <remarks>They start at 255 and go DOWN. Your own in-game events can start at 0.</remarks>
            Constants.EventCode = {
                GameList: /// <summary>(230) Initial list of RoomInfos (in lobby on Master)</summary>
                230,
                GameListUpdate: /// <summary>(229) Update of RoomInfos to be merged into "initial" list (in lobby on Master)</summary>
                229,
                QueueState: /// <summary>(228) Currently not used. State of queueing in case of server-full</summary>
                228,
                AppStats: /// <summary>(227) Currently not used. Event for matchmaking</summary>
                // Match: 227,
                /// <summary>(226) Event with stats about this application (players, rooms, etc)</summary>
                226,
                AzureNodeInfo: /// <summary>(210) Internally used in case of hosting by Azure</summary>
                210,
                Join: /// <summary>(255) Event Join: someone joined the game. The new actorNumber is provided as well as the properties of that actor (if set in OpJoin).</summary>
                Constants.LiteEventCode.Join,
                Leave: /// <summary>(254) Event Leave: The player who left the game can be identified by the actorNumber.</summary>
                Constants.LiteEventCode.Leave,
                PropertiesChanged: /// <summary>(253) When you call OpSetProperties with the broadcast option "on", this event is fired. It contains the properties being set.</summary>
                Constants.LiteEventCode.PropertiesChanged
            };
            /** End user doesn't need this */
            /// <summary>Codes for parameters of Operations and Events.</summary>
            Constants.ParameterCode = {
                Address: /// <summary>(230) Address of a (game) server to use.</summary>
                230,
                PeerCount: /// <summary>(229) Count of players in this application in a rooms (used in stats event)</summary>
                229,
                GameCount: /// <summary>(228) Count of games in this application (used in stats event)</summary>
                228,
                MasterPeerCount: /// <summary>(227) Count of players on the master server (in this app, looking for rooms)</summary>
                227,
                UserId: /// <summary>(225) User's ID</summary>
                225,
                ApplicationId: /// <summary>(224) Your application's ID: a name on your own Photon or a GUID on the Photon Cloud</summary>
                224,
                Position: /// <summary>(223) Not used currently (as "Position"). If you get queued before connect, this is your position</summary>
                223,
                MatchMakingType: /// <summary>(223) Modifies the matchmaking algorithm used for OpJoinRandom. Allowed parameter values are defined in enum MatchmakingMode.</summary>
                223,
                GameList: /// <summary>(222) List of RoomInfos about open / listed rooms</summary>
                222,
                Secret: /// <summary>(221) Internally used to establish encryption</summary>
                221,
                AppVersion: /// <summary>(220) Version of your application</summary>
                220,
                AzureNodeInfo: /// <summary>(210) Internally used in case of hosting by Azure</summary>
                210,
                AzureLocalNodeId: // only used within events, so use: EventCode.AzureNodeInfo
                /// <summary>(209) Internally used in case of hosting by Azure</summary>
                209,
                AzureMasterNodeId: /// <summary>(208) Internally used in case of hosting by Azure</summary>
                208,
                RoomName: /// <summary>(255) Code for the gameId/roomName (a unique name per room). Used in OpJoin and similar.</summary>
                Constants.LiteOpKey.GameId,
                Broadcast: /// <summary>(250) Code for broadcast parameter of OpSetProperties method.</summary>
                Constants.LiteOpKey.Broadcast,
                ActorList: /// <summary>(252) Code for list of players in a room. Currently not used.</summary>
                Constants.LiteOpKey.ActorList,
                ActorNr: /// <summary>(254) Code of the Actor of an operation. Used for property get and set.</summary>
                Constants.LiteOpKey.ActorNr,
                PlayerProperties: /// <summary>(249) Code for property set (Hashtable).</summary>
                Constants.LiteOpKey.ActorProperties,
                CustomEventContent: /// <summary>(245) Code of data/custom content of an event. Used in OpRaiseEvent.</summary>
                Constants.LiteOpKey.Data,
                Data: /// <summary>(245) Code of data of an event. Used in OpRaiseEvent.</summary>
                Constants.LiteOpKey.Data,
                Code: /// <summary>(244) Code used when sending some code-related parameter, like OpRaiseEvent's event-code.</summary>
                /// <remarks>This is not the same as the Operation's code, which is no longer sent as part of the parameter Dictionary in Photon 3.</remarks>
                Constants.LiteOpKey.Code,
                GameProperties: /// <summary>(248) Code for property set (Hashtable).</summary>
                Constants.LiteOpKey.GameProperties,
                Properties: /// <summary>
                /// (251) Code for property-set (Hashtable). This key is used when sending only one set of properties.
                /// If either ActorProperties or GameProperties are used (or both), check those keys.
                /// </summary>
                Constants.LiteOpKey.Properties,
                TargetActorNr: /// <summary>(253) Code of the target Actor of an operation. Used for property set. Is 0 for game</summary>
                Constants.LiteOpKey.TargetActorNr,
                ReceiverGroup: /// <summary>(246) Code to select the receivers of events (used in Lite, Operation RaiseEvent).</summary>
                Constants.LiteOpKey.ReceiverGroup,
                Cache: /// <summary>(247) Code for caching events while raising them.</summary>
                Constants.LiteOpKey.Cache,
                CleanupCacheOnLeave: /// <summary>(241) Bool parameter of CreateGame Operation. If true, server cleans up roomcache of leaving players (their cached events get removed).</summary>
                241,
                Group: /// <summary>(240) Code for "group" operation-parameter (as used in Op RaiseEvent).</summary>
                Constants.LiteOpKey.Group,
                Remove: /// <summary>(239) The "Remove" operation-parameter can be used to remove something from a list. E.g. remove groups from player's interest groups.</summary>
                Constants.LiteOpKey.Remove,
                Add: /// <summary>(238) The "Add" operation-parameter can be used to add something to some list or set. E.g. add groups to player's interest groups.</summary>
                Constants.LiteOpKey.Add,
                ClientAuthenticationType: /// <summary>(217) This key's (byte) value defines the target custom authentication type/service the client connects with. Used in OpAuthenticate</summary>
                217,
                ClientAuthenticationParams: /// <summary>(216) This key's (string) value provides parameters sent to the custom authentication type/service the client connects with. Used in OpAuthenticate</summary>
                216
            };
            /**
            @summary Codes for parameters and events used in Photon Load Balancing API.
            @member Photon.LoadBalancing.Constants.OperationCode
            @readonly
            @property {number} Authenticate Authenticates this peer and connects to a virtual application.
            @property {number} JoinLobby Joins lobby (on master).
            @property {number} LeaveLobby Leaves lobby (on master).
            @property {number} CreateGame Creates a game (or fails if name exists).
            @property {number} JoinGame Joins room (by name).
            @property {number} JoinRandomGame Joins random room (on master).
            @property {number} Leave Leaves the room.
            @property {number} RaiseEvent Raises event (in a room, for other actors/players).
            @property {number} SetProperties Sets Properties (of room or actor/player).
            @property {number} GetProperties Gets Properties.
            @property {number} ChangeGroups Changes interest groups in room.
            */
            Constants.OperationCode = {
                Authenticate: /// <summary>(230) Authenticates this peer and connects to a virtual application</summary>
                230,
                JoinLobby: /// <summary>(229) Joins lobby (on master)</summary>
                229,
                LeaveLobby: /// <summary>(228) Leaves lobby (on master)</summary>
                228,
                CreateGame: /// <summary>(227) Creates a game (or fails if name exists)</summary>
                227,
                JoinGame: /// <summary>(226) Join game (by name)</summary>
                226,
                JoinRandomGame: /// <summary>(225) Joins random game (on master)</summary>
                225,
                Leave: // CancelJoinRandom : 224, // obsolete, cause JoinRandom no longer is a "process". now provides result immediately
                /// <summary>(254) Code for OpLeave, to get out of a room.</summary>
                Constants.LiteOpCode.Leave,
                RaiseEvent: /// <summary>(253) Raise event (in a room, for other actors/players)</summary>
                Constants.LiteOpCode.RaiseEvent,
                SetProperties: /// <summary>(252) Set Properties (of room or actor/player)</summary>
                Constants.LiteOpCode.SetProperties,
                GetProperties: /// <summary>(251) Get Properties</summary>
                Constants.LiteOpCode.GetProperties,
                ChangeGroups: /// <summary>(248) Operation code to change interest groups in Rooms (Lite application and extending ones).</summary>
                Constants.LiteOpCode.ChangeGroups
            };
            /**
            @summary Options for matchmaking rules for joinRandomGame.
            @member Photon.LoadBalancing.Constants.MatchmakingMode
            @readonly
            @property {number} FillRoom Default. FillRoom Fills up rooms (oldest first) to get players together as fast as possible. Makes most sense with MaxPlayers > 0 and games that can only start with more players.
            @property {number} SerialMatching Distributes players across available rooms sequentially but takes filter into account. Without filter, rooms get players evenly distributed.
            @property {number} RandomMatching Joins a (fully) random room. Expected properties must match but aside from this, any available room might be selected.
            */
            Constants.MatchmakingMode = {
                FillRoom: /// <summary>Fills up rooms (oldest first) to get players together as fast as possible. Default.</summary>
                /// <remarks>Makes most sense with MaxPlayers > 0 and games that can only start with more players.</remarks>
                0,
                SerialMatching: /// <summary>Distributes players across available rooms sequentially but takes filter into account. Without filter, rooms get players evenly distributed.</summary>
                1,
                RandomMatching: /// <summary>Joins a (fully) random room. Expected properties must match but aside from this, any available room might be selected.</summary>
                2
            };
            /**
            @summary Caching options for events.
            @member Photon.LoadBalancing.Constants.EventCaching
            @readonly
            @property {number} DoNotCache Default. Do not cache.
            @property {number} MergeCache Will merge this event's keys with those already cached.
            @property {number} ReplaceCache Replaces the event cache for this eventCode with this event's content.
            @property {number} RemoveCache Removes this event (by eventCode) from the cache.
            @property {number} AddToRoomCache Adds an event to the room's cache.
            @property {number} AddToRoomCacheGlobal Adds this event to the cache for actor 0 (becoming a "globally owned" event in the cache).
            @property {number} RemoveFromRoomCache Remove fitting event from the room's cache.
            @property {number} RemoveFromRoomCacheForActorsLeft Removes events of players who already left the room (cleaning up).
            */
            Constants.EventCaching = {
                DoNotCache: // Summary:
                //     Default value (not sent).
                0,
                MergeCache: //
                // Summary:
                //     Will merge this event's keys with those already cached.
                1,
                ReplaceCache: //
                // Summary:
                //     Replaces the event cache for this eventCode with this event's content.
                2,
                RemoveCache: //
                // Summary:
                //     Removes this event (by eventCode) from the cache.
                3,
                AddToRoomCache: //
                // Summary:
                //     Adds an event to the room's cache.
                4,
                AddToRoomCacheGlobal: //
                // Summary:
                //     Adds this event to the cache for actor 0 (becoming a "globally owned" event
                //     in the cache).
                5,
                RemoveFromRoomCache: //
                // Summary:
                //     Remove fitting event from the room's cache.
                6,
                RemoveFromRoomCacheForActorsLeft: //
                // Summary:
                //     Removes events of players who already left the room (cleaning up).
                7
            };
            /**
            @summary Options for choosing room's actors who should receive events.
            @member Photon.LoadBalancing.Constants.ReceiverGroup
            @readonly
            @property {number} Others Default. Anyone else gets my event.
            @property {number} All Everyone in the current room (including this peer) will get this event.
            @property {number} MasterClient The "master client" does not have special rights but is the one who is in this room the longest time.
            */
            Constants.ReceiverGroup = {
                Others: // Summary:
                //     Default value (not sent). Anyone else gets my event.
                0,
                All: //
                // Summary:
                //     Everyone in the current room (including this peer) will get this event.
                1,
                MasterClient: //
                // Summary:
                //     The server sends this event only to the actor with the lowest actorNumber.
                //
                // Remarks:
                //     The "master client" does not have special rights but is the one who is in
                //     this room the longest time.
                2
            };
            /**
            @summary Options for optional "Custom Authentication" services used with Photon.
            @member Photon.LoadBalancing.Constants.CustomAuthenticationType
            @readonly
            @property {number} Custom Default. Use a custom authentification service.
            @property {number} None Disables custom authentification.
            */
            Constants.CustomAuthenticationType = {
                Custom: /// <summary>Use a custom authentification service. Currently the only implemented option.</summary>
                0,
                None: /// <summary>Disables custom authentification. Same as not providing any AuthenticationValues for connect (more precisely for: OpAuthenticate).</summary>
                255
            };
        })(LoadBalancing.Constants || (LoadBalancing.Constants = {}));
        var Constants = LoadBalancing.Constants;
    })(Photon.LoadBalancing || (Photon.LoadBalancing = {}));
    var LoadBalancing = Photon.LoadBalancing;
})(Photon || (Photon = {}));
var Photon;
(function (Photon) {
    /// <reference path="photon.ts"/>
    /// <reference path="photon-loadbalancing-constants.ts"/>
    /**
    Photon Load Balancing API
    @namespace Photon.LoadBalancing
    */
    (function (LoadBalancing) {
        var Actor = (function () {
            /**
            @classdesc Summarizes a "player" within a room, identified (in that room) by ID (or "actorNr"). Extend to implement custom logic.
            @constructor Photon.LoadBalancing.Actor
            @param {string} name Actor name.
            @param {number} actorNr Actor ID.
            @param {bool} isLocal Actor is local.
            */
            function Actor(name, actorNr, isLocal) {
                this.name = name;
                this.actorNr = actorNr;
                this.isLocal = isLocal;
                this.customProperties = {
                };
            }
            Actor.prototype.getRoom = // public getLoadBalancingClient() { return this.loadBalancingClient; }
            /**
            @summary Actor's room: the room initialized by client for create room operation or room client connected to.
            @method Photon.LoadBalancing.Actor#getRoom
            @returns {Photon.LoadBalancing.Room} Actor's room.
            */
            function () {
                return this.loadBalancingClient.myRoom();
            };
            Actor.prototype.raiseEvent = /**
            @summary Raises game custom event.
            @method Photon.LoadBalancing.Actor#raiseEvent
            @param {number} eventCode Identifies this type of event (and the content). Your game's event codes can start with 0.
            @param {object} [data] Custom data you want to send along (use null, if none).
            @param {object} [options] Additional options
            @property {object} options Additional options
            @property {number} [options.interestGroup] The ID of the interest group this event goes to (exclusively).
            @property {Photon.LoadBalancing.Constants.EventCaching} [options.cache=EventCaching.DoNotCache] Events can be cached (merged and removed) for players joining later on.
            @property {Photon.LoadBalancing.Constants.ReceiverGroup} [options.receivers=ReceiverGroup.Others] Defines to which group of players the event is passed on.
            */
            function (eventCode, data, options) {
                if(this.loadBalancingClient) {
                    this.loadBalancingClient.raiseEvent(eventCode, data, options);
                }
            };
            Actor.prototype.setName = /**
            @summary Sets room name (before create room operation).
            @method Photon.LoadBalancing.Actor#setName
            @param {string} name Room name.
            */
            function (name) {
                this.name = name;
            };
            Actor.prototype.onPropertiesChange = // properties methods
            /**
            @summary Called on every actor properties update: properties set by client, poperties update from server.
            Override to update custom room state.
            @method Photon.LoadBalancing.RoomInfo#onPropertiesChange
            @param {object} changedCustomProps Key-value map of changed properties.
            */
            function (changedCustomProps) {
            };
            Actor.prototype.getCustomProperty = /**
            @summary Returns custom property by name.
            @method Photon.LoadBalancing.Actor#getCustomProperty
            @param {string} name Name of the property.
            @returns {object} Property or undefined if property not found.
            */
            function (name) {
                return this.customProperties[name];
            };
            Actor.prototype.getCustomPropertyOrElse = /**
            @summary Returns custom property by name or default value.
            @method Photon.LoadBalancing.Actor#getCustomPropertyOrElse
            @param {string} name Name of the property.
            @param {object} defaultValue Default property value.
            @returns {object} Property or default value if property not found.
            */
            function (name, defaultValue) {
                return Exitgames.Common.Util.getPropertyOrElse(this.customProperties, name, defaultValue);
            };
            Actor.prototype.setCustomProperty = /**
            @summary Sets custom property.
            @method Photon.LoadBalancing.Actor#setCustomProperty
            @param {string} name Name of the property.
            @param {object} value Property value.
            */
            function (name, value) {
                this.customProperties[name] = value;
                if(this.loadBalancingClient && this.loadBalancingClient.isJoinedToRoom()) {
                    var props = {
                    };
                    props[name] = value;
                    this.loadBalancingClient._setPropertiesOfActor(props);
                    this.onPropertiesChange(props);
                }
            };
            Actor.prototype._getAllProperties = function () {
                var p = {
                };
                p[LoadBalancing.Constants.ActorProperties.PlayerName] = this.name;
                for(var k in this.customProperties) {
                    p[k] = this.customProperties[k];
                }
                return p;
            };
            Actor.prototype._setLBC = function (lbc) {
                this.loadBalancingClient = lbc;
            };
            Actor.prototype._updateFromResponse = function (vals) {
                this.actorNr = vals[LoadBalancing.Constants.ParameterCode.ActorNr];
                var props = vals[LoadBalancing.Constants.ParameterCode.PlayerProperties];
                if(props !== undefined) {
                    var name = props[LoadBalancing.Constants.ActorProperties.PlayerName];
                    if(name !== undefined) {
                        this.name = name;
                    }
                    this._updateCustomProperties(props);
                }
            };
            Actor.prototype._updateMyActorFromResponse = function (vals) {
                this.actorNr = vals[LoadBalancing.Constants.ParameterCode.ActorNr];
            };
            Actor.prototype._updateCustomProperties = function (vals) {
                for(var p in vals) {
                    this.customProperties[p] = vals[p];
                }
                this.onPropertiesChange(vals);
            };
            Actor._getActorNrFromResponse = function _getActorNrFromResponse(vals) {
                return vals[LoadBalancing.Constants.ParameterCode.ActorNr];
            };
            return Actor;
        })();
        LoadBalancing.Actor = Actor;        
        // readonly room info from server
        var RoomInfo = (function () {
            /**
            @classdesc Used for Room listings of the lobby (not yet joining). Offers the basic info about a room: name, player counts, properties, etc.
            @constructor Photon.LoadBalancing.RoomInfo
            @param {string} name Room name.
            */
            function RoomInfo(name) {
                // standard room properties
                // TODO: access via getters
                /**
                @summary Room name.
                @member Photon.LoadBalancing.RoomInfo#name
                @type {string}
                @readonly
                */
                this.name = "";
                /**
                @summary Joined room game server address.
                @member Photon.LoadBalancing.RoomInfo#address
                @type {string}
                @readonly
                */
                this.address = "";
                /**
                @summary Max players before room is considered full.
                @member Photon.LoadBalancing.RoomInfo#maxPlayers
                @type {number}
                @readonly
                */
                this.maxPlayers = 0;
                /**
                @summary Shows the room in the lobby's room list. Makes sense only for local room.
                @member Photon.LoadBalancing.RoomInfo#isVisible
                @type {bool}
                @readonly
                */
                this.isVisible = true;
                /**
                @summary Defines if this room can be joined.
                @member Photon.LoadBalancing.RoomInfo#isOpen
                @type {bool}
                @readonly
                */
                this.isOpen = true;
                /**
                @summary Count of player currently in room.
                @member Photon.LoadBalancing.RoomInfo#playerCount
                @type {number}
                @readonly
                */
                this.playerCount = 0;
                /**
                @summary Room removed (in room list updates).
                @member Photon.LoadBalancing.RoomInfo#removed
                @type {bool}
                @readonly
                */
                this.removed = false;
                // TODO: does end user need this?
                this.cleanupCacheOnLeave = false;
                // custom properties
                this._customProperties = {
                };
                this._propsListedInLobby = [];
                this.name = name;
            }
            RoomInfo.prototype.onPropertiesChange = /**
            @summary Called on every room properties update: room creation, properties set by client, poperties update from server.
            Override to update custom room state.
            @method Photon.LoadBalancing.RoomInfo#onPropertiesChange
            @param {object} changedCustomProps Key-value map of changed properties.
            */
            function (changedCustomProps) {
            };
            RoomInfo.prototype.getCustomProperty = /**
            @summary Returns custom property by name.
            @method Photon.LoadBalancing.RoomInfo#getCustomProperty
            @param {string} name Name of the property.
            @returns {object} Property or undefined if property not found.
            */
            function (prop) {
                return this._customProperties[prop];
            };
            RoomInfo.prototype.getCustomPropertyOrElse = /**
            @summary Returns custom property by name or default value.
            @method Photon.LoadBalancing.RoomInfo#getCustomPropertyOrElse
            @param {string} name Name of the property.
            @param {object} defaultValue Default property value.
            @returns {object} Property or default value if property not found.
            */
            function (prop, defaultValue) {
                return Exitgames.Common.Util.getPropertyOrElse(this._customProperties, prop, defaultValue);
            };
            RoomInfo.prototype._updateFromMasterResponse = function (vals) {
                this.address = vals[LoadBalancing.Constants.ParameterCode.Address];
                var name = vals[LoadBalancing.Constants.ParameterCode.RoomName];
                if(name) {
                    this.name = name;
                }
            };
            RoomInfo.prototype._updateFromProps = function (props, customProps) {
                if (typeof customProps === "undefined") { customProps = null; }
                if(props) {
                    this.maxPlayers = this.updateIfExists(this.maxPlayers, LoadBalancing.Constants.GameProperties.MaxPlayers, props);
                    this.isVisible = this.updateIfExists(this.isVisible, LoadBalancing.Constants.GameProperties.IsVisible, props);
                    this.isOpen = this.updateIfExists(this.isOpen, LoadBalancing.Constants.GameProperties.IsOpen, props);
                    this.playerCount = this.updateIfExists(this.playerCount, LoadBalancing.Constants.GameProperties.PlayerCount, props);
                    this.removed = this.updateIfExists(this.removed, LoadBalancing.Constants.GameProperties.Removed, props);
                    this._propsListedInLobby = this.updateIfExists(this._propsListedInLobby, LoadBalancing.Constants.GameProperties.PropsListedInLobby, props);
                    this.cleanupCacheOnLeave = this.updateIfExists(this.cleanupCacheOnLeave, LoadBalancing.Constants.GameProperties.CleanupCacheOnLeave, props);
                    var changedProps = {
                    };
                    if(customProps === null) {
                        customProps = props;
                    }
                    for(var k in customProps) {
                        if(parseInt(k).toString() != k) {
                            // if key is not a number
                            if(this._customProperties[k] !== customProps[k]) {
                                this._customProperties[k] = customProps[k];
                                changedProps[k] = customProps[k];
                            }
                        }
                    }
                    this.onPropertiesChange(changedProps);
                }
            };
            RoomInfo.prototype.updateIfExists = function (prevValue, code, props) {
                if(props.hasOwnProperty(code)) {
                    return props[code];
                } else {
                    return prevValue;
                }
            };
            return RoomInfo;
        })();
        LoadBalancing.RoomInfo = RoomInfo;        
        // joined room with writable properties
        var Room = (function (_super) {
            __extends(Room, _super);
            /**
            @classdesc Represents a room client joins or is joined to. Extend to implement custom logic. Custom properties can be set via setCustomProperty() while being in the room.
            @mixes Photon.LoadBalancing.RoomInfo
            @constructor Photon.LoadBalancing.Room
            @param {string} name Room name.
            */
            function Room(name) {
                        _super.call(this, name);
            }
            Room.prototype.setCustomProperty = // room created from client via factory always has this field set
            //public getLoadBalancingClient() { return this.loadBalancingClient; }
            /**
            @summary Sets custom property
            @method Photon.LoadBalancing.Room#setCustomProperty
            @param {string} name Name of the property.
            @param {object} value Property value.
            */
            function (name, value) {
                this._customProperties[name] = value;
                if(this.loadBalancingClient && this.loadBalancingClient.isJoinedToRoom()) {
                    var props = {
                    };
                    props[name] = value;
                    this.loadBalancingClient._setPropertiesOfRoom(props);
                }
                var cp = {
                };
                cp[name] = value;
                this.onPropertiesChange(cp);
            };
            Room.prototype.setProp = function (name, value) {
                if(this.loadBalancingClient && this.loadBalancingClient.isJoinedToRoom()) {
                    var props = {
                    };
                    props[name] = value;
                    this.loadBalancingClient._setPropertiesOfRoom(props);
                }
            };
            Room.prototype.setIsVisible = /**
            * @summary Sets rooms visibility in the lobby's room list.
            * @method Photon.LoadBalancing.Room#setIsOpen
            * @param {bool} isVisible New visibility value.
            */
            function (isVisible) {
                if(this.isVisible != isVisible) {
                    this.isVisible = isVisible;
                    this.setProp(LoadBalancing.Constants.GameProperties.IsVisible, isVisible);
                }
            };
            Room.prototype.setIsOpen = /**
            * @summary Sets if this room can be joined.
            * @method Photon.LoadBalancing.Room#setIsOpen
            * @param {bool} isOpen New property value.
            */
            function (isOpen) {
                if(this.isOpen == !isOpen) {
                    this.isOpen = isOpen;
                    this.setProp(LoadBalancing.Constants.GameProperties.IsOpen, isOpen);
                }
            };
            Room.prototype.setMaxPlayers = /**
            * @summary Sets max players before room is considered full.
            * @method Photon.LoadBalancing.Room#setMaxPlayers
            * @param {number} maxPlayers New max players value.
            */
            function (maxPlayers) {
                if(this.maxPlayers != maxPlayers) {
                    this.maxPlayers = maxPlayers;
                    this.setProp(LoadBalancing.Constants.GameProperties.MaxPlayers, maxPlayers);
                }
            };
            Room.prototype.setPropsListedInLobby = /**
            @summary Sets list of the room properties to pass to the RoomInfo list in a lobby. Call for myRoom() before createRoomFromMy call.
            @method Photon.LoadBalancing.Room#setPropsListedInLobby
            @param {string[]} props Array of properties names.
            */
            function (props) {
                this._propsListedInLobby = props;
            };
            Room.prototype._setLBC = function (lbc) {
                this.loadBalancingClient = lbc;
            };
            return Room;
        })(RoomInfo);
        LoadBalancing.Room = Room;        
        var LoadBalancingClient = (function () {
            /**
            @classdesc Implements the Photon LoadBalancing workflow. This class should be extended to handle system or custom events and operation responses.
            @constructor Photon.LoadBalancing.LoadBalancingClient
            @param {string} masterServerAddress Master server address:port.
            @param {string} appId Cloud application ID.
            @param {string} appVersion Cloud application version.
            */
            function LoadBalancingClient(masterServerAddress, appId, appVersion) {
                this.masterServerAddress = masterServerAddress;
                this.appId = appId;
                this.appVersion = appVersion;
                this.keepMasterConnection = false;
                this.reconnectPending = false;
                this.roomInfos = new Array();
                this.actors = {
                };
                this.userAuthType = LoadBalancing.Constants.CustomAuthenticationType.None;
                this.userAuthParameters = "";
                this.userAuthSecret = "";
                this.state = LoadBalancingClient.State.Uninitialized;
                this.logger = new Exitgames.Common.Logger("LoadBalancingClient");
                this.validNextState = {
                };
                this.initValidNextState();
                this.currentRoom = this.roomFactoryInternal("");
                this._myActor = this.actorFactoryInternal("", -1, true);
                this.addActor(this._myActor);
            }
            LoadBalancingClient.prototype.onStateChange = // override to handle system events:
            /**
            @summary Called on client state change. Override to handle it.
            @method Photon.LoadBalancing.LoadBalancingClient#onStateChange
            @param {Photon.LoadBalancing.LoadBalancingClient.State} state New client state.
            */
            function (state) {
            };
            LoadBalancingClient.prototype.onError = /**
            @summary Called if client error occures. Override to handle it.
            @method Photon.LoadBalancing.LoadBalancingClient#onError
            @param {Photon.LoadBalancing.LoadBalancingClient.PeerErrorCode} errorCode Client error code.
            @param {string} errorMsg Error message.
            */
            function (errorCode, errorMsg) {
                this.logger.error("Load Balancing Client Error", errorCode, errorMsg);
            };
            LoadBalancingClient.prototype.onOperationResponse = /**
            @summary Called on operation response. Override if need custom workflow or response error handling.
            @method Photon.LoadBalancing.LoadBalancingClient#onOperationResponse
            @param {number} errorCode Server error code.
            @param {string} errorMsg Error message.
            @param {Photon.LoadBalancing.Constants.OperationCode} code Operation code.
            @param {object} content Operation response content.
            */
            function (errorCode, errorMsg, code, content) {
            };
            LoadBalancingClient.prototype.onEvent = /**
            @summary Called on custom event. Override to handle it.
            @method Photon.LoadBalancing.LoadBalancingClient#onEvent
            @param {number} code Event code.
            @param {object} content Event content.
            @param {number} actorNr Actor ID event raised by.
            */
            function (code, content, actorNr) {
            };
            LoadBalancingClient.prototype.onRoomList = /**
            @summary Called on room list received from master server (on connection). Override to handle it.
            @method Photon.LoadBalancing.LoadBalancingClient#onRoomList
            @param {Photon.LoadBalancing.RoomInfo[]} rooms Room list.
            */
            function (rooms) {
            };
            LoadBalancingClient.prototype.onRoomListUpdate = /**
            @summary Called on room list updates received from master server. Override to handle it.
            @method Photon.LoadBalancing.LoadBalancingClient#onRoomListUpdate
            @param {Photon.LoadBalancing.RoomInfo[]} rooms Updated room list.
            @param {Photon.LoadBalancing.RoomInfo[]} roomsUpdated Rooms whose properties were changed.
            @param {Photon.LoadBalancing.RoomInfo[]} roomsAdded New rooms in list.
            @param {Photon.LoadBalancing.RoomInfo[]} roomsRemoved Rooms removed from list.
            */
            function (rooms, roomsUpdated, roomsAdded, roomsRemoved) {
            };
            LoadBalancingClient.prototype.onMyRoomPropertiesChange = // TODO: move to Room? Or remove and use Room.onPropertiesChange only?
            /**
            @summary Called on joined room properties changed event. Override to handle it.
            @method Photon.LoadBalancing.LoadBalancingClient#onMyRoomPropertiesChange
            */
            function () {
            };
            LoadBalancingClient.prototype.onActorPropertiesChange = /**
            @summary Called on actor properties changed event. Override to handle it.
            @method Photon.loadbalancing.loadbalancingClient#onActorPropertiesChange
            @param {Photon.LoadBalancing.Actor} actor Actor whose properties were changed.
            */
            function (actor) {
            };
            LoadBalancingClient.prototype.onJoinRoom = /**
            @summary Called when client joins room. Override to handle it.
            @method Photon.LoadBalancing.LoadBalancingClient#onJoinRoom
            */
            function () {
            };
            LoadBalancingClient.prototype.onActorJoin = /**
            @summary Called when new actor joins the room client joined to. Override to handle it.
            @method Photon.LoadBalancing.LoadBalancingClient#onActorJoin
            @param {Photon.LoadBalancing.Actor} actor New actor.
            */
            function (actor) {
            };
            LoadBalancingClient.prototype.onActorLeave = /**
            @summary Called when actor leaves the room client joined to. Override to handle it.
            @method Photon.LoadBalancing.LoadBalancingClient#onActorLeave
            @param {Photon.LoadBalancing.Actor} actor Actor left the room.
            */
            function (actor) {
            };
            LoadBalancingClient.prototype.roomFactory = /**
            @summary Override with creation of custom room (extended from Room): { return new CustomRoom(...); }
            @method Photon.LoadBalancing.LoadBalancingClient#roomFactory
            @param {string} name Room name. Pass to super() in custom actor constructor.
            */
            function (name) {
                return new Room(name);
            };
            LoadBalancingClient.prototype.actorFactory = /**
            @summary Override with creation of custom actor (extended from Actor): { return new CustomActor(...); }
            @method Photon.LoadBalancing.LoadBalancingClient#actorFactory
            @param {string} name Actor name. Pass to super() in custom room constructor.
            @param {number} actorNr Actor ID. Pass to super() in custom room constructor.
            @param {bool} isLocal Actor is local. Pass to super() in custom room constructor.
            */
            function (name, actorNr, isLocal) {
                return new Actor(name, actorNr, isLocal);
            };
            LoadBalancingClient.prototype.myActor = //------------------------
            /**
            @summary Returns local actor.
            Client always has local actor even if not joined.
            @method Photon.LoadBalancing.LoadBalancingClient#myActor
            @returns {Photon.LoadBalancing.Actor} Local actor.
            */
            function () {
                return this._myActor;
            };
            LoadBalancingClient.prototype.myRoom = /**
            @summary Returns client's room.
            Client always has it's room even if not joined. It's used for room creation operation.
            @method Photon.LoadBalancing.LoadBalancingClient#myRoom
            @returns {Photon.LoadBalancing.Room} Current room.
            */
            function () {
                return this.currentRoom;
            };
            LoadBalancingClient.prototype.myRoomActors = /**
            @summary Returns actors in room client currently joined including local actor.
            @method Photon.LoadBalancing.LoadBalancingClient#myRoomActors
            @returns {Photon.LoadBalancing.Room[]} Room actors list.
            */
            function () {
                return this.actors;
            };
            LoadBalancingClient.prototype.roomFactoryInternal = function (name) {
                if (typeof name === "undefined") { name = ""; }
                var r = this.roomFactory(name);
                r._setLBC(this);
                return r;
            };
            LoadBalancingClient.prototype.actorFactoryInternal = function (name, actorId, isLocal) {
                if (typeof name === "undefined") { name = ""; }
                if (typeof actorId === "undefined") { actorId = -1; }
                if (typeof isLocal === "undefined") { isLocal = false; }
                var a = this.actorFactory(name, actorId, isLocal);
                a._setLBC(this);
                return a;
            };
            LoadBalancingClient.prototype.setCustomAuthentication = /**
            @summary Enables custom authentication and sets it's parameters.
            @method Photon.LoadBalancing.LoadBalancingClient#setCustomAuthentication
            @param {string} authParameters This string must contain any (http get) parameters expected by the used authentication service.
            @param {Photon.LoadBalancing.Constants.CustomAuthenticationType} [authType=Photon.LoadBalancing.Constants.CustomAuthenticationType.Custom] The type of custom authentication provider that should be used.
            */
            function (authParameters, authType) {
                if (typeof authType === "undefined") { authType = Photon.LoadBalancing.Constants.CustomAuthenticationType.Custom; }
                this.userAuthType = authType;
                this.userAuthParameters = authParameters;
            };
            LoadBalancingClient.prototype.connect = /**
            @summary Starts connection to master server.
            @method Photon.LoadBalancing.LoadBalancingClient#connect
            @param {bool} [keepMasterConnection=false] Don't disconnect from master server after joining room.
            */
            function (keepMasterConnection) {
                if (typeof keepMasterConnection === "undefined") { keepMasterConnection = false; }
                this.reconnectPending = false;
                if(this.checkNextState(LoadBalancingClient.State.ConnectingToMasterserver)) {
                    this.changeState(LoadBalancingClient.State.ConnectingToMasterserver);
                    this.logger.info("Connecting to Master", this.masterServerAddress);
                    this.keepMasterConnection = keepMasterConnection;
                    this.masterPeer = new MasterPeer(this, "ws://" + this.masterServerAddress, "");
                    this.initMasterPeer(this.masterPeer);
                    this.masterPeer.connect();
                    return true;
                } else {
                    return false;
                }
            };
            LoadBalancingClient.prototype.createRoomFromMy = /**
            @summary Creates a new room on the server (or fails when the name is already taken). Takes parameters (except name) for new room from myRoom() object. Set them before call.
            @method Photon.LoadBalancing.LoadBalancingClient#createRoomFromMy
            @param {string} [roomName] New room name. Assigned automatically by server if empty or not specified.
            */
            function (roomName) {
                this.currentRoom.name = roomName ? roomName : "";
                return this.createRoomInternal(this.masterPeer);
            };
            LoadBalancingClient.prototype.createRoom = /**
            @summary Creates a new room on the server (or fails when the name is already taken).
            @method Photon.LoadBalancing.LoadBalancingClient#createRoom
            @param {string} [roomName] The name to create a room with. Must be unique and not in use or can't be created. If not specified or null, the server will assign a GUID as name.
            @param {bool} [isVisible=true] Shows the room in the lobby's room list.
            @param {bool} [isOpen=false] Keeps players from joining the room (or opens it to everyone).
            @param {number} [maxPlayers=0] Max players before room is considered full (but still listed).
            @param {object} [customGameProperties] Custom properties to apply to the room on creation (use string-typed keys but short ones).
            @param {string} [propsListedInLobby] Defines the custom room properties that get listed in the lobby.
            */
            function (roomName, isVisible, isOpen, maxPlayers, customGameProperties, propsListedInLobby) {
                if (typeof isVisible === "undefined") { isVisible = true; }
                if (typeof isOpen === "undefined") { isOpen = true; }
                if (typeof maxPlayers === "undefined") { maxPlayers = 0; }
                if (typeof customGameProperties === "undefined") { customGameProperties = {
                }; }
                this.currentRoom = this.roomFactoryInternal(roomName ? roomName : "");
                this.currentRoom.isVisible = isVisible;
                this.currentRoom.isOpen = isOpen;
                this.currentRoom.maxPlayers = maxPlayers;
                this.currentRoom._customProperties = customGameProperties ? customGameProperties : {
                };
                this.currentRoom._propsListedInLobby = propsListedInLobby ? propsListedInLobby : [];
                this.currentRoom.onPropertiesChange(customGameProperties);
                return this.createRoomInternal(this.masterPeer);
            };
            LoadBalancingClient.prototype.joinRoom = /**
            @summary Joins a room by name and sets this player's properties.
            @method Photon.LoadBalancing.LoadBalancingClient#joinRoom
            @param {string} roomName The name of the room to join. Must be existing already, open and non-full or can't be joined.
            */
            function (roomName) {
                var op = [];
                this.currentRoom = this.roomFactoryInternal(roomName);
                op.push(LoadBalancing.Constants.ParameterCode.RoomName);
                op.push(roomName);
                this.masterPeer.sendOperation(LoadBalancing.Constants.OperationCode.JoinGame, op);
                return true;
            };
            LoadBalancingClient.prototype.joinRandomRoom = /**
            @summary Joins a random, available room.
            This operation fails if all rooms are closed or full.
            @method Photon.LoadBalancing.LoadBalancingClient#joinRandomRoom
            @param {object} [expectedCustomRoomProperties] If specified, a room will only be joined, if it matches these custom properties. Use null to accept rooms with any properties.
            @param {number} [expectedMaxPlayers] If specified, filters for a particular maxPlayer setting. Use 0 to accept any maxPlayer value.
            @param {Photon.LoadBalancing.Constants.MatchmakingMode} [matchmakingMode=MatchmakingMode.FillRoom] Selects one of the available matchmaking algorithms.
            */
            function (expectedCustomRoomProperties, expectedMaxPlayers, matchingType) {
                if (typeof expectedMaxPlayers === "undefined") { expectedMaxPlayers = 0; }
                if (typeof matchingType === "undefined") { matchingType = LoadBalancing.Constants.MatchmakingMode.FillRoom; }
                var op = [];
                if(matchingType != LoadBalancing.Constants.MatchmakingMode.FillRoom) {
                    op.push(LoadBalancing.Constants.ParameterCode.MatchMakingType);
                    op.push(matchingType);
                }
                var expectedRoomProperties = {
                };
                var propNonEmpty = false;
                if(expectedCustomRoomProperties) {
                    for(var k in expectedCustomRoomProperties) {
                        expectedRoomProperties[k] = expectedCustomRoomProperties[k];
                        propNonEmpty = true;
                    }
                }
                if(expectedMaxPlayers > 0) {
                    expectedRoomProperties[LoadBalancing.Constants.GameProperties.MaxPlayers] = expectedMaxPlayers;
                    propNonEmpty = true;
                }
                if(propNonEmpty) {
                    op.push(LoadBalancing.Constants.ParameterCode.GameProperties);
                    op.push(expectedRoomProperties);
                }
                this.masterPeer.sendOperation(LoadBalancing.Constants.OperationCode.JoinRandomGame, op);
                return true;
            };
            LoadBalancingClient.prototype._setPropertiesOfRoom = function (properties) {
                var op = [];
                op.push(LoadBalancing.Constants.ParameterCode.Properties);
                op.push(properties);
                op.push(LoadBalancing.Constants.ParameterCode.Broadcast);
                op.push(true);
                this.gamePeer.sendOperation(LoadBalancing.Constants.OperationCode.SetProperties, op);
            };
            LoadBalancingClient.prototype._setPropertiesOfActor = function (properties) {
                var op = [];
                op.push(LoadBalancing.Constants.ParameterCode.ActorNr);
                op.push(this.myActor().actorNr);
                op.push(LoadBalancing.Constants.ParameterCode.Properties);
                op.push(properties);
                op.push(LoadBalancing.Constants.ParameterCode.Broadcast);
                op.push(true);
                this.gamePeer.sendOperation(LoadBalancing.Constants.OperationCode.SetProperties, op);
            };
            LoadBalancingClient.prototype.disconnect = /**
            @summary Disconnects from master and game servers.
            @method Photon.LoadBalancing.LoadBalancingClient#disconnect
            */
            function () {
                if(this.state != LoadBalancingClient.State.Uninitialized) {
                    if(this.masterPeer) {
                        this.masterPeer.disconnect();
                    }
                    if(this.gamePeer) {
                        this.gamePeer.disconnect();
                    }
                    this.changeState(LoadBalancingClient.State.Disconnecting);
                }
            };
            LoadBalancingClient.prototype.leaveRoom = /**
            @summary Leaves room and connects to master server if not connected.
            @method Photon.LoadBalancing.LoadBalancingClient#leaveRoom
            */
            function () {
                if(this.isJoinedToRoom()) {
                    if(this.gamePeer) {
                        this.reconnectPending = true;
                        this.gamePeer.disconnect();
                    }
                    this.changeState(LoadBalancingClient.State.Disconnecting);
                }
            };
            LoadBalancingClient.prototype.raiseEvent = /**
            @summary Raises game custom event
            @method Photon.LoadBalancing.LoadBalancingClient#raiseEvent
            @param {number} eventCode Identifies this type of event (and the content). Your game's event codes can start with 0.
            @param {object} [data] Custom data you want to send along (use null, if none).
            @param {object} [options] Additional options
            @property {object} options Additional options
            @property {number} [options.interestGroup] The ID of the interest group this event goes to (exclusively).
            @property {Photon.LoadBalancing.Constants.EventCaching} [options.cache=EventCaching.DoNotCache] Events can be cached (merged and removed) for players joining later on.
            @property {Photon.LoadBalancing.Constants.ReceiverGroup} [options.receivers=ReceiverGroup.Others] Defines to which group of players the event is passed on.
            */
            function (eventCode, data, options) {
                if(this.isJoinedToRoom()) {
                    this.gamePeer.raiseEvent(eventCode, data, options);
                }
            };
            LoadBalancingClient.prototype.changeGroups = /**
            @summary Changes client's interest groups (for events in room).
            First, removing groups is executed. This way, you could leave all groups and join only the ones provided.
            @method Photon.LoadBalancing.LoadBalancingClient#changeGroups
            @param {number[]} groupsToRemove Groups to remove from interest. Null will not leave any. A [] will remove all.
            @param {number[]} groupsToAdd Groups to add to interest. Null will not add any. A [] will add all current.
            */
            function (groupsToRemove, groupsToAdd) {
                if(this.isJoinedToRoom()) {
                    this.logger.debug("Group change:", groupsToRemove, groupsToAdd);
                    this.gamePeer.changeGroups(groupsToRemove, groupsToAdd);
                }
            };
            LoadBalancingClient.prototype.isConnectedToMaster = /**
            @summary Checks if client is connected to master server (usually joined to lobby and receives room list updates).
            @method Photon.LoadBalancing.LoadBalancingClient#isConnectedToMaster
            @returns {bool} True if client is connected to master server.
            */
            function () {
                return this.masterPeer && this.masterPeer.isConnected();
            };
            LoadBalancingClient.prototype.isInLobby = /**
            @summary Checks if client is in lobby and ready to join or create game.
            @method Photon.LoadBalancing.LoadBalancingClient#isInLobby
            @returns {bool} True if client is in lobby.
            */
            function () {
                return this.state == LoadBalancingClient.State.JoinedLobby;
            };
            LoadBalancingClient.prototype.isJoinedToRoom = /**
            @summary Checks if client is joined to game.
            @method Photon.LoadBalancing.LoadBalancingClient#isJoinedToRoom
            @returns {bool} True if client is joined to game.
            */
            function () {
                return this.state == LoadBalancingClient.State.Joined;
            };
            LoadBalancingClient.prototype.isConnectedToGame = /**
            @deprecated Use isJoinedToRoom()
            */
            function () {
                return this.isJoinedToRoom();
            };
            LoadBalancingClient.prototype.availableRooms = /**
            @summary Current room list from master server.
            @method Photon.LoadBalancing.LoadBalancingClient#availableRooms
            @returns {RoomInfo[]} Current room list
            */
            function () {
                return this.roomInfos;
            };
            LoadBalancingClient.prototype.setLogLevel = /**
            @summary Sets client logger level
            @method Photon.LoadBalancing.LoadBalancingClient#setLogLevel
            @param {Exitgames.Common.Logger.Level} level Logging level.
            */
            function (level) {
                this.logger.setLevel(level);
                if(this.masterPeer) {
                    this.masterPeer.setLogLevel(level);
                }
                if(this.gamePeer) {
                    this.gamePeer.setLogLevel(level);
                }
            };
            LoadBalancingClient.prototype.addActor = function (a) {
                this.actors[a.actorNr] = a;
            };
            LoadBalancingClient.prototype.changeState = function (nextState) {
                this.logger.info("State:", LoadBalancingClient.StateToName(this.state), "->", LoadBalancingClient.StateToName(nextState));
                this.state = nextState;
                this.onStateChange(nextState);
            };
            LoadBalancingClient.prototype.createRoomInternal = function (peer) {
                var gp = {
                };
                gp[LoadBalancing.Constants.GameProperties.IsOpen] = this.currentRoom.isOpen;
                gp[LoadBalancing.Constants.GameProperties.IsVisible] = this.currentRoom.isVisible;
                if(this.currentRoom.maxPlayers > 0) {
                    gp[LoadBalancing.Constants.GameProperties.MaxPlayers] = this.currentRoom.maxPlayers;
                }
                if(this.currentRoom._propsListedInLobby && this.currentRoom._propsListedInLobby.length > 0) {
                    gp[LoadBalancing.Constants.GameProperties.PropsListedInLobby] = this.currentRoom._propsListedInLobby;
                }
                for(var p in this.currentRoom._customProperties) {
                    gp[p] = this.currentRoom._customProperties[p];
                }
                var op = [];
                if(this.currentRoom.name) {
                    op.push(LoadBalancing.Constants.ParameterCode.RoomName);
                    op.push(this.currentRoom.name);
                }
                op.push(LoadBalancing.Constants.ParameterCode.GameProperties);
                op.push(gp);
                op.push(LoadBalancing.Constants.ParameterCode.CleanupCacheOnLeave);
                op.push(true)//TODO: make this optional?
                ;
                op.push(LoadBalancing.Constants.ParameterCode.Broadcast);
                op.push(true)//TODO: make this optional?
                ;
                if(peer === this.gamePeer) {
                    op.push(LoadBalancing.Constants.ParameterCode.PlayerProperties);
                    op.push(this._myActor._getAllProperties());
                }
                peer.sendOperation(LoadBalancing.Constants.OperationCode.CreateGame, op);
            };
            LoadBalancingClient.prototype.initMasterPeer = function (mp) {
                var _this = this;
                mp.setLogLevel(this.logger.getLevel());
                // errors
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.error, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this.onError(LoadBalancingClient.PeerErrorCode.MasterError, "Master peer error");
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectFailed, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this.onError(LoadBalancingClient.PeerErrorCode.MasterConnectFailed, "Master peer connect failed: " + _this.masterServerAddress);
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.timeout, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this.onError(LoadBalancingClient.PeerErrorCode.MasterTimeout, "Master peer error timeout");
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connecting, function () {
                });
                // status
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connect, function () {
                    mp._logger.info("Connected");
                    //TODO: encryption phase
                    var op = [];
                    op.push(LoadBalancing.Constants.ParameterCode.ApplicationId);
                    op.push(_this.appId);
                    op.push(LoadBalancing.Constants.ParameterCode.AppVersion);
                    op.push(_this.appVersion);
                    if(_this.userAuthType != LoadBalancing.Constants.CustomAuthenticationType.None) {
                        op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationType);
                        op.push(_this.userAuthType);
                        op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationParams);
                        op.push(_this.userAuthParameters);
                    }
                    mp.sendOperation(LoadBalancing.Constants.OperationCode.Authenticate, op);
                    mp._logger.info("Authenticate...");
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.disconnect, function () {
                    mp._logger.info("Disconnected");
                });
                mp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectClosed, function () {
                    mp._logger.info("Server closed connection");
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this.onError(LoadBalancingClient.PeerErrorCode.MasterConnectClosed, "Master server closed connection");
                });
                //events
                mp.addEventListener(LoadBalancing.Constants.EventCode.GameList, function (data) {
                    var gameList = data.vals[LoadBalancing.Constants.ParameterCode.GameList];
                    _this.roomInfos = new Array();
                    for(var g in gameList) {
                        var r = new RoomInfo(g);
                        r._updateFromProps(gameList[g]);
                        _this.roomInfos.push(r);
                    }
                    _this.onRoomList(_this.roomInfos);
                    mp._logger.debug("ev GameList", _this.roomInfos, gameList);
                });
                mp.addEventListener(LoadBalancing.Constants.EventCode.GameListUpdate, function (data) {
                    var gameList = data.vals[LoadBalancing.Constants.ParameterCode.GameList];
                    var roomsUpdated = new Array();
                    var roomsAdded = new Array();
                    var roomsRemoved = new Array();
                    for(var g in gameList) {
                        var exist = _this.roomInfos.filter(function (x) {
                            return x.name == g;
                        });
                        if(exist.length > 0) {
                            var r = exist[0];
                            r._updateFromProps(gameList[g]);
                            if(r.removed) {
                                roomsRemoved.push(r);
                            } else {
                                roomsUpdated.push(r);
                            }
                        } else {
                            var r = new RoomInfo(g);
                            r._updateFromProps(gameList[g]);
                            _this.roomInfos.push(r);
                            roomsAdded.push(r);
                        }
                    }
                    _this.roomInfos = _this.roomInfos.filter(function (x) {
                        return !x.removed;
                    });
                    _this.onRoomListUpdate(_this.roomInfos, roomsUpdated, roomsAdded, roomsRemoved);
                    mp._logger.debug("ev GameListUpdate:", _this.roomInfos, "u:", roomsUpdated, "a:", roomsAdded, "r:", roomsRemoved, gameList);
                });
                // responses - check operation result: data.errCode
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.Authenticate, function (data) {
                    mp._logger.debug("resp Authenticate", data);
                    if(!data.errCode) {
                        mp._logger.info("Authenticated");
                        _this.userAuthSecret = data.vals[LoadBalancing.Constants.ParameterCode.Secret];
                        _this.changeState(LoadBalancingClient.State.ConnectedToMaster);
                        mp.sendOperation(LoadBalancing.Constants.OperationCode.JoinLobby);
                        mp._logger.info("Join Lobby...");
                    } else {
                        _this.changeState(LoadBalancingClient.State.Error);
                        _this.onError(LoadBalancingClient.PeerErrorCode.MasterAuthenticationFailed, "Master authentication failed");
                    }
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.JoinLobby, function (data) {
                    mp._logger.debug("resp JoinLobby", data);
                    if(!data.errCode) {
                        mp._logger.info("Joined to Lobby");
                        _this.changeState(LoadBalancingClient.State.JoinedLobby);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.JoinLobby, data);
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.CreateGame, function (data) {
                    mp._logger.debug("resp CreateGame", data);
                    if(!data.errCode) {
                        _this.currentRoom._updateFromMasterResponse(data.vals);
                        mp._logger.debug("Created/Joined " + _this.currentRoom.name);
                        _this.connectToGameServer(true);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.CreateGame, data);
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.JoinGame, function (data) {
                    mp._logger.debug("resp JoinGame", data);
                    if(!data.errCode) {
                        _this.currentRoom._updateFromMasterResponse(data.vals);
                        mp._logger.debug("Joined " + _this.currentRoom.name);
                        _this.connectToGameServer(false);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.JoinGame, data);
                });
                mp.addResponseListener(LoadBalancing.Constants.OperationCode.JoinRandomGame, function (data) {
                    mp._logger.debug("resp JoinRandomGame", data);
                    if(!data.errCode) {
                        _this.currentRoom._updateFromMasterResponse(data.vals);
                        mp._logger.debug("Joined " + _this.currentRoom.name);
                        _this.connectToGameServer(false);
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.JoinRandomGame, data);
                });
            };
            LoadBalancingClient.prototype.connectToGameServer = function (createGame) {
                if(!this.keepMasterConnection) {
                    this.masterPeer.disconnect();
                }
                if(this.checkNextState(LoadBalancingClient.State.ConnectingToGameserver)) {
                    this.logger.info("Connecting to Game", this.currentRoom.address);
                    this.gamePeer = new GamePeer(this, "ws://" + this.currentRoom.address, "");
                    this.initGamePeer(this.gamePeer, createGame);
                    if(!this.keepMasterConnection) {
                        this.masterPeer.disconnect();
                    }
                    this.gamePeer.connect();
                    this.changeState(LoadBalancingClient.State.ConnectingToGameserver);
                    return true;
                } else {
                    return false;
                }
            };
            LoadBalancingClient.prototype.initGamePeer = function (gp, createGame) {
                var _this = this;
                gp.setLogLevel(this.logger.getLevel());
                // errors
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.error, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this.onError(LoadBalancingClient.PeerErrorCode.GameError, "Game peer error");
                });
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectFailed, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this.onError(LoadBalancingClient.PeerErrorCode.GameConnectFailed, "Game peer connect failed: " + _this.currentRoom.address);
                });
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.timeout, function () {
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this.onError(LoadBalancingClient.PeerErrorCode.GameTimeout, "Game peer timeout");
                });
                // status
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connect, function () {
                    gp._logger.info("Connected");
                    //TODO: encryption phase
                    var op = [];
                    op.push(LoadBalancing.Constants.ParameterCode.ApplicationId);
                    op.push(_this.appId);
                    op.push(LoadBalancing.Constants.ParameterCode.AppVersion);
                    op.push(_this.appVersion);
                    if(_this.userAuthType != LoadBalancing.Constants.CustomAuthenticationType.None) {
                        op.push(LoadBalancing.Constants.ParameterCode.ClientAuthenticationType);
                        op.push(_this.userAuthType);
                        op.push(LoadBalancing.Constants.ParameterCode.Secret);
                        op.push(_this.userAuthSecret);
                    }
                    gp.sendOperation(LoadBalancing.Constants.OperationCode.Authenticate, op);
                    gp._logger.info("Authenticate...");
                });
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.disconnect, function () {
                    for(var i in _this.actors) {
                        _this.onActorLeave(_this.actors[i]);
                    }
                    _this.actors = {
                    };
                    _this.addActor(_this._myActor);
                    gp._logger.info("Disconnected");
                    if(_this.masterPeer && _this.masterPeer.isConnected()) {
                        _this.changeState(LoadBalancingClient.State.JoinedLobby);
                    } else {
                        _this.changeState(LoadBalancingClient.State.Disconnected);
                        if(_this.reconnectPending) {
                            _this.connect(_this.keepMasterConnection);
                        }
                    }
                });
                gp.addPeerStatusListener(Photon.PhotonPeer.StatusCodes.connectClosed, function () {
                    gp._logger.info("Server closed connection");
                    _this.changeState(LoadBalancingClient.State.Error);
                    _this.onError(LoadBalancingClient.PeerErrorCode.MasterConnectClosed, "Game server closed connection");
                });
                // responses
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.Authenticate, function (data) {
                    gp._logger.debug("resp Authenticate", data);
                    if(!data.errCode) {
                        gp._logger.info("Authenticated");
                        gp._logger.info("Connected");
                        if(createGame) {
                            _this.createRoomInternal(gp);
                        } else {
                            var op = [];
                            op.push(LoadBalancing.Constants.ParameterCode.RoomName);
                            op.push(_this.currentRoom.name);
                            op.push(LoadBalancing.Constants.ParameterCode.Broadcast);
                            op.push(true);
                            op.push(LoadBalancing.Constants.ParameterCode.PlayerProperties);
                            op.push(_this._myActor._getAllProperties());
                            gp.sendOperation(LoadBalancing.Constants.OperationCode.JoinGame, op);
                        }
                        _this.changeState(LoadBalancingClient.State.ConnectedToGameserver);
                    } else {
                        _this.changeState(LoadBalancingClient.State.Error);
                        _this.onError(LoadBalancingClient.PeerErrorCode.GameAuthenticationFailed, "Game authentication failed");
                    }
                });
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.CreateGame, function (data) {
                    gp._logger.debug("resp CreateGame", data);
                    if(!data.errCode) {
                        _this._myActor._updateMyActorFromResponse(data.vals);
                        gp._logger.info("myActor: ", _this._myActor);
                        _this.actors = {
                        };
                        _this.addActor(_this._myActor);
                        _this.changeState(LoadBalancingClient.State.Joined);
                        _this.onJoinRoom();
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.CreateGame, data);
                });
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.JoinGame, function (data) {
                    gp._logger.debug("resp JoinGame", data);
                    if(!data.errCode) {
                        _this._myActor._updateMyActorFromResponse(data.vals);
                        gp._logger.info("myActor: ", _this._myActor);
                        _this.currentRoom._updateFromProps(data.vals[LoadBalancing.Constants.ParameterCode.GameProperties]);
                        _this.actors = {
                        };
                        _this.addActor(_this._myActor);
                        var actorList = data.vals[LoadBalancing.Constants.ParameterCode.PlayerProperties];
                        for(var k in actorList) {
                            var a = _this.actorFactoryInternal(actorList[k][LoadBalancing.Constants.ActorProperties.PlayerName], parseInt(k));
                            a._updateCustomProperties(actorList[k]);
                            _this.addActor(a);
                        }
                        _this.changeState(LoadBalancingClient.State.Joined);
                        _this.onJoinRoom();
                    }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.JoinGame, data);
                });
                gp.addResponseListener(LoadBalancing.Constants.OperationCode.SetProperties, function (data) {
                    gp._logger.debug("resp SetProperties", data);
                    //                if (!data.errCode) { }
                    _this._onOperationResponseInternal2(LoadBalancing.Constants.OperationCode.SetProperties, data);
                });
                // events
                gp.addEventListener(LoadBalancing.Constants.EventCode.Join, function (data) {
                    gp._logger.debug("ev Join", data);
                    if(Actor._getActorNrFromResponse(data.vals) === _this._myActor.actorNr) {
                        _this._myActor._updateMyActorFromResponse(data.vals);
                        _this.addActor(_this._myActor);
                    } else {
                        var actor = _this.actorFactoryInternal();
                        actor._updateFromResponse(data.vals);
                        _this.addActor(actor);
                        _this.onActorJoin(actor);
                    }
                });
                gp.addEventListener(LoadBalancing.Constants.EventCode.Leave, function (data) {
                    gp._logger.debug("ev Leave", data);
                    var actorNr = Actor._getActorNrFromResponse(data.vals);
                    if(actorNr && _this.actors[actorNr]) {
                        var a = _this.actors[actorNr];
                        delete _this.actors[actorNr];
                        _this.onActorLeave(a);
                    }
                });
                gp.addEventListener(LoadBalancing.Constants.EventCode.PropertiesChanged, function (data) {
                    gp._logger.debug("ev PropertiesChanged", data);
                    var targetActorNr = data.vals[LoadBalancing.Constants.ParameterCode.TargetActorNr];
                    if(targetActorNr !== undefined && targetActorNr > 0) {
                        if(_this.actors[targetActorNr] !== undefined) {
                            var actor = _this.actors[targetActorNr];
                            actor._updateCustomProperties(data.vals[LoadBalancing.Constants.ParameterCode.Properties]);
                            _this.onActorPropertiesChange(actor);
                        }
                    } else {
                        _this.currentRoom._updateFromProps(data.vals, data.vals[LoadBalancing.Constants.ParameterCode.Properties]);
                        _this.onMyRoomPropertiesChange();
                    }
                });
            };
            LoadBalancingClient.prototype._onOperationResponseInternal2 = function (code, data) {
                this.onOperationResponse(data.errCode, data.errMsg, code, data.vals);
            };
            LoadBalancingClient.prototype.initValidNextState = //TODO: ugly way to init const table
            function () {
                this.validNextState[LoadBalancingClient.State.Error] = [
                    LoadBalancingClient.State.ConnectingToMasterserver
                ];
                this.validNextState[LoadBalancingClient.State.Uninitialized] = [
                    LoadBalancingClient.State.ConnectingToMasterserver
                ];
                this.validNextState[LoadBalancingClient.State.Disconnected] = [
                    LoadBalancingClient.State.ConnectingToMasterserver
                ];
                this.validNextState[LoadBalancingClient.State.ConnectedToMaster] = [
                    LoadBalancingClient.State.JoinedLobby
                ];
                this.validNextState[LoadBalancingClient.State.JoinedLobby] = [
                    LoadBalancingClient.State.ConnectingToGameserver
                ];
                this.validNextState[LoadBalancingClient.State.ConnectingToGameserver] = [
                    LoadBalancingClient.State.ConnectedToGameserver
                ];
                this.validNextState[LoadBalancingClient.State.ConnectedToGameserver] = [
                    LoadBalancingClient.State.Joined
                ];
            };
            LoadBalancingClient.prototype.checkNextState = function (nextState, dontThrow) {
                if (typeof dontThrow === "undefined") { dontThrow = false; }
                var valid = this.validNextState[this.state];
                var res = valid && valid.indexOf(nextState) >= 0;
                if(res || dontThrow) {
                    return res;
                } else {
                    throw new Error("LoadBalancingPeer checkNextState fail: " + LoadBalancingClient.StateToName(this.state) + " -> " + LoadBalancingClient.StateToName(nextState));
                }
            };
            LoadBalancingClient.PeerErrorCode = {
                Ok: 0,
                MasterError: 1001,
                MasterConnectFailed: 1002,
                MasterConnectClosed: 1003,
                MasterTimeout: 1004,
                MasterAuthenticationFailed: 1101,
                GameError: 2001,
                GameConnectFailed: 2002,
                GameConnectClosed: 2003,
                GameTimeout: 2004,
                GameAuthenticationFailed: 2101
            };
            LoadBalancingClient.State = {
                Error: -1,
                Uninitialized: 0,
                ConnectingToMasterserver: 1,
                ConnectedToMaster: 2,
                JoinedLobby: 3,
                ConnectingToGameserver: 4,
                ConnectedToGameserver: 5,
                Joined: 6,
                Disconnecting: 7,
                Disconnected: 8
            };
            LoadBalancingClient.StateToName = function StateToName(value) {
                return Exitgames.Common.Util.enumValueToName(LoadBalancingClient.State, value);
            };
            return LoadBalancingClient;
        })();
        LoadBalancing.LoadBalancingClient = LoadBalancingClient;        
        //TODO: internal
        var MasterPeer = (function (_super) {
            __extends(MasterPeer, _super);
            function MasterPeer(client, url, subprotocol) {
                        _super.call(this, url, subprotocol, "Master");
                this.client = client;
            }
            MasterPeer.prototype.onUnhandledEvent = // overrides
            function (code, args) {
                this.client.onEvent(code, args.vals[LoadBalancing.Constants.ParameterCode.CustomEventContent], args.vals[LoadBalancing.Constants.ParameterCode.ActorNr]);
            };
            MasterPeer.prototype.onUnhandledResponse = // overrides
            function (code, args) {
                this.client.onOperationResponse(args.errCode, args.errMsg, code, args.vals);
            };
            return MasterPeer;
        })(Photon.PhotonPeer);
        LoadBalancing.MasterPeer = MasterPeer;        
        //TODO: internal
        var GamePeer = (function (_super) {
            __extends(GamePeer, _super);
            function GamePeer(client, url, subprotocol) {
                        _super.call(this, url, subprotocol, "Game");
                this.client = client;
            }
            GamePeer.prototype.onUnhandledEvent = // overrides
            function (code, args) {
                this.client.onEvent(code, args.vals[LoadBalancing.Constants.ParameterCode.CustomEventContent], args.vals[LoadBalancing.Constants.ParameterCode.ActorNr]);
            };
            GamePeer.prototype.onUnhandledResponse = // overrides
            function (code, args) {
                this.client.onOperationResponse(args.errCode, args.errMsg, code, args.vals);
            };
            GamePeer.prototype.raiseEvent = function (eventCode, data, options) {
                if(this.client.isJoinedToRoom()) {
                    this._logger.debug("raiseEvent", eventCode, data, options);
                    var params = [
                        LoadBalancing.Constants.ParameterCode.Code, 
                        eventCode, 
                        LoadBalancing.Constants.ParameterCode.Data, 
                        data
                    ];
                    if(options) {
                        if(options.receivers != undefined && options.receivers !== LoadBalancing.Constants.ReceiverGroup.Others) {
                            params.push(LoadBalancing.Constants.ParameterCode.ReceiverGroup);
                            params.push(options.receivers);
                        }
                        if(options.cache != undefined && options.cache !== LoadBalancing.Constants.EventCaching.DoNotCache) {
                            params.push(LoadBalancing.Constants.ParameterCode.Cache);
                            params.push(options.cache);
                        }
                        if(options.interestGroup != undefined) {
                            if(this.checkGroupNumber(options.interestGroup)) {
                                params.push(LoadBalancing.Constants.ParameterCode.Group);
                                params.push(options.interestGroup);
                            } else {
                                throw new Error("raiseEvent - Group not a number: " + options.interestGroup);
                            }
                        }
                    }
                    this.sendOperation(LoadBalancing.Constants.OperationCode.RaiseEvent, params);
                } else {
                    throw new Error("raiseEvent - Not joined!");
                }
            };
            GamePeer.prototype.changeGroups = function (groupsToRemove, groupsToAdd) {
                var params = [];
                if(groupsToRemove != null && groupsToRemove != undefined) {
                    this.checkGroupArray(groupsToRemove, "groupsToRemove");
                    params.push(LoadBalancing.Constants.ParameterCode.Remove);
                    params.push(groupsToRemove);
                }
                if(groupsToAdd != null && groupsToAdd != undefined) {
                    this.checkGroupArray(groupsToAdd, "groupsToAdd");
                    params.push(LoadBalancing.Constants.ParameterCode.Add);
                    params.push(groupsToAdd);
                }
                this.sendOperation(LoadBalancing.Constants.OperationCode.ChangeGroups, params);
            };
            GamePeer.prototype.checkGroupNumber = function (g) {
                return !(typeof (g) != "number" || isNaN(g) || g === Infinity || g === -Infinity);
            };
            GamePeer.prototype.checkGroupArray = function (groups, groupsName) {
                if(Exitgames.Common.Util.isArray(groups)) {
                    for(var i = 0; i < groups.length; ++i) {
                        var g = groups[i];
                        if(this.checkGroupNumber(g)) {
                        } else {
                            throw new Error("changeGroups - " + groupsName + " (" + groups + ") not an array of numbers: element " + i + " = " + g);
                        }
                    }
                } else {
                    throw new Error("changeGroups - groupsToRemove not an array: " + groups);
                }
            };
            return GamePeer;
        })(Photon.PhotonPeer);
        LoadBalancing.GamePeer = GamePeer;        
    })(Photon.LoadBalancing || (Photon.LoadBalancing = {}));
    var LoadBalancing = Photon.LoadBalancing;
})(Photon || (Photon = {}));

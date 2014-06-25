
document.addEventListener('DOMContentLoaded', function () {
    RegisterCommands();
    window.addEventListener('message', MSG.received);
    //have to initalize the sandbox message as it can only send back to the sender    
    MSG.sandboxFrame().onload = function () {
        MSG.sendCommand("initSandbox");        
    };

});



//handles messaging to opposite api
var MSG = {
    //gets sandboxframe DOM element (with caching)
    sandboxFrame: function () {
        if (!MSG.hasOwnProperty('sandboxDOMelement')) {
            MSG['sandboxDOMelement'] = document.getElementById('sandboxFrame');
        }
        return MSG['sandboxDOMelement']
    },
    commands: {},
    /**
    * Registers command that can be called from opposite API
    * @param {string} command - name of command
    * @param {function} listener - function to fire
    * @param {int} [indexOfCallbackArg=-1] - pass the index of callback argument if any, this is because a callback (function) cannot be passed between APIs, so the callback argument must be inected by the MSG handler
    */
    registerCommand: function (command, listener, indexOfCallbackArg) {
        if (typeof indexOfCallbackArg === 'undefined') {
            indexOfCallbackArg = -1;
        }
        if (MSG.commands.hasOwnProperty(command)) {
            log(new Error('MSG.registerCommand, a command with name=' + command + ' already exists. Each command can only be registered once. this shouold never happen'));
        }
        else {
            MSG.commands[command] = { "callback": listener, "indexOfCallbackArg": indexOfCallbackArg };
        }
    },
    //each send message gets an ID, which is used on the response to fire the callback
    lastMsgID: 1,
    //each time a message is sent that has a callback, it is added to this by its ID, so when the secure API responds, we can fire the callback
    messageCallbacks: {},
    //fired on message received from secure api
    received: function (e) {
        try {
           // console.log('received in SECURE', e.data);

            //#region ReadData
            //get message
            var command, args, callbackid, id;
            if (e.data.hasOwnProperty('command')) {
                command = e.data.command;
            }
            if (e.data.hasOwnProperty('args')) {
                args = e.data.args;
            }
            if (e.data.hasOwnProperty('id')) {
                id = e.data.id;
            }
            if (e.data.hasOwnProperty('callbackid')) {
                callbackid = e.data.callbackid;
            }
            //#endregion


            //#region MessageResponse
            //this means that this message is a response from a message that was sent from here
            if (callbackid) {
                if (!MSG.messageCallbacks.hasOwnProperty(callbackid.toString())) {
                    log(new Error('MSG.Received in SECURE with callbackid=' + callbackid + ' but no callback by this id was found. this shouold never happen'));
                }
                else {
                    var cb = MSG.messageCallbacks[callbackid.toString()];
                    if (typeof cb !== 'function') {
                        log(
                            new Error('MSG.Received in SECURE with callbackid=' + callbackid + ' however, the variable that was found for the callback is not a function. this should never happen'),
                            'callback=',
                            cb);
                    }
                    else {//fire callback
                        cb(args);
                    }
                }
                if (command) {
                    log(new Error('MSG.Received in SECURE with callbackid=' + callbackid + '  AND command=' + command + '. A message should not contain both a command and a callbackid (a command is for firing an event, a callbackid is a response from a command). this should never happen'));
                }
            }
            //#endregion


            //#region FireCommand
            //need to fire a command here....
            if (command) {
                if (MSG.commands.hasOwnProperty(command)) {
                    if (args) {
                        //args must be an array
                        if (args.constructor.name !== 'Array') {
                            var temp = args;
                            args = [];
                            args.push(temp);
                        }
                    }
                    else {
                        args = [];
                    }
                    //comebcak- NOT DONE HERE-- clean up and copy to other soure
                    var C = MSG.commands[command];
                    if (C.indexOfCallbackArg !== -1) {
                        if (args[C.indexOfCallbackArg] !== undefined) {
                            throw new Error('indexOfCallbackArg=' + indexOfCallbackArg + ' but there is already an arugment at this index. this hsould never happen');
                        }
                        //add send response as callback parameter
                        args[C.indexOfCallbackArg] = function (a) { MSG.sendResponse(id, a); };
                        if (id) {
                            C.callback.apply(null, args);
                            return;
                        }
                        else {
                            throw new Error("argiscallback but no callback id specified!");
                        }
                    }
                    else {
                        var result = C.callback.apply(null, args);
                    }
                    //if id specified, it means we need to do a 'callback' by sending a response back
                    if (id) {
                        MSG.sendResponse(id, result);
                    }
                }
                else {
                    log(new Error('MSG.Received in SECURE with id=' + id + ' and command=' + command + ' but no command was found with this name, this should never happen.'));
                }
            }
            //#endreigon
        }
        catch (ex) {
            throw (ex);
            //log('error in MSG.received', ex);
        }
    },
    /**
    * Sends message to opposite api; 
    * Each message gets a unique ID which is used to fire the callback when its received
    * @param {plainObject} command - command to call in opposite API (each command type must be setup manually on opposite API)
    * @param {any object including array of objects} [args] - arguments to pass to the receiving command (fn) on the opposite API
    * @param {function} [callback] - callback to fire when result is received    
    */
    sendCommand: function (command, args, callback) {
        //log('sending command:' + command);
        try {
            var data = {
                "command": command,
                "args": args
            };
            //add callback if specified
            if (typeof callback === 'function') {
                if (MSG.lastMsgID > 9007199254740990) {//reset if max reached
                    MSg.lastMsgID = 1;
                }
                var id = MSG.lastMsgID++;
                MSG.messageCallbacks[id] = callback;
                data["id"] = id;
            }
            MSG.sandboxFrame().contentWindow.postMessage(data, '*');
        }
        catch (ex) {
            log('error sending command- ' + ex);
            setTimeout(function () {
                throw (ex);
            }, 0);
        }
    },
    /**
    * Sends message to api that is a response to a message received from the opposite api
    * Each message gets a unique ID which is used to fire the callback when its received   *
    * @param {any object including array of objects} [args] - arguments to pass to the receiving command (fn) on the opposite api
    * @param {int} [callbackid] - the id of the callback to fire on the oposite api
    */
    sendResponse: function (callbackid, args) {
        try {
            var data = {
                "callbackid": callbackid,
                "args": args
            };
            //console.log('sending response, data=', data);
            MSG.sandboxFrame().contentWindow.postMessage(data, '*');
        }
        catch (ex) {
            console.log('\nsendResponse error=');
            throw ex;
        }
    }
}




function RegisterCommands() {    
    MSG.registerCommand('testfn', function (a, b, callback) {
        //console.log('test function:');
        //DBG(arguments, true);
        callback("a=" + a + "; b=" + b);
    }, 2);


    //#region requireLoadText
    //from text.js- extracted to here as its need to use chrome.runtime
    var requireLoadText_cache = {};
    var requireLoadText_directory = null;
    var requireLoadText = function (name,  onLoad) {        
        if (name in requireLoadText_cache) {
            return onLoad(requireLoadText_cache[name]);
        }

        var getFile = function () {
            requireLoadText_directory.getFile(name, { create: false }, function (entry) {
                entry.file(function (file) {
                    var reader = new FileReader();
                    reader.onloadend = function () {
                        requireLoadText_cache[name] = reader.result;
                        onLoad(reader.result);
                    };
                    reader.readAsText(file);
                });
            });
        };

        if (requireLoadText_directory) return getFile();
        chrome.runtime.getPackageDirectoryEntry(function (dir) {
            requireLoadText_directory = dir;
            //console.log('got directory', directory);
            getFile();
        });
    }
    MSG.registerCommand('requireLoadText', requireLoadText, 1);
    //#endregion
}

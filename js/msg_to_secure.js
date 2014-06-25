
document.addEventListener('DOMContentLoaded', function () {
    RegisterCommands();
    window.addEventListener('message', MSG.received);
});


//handles messaging to opposite api
var MSG = {
    commands: {},
    /**
    * Registers command that can be called from opposite API
    * @param {string} command - name of command
    * @param {function} listener - function to fire
    */
    registerCommand: function (command, listener) {
        if (MSG.commands.hasOwnProperty(command)) {
            log(new Error('MSG.registerCommand, a command with name='+command+' already exists. Each command can only be registered once. this shouold never happen'));
        }
        else {
            MSG.commands[command] = listener;
        }
    },
    //each send message gets an ID, which is used on the response to fire the callback
    lastMsgID: 1,
    //each time a message is sent that has a callback, it is added to this by its ID, so when the secure API responds, we can fire the callback
    messageCallbacks: {},
    //source of secure api, set on first received message 
    secureSource: null,
    //origin of secure api, set on first received message
    secureOrigin: null,
    //fired on message received from secure api
    received: function (e) {
        try {
            //console.log('received in SANDBOX', e.data);

            //#region ReadData
            //on first receive, need to set origin and source which are used to send messages back to secure api
            if (MSG.secureOrigin === null) {
                MSG.secureOrigin = e.origin;
            }
            if (MSG.secureSource === null) {
                MSG.secureSource = e.source;
            }

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

            //this means that this message is a response from a message that was sent from here
            if (callbackid) {
                if (!MSG.messageCallbacks.hasOwnProperty(callbackid.toString())) {
                   throw new Error('MSG.Received in SANDBOX with callbackid=' + callbackid + ' but no callback by this id was found. this shouold never happen');
                }
                else {
                    var cb = MSG.messageCallbacks[callbackid.toString()];
                    if (typeof cb !== 'function') {
                        throw new Error('MSG.Received in SANDBOX with callbackid=' + callbackid + ' however, the variable that was found for the callback is not a function. this should never happen');
                    }
                    else {//fire callback
                        cb(args);
                    }
                }
                if (command) {
                    throw new Error('MSG.Received in SANDBOX with callbackid=' + callbackid + '  AND command=' + command + '. A message should not contain both a command and a callbackid (a command is for firing an event, a callbackid is a response from a command). this should never happen');
                }
            }

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
                    var result = MSG.commands[command].apply(null, args);
                    //if id specified, it means we need to do a 'callback' by sending a response back
                    if (id) {
                        MSG.sendResponse(id, result);
                    }
                }
                else {                    
                   throw new Error('MSG.Received in SANDBOX with command=' + command + ' but no command was found with this name, this should never happen.');
                }
            }
        }
        catch(ex){
            console.log('\nerror in MSG.received:');
            throw ex;
        }
    },
    /**
    * Sends message to opposite api; 
    * Each message gets a unique ID which is used to fire the callback when its received
    * @param {string} command - command to call in opposite API (each command type must be setup manually on opposite API)
    * @param {any object including array of objects} [args] - arguments to pass to the receiving command (fn) on the opposite API
    * @param {function} [callback] - callback to fire when result is received    
    */
    sendCommand: function (command, args, callback) {        
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
        MSG.secureSource.postMessage(data, MSG.secureOrigin);
    },
   /**
   * Sends message to api that is a response to a message received from the opposite api
   * Each message gets a unique ID which is used to fire the callback when its received   *
   * @param {any object including array of objects} [args] - arguments to pass to the receiving command (fn) on the opposite api
   * @param {int} [callbackid] - the id of the callback to fire on the oposite api
   */
    sendResponse: function (callbackid, args) {
        var data = {
            "callbackid": callbackid,
            "args": args
        };
        MSG.secureSource.postMessage(data, MSG.secureOrigin);
    }
}


//emulate chrome APIs

chrome['runtime'] = {};



/**
* https://developer.chrome.com/extensions/runtime#method-getPackageDirectoryEntry
*/
/*  cant do this because it returns a function
chrome.runtime.getPackageDirectoryEntry = function (callback) {
   // return;//COMEBACK
  //  DBG(arguments, true);
    MSG.sendCommand('chrome.runtime.getPackageDirectoryEntry', null, callback);
};
*/

function RegisterCommands() {
    MSG.registerCommand('initSandbox', function () {
        console.log('sandbox initialized');
        /* this works: use it for testing
        MSG.sendCommand("testfn", ["argA", "argB"], function (a) {
            console.log('testfn response received from callback (in sandbox). args=' + a);
        })*/
    });
}




/*
//The load event is fired when a resource and its dependent resources have finished loading.
document.addEventListener('load', function () {
    callSB('some data', 'testType');
})*/

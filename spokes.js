  //Ensure jquery is loaded
if ( typeof jQuery === 'undefined' )
  alert("Spokes Error: jQuery must be loaded before spokes Javascript");

  //Compresses an array of queue items down to a single number
function compressQueueList( queue )
{
  var val = 0;

    //If we aren't an array, just return queue
  if ( queue.constructor.toString().indexOf("Array") == -1 )
    return queue;

    //We have an array, go through it and or everthing together
  for ( var i = 0; i < queue.length; i++ )
    if ( typeof( queue[i] ) === "number" && queue[i] > 0 )
      val |= queue[i];

  return val;
}

  //This is an action object which provides callbacks if the server is offline
function SpokesAction( callback )
{
  this.Age = 0;
  this.Callback = callback;
  this.isValid = true;
}
  //Holds a list actions for all objects
SpokesAction.Action_List = new Array();

//Register myself with the allocated list of spokes
setInterval(function () { 
    var len = SpokesAction.Action_List.length - 1;
    for ( var i = len; i >= 0; i-- ) {
      var action = SpokesAction.Action_List[i];
      action.Age++;
      if ( action.Age > 4 ){
        SpokesAction.Action_List.splice(i,1); 
          //Call the user telling them the request timed out
        if ( action.isValid && typeof( action.Callback) === 'function' )
          action.Callback( new SpokesResponse( {"Description":"","Err":{"Description":"No response.  Server appears to be offline.","Error_Code":0,"Type":4},"Result":null,"Type":0,"Type_Name":"Unknown","isError":true} ) );

      }
    }
}, 2000); //2 seconds on the callback


  //Create my object
function Spokes( url ) {
  // set path to default if url is undefined
  this.Path = (typeof url === 'undefined' || url == null) ? "http://127.0.0.1:32001/Spokes" : url;  //Custom address
  this.Device = new Device( this.Path ); 
  this.Plugin = new Plugin( this.Path );
}

  //Create my object
function Device( path )
{
  this.Path = path;
  this.Sess_Id = "";
  this.isAttached = false;
}

  //Connect to a device
Device.prototype.attach = function( uid, callback )
{
    //Change the uid to a special value if none was given
  if ( callback == undefined && typeof(uid) === "function" )
  {
    callback = uid;
    uid = "0123456789"; //Magic uid which tells server to pick first device 
  }

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Attach to device
  // API: http://127.0.0.1:32001/Spokes/DeviceServices/{uid}/Attach
  // Params: {uid}  is the unique identifier of a device
  // Returns: a session hash string (or an error string)
  local = this;
  $.getJSON(this.Path + "/DeviceServices/"+ uid +"/Attach?callback=?", 
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.SessionHash )
                resp.isValid = false;

                //Store my session and set that we are attached
              if ( resp.isValid && !resp.isError )
              {
                local.Sess_Id = resp.Result;
                local.isAttached = true;   
              }

                //Pass my result back to the user
              action.isValid = false;
              if ( typeof( action.Callback ) === 'function' )
                action.Callback( resp ); 
            } );

  return true;
}

  //Release my session from a device
Device.prototype.release = function( callback )
{
    //Can't release, we aren't attached
  if ( this.isAttached == false )
    return false;

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  local = this;
  
  // Detach from device
  // API: http://127.0.0.1:32001/Spokes/DeviceServices/{sess}/Release
  // Params: {sess} is the unique identifier of a session.
  // Returns: true or false (success or failure)
  $.getJSON(this.Path+"/DeviceServices/"+ this.Sess_Id +"/Release?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool )
                resp.isValid = false;

                //Set that we aren't attached anymore, if if this failed
              local.Sess_Id = "";
              local.isAttached = false;   

                //Pass my result back to the user
              action.isValid = false;
              if ( typeof(action.Callback) === 'function' )
                action.Callback( resp ); 
            } );

  return true;
}

  //Fetch a list of a devices
Device.prototype.deviceList = function( callback )
{
    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Get list of all devices connected to machine
  // API: http://127.0.0.1:32001/Spokes/DeviceServices/DeviceList
  // Returns: Array of DeviceInfo objects.
  $.getJSON(this.Path + "/DeviceServices/DeviceList?callback=?", 
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.DeviceInfoArray )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if (action.Callback != null && action.Callback != undefined)
                  action.Callback(resp); 
            } );

  return true;
}

  //Returns the info for our connected device
Device.prototype.deviceInfo = function( callback )
{
    //Can't release, we aren't attached
  if ( this.isAttached == false || callback == null || callback == undefined )
    return false;

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Get additional device information
  // API: http://127.0.0.1:32001/Spokes/DeviceServices/{sess}/Info
  // Params: {sess} is the unique identifier of a session.
  // Returns: DeviceInfo objects for device we previously attached
  $.getJSON(this.Path+"/DeviceServices/"+ this.Sess_Id +"/Info?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.DeviceInfo )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if (action.Callback != null && action.Callback != undefined)
                  action.Callback(resp); 
            } );

  return true;
}

  //Returns all the valid events that have happened since last call
Device.prototype.events = function( queue, callback )
{
    //Check if I was only given one argument
  if ( callback == undefined && typeof( queue ) === 'function' )
  {
    callback = queue;
    queue = 0;
  }

    //If they gave me an array of queue items, compress them down to an int
  queue = compressQueueList( queue );

    //Can't release, we aren't attached
  if ( this.isAttached == false || callback == null || callback == undefined )
    return false;

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Get list of events from spokes for defined event queue
  // API: http://127.0.0.1:32001/Spokes/DeviceServices/{sess}/Events?{queue}=queue
  // Params: {sess} is the unique identifier of a session.
  //         {queue} is the number of the queue or queues you are interested in, 0 means all queues (this is default value), else select the appropriate queue number (Unknown = 0, DeviceStateChange = 1, HeadsetStateChange = 2, HeadsetButtonPressed = 4, BaseStateChange = 8, BaseButtonPressed = 16, CallStateChange = 32, ATDStateChange = 64), may be a binary OR of any set of these values
  // Returns: Array of SpokesEvent objects that are holding event informations
  $.getJSON(this.Path+"/DeviceServices/"+ this.Sess_Id +"/Events"+ 
            "?queue="+ queue +"&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.DeviceEventArray )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if (action.Callback != null && action.Callback != undefined)
                  action.Callback(resp); 
            });

  return true;
}

  //Returns specific event queues for headset events
Device.prototype.headsetEvents = function( callback )
{
  var evt = (SpokesEventType.HeadsetButtonPressed | 
             SpokesEventType.HeadsetStateChange);
  return this.events( evt, callback );
}

  //Returns specific event queues for base events
Device.prototype.baseEvents = function( callback )
{
  var evt = (SpokesEventType.BaseButtonPressed |
             SpokesEventType.BaseStateChange);
  return this.events( evt, callback );
}

  //Returns specific atd event queue content
Device.prototype.atdEvents = function( callback )
{
  return this.events( SpokesEventType.ATDStateChange, callback );
}

  //Starts or stops the ringer in the headest
Device.prototype.ring = function( enabled, callback )
{
    //Can't release, we aren't attached
  if ( this.isAttached == false || typeof(enabled) !== "boolean" )
    return false;

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Enables or disables the ringer
  // API: http://127.0.0.1:32001/Spokes/DeviceServices/{sess}/Ring?{enabled}=enabled
  // Params: {sess} is the unique identifier of a session.
  //         {enabled} when set to true turns the ringer on, false turns it off
  // Returns: true or false (success or failure)
  $.getJSON(this.Path+"/DeviceServices/"+ this.Sess_Id +"/Ring"+ 
                                          "?enabled="+ enabled +
                                          "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Sets the audio state, for wireless headsets MonoOn/Off turns them on and off
Device.prototype.audioState = function( state, callback )
{
    //Can't release, we aren't attached
  if ( this.isAttached == false || typeof(state) !== "number" )
    return false;

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

    //Convert the audio state into the textual name
  state = SpokesAudioType.Lookup[state];

  // Enables or disables the audio stream to the attached device. For a wireless device, this property also control the audio link.
  // API: http://127.0.0.1:32001/Spokes/DeviceServices/{sess}/AudioState?{state}=state
  // Params: {sess} is the unique identifier of a session.
  //         {state} true: sets AudioType.MonoOn; false: sets AudioType.MonoOff
  // Returns: true or false (success or failure)
  $.getJSON(this.Path+"/DeviceServices/"+ this.Sess_Id +"/AudioState"+ 
                                          "?state="+ state +
                                          "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}
/////////////////////////////////////////////////
// Configuration Services

  //Returns the queues we are registered for
Device.prototype.getEventRegistry = function( callback )
{
    //Can't release, we aren't attached
  if ( this.isAttached == false )
    return false;

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Configuration services, returnes mask from Spokes that defines from what queues we are going to receive events after Device.prototype.events function call. Default value is All.
  // API: http://127.0.0.1:32001/Spokes/EventManager/GetRegistry?{sess}=sess
  // Params: {sess} is the unique identifier of a session.
  // Returns: int. Or'ed queue numbers (Unknown = 0, DeviceStateChange = 1, HeadsetStateChange = 2, HeadsetButtonPressed = 4, BaseStateChange = 8, BaseButtonPressed = 16, CallStateChange = 32, ATDStateChange = 64)
  $.getJSON(this.Path + "/EventManager/GetRegistry" +
                                            "?sess=" + this.Sess_Id + 
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Integer )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Defines a list of queues we are registred for
Device.prototype.setEventRegistry = function (queue, callback)
{
    //Can't release, we aren't attached
  if ( this.isAttached == false )
    return false;

    //If they gave me an array of queue items, compress them down to an int
  queue = compressQueueList( queue );

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Configuration services, sets mask on Spokes that defines from what queues we are going to receive events after Device.prototype.events function call
  // API: http://127.0.0.1:32001/Spokes/EventManager/SetRegistry?{sess}=sess&{queue}=queue
  // Params: {sess} is the unique identifier of a session.
  // Params: {queue} Or'ed queue numbers (Unknown = 0, DeviceStateChange = 1, HeadsetStateChange = 2, HeadsetButtonPressed = 4, BaseStateChange = 8, BaseButtonPressed = 16, CallStateChange = 32, ATDStateChange = 64)
  // Returns: int, returns {queue} value
  $.getJSON(this.Path + "/EventManager/SetRegistry" +
                                            "?sess=" + this.Sess_Id +
                                            "&queue=" + queue +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Integer )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Adds a list of queues from our registry
Device.prototype.addEventRegistry = function (queue, callback)
{
    //Can't release, we aren't attached
  if ( this.isAttached == false )
    return false;

    //If they gave me an array of queue items, compress them down to an int
  queue = compressQueueList( queue );

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Configuration services, sends "event queue mask" integer that will be OR'ed with one previously defined in Spokes
  // API: http://127.0.0.1:32001/Spokes/EventManager/AddRegistry?{sess}=sess&{queue}=queue
  // Params: {sess} is the unique identifier of a session.
  // Params: {queue} Or'ed queue numbers (Unknown = 0, DeviceStateChange = 1, HeadsetStateChange = 2, HeadsetButtonPressed = 4, BaseStateChange = 8, BaseButtonPressed = 16, CallStateChange = 32, ATDStateChange = 64)
  // Returns: int, returns value of newly created "event queue mask" 
  $.getJSON(this.Path + "/EventManager/AddRegistry" + 
                                            "?sess=" + this.Sess_Id +
                                            "&queue=" + queue +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Integer )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Removes a list of queues from our registry
Device.prototype.removeEventRegistry = function (queue, callback)
{
    //Can't release, we aren't attached
  if ( this.isAttached == false )
    return false;

    //If they gave me an array of queue items, compress them down to an int
  queue = compressQueueList( queue );

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Configuration services, sends "event queue mask" integer that will be subtracted from mask previously defined in Spokes
  // API: http://127.0.0.1:32001/Spokes/EventManager/RemoveRegistry?{sess}=sess&{queue}=queue
  // Params: {sess} is the unique identifier of a session.
  // Params: {queue} Or'ed queue numbers (Unknown = 0, DeviceStateChange = 1, HeadsetStateChange = 2, HeadsetButtonPressed = 4, BaseStateChange = 8, BaseButtonPressed = 16, CallStateChange = 32, ATDStateChange = 64)
  // Returns: int, returns value of newly created "event queue mask" 
  $.getJSON(this.Path + "/EventManager/RemoveRegistry" + 
                                            "?sess=" + this.Sess_Id +
                                            "&queue=" + queue +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Integer )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Sets the time to live for all event queue messages
Device.prototype.setGlobalTTL = function( ttl, callback )
{
    //Can't release, we aren't attached
  if ( this.isAttached == false )
    return false;

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Configuration services. Sets amount of time events are going to be cached on Spokes. This value is set in every queue
  // API: http://127.0.0.1:32001/Spokes/EventManager/GlobalTTL?{sess}=sess&{ttl}=ttl
  // Params: {sess} is the unique identifier of a session.
  // Params: {ttl} int, time in milliseconds
  // Returns: int, new TTL
  $.getJSON(this.Path + "/EventManager/GlobalTTL" + 
                                            "?sess=" + this.Sess_Id + 
                                            "&ttl="+ ttl +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Integer )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Sets the max number of events per queue, for all queues
Device.prototype.setGlobalMaxEvents = function( max, callback )
{
    //Can't release, we aren't attached
  if ( this.isAttached == false )
    return false;

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Configuration services. Sets maximum event count that can be cached in Spokes. This value is set in every event queue.
  // API: http://127.0.0.1:32001/Spokes/EventManager/GlobalMaxCount?{sess}=sess&{max}=max
  // Params: {sess} is the unique identifier of a session.
  // Params: {max} int, maximum number of events
  // Returns: int, new max count
  $.getJSON(this.Path + "/EventManager/GlobalMaxCount" + 
                                            "?sess=" + this.Sess_Id + 
                                            "&max="+ max +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Integer )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Sets the time to live for a list of queues
Device.prototype.setQueueTTL = function( queue, ttl, callback )
{
    //Can't release, we aren't attached
  if ( this.isAttached == false )
    return false;

    //If they gave me an array of queue items, compress them down to an int
  queue = compressQueueList( queue );

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Configuration services. Sets amount of time events are going to be cached on Spokes. This value is set only for queue defined in {queue} param
  // API: http://127.0.0.1:32001/Spokes/EventManager/TTL?{sess}=sess&{ttl}=ttl&{queue}=queue
  // Params: {sess} is the unique identifier of a session.
  // Params: {queue} Or'ed queue numbers (Unknown = 0, DeviceStateChange = 1, HeadsetStateChange = 2, HeadsetButtonPressed = 4, BaseStateChange = 8, BaseButtonPressed = 16, CallStateChange = 32, ATDStateChange = 64)
  // Params: {ttl} int, time in milliseconds
  // Returns: int, new TTL
  $.getJSON(this.Path + "/EventManager/TTL" + 
                                            "?sess=" + this.Sess_Id + 
                                            "&queue="+ queue +
                                            "&ttl="+ ttl +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Integer )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Sets the max number of events per queue, for the list of queues given
Device.prototype.setQueueMaxEvents = function( queue, max, callback )
{
    //Can't release, we aren't attached
  if ( this.isAttached == false )
    return false;

    //If they gave me an array of queue items, compress them down to an int
  queue = compressQueueList( queue );

    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Configuration services. Sets maximum event count that can be cached in Spokes. This value is set only for queue defined in {queue} param
  // API: http://127.0.0.1:32001/Spokes/EventManager/MaxCount?{sess}=sess&{queue}=queue&{max}=max
  // Params: {sess} is the unique identifier of a session.
  // Params: {queue} Or'ed queue numbers (Unknown = 0, DeviceStateChange = 1, HeadsetStateChange = 2, HeadsetButtonPressed = 4, BaseStateChange = 8, BaseButtonPressed = 16, CallStateChange = 32, ATDStateChange = 64)
  // Params: {max} int, maximum number of events in specified queue
  // Returns: int, new max count
  $.getJSON(this.Path + "/EventManager/MaxCount" + 
                                            "?sess=" + this.Sess_Id + 
                                            "&queue="+ queue +
                                            "&max="+ max +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Integer )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}
//Define CallState
function SessionCallState() {}
SessionCallState.Unknown            = 0;
SessionCallState.AcceptCall         = 1;
SessionCallState.TerminateCall      = 2;
SessionCallState.HoldCall           = 3;
SessionCallState.Resumecall         = 4;
SessionCallState.Flash              = 5;
SessionCallState.CallInProgress     = 6;
SessionCallState.CallRinging        = 7;
SessionCallState.CallEnded          = 8;
SessionCallState.TransferToHeadSet  = 9;
SessionCallState.TransferToSpeaker  = 10;
SessionCallState.MuteON             = 11;
SessionCallState.MuteOFF            = 12;
SessionCallState.MobileCallRinging  = 13;
SessionCallState.MobileCallInProgress = 14;
SessionCallState.MobileCallEnded    = 15;
SessionCallState.Don                = 16;
SessionCallState.Doff               = 17;
SessionCallState.CallIdle           = 18;
SessionCallState.Play               = 19;
SessionCallState.Pause              = 20;
SessionCallState.Stop               = 21;
SessionCallState.DTMFKey            = 22;
SessionCallState.RejectCall         = 23;

SessionCallState.Lookup = Array();
SessionCallState.Lookup[SessionCallState.Unknown] = "Unknown";
SessionCallState.Lookup[SessionCallState.AcceptCall] = "AcceptCall";
SessionCallState.Lookup[SessionCallState.TerminateCall] = "TerminateCall";
SessionCallState.Lookup[SessionCallState.HoldCall] = "HoldCall";
SessionCallState.Lookup[SessionCallState.Resumecall] = "Resumecall";
SessionCallState.Lookup[SessionCallState.Flash] = "Flash";
SessionCallState.Lookup[SessionCallState.CallInProgress] = "CallInProgress";
SessionCallState.Lookup[SessionCallState.CallRinging] = "CallRinging";
SessionCallState.Lookup[SessionCallState.CallEnded] = "CallEnded";
SessionCallState.Lookup[SessionCallState.TransferToHeadSet] = "TransferToHeadSet";
SessionCallState.Lookup[SessionCallState.TransferToSpeaker] = "TransferToSpeaker";
SessionCallState.Lookup[SessionCallState.MuteON] = "MuteON";
SessionCallState.Lookup[SessionCallState.MuteOFF] = "MuteOFF";
SessionCallState.Lookup[SessionCallState.MobileCallRinging] = "MobileCallRinging";
SessionCallState.Lookup[SessionCallState.MobileCallInProgress] = "MobileCallInProgress";
SessionCallState.Lookup[SessionCallState.MobileCallEnded] = "MobileCallEnded";
SessionCallState.Lookup[SessionCallState.Don] = "Don";
SessionCallState.Lookup[SessionCallState.Doff] = "Doff";
SessionCallState.Lookup[SessionCallState.CallIdle] = "CallIdle";
SessionCallState.Lookup[SessionCallState.Play] = "Play";
SessionCallState.Lookup[SessionCallState.Pause] = "Pause";
SessionCallState.Lookup[SessionCallState.Stop] = "Stop";
SessionCallState.Lookup[SessionCallState.DTMFKey] = "DTMFKey";
SessionCallState.Lookup[SessionCallState.RejectCall] = "RejectCall";
  //Define all the audio states that exist
function SpokesAudioType() {}
SpokesAudioType.MonoOn        = 1;       
SpokesAudioType.MonoOff       = 2;
SpokesAudioType.StereoOn      = 3;
SpokesAudioType.StereoOff     = 4;
SpokesAudioType.MonoOnWait    = 5;
SpokesAudioType.StereoOnWait  = 6;

  //Create a lookup for the textual names of the enum
SpokesAudioType.Lookup = Array();
SpokesAudioType.Lookup[SpokesAudioType.MonoOn] = "MonoOn";
SpokesAudioType.Lookup[SpokesAudioType.MonoOff] = "MonoOff";
SpokesAudioType.Lookup[SpokesAudioType.StereoOn] = "StereoOn";
SpokesAudioType.Lookup[SpokesAudioType.StereoOff] = "StereoOff";
SpokesAudioType.Lookup[SpokesAudioType.MonoOnWait] = "MonoOnWait";
SpokesAudioType.Lookup[SpokesAudioType.StereoOnWait] = "StereoOnWait";

  //Define my response types
function SpokesResponseType() {}
SpokesResponseType.Unknown             = 0;
SpokesResponseType.Error               = 1;
SpokesResponseType.Bool                = 2;
SpokesResponseType.Integer             = 3;
SpokesResponseType.DeviceInfo          = 4;
SpokesResponseType.DeviceInfoArray     = 5;
SpokesResponseType.DeviceEventArray    = 6;
SpokesResponseType.SessionHash         = 7;
SpokesResponseType.String              = 8;
SpokesResponseType.CallManagerState    = 9;
SpokesResponseType.CallStateArray      = 10;
SpokesResponseType.ContactArray        = 11;
SpokesResponseType.StringArray         = 12;

  //Define my response class
function SpokesResponse( obj ) 
{
    //Copy the JSON data into this object
  this.Type         = obj["Type"];
  this.Type_Name    = obj["Type_Name"];
  this.Description  = obj["Description"];
  this.isError      = obj["isError"];
  this.isValid      = true;
  this.Err          = null;
  this.Result       = null;

    //If we have an error, null the result and populate error, else opposite
  if ( this.isError )
  {
    this.Err = new SpokesError( obj["Err"] );
    return;
  }

    //Store a user result object
  switch ( this.Type )
  {
      //Object types that js knowns about
    case SpokesResponseType.Bool:
    case SpokesResponseType.Integer:
    case SpokesResponseType.SessionHash:
    case SpokesResponseType.String:
    case SpokesResponseType.CallManagerState:
      this.Result = obj["Result"];
      break;

      //Create a device info object
    case SpokesResponseType.DeviceInfo:
      this.Result = new SpokesDeviceInfo( obj["Result"] );
      break;

      //Create an array of device info objects
    case SpokesResponseType.DeviceInfoArray:
        //Store my json array and get my result ready to handle data
      var ary = obj["Result"];
      this.Result = new Array();

        //Craete device info objects and store them
      for ( var i = 0; i < ary.length; i++ )
        this.Result[i] = new SpokesDeviceInfo( ary[i] );
      break;

      //Store an array of events
    case SpokesResponseType.DeviceEventArray:
        //Store my json array and get my result ready to handle data
      var ary = obj["Result"];
      this.Result = new Array();

        //Craete device info objects and store them
      for ( var i = 0; i < ary.length; i++ )
        this.Result[i] = new SpokesEvent( ary[i] );
      break;

      //Returns an array of call states
    case SpokesResponseType.CallStateArray:
    case SpokesResponseType.StringArray:
        //Store my json array and get my result ready to handle data
      var ary = obj["Result"];
      this.Result = new Array();

        //Craete device info objects and store them
      for ( var i = 0; i < ary.length; i++ )
        this.Result[i] = ary[i];
      break;

      //Returns an array of contact arrays
    case SpokesResponseType.ContactArray:
        //Store my json array and get my result ready to handle data
      var ary = obj["Result"];
      this.Result = new Array();

        //Craete device info objects and store them
      for ( var i = 0; i < ary.length; i++ )
        this.Result[i] = new SpokesContact( ary[i] );
      break;

    default:
      alert("Invalid object type sent");
      break;
  }
}

  //Creates an device info instance
function SpokesDeviceInfo( obj )
{
  this.Uid              = obj["Uid"];
  this.DevicePath       = obj["DevicePath"];
  this.InternalName     = obj["InternalName"];
  this.IsAttached       = obj["IsAttached"];
  this.ManufacturerName = obj["ManufacturerName"];
  this.ProductId        = obj["ProductId"];
  this.ProductName      = obj["ProductName"];
  this.SerialNumber     = obj["SerialNumber"];
  this.VendorId         = obj["VendorId"];
  this.VersionNumber    = obj["VersionNumber"]; //for backward compatibility
  this.USBVersionNumber         = obj["USBVersionNumber"];
  this.BaseFirmwareVersion      = obj["BaseFirmwareVersion"];
  this.BluetoothFirmwareVersion = obj["BluetoothFirmwareVersion"];
  this.RemoteFirmwareVersion    = obj["RemoteFirmwareVersion"];
}

  //Stores the spokes event types that can exist
function SpokesEventType() {}
SpokesEventType.DeviceStateChange       = 1;
SpokesEventType.HeadsetStateChange      = 2;
SpokesEventType.HeadsetButtonPressed    = 4;
SpokesEventType.BaseStateChange         = 8;
SpokesEventType.BaseButtonPressed       = 16;
SpokesEventType.CallStateChange         = 32;
SpokesEventType.ATDStateChange          = 64;

  //Creates a device event instance
function SpokesEvent( obj )
{
  this.Event_Log_Type_Name  = obj["Event_Log_Type_Name"];
  this.Event_Log_Type_Id    = obj["Event_Log_Type_Id"];
  this.Event_Name           = obj["Event_Name"];
  this.Event_Id             = obj["Event_Id"];
  this.Timestamp            = obj["Timestamp"];
  this.Age                  = obj["Age"];
}

  //Defines a spokes error
function SpokesErrorType() {}
SpokesErrorType.Unknown         = 0;
SpokesErrorType.Invalid_Uid     = 1;
SpokesErrorType.Exception       = 2;
SpokesErrorType.Invalid_Session = 3;
SpokesErrorType.Server_Offline  = 4;

  //Creates a spokes error object
function SpokesError( obj )
{
  this.Type = obj["Type"];
  this.Description = obj["Description"];
  this.Error_Code = obj["Error_Code"];
}

  //Returns a spokes contact
function SpokesContact( obj )
{
  this.Id = obj["Id"];
  this.Name = obj["Name"];
  this.Email = obj["Email"];
  this.Phone = obj["Phone"];
  this.SipUri = obj["SipUri"];
  this.WorkPhone = obj["WorkPhone"];
  this.HomePhone = obj["HomePhone"];
  this.MobilePhone = obj["MobilePhone"];
  this.FriendlyName = obj["FriendlyName"];
}

  //A callId Object
function SpokesCallId( obj )
{
  this.Id = obj["Id"];
  this.InConference = obj["InConference"];
  this.ConferenceId = obj["ConferenceId"];
}

/////////////////////////////////////////////////////
// SessionManager

// Plugin
function Plugin( path )
{
  this.Path = path;
  this.Sess_Id = "";
  this.isAttached = false;
}

  //List out all plugins
Plugin.prototype.pluginList = function( callback )
{
    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Session services. Returns list of all plugins that are installed in Spokes, together with those registered from REST. 
  // API: http://127.0.0.1:32001/Spokes/SessionManager/PluginList
  // Returns: Array of plugin names
  $.getJSON(this.Path+"/SessionManager/PluginList?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.StringArray )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Register a plugin
Plugin.prototype.register = function( name, callback )
{
    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Session services. Register plugin to spokes. This is needed before using any Call Services functionality
  // API: http://127.0.0.1:32001/Spokes/SessionManager/Register/{name}
  // Params: {name} Plugin name
  // Returns: true or false (success or failure)
  $.getJSON(this.Path+"/SessionManager/Register/"+ name +"?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Unregister a plugin
Plugin.prototype.unRegister = function( name, callback )
{
    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Session services. Unregister plugin from Spokes
  // API: http://127.0.0.1:32001/Spokes/SessionManager/UnRegister/{name}
  // Params: {name} Plugin name
  // Returns: true or false (success or failure)
  $.getJSON(this.Path+"/SessionManager/UnRegister/"+ name +"?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

  //Set that the plugin is active
Plugin.prototype.isActive = function( name, active, callback )
{
    //Register the callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Session services. Seting state of plugin to "Active" or "No Active" state
  // API: http://127.0.0.1:32001/Spokes/SessionManager/IsActive/{name}?{active}=active
  // Params: {name} Plugin name
  // Params: {active} true or false, 
  // Returns: true or false (success or failure)
  $.getJSON(this.Path+"/SessionManager/IsActive/"+ name +
                "?active="+ active +
                "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}
/////////////////////////////////////
// Call services

//callManagerState
Plugin.prototype.callManagerState = function(callback )
{
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Call services. Query status of all calls on Spokes
  // API: http://127.0.0.1:32001/Spokes/CallServices/CallManagerState
  // Returns: object that contains list of all current calls in Spokes
  $.getJSON(this.Path + "/CallServices/CallManagerState?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.CallManagerState )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}
// session events
Plugin.prototype.sessionEvents = function(callback )
{
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Call services. Query for list of all Session Manager CallStateChanged events
  // API: http://127.0.0.1:32001/Spokes/CallServices/Events
  // Returns: List of strings. Possible string values are defined in SessionCallState object
  $.getJSON(this.Path + "/CallServices/Events?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.StringArray  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}
// call call events
Plugin.prototype.sessionCallEvents = function( name, callback )
{
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Call services. Query for list of all Session Manager CallStateChanged events
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/SessionManagerCallEvents
  // Params: {name} Plugin name
  // Returns: List of strings. Possible string values are defined in SessionCallState object
  $.getJSON(this.Path + "/CallServices/"+ name +"/SessionManagerCallEvents?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.StringArray  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// callEvents
Plugin.prototype.callEvents = function( name, callback )
{
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Call services. Query for list of all CallStateChanged events for plugin registered with {name} 
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/CallEvents
  // Params: {name} Plugin name
  // Returns: List of CallState objects
  $.getJSON(this.Path + "/CallServices/"+ name +"/CallEvents?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.CallStateArray  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// callRequests 
Plugin.prototype.callRequests = function( name, callback )
{
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  // Call services. Query for list of all CallRequested events for plugin registered with {name} 
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/CallRequests
  // Params: {name} Plugin name
  // Returns: List of Contact objects
  $.getJSON(this.Path + "/CallServices/"+ name +"/CallRequests?callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.ContactArray  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}
// incomingCall
Plugin.prototype.incomingCall = function( name, callID, contact, tones, route, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id ) || contact == undefined || contact.getName() != "SpokesContact" || !isNumber( tones) || !isNumber( route) ){
    callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
    return false;
  }
  
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  
  callID = JSON.stringify(callID); 
  contact = JSON.stringify(contact); 
  
  // Call services. Notifies Spokes about an incoming softphone call with a unique CallID.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/IncomingCall?{callID}=callID&{contact}=contact&{tones}=tones&{route}=route
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Params: {contact} Object of SpokesContact type. Containes Name property of string type
  // Params: {tones} Unknown = 0
  // Params: {route} ToHeadset = 0, ToSpeaker = 1 
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/IncomingCall" + 
                                            "?callID=" + callID +
                                            "&contact="+ contact +
                                            "&tones="+ tones +
                                            "&route="+ route +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}
// outgoingCall
Plugin.prototype.outgoingCall = function( name, callID, contact,  route, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id ) || contact == undefined || contact.getName() != "SpokesContact" || !isNumber( route)) {
		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );
  
  callID = JSON.stringify(callID); 
  contact = JSON.stringify(contact); 
  
  // Call services. Notifies Spokes about an outgoing softphone call.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/OutgoingCall?{callID}=callID&{contact}=contact&{route}=route
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Params: {contact}Object of SpokesContact type. Containes Name property of string type
  // Params: {route} ToHeadset = 0, ToSpeaker = 1 
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/OutgoingCall" + 
                                            "?callID=" + callID +
                                            "&contact="+ contact +
                                            "&route="+ route +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// terminateCall
Plugin.prototype.terminateCall = function( name, callID, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id ) ){
  		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );
  
  callID = JSON.stringify(callID); 

  // Call services. Notifies Spokes about a call terminated in the softphone GUI.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/TerminateCall?{callID}=callID
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/TerminateCall" + 
                                            "?callID=" + callID +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// answerCall
Plugin.prototype.answerCall = function( name, callID, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id ) ){
  		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );
  
  callID = JSON.stringify(callID); 

  // Call services. Notifies Spokes about a softphone call answered via the softphone GUI.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/AnswerCall?{callID}=callID
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/AnswerCall" + 
                                            "?callID=" + callID +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// holdCall
Plugin.prototype.holdCall = function( name, callID, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id ) ) {
  		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );
  
  callID = JSON.stringify(callID); 

  // Call services. Notifies Spokes about a softphone call held via the softphone GUI.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/HoldCall?{callID}=callID
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/HoldCall" + 
                                            "?callID=" + callID +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// resumeCall
Plugin.prototype.resumeCall = function( name, callID, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id ) ){
  		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );
  
  
  callID = JSON.stringify(callID); 

  // Call services.Notifies Spokes about a softphone call resumed via the softphone GUI.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/ResumeCall?{callID}=callID
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/ResumeCall" + 
                                            "?callID=" + callID +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// muteCall
Plugin.prototype.muteCall = function( name, callID, muted, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id ) ) {
  		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );
  
  callID = JSON.stringify(callID); 

  // Call services. Notifies Spokes about a softphone call muted or unmuted via the softphone GUI.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/MuteCall?{callID}=callID&{muted}=muted
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Params: {muted} true or false. Defines is call muted or unmuted
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/MuteCall" + 
                                            "?callID=" + callID +
                                            "&muted=" + muted +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// insertCall
Plugin.prototype.insertCall = function( name, callID, contact, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id ) || contact == undefined || contact.getName() != "SpokesContact" ) {
  		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );
  
  callID = JSON.stringify(callID); 
  contact = JSON.stringify(contact); 

  // Call services. Notifies about a softphone call that is already active. Applicable only to softphones that provide notification about already-active calls as part of their SDK.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/InsertCall?{callID}=callID&{contact}=contact
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Params: {contact} Object of SpokesContact type. Containes Name property of string type
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/InsertCall" + 
                                            "?callID=" + callID +
                                            "&contact=" + contact +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// setAudioRoute
Plugin.prototype.setAudioRoute = function( name, callID, route, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id ) ||!isNumber( route)) {
		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );
  
  if( callID.getName() != "SpokesCallId" )
    return false;
  
  callID = JSON.stringify(callID); 

  // Call services. Sets the audio route (to the speaker or to the headset).
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/SetAudioRoute?{callID}=callID&{route}=route
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Params: {route} ToHeadset = 0, ToSpeaker = 1 
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/SetAudioRoute" + 
                                            "?callID=" + callID +
                                            "&route=" + route +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// setConferenceId
Plugin.prototype.setConferenceId = function( name, callID, callback )
{
    // Error handling
  if( callID == undefined || callID.getName() != "SpokesCallId" || !isNumber( callID.Id )){
  		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );
  
  callID = JSON.stringify(callID); 

  // Call services.Notifies the CallManager about a conference call.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/SetConferenceId?{callID}=callID
  // Params: {name} Plugin name
  // Params: {callID} Object of SpokesCallId type. Containes Id property of int type
  // Params: {route} ToHeadset = 0, ToSpeaker = 1 
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/SetConferenceId" + 
                                            "?callID=" + callID +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}

// make call
Plugin.prototype.makeCall = function( name, contact, callback )
{
    // Error handling
  if( contact == undefined || contact.getName() != "SpokesContact" ) {
  		callback( new SpokesResponse( {isError:true, Err: {Type:2, Description:"Invalid parameters", Error_Code:0} } ) );
		return false;
  }
		
    //Register callback
  var action = new SpokesAction( callback );
  SpokesAction.Action_List.unshift( action );

  contact = JSON.stringify(contact); 
 
  // Call services.Notifies the CallManager about a conference call.
  // API: http://127.0.0.1:32001/Spokes/CallServices/{name}/MakeCall?{contact}=contact
  // Params: {name} Plugin name
  // Params: {contact} Object of SpokesContact type. Containes Name property of string type
  // Returns: true or false (success or failure)
  $.getJSON(this.Path + "/CallServices/" + name + "/MakeCall" + 
                                            "?contact=" + contact +
                                            "&callback=?",
            function(data)
            { 
                //Create a nice object, and ensure its of the right type
              var resp = new SpokesResponse( data );
              if ( resp.Type != SpokesResponseType.Bool  )
                resp.isValid = false;

                //Pass my result back to the user
              action.isValid = false;
              if ( action.Callback != null && action.Callback != undefined )
                action.Callback( resp ); 
            } );

  return true;
}
var getName = function() { 
   var funcNameRegex = /function (.{1,})\(/;
   var results = (funcNameRegex).exec((this).constructor.toString());
   return (results && results.length > 1) ? results[1] : "";
};
SpokesCallId.prototype.getName = getName;
SpokesContact.prototype.getName = getName;
var JSON = JSON || {};
//  in case if browser don't support (IE7) native JSON implement JSON.stringify serialization
JSON.stringify = JSON.stringify || function(obj) {
    var t = typeof (obj);
    if (t != "object" || obj === null) {
        if (t == "string")
            obj = '"' + obj + '"';
        return String(obj);
    } else {
        var n, v, json = [], arr = (obj && obj.constructor == Array);
        for (n in obj) {
            v = obj[n];
			if( v != undefined) {
				t = typeof (v);
				if (t == "string")
					v = '"' + v + '"';
				else if (t == "object" && v !== null)
					v = JSON.stringify(v);
				else 
					continue; // skip all other properties
				json.push((arr ? "" : '"' + n + '":') + String(v));
			}
        }
        return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
    }
};
function isNumber(n) {
  return n == parseInt(n);
}

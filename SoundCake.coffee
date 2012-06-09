spokes = null
plugin_registered = false
plugin_name = "SoundCake"
callid = 0

connectToSpokes = () -> 
	# Create my spokes object
	spokes = new Spokes("http://localhost:32001/Spokes")
	
	# get list of attached devices
	spokes.Device.deviceList( (result) -> 
		# create table of all devices found if no errors
		if not result.isError
			if result.Result[0] isnt null
				# attach to device
				spokes.Device.attach(result.Result[0].Uid, controlInterface)
			
				# start polling device for events...
				pollDeviceEvents()
			else
				alert("Error: Device was null on connecting to Spokes. Is there a Plantronics device connects?")
		else
			alert("Error connecting to Spokes.")
		
		return
	)
	return

# creates a control interface
controlInterface = (session) ->
	if session.isError or not spokes.Device.isAttached
		alert("Session Registration Error")
	else
		registerPlugin()
	
	return

# Register a Spokes Plugin session to get access to Call Services and Session Manager interfaces
registerPlugin = () ->
	# choose to register or unregister the plugin
	if not plugin_registered
		# register new plugin to Spokes
		spokes.Plugin.register(plugin_name, (result) ->
			if not result.isError
				# set plugin active status to true
				spokes.Plugin.isActive(plugin_name, true, (result) ->
					if not result.isError
						# plugin registered and active
						plugin_registered = true
					else
						alert("Error checking if plugin is active: " + result.Err.Description)
					
					return
				)
			else
				alert("Error registering plugin: " + result.Err.Description)
			
			return
		)
	return

unregisterPlugin = () ->
	spokes.Plugin.unRegister(plugin_name)
	plugin_registered = false
	return
	
disconnectFromSpokes = () ->
	unregisterPlugin()
	spokes.Device.release( (result) ->
		if result.isError
			alert("Error releasing device")
		
		spokes = null
		return
	)
	return
	
pollDeviceEvents = () -> 
	setInterval( () -> 
		if spokes is null 
			return
		if not spokes.Device.isAttached
			return
		
		# Make an events call
		spokes.Device.events( (result) ->
			if result.isError
				alert("Error polling for events: " + result.Err.Description)
			else
				# display list of events collected from REST service
				if result.Result.length > 0
					i = 0
					while i < result.Result.length
						switch result.Result[i].Event_Name
							when "Don" then window.Grooveshark.play()
							when "Doff" then window.Grooveshark.pause()
							else 
						i++
				
			return
		)
		return
	, 2000)
	
	return
	
$(document).ready( () -> 
	connectToSpokes()
	return
)
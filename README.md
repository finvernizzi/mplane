[![mPlane](http://www.ict-mplane.eu/sites/default/files//public/mplane_final_256x_0.png)](http://www.ict-mplane.eu/)

#mPlane nodeJS reference library 
[![](https://travis-ci.org/finvernizzi/mplane.svg)](https://travis-ci.org/finvernizzi/mplane)


This is the [mPlane](http://www.ict-mplane.eu/) nodejs library. 
The architecture and software structure is freely inspired by [mPlane reference implementation](http://fp7mplane.github.io/protocol-ri/) written in python by Brian Trammell <brian@trammell.ch>.


#Installation

`npm install mplane`

#Usage example
In this example we set a simple capability for a pinger probe. First of all import the main mPlane library

```javascript
var mplane = require('mplane');

// The IP address of the pinger
var __MY_IP__ = "192.168.0.123";

// Initialize available primitives from the registry
mplane.Element.initialize_registry("registry.json");

// Create a new mPlane Capability
var pingerCapability = new mplane.Capability();

// Set the accepted time and periodicity
pingerCapability.set_when("now ... future / 1s");

// Add parameters with associated constraints
pingerCapability.add_parameter({
    type:"destination.ip4",
    constraints:"192.168.0.1 ... 192.168.0.254"
});
pingerCapability.add_parameter({
    type:"number",
    constraints:"1 ... 10"
});
pingerCapability.add_parameter({
        type:"source.ip4",
        constraints:__MY_IP__
});

// Add result columns
pingerCapability.add_result_column("delay.twoway")
    .set_metadata_value("System_type","Pinger")
    .set_metadata_value("System_version","0.1a")
    .set_metadata_value("System_ID","Lab test machine").update_token();
    
// Define a label
pingerCapability.set_label("DEMO pinger");
```

##Chainability
Each mPlane function supports chainability
For example you can define all the parameters in a single chain:
 
```javascript
// Add parameters with associated constraints
pingerCapability.add_parameter({
    type:"destination.ip4",
    constraints:"192.168.0.1 ... 192.168.0.254"
}).add_parameter({
    type:"number",
    constraints:"1 ... 10"
}).add_parameter({
        type:"source.ip4",
        constraints:__MY_IP__
});
```


#Transport

The base mPlane library implements the mPlane Information Model elements that can be used to realize messages to be carried over any protocol of choice (SSH, HTTP,...).
A nodejs HTTPS API has been implemented for basic usage (create and read elements) and can be find [here](https://github.com/finvernizzi/mplane_http_transport.git)

Please refer to the Examples directory for a working mPlane supervisor and pinger.

#Documentation

Please refer to the API reference [mPlane nodejs API](http://finvernizzi.github.io/mplane/)

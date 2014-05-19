/**
 * Pinger probe implementing the Capability push, Specification pull model
 *
 * @author fabrizio.invernizzi@telecomitalia.it
 * @version 0.0.1a
 *
 */

var exec = require('child_process').exec,
    mplane = require('mplane'),
    _ = require("lodash"),
    request = require("request"),
    http = require("http"),
    inquirer = require("inquirer"),
    os=require('os'),
    url = require('url'),
    prettyjson = require('prettyjson'),
    async = require("async");

var ifaces=os.networkInterfaces();
var ipAdresses = [];
for (var dev in ifaces) {
    var alias=0;
    ifaces[dev].forEach(function(details){
        if (details.family=='IPv4') {
            //console.log(dev+(alias?':'+alias:''),details.address);
            ipAdresses.push(details.address);
            ++alias;
        }
    });
}

var __MY_IP__ = "127.0.0.1";
var supervisorIP = "127.0.0.1";
var supervisorPort = 2426;
var specificationLink = "";

var questions = [
    {
        type: "list",
        name: "ipSource",
        message: "Select your source IP address",
        choices: ipAdresses,
        filter: function( val ) { return val.toLowerCase(); }
    }
];

prompt = inquirer.prompt( questions, function( answers ) {
    __MY_IP__ = answers.ipSource;

    // Initialize available primitives from the registry
    mplane.Element.initialize_registry("registry.json");

    // Source address and destination parameters initialized from the registry
    var sourceAddress = new mplane.Element("source.ip");
    //  My source address should never be changed!
    sourceAddress.addConstraint( __MY_IP__ );

    var destinationAddress = new mplane.Element("destination");
    destinationAddress.addConstraint("10.34.32.0 ... 10.34.32.255");

    var numberOfEchoRequests = new mplane.Element("number");
    numberOfEchoRequests.addConstraint("1 ... 10");

    // Ping result - MEAN RTT
    var meanRTT = new mplane.Element("delay.twoway");

    var statement = new mplane.Statement({verb:mplane.Statement.VERB_MEASURE});
    statement.add_parameter("My source address" , sourceAddress , __MY_IP__);

    // Here we should set a valid ip address in accordance with the constraints on the destinationAddress
    statement.add_parameter("The destination address" , destinationAddress , __MY_IP__);
    statement.add_parameter("The number of echo requests the pinger should send" , numberOfEchoRequests , 1);
    statement.add_result_column("Mean RTT", meanRTT);

    // THE CAPABILITY we will announce
    var capability = new mplane.Capability(statement);

    registerToSupervisor(capability);
    checkForSpecifications(10000);
});


function mean(values){
    var sum = 0 , elements = 0;
    _.each(values , function(val , index){
        if (!_.isNaN(val)){
            sum += val*1;
            elements +=1;
        }
    });
    return (sum/elements);
}

function doAPing(destination , Wait , requests , callback){
 exec("ping -S " + __MY_IP__ + "  -W "+ Wait  +" -c " + requests + " " + destination  + " | grep from",
  function (error, stdout, stderr) {
      var times = [];
    if (!stdout)
        console.log("No answer")
    else{
        var replies = stdout.split(/\n/);
        _.each(replies , function(row , index){
            process.stdout.write(". ");
            var vals = row.split(/[\t\s]+/);
            _.each(vals, function(el , index){
                var element = el.split("=");
                switch(element[0]){
                    case "time":
                        times.push(element[1]);
                        break;
                    default:
                        // nothing to do here
                }
            });
        });
        console.log(mean(times))
        callback(null, mean(times));
        //console.log("Mean RTT:"+mrtt);
        //return mrtt;
    }
    if (error !== null) {
      callback(error , null);
    }
  });
}

/**
 * POST to the supervisor all the probe information
 * @param capability
 */
function registerToSupervisor( capability) {
    // Serialize the capability Object
    var post_data = capability.to_dict();

    var post_options = {
        path: '/register',
        method: 'POST',
        host: supervisorIP,
        port: supervisorPort,
        followRedirect:false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': post_data.length
        }
    };

    // Set up the request
    var post_req = http.request(post_options, function(res) {
        // We expect a redirect to the Specification url
        if (res.statusCode == 302){
            console.log("The supervisor answered with:");
            console.log(res.headers.location);
            specificationLink = res.headers.location;
        }else{
            console.log("Unable to register to the supervisor. May be we are already registered?("+res.statusCode+")");
        }
    });

    // post the data
    post_req.write(post_data);
    post_req.end();
}

function checkForSpecifications(period){
    setInterval(function(){

        specificationUrlDetails = url.parse(specificationLink, true);
        var get_options = {
            path: specificationUrlDetails.path,
            method: 'GET',
            host: specificationUrlDetails.hostname,
            port: specificationUrlDetails.port,
            followRedirect:false
        };
        if (!specificationUrlDetails){
            console.log("ERROR")
            return;
        }

        var req = http.get(get_options, function(res) {
            // Buffer the body entirely for processing as a whole.
            var bodyChunks = [];
            var spec = null;
            res.on('data', function(chunk) {
                bodyChunks.push(chunk);
            }).on('end', function() {
                body = Buffer.concat(bodyChunks);
                if (body == "NOTHING for you"){
                    console.log("NO specification ... nothing to do!");
                }else{
                    spec = JSON.parse(body);
                    var dest = spec._params['The destination address']._value;
                    var reqNum = spec._params['The number of echo requests the pinger should send']._value;

                    async.waterfall([
                        function(callback){
                            console.log("------------------------------------------");
                            console.log("So i should work...")
                            doAPing(dest, 4 , reqNum , callback);
                        }
                    ], function (err, meanRTT) {
                        console.log("CALCULATED:"+meanRTT);
                        postResultToSupervisor( spec , meanRTT);

                    });

                }
            })
        });

        req.on('error', function(e) {
            console.log('ERROR: ' + e.message);
        });

    } , period);
}

function postResultToSupervisor( specification , meanRTT) {
    var specificationUrlDetails = url.parse(specificationLink, true);
    var specSplit = specificationUrlDetails.path.split("=");
    var token = specSplit[1];

    // Create a result obj from the specification
    var result = new mplane.Result(specification);
    // Add the result comlumns
    if (_.isNaN(meanRTT))
        meanRTT = 0;
    result.add_result_column("meanRTT" , new mplane.Element("delay.twoway")).setValue({"meanRTT" : meanRTT});

    var post_data = result.to_dict();
    var post_options = {
        path: '/result/token='+token,
        method: 'POST',
        host: supervisorIP,
        port: supervisorPort,
        followRedirect:false,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': post_data.length
        }
    };

    // Set up the request
    var post_req = http.request(post_options, function(res) {
        if (res.statusCode == 200){
            console.log("The supervisor received the result of my work!");
        }else{
            console.log("Unable to send result to the supervisor ("+res.statusCode+")");
        }
        // Here since it is async
        console.log("------------------------------------------");
    });

    //console.log(post_data)
    // post the data
    post_req.write(post_data);
    post_req.end();

    return;
}
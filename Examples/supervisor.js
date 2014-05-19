/**
 * mPlane supervisor example
 *
 * @author fabrizio.invernizzi@telecomitalia.it
 * @version 0.0.1a
 *      Capability push, Specification pull paradigm ONLY
 *
 */


var mplane = require('mplane'),
    //cli = require('cli').enable('status','catchall'),
    express = require('express'),
    app = express(),
    connect = require('connect'),
    //prompt = require('prompt'),
    inquirer = require("inquirer"),
    _ = require("lodash"),
    prettyjson = require('prettyjson');
   // router = express.Router();


var LISTEN_PORT = 2426;
var LISTEN_IP = "127.0.0.1";

// List of probes registerd to this supervisor
// Each probe is identified by its unique token
var __registered_probes__ = {};
// List of required measures, indexed by probe token
// Capability push, Specification pull paradigm
var __required_specifications__ = {};


var __SPEC_STATUS_QUEUED_="queued";
var __SPEC_STATUS_PROBE_TAKEN_="taken";
var __SPEC_STATUS_GOT_RESULT="got_result";

// ---------------------------------------------------------------
// WEB server
// ---------------------------------------------------------------
app.use(connect.bodyParser({strict:false}));

/**
 * We have received a POST message with a register
 *
 */
// FIXME: the register path is not in the architecture specification
app.post('/register', function(req, res){
    var newToken = registerProbe(req.body);
    if (newToken){
        res.writeHead(302, {
            'Location': "http://"+LISTEN_IP+":"+LISTEN_PORT+"/specification/token="+newToken
        });
        res.end();
    }
    else{
        res.writeHead( 403, 'Already registered', {'content-type' : 'text/plain'});
        res.end( 'Already registered');
    }
});
var tokenReq = null;
app.param('token', function(req,res, next, token){
    tokenReq = null;
    var t = token.split("=");
    if (t[1])
        tokenReq = t[1];
    next();
});
app.get('/specification/:token', function(req, res){
    var r = "NOTHING for you";
    if (tokenReq) {
        if (__required_specifications__[tokenReq]){
            var specHashes = _.keys(__required_specifications__[tokenReq]);
            for (var specNum=0; specNum<specHashes.length; specNum++){
                var specHash = specHashes[specNum];
                if ((__required_specifications__[tokenReq][specHash].specification_status == __SPEC_STATUS_QUEUED_)) {
                    var spec = createSpecificationFromRegisteredSpecification(tokenReq, specHash);
                    // We need to be sure the spec is using the right token
                    spec.set_token(specHash);
                    __required_specifications__[tokenReq][specHash].specification_status = __SPEC_STATUS_PROBE_TAKEN_;
                    res.json(spec);
                    // One a time, so stop
                    specNum = specHashes.length;
                    r=null;
                }
            }
        }
    }
    if (r)
        res.send(403 , r);
});
app.post('/result/:token', function(req, res){
    var r = "NOTHING for you";
    var result = new mplane.Result(req.body);
    if (tokenReq) {
        __required_specifications__[tokenReq][result.get_token()] = result;
        __required_specifications__[tokenReq][result.get_token()].specification_status = __SPEC_STATUS_GOT_RESULT;
        res.send("OK");
    }
    else{
        res.send(403 , r);
    }
});

var server = app.listen(LISTEN_PORT , LISTEN_IP);


function registerProbe(probe){
    //FIXME: the get_token function is not exposed in mplane
    if (!__registered_probes__[probe._token]){
        __registered_probes__[probe._token] = probe;
        return probe._token;
    }
    return false;
}


// ---------------------------------------------------------------
// Start the prompt
// ---------------------------------------------------------------
motd();
cli();


var prompt;

function cli(){
    var prompt = "mPlane - "+LISTEN_IP+"@"+LISTEN_PORT+"#";
    var questions = [
        {
            type: "list",
            name: "cmd",
            message: prompt,
            choices: [ "Show", "Specifications" , new inquirer.Separator() , "Quit" ],
            filter: function( val ) { return val.toLowerCase(); }
        },
            {
                type: "list",
                name: "showType",
                message: prompt+" (SHOW) ",
                choices: [ "Probes", "Specifications" ],
                when: function(curCmd){ return (curCmd.cmd == "show");},
                filter: function( val ) { return val.toLowerCase(); }
            },
            {
                type: "list",
                name: "probeHash",
                message: prompt+"(SPECIFICATION) " ,
                choices: function(){
                    var h = _.keys(__registered_probes__);
                    if (h.length == 0)
                        return ["-- No Probes yet --"];
                    else
                        return h;
                },
                when: function(curCmd){return (curCmd.cmd == "specifications");},
                filter: function( val ) { return val.toLowerCase(); }
            }

    ];

    prompt = inquirer.prompt( questions, function( answers ) {
        switch (answers.cmd){
            case "quit":
                console.log("\nSEE YOU NEXT TIME!\n\n");
                server.close();
                return false;
                break;
            case "show":
                doShow(answers.showType);
                console.log("\n\n");
                cli();
                break;
            case "specifications":
                if (answers.probeHash == "-- no probes yet --"){
                    cli();
                    break;
                }else{
                    queueSpecification(answers.probeHash);
                    console.log("\n\n");
                }
                //cli();
                break;
            default:
               // cli();
        }
    });
}


function doShow(args){
    switch (args.toLowerCase()){
        case "probes":
            if (_.keys(__registered_probes__).length == 0){
                console.log("---> NO probes registered YET <---");
                return true;
            }
            _.forEach(__registered_probes__, function(vale , key , collection){
                console.log("-----------------------------------------------------------");
                console.log("---> ["+key+"] <---");
                console.log(prettyjson.render(__registered_probes__[key]));
                //console.log(__registered_probes__[key]);
            });
            return true;
            break;
        case "specifications":
            if (_.keys(__required_specifications__).length == 0){
                console.log("---> NO specification queued <---");
                return true;
            }else{
                showSpecifications();
                return true;
            }
            break;
        default:
            return true;
    }

    return true;
}

/**
 * Defines a probe measure
 * The number is internal and is derived from the registration order
 * From the number i can derive the token
 * @param probeNumber
 */
function queueSpecification(probeHash){
    if (typeof  probeHash == "undefined"){
        console.log("You should choose a probe");
        return true;
    }
    if (!__required_specifications__[probeHash])
        __required_specifications__[probeHash] = {}; // We can have multiple request for a single probe

    var spec = createSpecificationFromRegisteredProbe(probeHash);

    var inputParams = [ ];
    var paramNames = spec.parameter_names();

    var parameters = [];
    for (var i=0; i<paramNames.length ; i++) {
       parameters.push(spec.getParameter(paramNames[i])) ;
    }

    var msg = "";
    var defaultValue = "";
    //FIXME: it should work also with multiple contraints!!!
    _.forEach(parameters , function(par){
        var constr = par.getConstraints();
        var pn = par.getName().replace(/\s/gi , "_");

        switch (constr['0']._type){
            case "singleton":
                defaultValue = constr['0']._param;
                break;
            case "range":
                defaultValue = constr['0']._param.valA;
                break;
            case "list":
                defaultValue = constr['0']._param[0];
                break;
            default:
        }
        msg = par.getDescription() +" [" + constr['0'].unParse_constraint()+"]";

        inputParams.push(
            {
                type: "input",
                name: pn,
                message: msg || "TBD",
                validate: function(value){return (constr['0'].met_by(value));},
                default:defaultValue
            }
        )
    });

    // New prompt for input about parameters to be filled
    var paramsCli = inquirer.prompt( inputParams, function( userParams ) {
        //console.log(userParams);//OK!
        // Do not confuse the name of the parameter in the specification parameters obj with the parameter name in the parameter itself!
        for (var parNum=0 ; parNum<paramNames.length ; parNum++) {
            par = parameters[parNum];
            try {
                var parName = par.getName();
                //console.log(parName.replace(/\s/gi , "_"));
                //console.log(userParams[parName.replace(/\s/gi , "_")]);
                par.setValue(userParams[parName.replace(/\s/gi, "_")]);
                spec.setParameterValue(paramNames[parNum], userParams[parName.replace(/\s/gi, "_")]);
                spec.specification_status = __SPEC_STATUS_QUEUED_;
            } catch (e) {
                console.log(e)
            }
        }
        var specToken = spec.update_token();

        __required_specifications__[probeHash][specToken]= {};
        __required_specifications__[probeHash][specToken]= spec;
        console.log("Specification for "+probeHash+" QUEUED ("+specToken+")");
        cli();
    });
}

/**
 * Show queued specifications
 * @param probeNumber
 * @returns {boolean}
 */
function showSpecifications(probeHash){
    if (_.keys(__registered_probes__).length == 0){
        console.log("---> NO probes registered YET <---");
        return true;
    }

    // Are we asking for a specific probe or for all probes?
    if (!_.isUndefined(probeHash)){
        _.forEach(__registered_probes__ , function(hash) {
            showSpecificationForProbe(hash);
        });
    }
    else{
        var hashes = _.keys(__registered_probes__);
        _.forEach(hashes , function(hash){
            if (__required_specifications__[hash]){
                showSpecificationForProbe(hash);
                console.log( "\n");
            }
        });

        return true;
    }
}

function showSpecificationForProbe(probeHash){
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
    console.log("Queued specification for "+probeHash);
    var specHashes = _.keys(__required_specifications__[probeHash]);
    for (var specNum=0 ; specNum<specHashes.length ; specNum++){
        var specToken = specHashes[specNum];
        console.log("------> Specification "+specToken+" <-------");
        console.log(prettyjson.render(__required_specifications__[probeHash][specToken]));
        //console.log(prettyjson.render(specification));
    }
    //_.forEach(__required_specifications__[probeHash] , function(specification){
//        console.log("------> Specification "+specification.get_token()+" <-------");
//        console.log(prettyjson.render(specification));
        //console.log(specification);
    //});
    console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
}

function help(){
    console.log("SHOW probes");
    console.log("HELP");
}


function motd(){
    console.log("\n\n");
    console.log("           mPlane supervisor DEMO");
    console.log("\n\n");

}

function createSpecificationFromRegisteredProbe(probeHash){
    var statement = new mplane.Statement({verb:mplane.Statement.VERB_MEASURE});
    var params = __registered_probes__[probeHash]._params;
    var parNames = _.keys(params);
    _.forEach(parNames , function(name){
        var paramNew = new mplane.Element(params[name]._element);
        statement.add_parameter(name , paramNew , params[name]._value);
    });
    return new  mplane.Specification(statement);
}

function createSpecificationFromRegisteredSpecification(probeHash , specHash){
    specification = __required_specifications__[probeHash][specHash];
    var statement = new mplane.Statement({verb:mplane.Statement.VERB_MEASURE});
    var params = specification._params;
    var parNames = _.keys(params);
    _.forEach(parNames , function(name){
        var paramNew = new mplane.Element(params[name]._element);
        statement.add_parameter(name , paramNew , params[name]._value);
    });
    return new  mplane.Specification(statement);
}
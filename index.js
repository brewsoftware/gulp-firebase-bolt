var bolt = require('firebase-bolt');
var through = require('through2');
var readfile = require('fs-readfile-promise');
var path = require('path');
//var fileIO =
// Consts
const PLUGIN_NAME = 'gulp-firebase-bolt';

/*
  Firebase bolt gulp plugin
  Note: Using a modified bolt syntax to include imports
*/

module.exports = function() {
    // creating a stream through which each file will pass
      var cwd ='';
      var stream = through.obj(function(file, enc, cb) {
        var self = this;
        var newfile = file.clone({contents: false});
        var content ='';
        // base relative path
        var cwdPath = file.cwd.split(path.sep);
        var histPath = file.history[0].split(path.sep);
        for(var i=0;i< cwdPath.length ;i++){
          histPath.shift();
        }
        histPath.pop();
        cwd = './';
        if(histPath.length >0){
          cwd =  cwd + histPath.join('/');
        }
        if (file.isBuffer()) {
          content = file.contents.toString()
          parserWrapper(content).then(function(symbols){
            readSuccess(symbols, cb,newfile );
          }).catch(function(ex){
             this.emit('error', new PluginError(PLUGIN_NAME, 'Error converting file'));
             cb();
          });
        } else if (file.isStream()) {
          file.contents.on('data', function(chunk) {
            content = content + chunk;
          });
          file.contents.on('end', function(){
            // make sure the file goes through the next gulp plugin
            parserWrapper(content ).then(function(symbols){
              readSuccess(symbols, cb,newfile );
            }).catch(function(ex){
               this.emit('error', new PluginError(PLUGIN_NAME, 'Error converting file'));
               cb();
            });
          });

        } else {
          cb();
        }
      });
      // returning the file stream
    return stream;
    /*
      *************************** Function Section ****************************
    */
    var sym; // Global symbols variable


    function parsePath(path) {
       var extname = Path.extname(path);
       return {
         dirname: Path.dirname(path),
         basename: Path.basename(path, extname),
         extname: extname
       };
     }

    function parserWrapper(data) {
      var promises = [];
      sym = bolt.parse(data);
      var currentDirectoryContext = cwd;
      console.log("current context" + currentDirectoryContext);
      while (sym.imports.length > 0) {
          var next = sym.imports.pop();
          next = getNextFilenameFromContextAndImport({
            filename: cwd + '/tempfilename',
            scope: false
          }, next);
          var p = processRecursive(next);
          promises.push(p);
      } // end while
      var retPromise = new Promise(function(resolve, reject){
        Promise.all(promises).then(function(){
          console.log(sym);
          resolve(sym);
        }).catch(function(ex){
          console.log(ex);
        });
      });
      return retPromise;
    }; // end function
    function getNextFilenameFromContextAndImport(current, nextImport){
      // Convert absolute filenames to relative
      // Convert relative filenames to include original path

      var currentFn = current.filename.split('/');
      var nextFn = nextImport.filename.split('/');
      if(nextImport.scope){
        nextImport.filename = './node_modules/' + nextImport.filename + '/index';
      } else{
        // import {./something} -> ['.','something'] -> ''
        // import {./something/anotherthing} -> ['.','something','anotherthing'] -> something

        currentFn.pop();
//        var delim = nextFn.shift();
        while(nextFn[0] === '..'){
          currentFn.pop();
          nextFn.shift();
        }
        if(nextFn[0] === '.'){
          nextFn.shift();
        }
        nextImport.filename  = currentFn.concat(nextFn).join('/');
      }

      return nextImport;
    }
    function processRecursive(next){

      var promises = [];
      var p = new Promise(function(resolve, reject) {

        console.log("Reading: " + JSON.stringify(next));
        readfile(next.filename  + '.bolt').then(
          function(subData) {
            console.log("Success Reading: " + next.filename + '.bolt');
            var subPromises = [];
            var newRules = bolt.parse(subData.toString());
            console.log('*******' + next.filename);
            if (newRules) {
                newRules.imports.map(function (obj) {
                    sym.imports.push(obj);
                    return obj;
                });
            }
            for (var funcKey in newRules.functions) {
                if (newRules.functions.hasOwnProperty(funcKey)) {
                    sym.functions[funcKey] = newRules.functions[funcKey];
                }
            }
            for (var schemaKey in newRules.schema) {
                if (newRules.schema.hasOwnProperty(schemaKey)) {
                    sym.schema[schemaKey] = newRules.schema[schemaKey];
                }
            }
            for (var pathKey in newRules.paths) {
                if (newRules.paths.hasOwnProperty(pathKey)) {
                    sym.paths[pathKey] = newRules.paths[pathKey];
                }
            }
            /*
            {
              filename:
              alias:
              scope: fale = local
            }
            */
            for(var impKey in newRules.imports){
                var imp = getNextFilenameFromContextAndImport(next, newRules.imports[impKey]);

                // check for global modules
                var inner = processRecursive(imp);
                subPromises.push(inner);
                // push a new import path
            }
            Promise.all(subPromises).then(function(){
              resolve();
            }).carch(function(ex){
              this.emit('error in parsed files');
            });

        }); // end readFile
      }); // end promise
    promises.push(p);

    var retPromise = new Promise(function(resolve, reject){
      Promise.all(promises).then(function(){
        resolve();
      }).catch(function(ex){
        console.log(ex);
      });
    });
    return retPromise;
    }
    /*
    * readSuccess -Final call with all the symboly loaded
    * calls the original parser function after the parser has succeeded.
    */
    function readSuccess(symbols, cb, newfile){
      var gen = new bolt.Generator(symbols);
      var rules = gen.generateRules();
      var output =  JSON.stringify(rules, null, 2);
      newfile.contents = new Buffer(output);
      newfile.path = newfile.path.replace('.bolt','.json');
      cb(null, newfile);// finished
    };


};

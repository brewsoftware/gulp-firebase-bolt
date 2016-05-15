var bolt = require('firebase-bolt');
var through = require('through2');
var readfile = require('fs-readfile-promise');
var Path = require('path');
//var fileIO =
// Consts
const PLUGIN_NAME = 'gulp-firebase-bolt';

/*
  Firebase bolt gulp plugin
  Note: Using a modified bolt syntax to include imports
*/

module.exports = function() {
    // creating a stream through which each file will pass
      var stream = through.obj(function(file, enc, cb) {
        var self = this;
        var parsedPath = parsePath(file.relative);
        var newfile = file.clone({contents: false});
        var content ='';
        if (file.isBuffer()) {

          content = file.contents.toString()
          parserWrapper(content,parsedPath).then(function(symbols){
            readSuccess(symbols, cb,newfile,parsedPath );
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
            parserWrapper(content,parsedPath ).then(function(symbols){
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

    function readSuccess(symbols, cb,newfile){
      var gen = new bolt.Generator(symbols);
      var rules = gen.generateRules();
      var output =  JSON.stringify(rules, null, 2);
      //file.contents.end(output);
      newfile.contents = new Buffer(output);
      newfile.path = newfile.path.replace('.bolt','.json');
      cb(null, newfile);// finished
    };
    function parsePath(path) {
       var extname = Path.extname(path);
       return {
         dirname: Path.dirname(path),
         basename: Path.basename(path, extname),
         extname: extname
       };
     }
    function parserWrapper(data,parsedPath ) {
        var promises = [];
        var sym = bolt.parse(data);
        while (sym.imports.length > 0) {
            var next = sym.imports.pop();
            var p = readfile( next.filename + '.bolt').then(
              function(subData){
                  console.log('data');
                  console.log(subData.toString());
              var newRules = bolt.parse(subData.toString());
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
            });
            promises.push(p);
        }
        var retPromise = new Promise(function(resolve, reject){
          Promise.all(promises).then(function(){
            resolve(sym);
          });
        });
        return retPromise;
    };

};

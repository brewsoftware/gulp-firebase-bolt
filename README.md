# gulp-firebase-bolt
Bolt compiler for firebase based on bolt specifications

# Usage

To send a single file and redirect to an output directory
gulp.src('test.bolt')
.pipe(firebase())
.pipe(gulp.dest('./output/'));

To take all bolt files in a directory and output their corresponding JSON files
gulp.src('*.bolt')
.pipe(firebase())
.pipe(gulp.dest('./output/'));

TODO: Increase support for import aliases
TODO: Further testing and debugging
TODO: Documentation

Streams & buffers are currently supported.

var gulp = require('gulp');
var firebase = require('./index');

gulp.task('default', function(){
  gulp.src('test.bolt')
  .pipe(firebase())
  .pipe(gulp.dest('./output/'));
});

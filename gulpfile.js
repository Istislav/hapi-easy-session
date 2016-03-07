'use strict';

const gulp = require('gulp');
const jscs = require('gulp-jscs');

gulp.task('validate', () => {
  gulp.src('session.js')
    .pipe(jscs())
    .pipe(jscs.reporter());
});

gulp.task('default', ['validate']);

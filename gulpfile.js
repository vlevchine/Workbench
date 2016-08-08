"use strict";

var gulp = require('gulp');
var jshint = require('gulp-jshint');

gulp.task('default',['jshint','test','serve']);

gulp
    .task('jshint', function(){
        return gulp.src('./*.js')
            .pipe(jshint())
            .pipe(jshint.reporter('default'));
    })
    .task('test',function(){
        require('./test.js');
    })
    .task('serve',function(){
        require('./main.js');
    });
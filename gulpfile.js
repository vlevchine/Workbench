"use strict";

var gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    mocha = require('gulp-mocha'),
    gutil = require('gulp-util');


gulp
    .task('l', function(){
        return gulp.src(['server/**/*.js', 'app/**/*.js'])
            .pipe(jshint())
            .pipe(jshint.reporter('default'));
    })
    .task('t', function() {
        return gulp.src(['test/*.js'], {read:false})
            .pipe(mocha({reporter: 'spec'}))
            .on('error', gutil.log);
    })
    .task('s',function(){
        require('./main.js');
    });

gulp.task('lt',['l','t']);
gulp.task('default',['l','t','s']);
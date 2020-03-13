'use strict';

import gulp from 'gulp';
import watch from 'gulp-watch';
import gp_uglify from 'gulp-uglify';
import browserify from 'browserify';
import babelify from 'babelify';
import del from 'del';
import buffer from 'vinyl-buffer';
import source from 'vinyl-source-stream';


const project = 'stations';
const projSrc = 'src/';

const paths = {
	main: projSrc + 'main.jsx',
	alljs: projSrc + '**/*.js',
	alljsx: projSrc + '**/*.jsx',
	commonjs: '../common/**/*.js*',
	target: 'target/',
	bundleFile: project + '.js'
};

const presets = [
	[
		"@babel/preset-env",
		{
			"targets": {
				"chrome": "60",
				"opera": "58",
				"edge": "11",
				"firefox": "68",
				"safari": "12"
			}
		}
	]
];

const clean = _ => {
	return del([paths.target + paths.bundleFile], {force: true});
};

const applyProdEnvironment = cb => {
	process.env.NODE_ENV = 'production';
	return cb();
};

const compileSrc = _ => {
	const isProduction = process.env.NODE_ENV === 'production';

	const browser = browserify({
		entries: [paths.main],
		debug: !isProduction,
		extensions: ['.jsx']
	})
		.transform(babelify, {
			presets,
			global: true,
			ignore: [/\/node_modules\/(?!ol\/)/],
			extensions: ['.js', '.jsx']
		})
		.bundle()
		.on('error', function(err){
			console.log(err);
			this.emit('end');
		});

	if (process.env.NODE_ENV === 'production'){
		return browser
			.pipe(source(paths.bundleFile))
			.pipe(buffer())
			.pipe(gp_uglify())
			.pipe(gulp.dest(paths.target));
	} else {
		return browser
			.pipe(source(paths.bundleFile))
			.pipe(gulp.dest(paths.target));
	}
};

gulp.task('build', gulp.series(clean, compileSrc));

gulp.task('buildWatch', gulp.series('build', function watcher(){ watch([paths.alljs, paths.alljsx], {}, gulp.series('build')) }));

gulp.task('publish', gulp.series(applyProdEnvironment, 'build'));

gulp.task('default', gulp.series('publish'));

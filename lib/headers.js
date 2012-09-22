/*
	anvil.headers - An anvil core plugin that writes headers to output files
	version:	0.0.2
	author:		Alex Robson <alex@sharplearningcurve.com> (http://sharplearningcurve.com)
	copyright:	2011 - 2012
	license:	Dual licensed
				MIT (http://www.opensource.org/licenses/mit-license)
				GPL (http://www.opensource.org/licenses/gpl-license)
*/
module.exports = function( _, anvil ) {
	return anvil.plugin( {
		name: "anvil.headers",
		activities: [ "identify", "push" ],
		dependencies: [ "fileLoader" ],
		commander: [
			[ "--header [value]", "provide header plugin with the name of header files (minus extension)", "header" ]
		],
		headers: {},
		config: {
			header: ""
		},

		configure: function( config, command, done ) {
			var self = this,
				outputPlugin = anvil.plugins[ "anvil.output" ];
			this.headerFileName = command.header || "header";
			if( outputPlugin ) {
				outputPlugin.dependencies.push( "anvil.headers" );
			}
			_.each( self.getHeaders( anvil.project.files ), function( file ) {
				file.noCopy = true;
				self.headers[ file.extension() ] = file;
			} );
			done();
		},

		getHeaders: function( files ) {
			var self = this;
			return _.filter( files, function( file ) {
				var full = file.name,
					limited = full.replace( file.extension(), "" );
				return limited === self.headerFileName;
			} );
		},

		getOutput: function() {
			var self = this,
				lookup = {
					extensions: []
				},
				files = _.filter( anvil.project.files, function( file ) {
					var extension = file.extension(),
						hasHeader = _.any( self.headers, function( value, key ) {
							return key === extension;
						} );
					return file.dependents.length === 0 && !file.noCopy && hasHeader;
				} );
			_.each( files, function( file ) {
				var extension = file.extension();
				lookup.extensions.push( extension );
				if( lookup[ extension ] ) {
					lookup[ extension ].files.push( file );
				} else {
					lookup[ extension ] = {
						header: self.headers[ extension ],
						files: [ file ]
					};
				}
			} );
			lookup.extensions = _.uniq( lookup.extensions );
			return lookup;
		},

		run: function( done, activity ) {
			var self = this;
			if( activity === "identify" ) {
				anvil.fs.getFiles( "./", anvil.config.working, function( files, directories ) {
					if( files.length > 0 ) {
						_.each( self.getHeaders( files ), function( file ) {
							self.headers[ file.extension() ] = file;
							file.noCopy = true;
							anvil.project.files.push( file );
						} );
						done();
					} else {
						done();
					}
				}, [], 0 );
			} else {
				var lookup = self.getOutput();
				anvil.scheduler.parallel( lookup.extensions, function( extension, done ) {
					var set = lookup[ extension ];
					anvil.fs.read( [ set.header.workingPath, set.header.name ], function( header ) {
						var prepend = function( content, done ) {
							done( header + "\n" + content );
						};
						anvil.scheduler.parallel( set.files, function( file, done ) {
							var target = [ file.workingPath, file.name ];
							anvil.fs.transform( target, prepend, target, done );
						}, done );
					} );
				}, function() { done(); } );
			}
		}
	} );
};
var minimatch = require( "minimatch" ),
	path = require( "path" );

module.exports = function( _, anvil ) {
	anvil.plugin( {
		name: "anvil.headers",
		activities: [ "identify", "push" ],
		dependencies: [ "fileLoader" ],
		config: {
			header: "header",
			headers: {}
		},

		configure: function( config, command, done ) {
			var self = this,
				outputPlugin = anvil.extensions.plugins[ "anvil.output" ];
			if( outputPlugin ) {
				outputPlugin.dependencies.push( "anvil.headers" );
			}
			done();
		},

		findHeaderFiles: function() {
			var self = this;
			_.each( this.config.headers, function( file, pattern ) {
				if( _.isString( file ) ) {
					var match = _.find(
						anvil.project.files,
						function( f ) {
							var p = self.getRelativeFilePath( f ).replace( /^\/|^\\/, "" );
							return file === p;
						} );
					if( match ) {
						match.noCopy = true;
						self.config.headers[ pattern ] = match;
					}
				}
			} );
		},

		getHeaders: function( files ) {
			var self = this;
			return _.filter( files, function( file ) {
				var full = file.name,
					limited = full.replace( file.extension(), "" );
				return limited === self.config.header;
			} );
		},

		getOutput: function() {
			var self = this,
				lookup = {},
				list = [];
			_.each( anvil.project.files, function( file ) {
				if( !file.noCopy ) {
					var filePath = self.getRelativeFilePath( file );
					lookup[ filePath ] = {
						file: file,
						headerDepth: -1,
						header: {}
					};
					list.push( filePath );
				}
			} );
			_.each( this.config.headers, function( header, pattern ) {
				var matches = minimatch.match( list, pattern, {} ),
					headerDepth = header.relativePath.split( /\\|\//g ).length,
					patternFile = path.basename( pattern );
				_.each( matches, function( fileKey ) {
					var file = lookup[ fileKey ];
					if( headerDepth > file.headerDepth ) {
						file.headerDepth = headerDepth;
						file.header = header;
					} else if( patternFile === file.name ) {
						file.headerDepth = 1000000;
						file.header = header;
					}
				} );
			} );
			return lookup;
		},

		getHeaderPattern: function( file ) {
			return path.join(
				file.relativePath.replace( /^\/|^\\/, ""),
				"**",
				"*" + file.extension() );
		},

		getRelativeFilePath: function( file ) {
			return anvil.fs.buildPath( [
					file.relativePath.replace( /^\/|^\\/, "" ),
					file.name
				] );
		},

		identify: function( done ) {
			var self = this;
			if( !_.isEmpty( this.config.headers ) ) {
				this.findHeaderFiles();
			}
			_.each( self.getHeaders( anvil.project.files ), function( file ) {
				file.noCopy = true;
				var pattern = self.getHeaderPattern( file );
				if( !self.config.headers[ pattern ] ) {
					self.config.headers[ pattern ] = file;
				}
			} );
			anvil.fs.getFiles( "./", anvil.config.working, function( files, directories ) {
				if( files.length > 0 ) {
					_.each( self.getHeaders( files ), function( file ) {
						file.noCopy = true;
						var pattern = self.getHeaderPattern( file );
						self.config.headers[ pattern ] = file;
						anvil.project.files.push( file );
					} );
					done();
				} else {
					done();
				}
			}, [], 0 );
		},

		place: function( done ) {
			var self = this,
				files = self.getOutput(),
				lookup = {},
				list;
			_.each( files, function( file, fileName ) {
				if( file.header ) {
					if( lookup[ file.header.fullPath ] ) {
						lookup[ file.header.fullPath ].files.push( file.file );
					} else if( !_.isEmpty( file.header ) ) {
						lookup[ file.header.fullPath ] = {
							file: file.header,
							files: [ file.file ]
						};
					}
				}
			} );
			list = _.map( lookup, function( header ) { return header; } );
			anvil.scheduler.parallel( list, function( header, done ) {
				anvil.fs.read( [ header.file.workingPath, header.file.name ], function( headerContent ) {
					var prepend = function( content, done ) {
						done( headerContent + "\n" + content );
					};
					anvil.scheduler.parallel( header.files, function( file, done ) {
						var target = [ file.workingPath, file.name ];
						anvil.fs.transform( target, prepend, target, done );
					}, done );
				} );
				}, function() { done(); }
			);
		},

		run: function( done, activity ) {
			var self = this;
			if( activity === "identify" ) {
				this.identify( done );
			} else {
				this.place( done );
			}
		}
	} );
};
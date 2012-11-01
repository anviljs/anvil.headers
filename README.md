## Anvil Headers Plugin

This plugin enables tokenized header files to get prepended after minimization steps (and also saves you from having to type the same copyright crap at the top of each file).

## Installation

anvil will install this plugin during post-install.

## Conventions

### File Name
This plugin assume that your header files will be named header and that the extension of the header file will control which kinds of files the header applies to.

### Top Level Headers
By convention, a header file at the very top of your repository will get applied to all files in your source tree that have a matching extension.

### Location
After that, header files within a directory will apply to all files found in that directory and 'override' any headers found at a higher level of the source tree hierarchy.

### File specific headers
If you need to target a specific file you can provide the following configuration:

	"anvil.headers": {
		"headers": {
			"relative/path/to/your/file.ext": "relative/path/to/your/header.ext"
		}
	}
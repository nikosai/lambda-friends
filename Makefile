.PHONY: web run clean
ALLSRC := $(wildcard src/*.ts)

all: js/cui.js docs/app.js

js/cui.js: $(ALLSRC) tsconfig.json Makefile
	@tsc

js/webui.js: js/cui.js

js/server.js: js/cui.js

run: js/cui.js
	@node js/cui.js

docs/app.js: js/webui.js
	@browserify js/webui.js -o docs/app.js

web: docs/app.js js/server.js
	@node js/server.js

clean:
	-rm -rf js/*
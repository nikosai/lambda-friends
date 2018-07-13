.PHONY: web run clean silent test all
ALLSRC := $(wildcard src/*.ts)

all: js/cui.js docs/app.js

js/cui.js: $(ALLSRC) tsconfig.json Makefile
	tsc

js/webui.js: js/cui.js

js/server.js: js/cui.js

js/test.js: js/cui.js

run: js/cui.js
	node js/cui.js

silent: js/cui.js
	@node js/cui.js

docs/app.js: $(ALLSRC) js/webui.js
	browserify js/webui.js -o docs/app.js

web: docs/app.js js/server.js
	node js/server.js

test: js/test.js
	node js/test.js

graph_closure.csv: js/cui.js
	node js/closure.js > graph_closure.csv

clean:
	-rm -rf js/*

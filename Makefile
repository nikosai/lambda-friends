.PHONY: web run clean silent test all
ALLSRC := $(wildcard src/*.ts)

all: js/cli.js docs/app.js

js/cli.js: $(ALLSRC) tsconfig.json Makefile
	tsc

js/webui.js: js/cli.js

js/server.js: js/cli.js

js/test.js: js/cli.js

run: js/cli.js
	node js/cli.js

silent: js/cli.js
	@node js/cli.js

docs/app.js: $(ALLSRC) js/webui.js
	npx webpack
	cp graph_closure.csv docs/

web: docs/app.js js/server.js
	node js/server.js

test: js/test.js
	node js/test.js

graph_closure.csv: js/cli.js
	node js/closure.js > graph_closure.csv

clean:
	-rm -rf js/*

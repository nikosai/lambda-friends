.PHONY: default run clean
ALLSRC := $(wildcard src/*.ts)
MAIN = js/lambda-friends.js
WEBUI = js/app.js
CUI = js/cui.js

js: $(ALLSRC) tsconfig.json Makefile
	@tsc

run: js
	@node $(CUI)

web: js
	@browserify js/webui.js -o docs/app.js

clean:
	@rm -rf js/*
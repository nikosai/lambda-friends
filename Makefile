.PHONY: default run clean
ALLSRC := $(wildcard src/*.ts)
TARGET = js/lambda-friends.js

default:
	@make $(TARGET)

run: $(TARGET)
	@node $(TARGET)

test: $(TARGET)
	@node $(TARGET) < in.txt

js/lambda-friends.js: $(ALLSRC) tsconfig.json Makefile
	@tsc

clean:
	@rm -rf js/*
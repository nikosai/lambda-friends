#!/bin/bash
cd `dirname $0`
make > /dev/null
node js/cli.js $*

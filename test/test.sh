#!/bin/bash
cd `dirname $0`

files=`find testcase/ -type f`
lf=../run.sh

if [ "$1" == "reset" ]; then
  rm -f expected/*
fi

echo "Test Start!" > /dev/stderr
for file in $files; do
  basename=`basename -s .txt $file`
  optfile=option/${basename}.opt
  if [ ! -e $optfile ]; then
    opts=
  else
    opts=`cat $optfile`
  fi
  i=1
  count=`grep -c "" $file`
  # echo `cat $file` > /dev/stderr
  IFS=$'\n'
  for line in `cat $file`; do
    echo "Testing '${basename}' (${i}/${count}) ..." > /dev/stderr
    expected=expected/${basename}_${i}.txt
    if [ ! -e $expected ]; then
      echo "" | $lf $opts "${line}" &> $expected
    else
      diff=`diff $expected <(echo "" | $lf $opts "${line}")`
      if [ ! "$diff" = "" ]; then
        echo "Error in '${basename}' (${i}/${count}) !" > /dev/stderr
        echo $diff > /dev/stderr
        exit 1
      fi
    fi
    let i++
  done
  echo "Testing '${basename}': DONE! (${count} tests)" > /dev/stderr
done
exit 0

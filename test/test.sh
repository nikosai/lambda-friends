#!/bin/bash
cd `dirname $0`

files=`find testcase/ -type f`
lf=../run.sh

if [ "$1" == "reset" ]; then
  rm -f expected/*
fi

echo "Test Start!" > /dev/stderr
sum=0
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
  sum=$(( $sum + $count ))
  OIFS=$IFS
  IFS=$'\n'
  for line in `cat $file`; do
    IFS=$OIFS
    echo "Testing '${basename}' (${i}/${count}) : $lf $opts '${line}'" > /dev/stderr
    expected=expected/${basename}_${i}.txt
    res=`echo "" | $lf ${opts[*]} "${line}" 2>&1`
    if [ ! -e $expected ]; then
      echo "$res" > $expected
    else
      diff=`diff $expected <(echo "$res")`
      if [ ! "$diff" = "" ]; then
        echo "Error in '${basename}' (${i}/${count}) : $lf $opts '${line}' !" > /dev/stderr
        echo $diff > /dev/stderr
        exit 1
      fi
    fi
    IFS=$'\n'
    let i++
  done
  IFS=$OIFS
  echo "Testing '${basename}': DONE! (${count} tests)" > /dev/stderr
done
echo "Successfully done all ${sum} tests!"
exit 0

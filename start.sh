#!/bin/bash

while true; do
  npm start
  if [ $? -eq 1 ]; then
    echo "Press any key to exit..."
    read -n 1 -s -r
  else
    break
  fi
done

#!/bin/bash

# autobuild
cd workers/node
./build.sh
cd ../..

docker-compose up -d
# setup rights
chmod -R a+rw elastic zeebe workers

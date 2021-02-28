#!/bin/bash

docker pull williamyeh/wrk

# run 100 connections within 10 threads during 10 seconds
docker run --rm -v 'pwd':/data --network host williamyeh/wrk -s post.lua -t10 -c100 -d10s \
 http://localhost:2595/process-definition/key/payment-retrieval/start

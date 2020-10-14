#!/bin/bash

curl -H "Content-Type: application/json" -X POST -d '{"upload": "/zeebe/bpms/examples/payment-retrieval.bpmn"}' http://localhost:2595/deployment/create

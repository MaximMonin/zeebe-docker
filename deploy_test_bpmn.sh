#!/bin/bash

curl -H "Content-Type: application/json" -X POST -d '{"upload": "/zeebe/bpms/examples/payment-retrieval.bpmn"}' http://localhost:2595/deployment/create
curl -H "Content-Type: application/json" -X POST -d '{"upload": "/zeebe/bpms/examples/search-domain.bpmn"}' http://localhost:2595/deployment/create

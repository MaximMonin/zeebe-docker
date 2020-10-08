#!/bin/bash

for (( i=0; i<100; ++i)); do
curl --location --request POST 'http://localhost:26500/workflows/start' \
--header 'Content-Type: application/json' \
--data-raw '{ "processDefinitionId":"payment-retrieval","variables": {"item": "item-xyz","amount": 555}}'
done
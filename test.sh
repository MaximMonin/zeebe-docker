#!/bin/bash

for (( i=0; i<100; ++i)); do
   docker exec -it zeebe-gateway zbctl --insecure create instance "payment-retrieval" --variables '{"item": "item-xyz", "amount": 555}'
done

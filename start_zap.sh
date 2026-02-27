#!/bin/bash
echo "Starting OWASP ZAP on port 8090..."
zap.sh -daemon -port 8090 -config api.disablekey=true

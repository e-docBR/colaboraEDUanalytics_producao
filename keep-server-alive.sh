#!/bin/bash
# Script to keep the Next.js server alive
cd /home/z/my-project
while true; do
  PORT=3000 node .next/standalone/server.js 2>&1
  echo "Server died, restarting in 2s..."
  sleep 2
done

#!/bin/sh
set -e

# Only run seed if RUN_SEED is set to true
if [ "$RUN_SEED" = "true" ]; then
    echo "Running database seed..."
    node seed.js || echo "Seed failed or skipped duplicates"
fi

echo "Starting application..."
exec node app.js

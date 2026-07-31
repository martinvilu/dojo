#!/bin/bash

# Local Testing Script for Ninja Dojo
# -----------------------------------
# This script starts the local development server and provides instructions
# for testing the LTI Deep Linking and Launch flows locally without Moodle.

echo "=========================================================="
echo "🥷 NINJA DOJO LOCAL TEST ENVIRONMENT"
echo "=========================================================="
echo ""
echo "Starting Next.js development server..."
echo ""
echo "INSTRUCTIONS:"
echo "1. Wait for the server to start at http://localhost:3000"
echo "2. Open your browser and go to: http://localhost:3000/test-lti.html"
echo "3. Use the LTI Simulator interface to test the Moodle flows."
echo ""
echo "Press Ctrl+C to stop the server."
echo "=========================================================="
echo ""

# Start the dev server
npm run dev

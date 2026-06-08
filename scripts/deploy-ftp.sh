#!/bin/bash
# ──────────────────────────────────────────────────────
# deploy-ftp.sh – Manual deployment for produktfotostudio.at
# ──────────────────────────────────────────────────────
# Usage: ./scripts/deploy-ftp.sh
# 
# This script builds the Astro site and provides instructions
# for uploading to Websupport.sk via FTP.
# ──────────────────────────────────────────────────────

set -e

echo "🔨 Building Astro site..."
npm run build

echo ""
echo "✅ Build complete! Output is in ./dist/"
echo ""
echo "── Upload Instructions ──────────────────────────"
echo ""
echo "Upload the contents of the dist/ folder to your"
echo "Websupport.sk hosting via FTP."
echo ""
echo "Option 1 – Using lftp:"
echo "  lftp -u USERNAME,PASSWORD ftp://SERVER_ADDRESS -e \\"
echo "    \"mirror -R --delete --verbose dist/ /www/; quit\""
echo ""
echo "Option 2 – Using rsync (if SSH available):"
echo "  rsync -avz --delete dist/ user@server:/path/to/www/"
echo ""
echo "Option 3 – Use any FTP client (FileZilla, Cyberduck)"
echo "  Connect to your Websupport.sk FTP and upload dist/ contents."
echo ""
echo "─────────────────────────────────────────────────"

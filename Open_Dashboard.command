#!/bin/bash

# Get the directory where this script is located
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "🚀 Démarrage de QualitySports..."
echo "📊 Mise à jour des données en cours..."

# Run the update script
./update_data.sh

# Open the site in the default browser
echo "🌐 Ouverture du site..."
open "index.html"

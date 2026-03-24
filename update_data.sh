#!/bin/bash

# Define paths
PROJECT_DIR="/Users/constantinmoreira/QualitySports"
EXCEL_FILE="$PROJECT_DIR/FIVE.xlsx"

echo "🔄 Début de la mise à jour des données..."

# ensure we are in the project dir
cd "$PROJECT_DIR"

# 1. Check if Excel file exists
if [ -f "$EXCEL_FILE" ]; then
    echo "✅ Fichier Excel trouvé : $EXCEL_FILE"
else
    echo "❌ ERREUR : Fichier Excel 'FIVE.xlsx' introuvable !"
    exit 1
fi

# 2. Run Stats Extractor (Players)
echo "-----------------------------------"
echo "📊 Mise à jour des statistiques joueurs..."
python3 extract_stats.py
if [ $? -eq 0 ]; then
    echo "✅ Stats mises à jour avec succès."
else
    echo "❌ Erreur lors de l'extraction des stats."
    exit 1
fi

# 3. Run Replays Extractor (Matches)
echo "-----------------------------------"
echo "🎥 Mise à jour des replays..."
python3 extract_replays.py
if [ $? -eq 0 ]; then
    echo "✅ Replays mis à jour avec succès."
else
    echo "❌ Erreur lors de l'extraction des replays."
    exit 1
fi

echo "-----------------------------------"
echo "🎉 Mise à jour terminée ! Recharge la page dans ton navigateur."

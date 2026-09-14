#!/bin/bash
cd "$(dirname "$0")"

if ! command -v node > /dev/null 2>&1; then
  echo
  echo "  Node.js n'est pas installé sur cet ordinateur."
  echo "  Installez-le depuis https://nodejs.org (version LTS), puis relancez ce fichier."
  echo
  read -r -p "Appuyez sur Entrée pour fermer."
  exit 1
fi

echo
echo "  Le logiciel démarre... la fenêtre du navigateur s'ouvre toute seule."
echo "  Laissez cette fenêtre ouverte pendant que vous travaillez."
echo "  Pour arrêter le logiciel : fermez cette fenêtre."
echo

( sleep 2; open http://localhost:3000 ) &
node server.js

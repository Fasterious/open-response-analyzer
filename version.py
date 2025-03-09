"""
Fichier de version pour l'Analyseur de Réponses Ouvertes.
Ce fichier contient la version actuelle du logiciel.
"""

__version__ = "0.1.0"
VERSION = __version__

# Décomposition de la version pour un accès facile
VERSION_PARTS = VERSION.split('.')
VERSION_MAJOR = int(VERSION_PARTS[0])
VERSION_MINOR = int(VERSION_PARTS[1])
VERSION_PATCH = int(VERSION_PARTS[2])

# Version sous forme de tuple
VERSION_TUPLE = (VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH)

# Chaîne de version pour l'affichage
VERSION_STRING = f"v{VERSION}" 
# Définir le fichier de sortie
$outputFile = "project_structure.txt"

# Générer l'arborescence en ignorant les dossiers inutiles pour la lecture
# -Recurse : parcourt les sous-dossiers
# -Attributes !Directory+!System : évite les fichiers systèmes
Get-ChildItem -Recurse | Where-Object { 
    $_.FullName -notmatch "node_modules" -and 
    $_.FullName -notmatch "\.git" -and 
    $_.FullName -notmatch "dist"
} | Select-Object FullName | ForEach-Object {
    $path = $_.FullName.Replace((Get-Location).Path, "")
    if ($path -ne "") { $path }
} > $outputFile

Write-Host "Arborescence générée dans $outputFile" -ForegroundColor Green
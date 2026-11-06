# Script to run Sonar Scanner using Docker
# It requires SonarQube to be running (e.g. via docker-compose up -d sonarqube)
# And requires a Sonar token if authentication is enabled.
# Usage: .\run-sonar.ps1 -Token "your_token_here"

param (
    [string]$Token
)

$SonarHost = "http://host.docker.internal:9000"

Write-Host "Generando reportes de cobertura para Backend..."
Push-Location backend
# Activar entorno virtual si existe (asume venv/Scripts/Activate.ps1 o similar)
# Ejecutar pytest con cobertura XML
$pythonExec = if (Test-Path "venv\Scripts\python.exe") { "venv\Scripts\python.exe" } else { "python" }
& $pythonExec -m pytest --cov=app --cov-report=xml tests/
Pop-Location

Write-Host "Generando reportes de cobertura para Frontend..."
Push-Location frontend
npm run coverage
Pop-Location

Write-Host "Iniciando SonarScanner..."

if ($Token) {
    docker run --rm -v "${PWD}:/usr/src" -e SONAR_HOST_URL=$SonarHost -e SONAR_TOKEN=$Token sonarsource/sonar-scanner-cli
} else {
    # If anonymous analysis is enabled or local development without token (if allowed)
    docker run --rm -v "${PWD}:/usr/src" -e SONAR_HOST_URL=$SonarHost sonarsource/sonar-scanner-cli
}

# Start n8n — runs at http://localhost:5678
# Data persists in postgres (n8n-db container) + C:\Users\profs\.n8n
# Hermes repo mounted at /hermes inside the container

$network = "content-pipeline_content-pipeline"

docker run -d `
  --name n8n `
  -p 5678:5678 `
  --network $network `
  -v "C:/Users/profs/.n8n:/home/node/.n8n" `
  -v "C:/Users/profs/Documents/Hermes:/hermes" `
  --env-file "C:/Users/profs/Documents/Hermes/n8n.env" `
  n8nio/n8n:latest

Write-Host "n8n started at http://localhost:5678"

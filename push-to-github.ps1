# Push SolScan to GitHub
# 1. Create a new repo at https://github.com/new (name it "SolScan" or similar)
# 2. Replace YOUR_GITHUB_USERNAME below with your actual GitHub username, then run this script:
#    .\push-to-github.ps1

$username = "rishabhvyass"  # <-- Change this to your GitHub username
$repo = "solana-wallet-app"                   # <-- Change if your repo has a different name

$url = "https://github.com/$username/$repo.git"
Write-Host "Adding remote: $url" -ForegroundColor Cyan
git remote add origin $url
Write-Host "Pushing to main..." -ForegroundColor Cyan
git push -u origin main
Write-Host "Done." -ForegroundColor Green

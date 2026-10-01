# ==============================================================================
# TrustSphere — MongoDB Database Restore Script (restore_database.ps1)
# Database: TrustSphereDB
# Backup Source: .\mongodb_backup\TrustSphereDB
# ==============================================================================

param(
    [string]$TargetUri = $env:MONGODB_URL,
    [string]$TargetDb = $env:MONGODB_DATABASE
)

$ErrorActionPreference = "Stop"

if (-not $TargetUri) { $TargetUri = $env:MONGODB_URI }
if (-not $TargetUri) { $TargetUri = "mongodb://localhost:27017" }
if (-not $TargetDb) { $TargetDb = "TrustSphereDB" }

$ProjectRoot = if ($PSScriptRoot) { $PSScriptRoot } else { "C:\TrustSphere" }
$DatabaseName = $TargetDb
$MongoUri = $TargetUri
$BackupRoot = Join-Path $ProjectRoot "mongodb_backup"
$BackupDbDir = Join-Path $BackupRoot "TrustSphereDB"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  TrustSphere MongoDB Restore Utility" -ForegroundColor Cyan
Write-Host "  Target Database : $DatabaseName" -ForegroundColor Cyan
Write-Host "  Target URI      : $($MongoUri -replace '://.*?:.*?@', '://***:***@')" -ForegroundColor Cyan
Write-Host "  Backup Location : $BackupDbDir" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 1. Verify Backup Folder Exists and Contains BSON Files
# ------------------------------------------------------------------------------
if (-not (Test-Path $BackupDbDir)) {
    Write-Host "[ERROR] Backup directory not found at: $BackupDbDir" -ForegroundColor Red
    Write-Host "Please ensure the 'mongodb_backup\TrustSphereDB' folder is present in the repository." -ForegroundColor Yellow
    exit 1
}

$BsonFiles = Get-ChildItem -Path $BackupDbDir -Filter "*.bson" -File
if (-not $BsonFiles -or $BsonFiles.Count -eq 0) {
    Write-Host "[ERROR] No .bson backup files found inside: $BackupDbDir" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Found $($BsonFiles.Count) collection backup files in '$BackupDbDir'." -ForegroundColor Green

# ------------------------------------------------------------------------------
# 2. Check Connection (Localhost port check or Remote URI check)
# ------------------------------------------------------------------------------
if ($MongoUri -match "localhost|127\.0\.0\.1") {
    Write-Host "[INFO] Checking if MongoDB is running on localhost:27017..." -ForegroundColor Cyan

    $MongoRunning = $false
    try {
        $TcpClient = New-Object System.Net.Sockets.TcpClient
        $ConnectAsync = $TcpClient.BeginConnect("127.0.0.1", 27017, $null, $null)
        $WaitResult = $ConnectAsync.AsyncWaitHandle.WaitOne(3000, $false)
        if ($WaitResult -and $TcpClient.Connected) {
            $MongoRunning = $true
        }
        $TcpClient.Close()
    } catch {
        $MongoRunning = $false
    }

    if (-not $MongoRunning) {
        Write-Host "[ERROR] MongoDB is not reachable on localhost:27017." -ForegroundColor Red
        Write-Host "Please ensure MongoDB Community Server is installed and running:" -ForegroundColor Yellow
        Write-Host "  - Open PowerShell as Administrator and run: net start MongoDB" -ForegroundColor Yellow
        Write-Host "  - Or open Windows Services (services.msc) and start 'MongoDB Server (MongoDB)'." -ForegroundColor Yellow
        exit 1
    }

    Write-Host "[OK] MongoDB is active and listening on localhost:27017." -ForegroundColor Green
} else {
    Write-Host "[INFO] Target is a cloud/remote MongoDB URI. Skipping localhost check." -ForegroundColor Cyan
}

# ------------------------------------------------------------------------------
# 3. Locate mongorestore.exe (or Use Built-in Python BSON Restore Fallback)
# ------------------------------------------------------------------------------
$MongoRestoreExe = $null

$CmdCheck = Get-Command mongorestore -ErrorAction SilentlyContinue
if ($CmdCheck) {
    $MongoRestoreExe = $CmdCheck.Source
}

if (-not $MongoRestoreExe) {
    $CandidatePaths = @(
        "C:\Program Files\MongoDB\Tools\*\bin\mongorestore.exe",
        "C:\Program Files\MongoDB\Server\*\bin\mongorestore.exe"
    )
    foreach ($Pattern in $CandidatePaths) {
        $Found = Get-Item $Pattern -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
        if ($Found) {
            $MongoRestoreExe = $Found.FullName
            break
        }
    }
}

if ($MongoRestoreExe) {
    Write-Host "[INFO] Using mongorestore binary: $MongoRestoreExe" -ForegroundColor Cyan
    & $MongoRestoreExe --uri="$MongoUri" --db="$DatabaseName" --drop "$BackupDbDir"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] mongorestore exited with code $LASTEXITCODE." -ForegroundColor Red
        exit $LASTEXITCODE
    }
} else {
    Write-Host "[INFO] 'mongorestore.exe' not found in PATH; using Python PyMongo/BSON restore fallback..." -ForegroundColor Yellow

    $PythonExe = Join-Path $ProjectRoot "venv\Scripts\python.exe"
    if (-not (Test-Path $PythonExe)) {
        $PyCmd = Get-Command python -ErrorAction SilentlyContinue
        if ($PyCmd) {
            $PythonExe = $PyCmd.Source
        } else {
            Write-Host "[ERROR] Neither mongorestore.exe nor Python environment was found." -ForegroundColor Red
            Write-Host "Please install MongoDB Database Tools (winget install MongoDB.DatabaseTools) or create the Python venv first." -ForegroundColor Yellow
            exit 1
        }
    }

    $PyScript = @"
import os, sys, bson
from pymongo import MongoClient

backup_dir = r'''$BackupDbDir'''
db_name = r'''$DatabaseName'''
mongo_uri = r'''$MongoUri'''

client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
db = client[db_name]

for fname in sorted(os.listdir(backup_dir)):
    if not fname.endswith('.bson'):
        continue
    col_name = fname[:-5]
    bson_path = os.path.join(backup_dir, fname)
    with open(bson_path, 'rb') as f:
        docs = list(bson.decode_file_iter(f))
    db[col_name].drop()
    if docs:
        db[col_name].insert_many(docs)
    print(f'  Restored {col_name}: {len(docs)} documents')

backend_dir = os.path.join(r'''$ProjectRoot''', 'backend')
if os.path.isdir(backend_dir):
    sys.path.insert(0, backend_dir)
    try:
        from database import init_db
        init_db()
    except Exception as e:
        print(f'  [WARN] Index initialization warning: {e}')
"@

    & $PythonExe -c $PyScript
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Python BSON restore failed with exit code $LASTEXITCODE." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  [SUCCESS] TrustSphereDB Restored Successfully!" -ForegroundColor Green
Write-Host "  Restored Collections:" -ForegroundColor Green
foreach ($File in ($BsonFiles | Sort-Object Name)) {
    $ColName = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
    Write-Host ("    - {0}" -f $ColName) -ForegroundColor Gray
}
Write-Host "============================================================" -ForegroundColor Green
exit 0

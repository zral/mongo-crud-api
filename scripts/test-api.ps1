#!/usr/bin/env pwsh
# MongoDB CRUD API - PowerShell Test Script

param(
    [string]$TestType = "all",
    [string]$ApiUrl = "http://localhost:3001"
)

Write-Host "🧪 MongoDB CRUD API Test Script" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan

# Function to make HTTP requests
function Invoke-ApiRequest {
    param(
        [string]$Method,
        [string]$Endpoint,
        [hashtable]$Body = $null
    )
    
    $uri = "$ApiUrl$Endpoint"
    $headers = @{"Content-Type" = "application/json"}
    
    try {
        if ($Body) {
            $jsonBody = $Body | ConvertTo-Json -Depth 10
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -Body $jsonBody -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -Uri $uri -Method $Method -Headers $headers -ErrorAction Stop
        }
        
        $content = $response.Content | ConvertFrom-Json
        return @{
            StatusCode = $response.StatusCode
            Content = $content
            Success = $true
        }
    } catch {
        Write-Host "❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
        return @{
            StatusCode = $_.Exception.Response.StatusCode.value__
            Content = $_.Exception.Message
            Success = $false
        }
    }
}

# Function to check if API is running
function Test-ApiHealth {
    Write-Host "🔍 Checking if API is running..." -ForegroundColor Yellow
    $result = Invoke-ApiRequest -Method "GET" -Endpoint "/health"
    
    if ($result.Success -and $result.Content.status -eq "healthy") {
        Write-Host "✅ API is running and healthy" -ForegroundColor Green
        Write-Host "   MongoDB Status: $($result.Content.mongodb)" -ForegroundColor Cyan
        return $true
    } else {
        Write-Host "❌ API is not responding properly" -ForegroundColor Red
        Write-Host "   Make sure the application is running with: docker-compose up -d" -ForegroundColor Yellow
        return $false
    }
}

# Function to run basic CRUD tests
function Test-BasicCrud {
    Write-Host ""
    Write-Host "🚀 Running Basic CRUD Tests..." -ForegroundColor Cyan
    Write-Host "------------------------" -ForegroundColor Cyan
    
    # Test 1: List collections
    Write-Host "1. Listing collections..." -ForegroundColor White
    $collections = Invoke-ApiRequest -Method "GET" -Endpoint "/api/management/collections"
    if ($collections.Success) {
        Write-Host "   Found $($collections.Content.count) collections: $($collections.Content.collections.name -join ', ')" -ForegroundColor Green
    }
    
    # Test 2: Create a test user
    Write-Host ""
    Write-Host "2. Creating a test user..." -ForegroundColor White
    $testUser = @{
        name = "PowerShell Test User"
        email = "pstest@example.com"
        age = 28
        department = "Automation"
    }
    
    $userResult = Invoke-ApiRequest -Method "POST" -Endpoint "/api/users" -Body $testUser
    if ($userResult.Success) {
        $userId = $userResult.Content.data._id
        Write-Host "   Created user with ID: $userId" -ForegroundColor Green
        
        # Test 3: Get the created user
        Write-Host ""
        Write-Host "3. Retrieving user by ID..." -ForegroundColor White
        $getUser = Invoke-ApiRequest -Method "GET" -Endpoint "/api/users/$userId"
        if ($getUser.Success) {
            Write-Host "   Retrieved user: $($getUser.Content.data.name)" -ForegroundColor Green
        }
        
        # Test 4: Update the user
        Write-Host ""
        Write-Host "4. Updating user..." -ForegroundColor White
        $updateData = @{
            age = 29
            department = "Updated Automation"
            lastModified = Get-Date
        }
        
        $updateResult = Invoke-ApiRequest -Method "PUT" -Endpoint "/api/users/$userId" -Body $updateData
        if ($updateResult.Success) {
            Write-Host "   Updated user age to: $($updateResult.Content.data.age)" -ForegroundColor Green
        }
        
        # Test 5: Delete the user
        Write-Host ""
        Write-Host "5. Deleting test user..." -ForegroundColor White
        $deleteResult = Invoke-ApiRequest -Method "DELETE" -Endpoint "/api/users/$userId"
        if ($deleteResult.Success) {
            Write-Host "   Deleted user: $($deleteResult.Content.data.name)" -ForegroundColor Green
        }
    }
    
    # Test 6: Test pagination
    Write-Host ""
    Write-Host "6. Testing pagination..." -ForegroundColor White
    $paginated = Invoke-ApiRequest -Method "GET" -Endpoint "/api/users?page=1`&limit=2"
    if ($paginated.Success) {
        $pagination = $paginated.Content.pagination
        Write-Host "   Page $($pagination.page) of $($pagination.pages), showing $($paginated.Content.data.Count) of $($pagination.total) total users" -ForegroundColor Green
    }
}

# Function to run management tests
function Test-Management {
    Write-Host ""
    Write-Host "🔧 Running Management API Tests..." -ForegroundColor Cyan
    Write-Host "-----------------------------" -ForegroundColor Cyan
    
    # Test 1: Create new collection
    Write-Host "1. Creating new collection 'powershell_test'..." -ForegroundColor White
    $newCollection = @{ name = "powershell_test" }
    $createResult = Invoke-ApiRequest -Method "POST" -Endpoint "/api/management/collections" -Body $newCollection
    
    if ($createResult.Success) {
        Write-Host "   ✅ Collection created successfully" -ForegroundColor Green
        
        # Test 2: Add data to new collection
        Write-Host ""
        Write-Host "2. Adding data to new collection..." -ForegroundColor White
        $testData = @{
            name = "PowerShell Test Item"
            value = 12345
            active = $true
            timestamp = Get-Date
        }
        
        $addDataResult = Invoke-ApiRequest -Method "POST" -Endpoint "/api/powershell_test" -Body $testData
        if ($addDataResult.Success) {
            $itemId = $addDataResult.Content.data._id
            Write-Host "   Created item with ID: $itemId" -ForegroundColor Green
        }
        
        # Test 3: Retrieve data from new collection
        Write-Host ""
        Write-Host "3. Retrieving data from new collection..." -ForegroundColor White
        $getData = Invoke-ApiRequest -Method "GET" -Endpoint "/api/powershell_test"
        if ($getData.Success) {
            Write-Host "   Found $($getData.Content.data.Count) items in collection" -ForegroundColor Green
        }
        
        # Test 4: Drop the test collection
        Write-Host ""
        Write-Host "4. Dropping test collection..." -ForegroundColor White
        $dropResult = Invoke-ApiRequest -Method "DELETE" -Endpoint "/api/management/collections/powershell_test"
        if ($dropResult.Success) {
            Write-Host "   ✅ Collection dropped successfully" -ForegroundColor Green
        }
    }
}

# Function to run performance tests
function Test-Performance {
    Write-Host ""
    Write-Host "⚡ Running Performance Tests..." -ForegroundColor Cyan
    Write-Host "----------------------" -ForegroundColor Cyan
    
    # Create test collection
    $testCollection = @{ name = "perf_test" }
    Invoke-ApiRequest -Method "POST" -Endpoint "/api/management/collections" -Body $testCollection | Out-Null
    
    Write-Host "1. Running concurrent requests test..." -ForegroundColor White
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    
    # Create multiple documents concurrently
    $jobs = 1..10 | ForEach-Object {
        Start-Job -ScriptBlock {
            param($ApiUrl, $Index)
            $headers = @{"Content-Type" = "application/json"}
            $testData = @{
                name = "Perf Test Item $Index"
                value = $Index * 10
                timestamp = Get-Date
            } | ConvertTo-Json
            
            try {
                Invoke-WebRequest -Uri "$ApiUrl/api/perf_test" -Method POST -Headers $headers -Body $testData -ErrorAction Stop
                return @{ Success = $true; Index = $Index }
            } catch {
                return @{ Success = $false; Index = $Index; Error = $_.Exception.Message }
            }
        } -ArgumentList $ApiUrl, $_
    }
    
    # Wait for all jobs to complete
    $results = $jobs | Receive-Job -Wait
    $jobs | Remove-Job
    
    $stopwatch.Stop()
    $successful = ($results | Where-Object { $_.Success }).Count
    
    Write-Host "   Completed $successful/10 concurrent requests in $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Green
    Write-Host "   Average: $([math]::Round($stopwatch.ElapsedMilliseconds / 10, 2))ms per request" -ForegroundColor Cyan
    
    # Cleanup
    Invoke-ApiRequest -Method "DELETE" -Endpoint "/api/management/collections/perf_test" | Out-Null
}

# Main execution
function Main {
    # Check if API is running
    if (-not (Test-ApiHealth)) {
        Write-Host ""
        Write-Host "💡 To start the API, run: docker-compose up -d" -ForegroundColor Yellow
        exit 1
    }
    
    # Run tests based on parameter
    switch ($TestType.ToLower()) {
        "basic" { Test-BasicCrud }
        "management" { Test-Management }
        "performance" { Test-Performance }
        "all" {
            Test-BasicCrud
            Test-Management
            Test-Performance
        }
        default {
            Write-Host "Usage: .\test-api.ps1 [-TestType basic|management|performance|all] [-ApiUrl http://localhost:3001]" -ForegroundColor Yellow
            exit 1
        }
    }
    
    Write-Host ""
    Write-Host "✅ Tests completed!" -ForegroundColor Green
}

# Run main function
Main

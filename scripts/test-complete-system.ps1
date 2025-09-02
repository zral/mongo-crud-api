# Complete System Test for MongoDB CRUD Application
param(
    [string]$ApiUrl = "http://localhost:3001",
    [string]$FrontendUrl = "http://localhost:3002"
)

Write-Host "`n🚀 MongoDB CRUD Complete System Test`n" -ForegroundColor Blue
Write-Host ("=" * 50) -ForegroundColor Blue

try {
    # Test 1: Check all services are running
    Write-Host "`n📍 Testing Service Availability...`n" -ForegroundColor Yellow
    
    Write-Host "1. MongoDB API Health Check..."
    $healthResponse = Invoke-RestMethod -Uri "$ApiUrl/health" -Method Get
    Write-Host "   ✓ API is healthy: $($healthResponse.status)" -ForegroundColor Green

    Write-Host "2. Frontend Availability..."
    $frontendResponse = Invoke-WebRequest -Uri $FrontendUrl -UseBasicParsing
    Write-Host "   ✓ Frontend is accessible (status: $($frontendResponse.StatusCode))" -ForegroundColor Green

    # Test 2: Test management interface functionality
    Write-Host "`n🔧 Testing Management Interface...`n" -ForegroundColor Yellow
    
    Write-Host "1. List existing collections..."
    $collectionsResponse = Invoke-RestMethod -Uri "$ApiUrl/api/management/collections" -Method Get
    Write-Host "   ✓ Found $($collectionsResponse.count) collections" -ForegroundColor Green
    foreach ($col in $collectionsResponse.collections) {
        Write-Host "     - $($col.name)" -ForegroundColor Gray
    }

    Write-Host "2. Create test collection..."
    $testCollectionName = "test_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    $createCollectionBody = @{ name = $testCollectionName } | ConvertTo-Json
    Invoke-RestMethod -Uri "$ApiUrl/api/management/collections" -Method Post -Body $createCollectionBody -ContentType "application/json" | Out-Null
    Write-Host "   ✓ Created collection: $testCollectionName" -ForegroundColor Green

    # Test 3: Test collection operations
    Write-Host "`n📊 Testing Collection Operations...`n" -ForegroundColor Yellow
    
    Write-Host "1. Add test document..."
    $testDoc = @{
        name = "Integration Test Document"
        type = "automated_test"
        timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        data = @{ test = $true; number = 42 }
    } | ConvertTo-Json -Depth 3
    
    $createResponse = Invoke-RestMethod -Uri "$ApiUrl/api/$testCollectionName" -Method Post -Body $testDoc -ContentType "application/json"
    $documentId = $createResponse.data._id
    Write-Host "   ✓ Document created with ID: $documentId" -ForegroundColor Green

    Write-Host "2. Retrieve document..."
    $getResponse = Invoke-RestMethod -Uri "$ApiUrl/api/$testCollectionName/$documentId" -Method Get
    Write-Host "   ✓ Document retrieved: $($getResponse.data.name)" -ForegroundColor Green

    Write-Host "3. Update document..."
    $updateDoc = @{
        name = "Integration Test Document"
        type = "automated_test"
        timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        data = @{ test = $true; number = 42 }
        updated = $true
        updatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    } | ConvertTo-Json -Depth 3
    
    Invoke-RestMethod -Uri "$ApiUrl/api/$testCollectionName/$documentId" -Method Put -Body $updateDoc -ContentType "application/json" | Out-Null
    Write-Host "   ✓ Document updated successfully" -ForegroundColor Green

    Write-Host "4. List documents with pagination..."
    $listResponse = Invoke-RestMethod -Uri "$ApiUrl/api/${testCollectionName}?page=1&limit=10" -Method Get
    Write-Host "   ✓ Retrieved $($listResponse.data.Count) documents" -ForegroundColor Green
    Write-Host "     Pagination: Page $($listResponse.pagination.page) of $($listResponse.pagination.pages), Total: $($listResponse.pagination.total)" -ForegroundColor Gray

    # Test 4: Cleanup
    Write-Host "`n🧹 Cleanup...`n" -ForegroundColor Yellow
    
    Write-Host "1. Delete test document..."
    Invoke-RestMethod -Uri "$ApiUrl/api/$testCollectionName/$documentId" -Method Delete | Out-Null
    Write-Host "   ✓ Document deleted" -ForegroundColor Green

    Write-Host "2. Drop test collection..."
    Invoke-RestMethod -Uri "$ApiUrl/api/management/collections/$testCollectionName" -Method Delete | Out-Null
    Write-Host "   ✓ Collection dropped" -ForegroundColor Green

    # Test summary
    Write-Host "`n✨ Complete System Test Results`n" -ForegroundColor Green
    Write-Host ("=" * 50) -ForegroundColor Green
    Write-Host "✓ All services running and healthy" -ForegroundColor Green
    Write-Host "✓ Management interface functional" -ForegroundColor Green
    Write-Host "✓ CRUD operations working" -ForegroundColor Green
    Write-Host "✓ Frontend accessible" -ForegroundColor Green
    Write-Host "✓ API endpoints responding correctly" -ForegroundColor Green
    
    Write-Host "`n🎉 System Ready for Use!`n" -ForegroundColor Blue
    Write-Host "Frontend URL: " -ForegroundColor Cyan -NoNewline
    Write-Host $FrontendUrl -ForegroundColor White
    Write-Host "API URL:      " -ForegroundColor Cyan -NoNewline  
    Write-Host $ApiUrl -ForegroundColor White
    Write-Host "MongoDB:      " -ForegroundColor Cyan -NoNewline
    Write-Host "localhost:27017" -ForegroundColor White

} catch {
    Write-Host "`n❌ Test Failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }
    exit 1
}

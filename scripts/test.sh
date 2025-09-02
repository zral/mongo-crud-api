#!/bin/bash

# MongoDB CRUD API - Test Script

echo "🧪 MongoDB CRUD API Test Script"
echo "==============================="

API_URL="http://localhost:3000"

# Function to make HTTP requests
http_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    
    if [ -n "$data" ]; then
        curl -s -X "$method" \
             -H "Content-Type: application/json" \
             -d "$data" \
             "$API_URL$endpoint"
    else
        curl -s -X "$method" "$API_URL$endpoint"
    fi
}

# Function to check if API is running
check_api() {
    echo "🔍 Checking if API is running..."
    response=$(http_request "GET" "/health")
    if echo "$response" | grep -q "healthy"; then
        echo "✅ API is running and healthy"
        return 0
    else
        echo "❌ API is not responding properly"
        echo "Response: $response"
        return 1
    fi
}

# Function to run basic tests
run_basic_tests() {
    echo ""
    echo "🚀 Running Basic Tests..."
    echo "------------------------"
    
    # Test 1: List collections
    echo "1. Listing collections..."
    response=$(http_request "GET" "/api/management/collections")
    echo "Response: $response" | head -c 200
    echo "..."
    
    # Test 2: Create a test document
    echo ""
    echo "2. Creating a test user..."
    test_user='{"name":"Test User","email":"test@example.com","age":25}'
    response=$(http_request "POST" "/api/users" "$test_user")
    user_id=$(echo "$response" | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)
    echo "Created user with ID: $user_id"
    
    # Test 3: Get the created user
    if [ -n "$user_id" ]; then
        echo ""
        echo "3. Retrieving user by ID..."
        response=$(http_request "GET" "/api/users/$user_id")
        echo "User retrieved: $(echo "$response" | grep -o '"name":"[^"]*"')"
        
        # Test 4: Update the user
        echo ""
        echo "4. Updating user..."
        update_data='{"age":26,"department":"Testing"}'
        response=$(http_request "PUT" "/api/users/$user_id" "$update_data")
        echo "User updated: $(echo "$response" | grep -o '"age":[^,]*')"
        
        # Test 5: Delete the user
        echo ""
        echo "5. Deleting test user..."
        response=$(http_request "DELETE" "/api/users/$user_id")
        echo "User deleted: $(echo "$response" | grep -o '"name":"[^"]*"')"
    fi
    
    # Test 6: Test pagination
    echo ""
    echo "6. Testing pagination..."
    response=$(http_request "GET" "/api/users?page=1&limit=2")
    echo "Pagination response: $(echo "$response" | grep -o '"pagination":{[^}]*}')"
}

# Function to run management tests
run_management_tests() {
    echo ""
    echo "🔧 Running Management Tests..."
    echo "-----------------------------"
    
    # Test 1: Create new collection
    echo "1. Creating new collection 'test_collection'..."
    response=$(http_request "POST" "/api/management/collections" '{"name":"test_collection"}')
    echo "Response: $response"
    
    # Test 2: Add data to new collection
    echo ""
    echo "2. Adding data to new collection..."
    test_data='{"name":"Test Item","value":123,"active":true}'
    response=$(http_request "POST" "/api/test_collection" "$test_data")
    item_id=$(echo "$response" | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)
    echo "Created item with ID: $item_id"
    
    # Test 3: Retrieve data from new collection
    echo ""
    echo "3. Retrieving data from new collection..."
    response=$(http_request "GET" "/api/test_collection")
    echo "Items found: $(echo "$response" | grep -o '"data":\[[^]]*\]' | wc -c)"
    
    # Test 4: Drop the test collection
    echo ""
    echo "4. Dropping test collection..."
    response=$(http_request "DELETE" "/api/management/collections/test_collection")
    echo "Response: $response"
}

# Function to run load tests
run_load_tests() {
    echo ""
    echo "⚡ Running Load Tests..."
    echo "----------------------"
    
    # Create test collection
    http_request "POST" "/api/management/collections" '{"name":"load_test"}' >/dev/null
    
    echo "1. Running concurrent requests test..."
    start_time=$(date +%s%N)
    
    # Run 10 concurrent requests
    for i in {1..10}; do
        (http_request "POST" "/api/load_test" "{\"name\":\"Load Test $i\",\"value\":$i}" >/dev/null) &
    done
    wait
    
    end_time=$(date +%s%N)
    duration=$(( (end_time - start_time) / 1000000 ))
    echo "Completed 10 concurrent requests in ${duration}ms"
    
    # Cleanup
    http_request "DELETE" "/api/management/collections/load_test" >/dev/null
}

# Main execution
main() {
    # Check if API is running
    if ! check_api; then
        echo ""
        echo "💡 To start the API, run: npm run docker:up"
        exit 1
    fi
    
    # Check command line arguments
    case "${1:-all}" in
        "basic")
            run_basic_tests
            ;;
        "management")
            run_management_tests
            ;;
        "load")
            run_load_tests
            ;;
        "all")
            run_basic_tests
            run_management_tests
            run_load_tests
            ;;
        *)
            echo "Usage: $0 [basic|management|load|all]"
            exit 1
            ;;
    esac
    
    echo ""
    echo "✅ Tests completed!"
}

# Run main function with all arguments
main "$@"

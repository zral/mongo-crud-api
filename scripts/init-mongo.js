// MongoDB initialization script
print('Initializing MongoDB database...');

// Switch to crud_api database
db = db.getSiblingDB('crud_api');

// Create sample collections with initial data
print('Creating sample collections...');

// Users collection
db.users.insertMany([
  {
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
    department: 'Engineering',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    age: 25,
    department: 'Marketing',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Bob Johnson',
    email: 'bob@example.com',
    age: 35,
    department: 'Sales',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Products collection
db.products.insertMany([
  {
    name: 'Laptop',
    price: 999.99,
    category: 'Electronics',
    inStock: true,
    description: 'High-performance laptop',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Mouse',
    price: 29.99,
    category: 'Electronics',
    inStock: true,
    description: 'Wireless mouse',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: 'Desk Chair',
    price: 199.99,
    category: 'Furniture',
    inStock: false,
    description: 'Ergonomic office chair',
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Orders collection
db.orders.insertMany([
  {
    userId: 'user1',
    products: ['laptop', 'mouse'],
    total: 1029.98,
    status: 'completed',
    orderDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    userId: 'user2',
    products: ['chair'],
    total: 199.99,
    status: 'pending',
    orderDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('Sample data inserted successfully!');
print('Collections created: users, products, orders');
print('Database initialization complete.');

/**
 * Filter utility service for parsing and building MongoDB queries
 * Provides webhook-style filtering capabilities for collections
 */

class FilterService {
  
  /**
   * Parse query parameters into MongoDB filter object
   * Supports various filter formats and operators
   */
  static parseQueryFilters(queryParams) {
    const filters = {};
    const specialParams = ['page', 'limit', 'sort', 'fields', 'search'];
    
    Object.entries(queryParams).forEach(([key, value]) => {
      if (specialParams.includes(key)) {
        return; // Skip pagination and sorting params
      }
      
      // Handle different filter formats
      if (key.startsWith('filter.')) {
        // Nested filter syntax: filter.field=value
        const filterKey = key.substring(7); // Remove 'filter.' prefix
        filters[filterKey] = this.parseFilterValue(value);
      } else if (key.includes('.')) {
        // Dot notation for nested fields: user.name=john
        filters[key] = this.parseFilterValue(value);
      } else {
        // Simple field filtering
        filters[key] = this.parseFilterValue(value);
      }
    });
    
    return filters;
  }
  
  /**
   * Parse filter value and detect operators
   */
  static parseFilterValue(value) {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Handle JSON filter syntax
    if (value.startsWith('{') && value.endsWith('}')) {
      try {
        return JSON.parse(value);
      } catch (error) {
        // If JSON parsing fails, treat as string
        return value;
      }
    }
    
    // Handle MongoDB operators in string format
    if (value.startsWith('$')) {
      try {
        return JSON.parse(value);
      } catch (error) {
        return value;
      }
    }
    
    // Handle comma-separated values as $in operator
    if (value.includes(',')) {
      const values = value.split(',').map(v => v.trim());
      return { $in: values };
    }
    
    // Handle range operators
    if (value.includes('..')) {
      const [min, max] = value.split('..').map(v => v.trim());
      const filter = {};
      if (min) filter.$gte = this.parseValue(min);
      if (max) filter.$lte = this.parseValue(max);
      return filter;
    }
    
    // Handle comparison operators
    if (value.startsWith('>=')) {
      return { $gte: this.parseValue(value.substring(2)) };
    }
    if (value.startsWith('<=')) {
      return { $lte: this.parseValue(value.substring(2)) };
    }
    if (value.startsWith('>')) {
      return { $gt: this.parseValue(value.substring(1)) };
    }
    if (value.startsWith('<')) {
      return { $lt: this.parseValue(value.substring(1)) };
    }
    if (value.startsWith('!')) {
      return { $ne: this.parseValue(value.substring(1)) };
    }
    
    // Handle regex patterns
    if (value.startsWith('/') && value.endsWith('/')) {
      const pattern = value.slice(1, -1);
      return { $regex: pattern, $options: 'i' };
    }
    
    // Handle wildcard patterns
    if (value.includes('*')) {
      const pattern = value.replace(/\*/g, '.*');
      return { $regex: `^${pattern}$`, $options: 'i' };
    }
    
    // Default: exact match with type conversion
    return this.parseValue(value);
  }
  
  /**
   * Parse string value to appropriate type
   */
  static parseValue(value) {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Boolean values
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    
    // Null value
    if (value.toLowerCase() === 'null') return null;
    
    // Number values
    if (/^-?\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^-?\d+\.\d+$/.test(value)) {
      return parseFloat(value);
    }
    
    // Date values (ISO format)
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    
    // MongoDB ObjectId
    if (/^[a-fA-F0-9]{24}$/.test(value)) {
      const { ObjectId } = require('mongodb');
      return new ObjectId(value);
    }
    
    return value;
  }
  
  /**
   * Build text search filter
   */
  static buildTextSearchFilter(searchTerm, searchFields = []) {
    if (!searchTerm || typeof searchTerm !== 'string') {
      return {};
    }
    
    const searchRegex = { $regex: searchTerm, $options: 'i' };
    
    if (searchFields.length === 0) {
      // If no specific fields, use MongoDB text search if available
      return { $text: { $search: searchTerm } };
    }
    
    // Search across specified fields
    if (searchFields.length === 1) {
      return { [searchFields[0]]: searchRegex };
    }
    
    return {
      $or: searchFields.map(field => ({
        [field]: searchRegex
      }))
    };
  }
  
  /**
   * Validate and sanitize MongoDB filter object
   */
  static validateFilter(filter) {
    if (!filter || typeof filter !== 'object') {
      return {};
    }
    
    // Remove potentially dangerous operators
    const dangerousOps = ['$where', '$eval'];
    const sanitized = JSON.parse(JSON.stringify(filter));
    
    const removeDangerous = (obj) => {
      if (Array.isArray(obj)) {
        return obj.map(removeDangerous);
      }
      
      if (obj && typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          if (dangerousOps.includes(key)) {
            delete obj[key];
          } else {
            obj[key] = removeDangerous(obj[key]);
          }
        });
      }
      
      return obj;
    };
    
    return removeDangerous(sanitized);
  }
  
  /**
   * Build comprehensive filter from query parameters
   */
  static buildCollectionFilter(queryParams) {
    const { search, fields, ...otherParams } = queryParams;
    
    let filter = this.parseQueryFilters(otherParams);
    
    // Add text search if provided
    if (search) {
      const searchFields = fields ? fields.split(',').map(f => f.trim()) : [];
      const textFilter = this.buildTextSearchFilter(search, searchFields);
      
      if (Object.keys(filter).length > 0) {
        filter = { $and: [filter, textFilter] };
      } else {
        filter = textFilter;
      }
    }
    
    return this.validateFilter(filter);
  }
  
  /**
   * Parse field selection for projection
   */
  static parseFieldSelection(fieldsParam) {
    if (!fieldsParam || typeof fieldsParam !== 'string') {
      return {};
    }
    
    const fields = fieldsParam.split(',').map(f => f.trim());
    const projection = {};
    
    fields.forEach(field => {
      if (field.startsWith('-')) {
        // Exclude field
        projection[field.substring(1)] = 0;
      } else {
        // Include field
        projection[field] = 1;
      }
    });
    
    return projection;
  }
}

module.exports = FilterService;

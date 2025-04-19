const mongoose = require("mongoose");
const db = mongoose.connection;

// Export a simple function that directly inserts into MongoDB
module.exports = {
  create: async function(userData) {
    // Wait for connection
    if (!db.readyState) {
      await new Promise(resolve => db.once('open', resolve));
    }
    // Direct insert without any Mongoose models
    return db.collection('users').insertOne(userData);
  }
};
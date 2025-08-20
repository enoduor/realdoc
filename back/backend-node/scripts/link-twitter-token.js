// scripts/link-twitter-token.js
require('dotenv').config();
const mongoose = require('mongoose');
const TwitterToken = require('../models/TwitterToken');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const orphans = await TwitterToken.find({ $or: [ { userId: null }, { userId: { $exists: false } } ] });
  console.log('Orphans:', orphans.length);
  
  if (orphans.length > 0) {
    console.log('Found orphaned Twitter tokens:');
    orphans.forEach(token => {
      console.log(`- Twitter ID: ${token.twitterUserId}, Handle: ${token.handle}, Name: ${token.name}`);
    });
    
    // Link all orphans to the main user (since we know this is the only user)
    const mainUserId = 'user_317vIukeHneALOkPCrpufgWA8DJ';
    
    console.log(`\nLinking all orphaned tokens to user: ${mainUserId}`);
    
    for (const orphan of orphans) {
      await TwitterToken.updateOne(
        { _id: orphan._id }, 
        { 
          userId: mainUserId,
          email: 'erick@oduor.net' // Add email for consistency
        }
      );
      console.log(`✅ Linked ${orphan.handle} (@${orphan.twitterUserId}) to user ${mainUserId}`);
    }
    
    console.log('\n🎉 All orphaned tokens have been linked!');
  } else {
    console.log('✅ No orphaned Twitter tokens found!');
  }
  
  await mongoose.disconnect();
})();

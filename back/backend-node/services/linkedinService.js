const axios = require('axios');

class LinkedInService {
  constructor() {
    this.apiV2 = process.env.LINKEDIN_V2_URL || 'https://api.linkedin.com/v2';
    this.apiRest = process.env.LINKEDIN_REST_URL || 'https://api.linkedin.com/rest';
    this.accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
  }

  get restHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'LinkedIn-Version': '202302', // latest stable
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json'
    };
  }

  async getOpenIdUser() {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    if (!res.ok) throw new Error(`userinfo failed: ${res.status} ${await res.text()}`);
    return res.json(); // -> { sub, name, ... }
  }

  async getAuthorUrn() {
    if (this.authorUrn) return this.authorUrn;
    const u = await this.getOpenIdUser();
    this.authorUrn = `urn:li:person:${u.sub}`;
    return this.authorUrn;
  }

  async testConnection() {
    try {
      // Get author URN using OpenID userinfo
      const author = await this.getAuthorUrn();

      // Draft probe (safe)
      const probe = await fetch(`${this.apiRest}/posts`, {
        method: 'POST',
        headers: this.restHeaders,
        body: JSON.stringify({
          author,
          commentary: 'Capability probe',
          visibility: 'PUBLIC',
          lifecycleState: 'DRAFT',
          distribution: { feedDistribution: 'MAIN_FEED' }
        })
      });

      const canPost = probe.status === 201;
      const details = canPost ? null : await safeJson(probe);

      return {
        connected: true,
        user: { id: author.split(':').pop(), authorUrn: author },
        canPost,
        permissions: canPost ? ['w_member_social (inferred)'] : [],
        details
      };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  }

  async postText(message) {
    try {
      const author = await this.getAuthorUrn();

      const res = await fetch(`${this.apiRest}/posts`, {
        method: 'POST',
        headers: this.restHeaders,
        body: JSON.stringify({
          author,
          commentary: message,
          visibility: 'PUBLIC',
          lifecycleState: 'PUBLISHED',
          distribution: { feedDistribution: 'MAIN_FEED' }
        })
      });
      
      if (res.status !== 201) {
        const errorText = await res.text();
        throw new Error(`Post failed: ${res.status} - ${errorText}`);
      }
      
      return { ok: true, id: res.headers.get('x-restli-id') };
    } catch (error) {
      throw new Error(`LinkedIn posting failed: ${error.message}`);
    }
  }

  async postWithMedia(text, mediaUrl, mediaType = 'image') {
    try {
      const author = await this.getAuthorUrn();
      
      // For media posts, we need to handle media assets differently
      // For now, let's post text with media reference
      const postData = {
        author,
        commentary: text,
        visibility: 'PUBLIC',
        lifecycleState: 'PUBLISHED',
        distribution: { feedDistribution: 'MAIN_FEED' }
      };

      const res = await fetch(`${this.apiRest}/posts`, {
        method: 'POST',
        headers: this.restHeaders,
        body: JSON.stringify(postData)
      });

      if (res.status !== 201) throw new Error(await res.text());
      
      const postUrn = res.headers.get('x-restli-id');
      
      return {
        id: postUrn,
        url: postUrn ? `https://linkedin.com/posts/${postUrn.split(':').pop()}` : 'https://linkedin.com',
        success: true,
        urn: postUrn,
        note: 'Media post created (media handling to be implemented)'
      };
    } catch (error) {
      throw new Error(`LinkedIn Media API Error: ${error.message}`);
    }
  }
}

async function safeJson(r) { 
  try { 
    return await r.json(); 
  } catch { 
    return await r.text(); 
  } 
}

module.exports = LinkedInService;

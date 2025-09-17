// frontend/src/components/PostStatusTracker.jsx
import React, { useMemo } from 'react';
import { PLATFORMS } from '../constants/platforms'; // ok if missing; we guard below

// --- helpers -------------------------------------------------------------
const toPlatformId = (p) => {
  if (!p) return '';
  if (typeof p === 'string') return p.toLowerCase();
  if (typeof p === 'object') {
    const id = p.platform || p.id || p.name || '';
    return (id || '').toString().toLowerCase();
  }
  return '';
};

const normalizePlatforms = (platforms) =>
  (platforms || []).map(toPlatformId).filter(Boolean);

const getPlatformNames = (platforms) => {
  const ids = normalizePlatforms(platforms);
  return ids.map((id) => {
    const meta = PLATFORMS?.[id.toUpperCase()];
    return meta?.name || id;
  });
};

const getPlatformIcons = (platforms) => {
  const ids = normalizePlatforms(platforms);
  return ids.map((id) => {
    const meta = PLATFORMS?.[id.toUpperCase()];
    return (
      <span key={id} className="inline-flex items-center mr-2">
        <span className="mr-1">{meta?.icon || '🔗'}</span>
        <span className="text-xs text-gray-600">{meta?.name || id}</span>
      </span>
    );
  });
};

const includesSafe = (haystackIds, value) => {
  if (!value) return false;
  const v = value.toString().toLowerCase();
  return haystackIds.some((id) => id.includes(v));
};

// --- component -----------------------------------------------------------
const PostStatusTracker = ({ posts = [], searchTerm = '' }) => {
  const term = (searchTerm || '').toLowerCase();

  const rows = useMemo(() => {
    return (posts || []).map((post) => {
      const platformIds = normalizePlatforms(post?.platforms);
      const platformNames = getPlatformNames(post?.platforms);

      const matchesSearch =
        !term ||
        includesSafe(platformIds, term) ||
        (post?.content && post.content.toString().toLowerCase().includes(term)) ||
        (post?.caption && post.caption.toString().toLowerCase().includes(term)) ||
        (post?.id && post.id.toString().toLowerCase().includes(term));

      return {
        ...post,
        _platformIds: platformIds,
        _platformNames: platformNames,
        _matchesSearch: matchesSearch,
      };
    })
    .filter((p) => p._matchesSearch);
  }, [posts, term]);

  return (
    <div className="space-y-3">
      {rows.map((post) => (
        <div key={post.id || post.timestamp} className="border rounded p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-wrap">
              {getPlatformIcons(post.platforms)}
            </div>
            <div className="text-xs text-gray-500">
              {post.timestamp && new Date(post.timestamp).toLocaleString()}
            </div>
          </div>

          {post.caption && (
            <p className="mt-2 text-sm text-gray-800">
              {post.caption}
            </p>
          )}

          {/* If you show platforms as text anywhere, use the safe join: */}
          <div className="mt-2 text-xs text-gray-600">
            Platforms: {post._platformNames.join(', ')}
          </div>

          {/* Example rendering of per-platform results safely */}
          {Array.isArray(post.platforms) && post.platforms.length > 0 && (
            <div className="mt-3 grid gap-2">
              {post.platforms.map((r, i) => {
                const pid = toPlatformId(r?.platform || r?.id);
                const name = PLATFORMS?.[pid.toUpperCase()]?.name || pid || 'platform';
                return (
                  <div key={r.postId || i} className="text-sm">
                    <span className={r.success ? 'text-green-700' : 'text-red-700'}>
                      {r.success ? '✅' : '❌'} {name}
                    </span>
                    {(r?.result?.url || r?.url) && (
                      <>
                        {' • '}
                        <a className="text-blue-600 hover:underline font-medium" href={r?.result?.url || r?.url} target="_blank" rel="noreferrer">
                          View Post →
                        </a>
                      </>
                    )}
                    {(r?.result?.message || r?.message) && <> • <span className="text-gray-600">{r?.result?.message || r?.message}</span></>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {rows.length === 0 && (
        <div className="text-sm text-gray-500">No posts to display.</div>
      )}
    </div>
  );
};

export default PostStatusTracker;

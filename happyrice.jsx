// rice-locator-app with multiple images and report/hide feature
// 管理者メール: murasek@patchworkscorp.com

// --- /pages/index.tsx ---
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, arrayUnion, serverTimestamp, arrayRemove } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import Layout from '@/components/Layout';
import dynamic from 'next/dynamic';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [user] = useAuthState(auth);
  const [categoryFilter, setCategoryFilter] = useState('すべて');
  const [newComment, setNewComment] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      const snapshot = await getDocs(collection(db, 'posts'));
      const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPosts(docs);
    };
    fetchData();
  }, []);

  const handleLike = async (postId: string) => {
    const postRef = doc(db, 'posts', postId);
    const updated = posts.map(p => p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p);
    setPosts(updated);
    await updateDoc(postRef, { likes: (updated.find(p => p.id === postId)?.likes || 1) });
  };

  const handleComment = async (postId: string) => {
    const commentText = newComment[postId]?.trim();
    if (!commentText || !user) return;
    const commentObj = `${user.email}: ${commentText}`;
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, { comments: arrayUnion(commentObj) });
    const updated = posts.map(p => p.id === postId ? { ...p, comments: [...(p.comments || []), commentObj] } : p);
    setPosts(updated);
    setNewComment({ ...newComment, [postId]: '' });
  };

  const handleDeleteComment = async (postId: string, comment: string) => {
    if (user?.email !== 'murasek@patchworkscorp.com') return;
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, { comments: arrayRemove(comment) });
    const updated = posts.map(p => p.id === postId ? { ...p, comments: (p.comments || []).filter((c) => c !== comment) } : p);
    setPosts(updated);
  };

  const handleReport = async (postId: string) => {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, { reported: true });
    const updated = posts.map(p => p.id === postId ? { ...p, reported: true } : p);
    setPosts(updated);
  };

  const filteredPosts = categoryFilter === 'すべて'
    ? posts
    : posts.filter((p) => p.category === categoryFilter);

  return (
    <Layout>
      <div className="p-4 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold mb-4">お米が買える場所</h1>
        <select
          className="border p-2 mb-4 w-full"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="すべて">すべて</option>
          <option value="無洗米">無洗米</option>
          <option value="玄米">玄米</option>
          <option value="白米">白米</option>
          <option value="その他">その他</option>
        </select>

        <ul>
          {filteredPosts.filter(p => !p.hidden).map((post) => (
            <li key={post.id} className="border p-4 mb-4 rounded">
              <p className="font-bold">店名: {post.shopName}</p>
              <p>場所: {post.location}</p>
              <p>カテゴリ: {post.category}</p>
              <p>メモ: {post.note}</p>
              <p>投稿者: {post.userEmail || '匿名'}</p>
              <p>投稿日時: {post.createdAt?.toDate?.().toLocaleString?.() || '不明'}</p>
              <p>価格: {user ? `${post.price}円` : '※価格は登録ユーザーのみ表示'}</p>
              {(post.imageUrls || []).map((url, idx) => (
                <img key={idx} src={url} className="w-full max-h-48 object-cover my-2" />
              ))}

              <div className="flex items-center justify-between mt-2">
                <button onClick={() => handleLike(post.id)} className="text-sm text-blue-500">❤️ {post.likes || 0}</button>
                {!post.reported && <button onClick={() => handleReport(post.id)} className="text-sm text-red-500">⚠️ 通報</button>}
                {user?.email === 'murasek@patchworkscorp.com' && post.reported && (
                  <span className="text-xs text-red-600">通報済み</span>
                )}
              </div>

              <div className="mt-2">
                <input
                  type="text"
                  value={newComment[post.id] || ''}
                  onChange={(e) => setNewComment({ ...newComment, [post.id]: e.target.value })}
                  className="border p-1 w-full"
                  placeholder="コメントを書く"
                />
                <button
                  onClick={() => handleComment(post.id)}
                  className="text-sm text-green-600 mt-1"
                >
                  コメント送信
                </button>
              </div>

              <ul className="mt-2">
                {(post.comments || []).map((c, idx) => (
                  <li key={idx} className="text-sm text-gray-700 border-b py-1 flex justify-between items-center">
                    <span>💬 {c}</span>
                    {user?.email === 'murasek@patchworkscorp.com' && (
                      <button onClick={() => handleDeleteComment(post.id, c)} className="text-red-500 text-xs ml-2">削除</button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="px-4">
        <Map posts={filteredPosts} />
      </div>
    </Layout>
  );
}

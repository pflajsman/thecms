import { Link } from 'react-router-dom';
import type { Post } from '../types';
import { formatDate, num } from '../lib/format';

export function PostRow({ post, index }: { post: Post; index: number }) {
  return (
    <li className="post-row">
      <Link to={`/post/${post.id}`}>
        <span className="num">{num(index)}</span>
        <span>
          <span className="title">{post.title}</span>
          <span className="excerpt">{post.excerpt}</span>
        </span>
        <span className="date">{formatDate(post.date)}</span>
      </Link>
    </li>
  );
}

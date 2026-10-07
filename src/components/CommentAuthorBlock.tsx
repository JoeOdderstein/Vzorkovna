import type { CSSProperties, ReactNode } from 'react';
import { commentAuthorHue } from '../lib/commentAuthorColor';

interface CommentAuthorBlockProps {
  username: string;
  children: ReactNode;
  className?: string;
}

export default function CommentAuthorBlock({
  username,
  children,
  className = '',
}: CommentAuthorBlockProps) {
  const style = {
    '--comment-h': String(commentAuthorHue(username)),
  } as CSSProperties;

  return (
    <div className={`tb-comment-author-block ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

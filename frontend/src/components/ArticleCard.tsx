import { Link } from 'react-router-dom';

interface Article {
  id: number;
  title: string;
  content_summary: string;
  article_type: string;
  author: string;
  page_number: number;
  year: number;
  month: number;
  issue_title: string;
}

interface ArticleCardProps {
  article: Article;
  highlightQuery?: string;
}

export default function ArticleCard({ article, highlightQuery }: ArticleCardProps) {
  const highlightText = (text: string, query?: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} style={{ background: 'yellow' }}>
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
        <Link
          to={`/articles/${article.id}`}
          style={{
            textDecoration: 'none',
            color: 'var(--primary-color)',
            fontSize: '1.25rem',
            fontWeight: '600',
          }}
        >
          {highlightText(article.title || '제목 없음', highlightQuery)}
        </Link>
        <span
          style={{
            background: 'var(--bg-color)',
            padding: '0.25rem 0.75rem',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
          }}
        >
          {article.article_type || '기타'}
        </span>
      </div>
      <p style={{ color: 'var(--secondary-color)', marginBottom: '0.5rem' }}>
        {highlightText(article.content_summary || '', highlightQuery)}
      </p>
      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--secondary-color)' }}>
        <span>{article.year}년 {article.month}월호</span>
        <span>페이지 {article.page_number}</span>
        {article.author && <span>작성자: {article.author}</span>}
      </div>
    </div>
  );
}


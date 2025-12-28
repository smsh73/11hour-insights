import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import ArticleCard from '../../components/ArticleCard';
import { ARTICLE_TYPES } from '../../utils/constants';

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

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedMonth, setSelectedMonth] = useState<number | ''>('');

  const { data: articles, isLoading } = useQuery<Article[]>({
    queryKey: ['search-articles', searchQuery, selectedType, selectedYear, selectedMonth],
    queryFn: async () => {
      const params: any = {};
      if (searchQuery) params.q = searchQuery;
      if (selectedType) params.type = selectedType;
      if (selectedYear) params.year = selectedYear;
      if (selectedMonth) params.month = selectedMonth;

      const response = await api.get('/articles/search', { params });
      return response.data;
    },
    enabled: searchQuery.length > 0 || !!selectedType || !!selectedYear || !!selectedMonth,
  });


  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>기사 검색</h1>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label className="label">검색어</label>
          <input
            type="text"
            className="input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목, 내용으로 검색..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label className="label">기사 유형</label>
            <select
              className="input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">전체</option>
              {ARTICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">연도</label>
            <input
              type="number"
              className="input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="2025"
              min="2020"
              max="2025"
            />
          </div>

          <div>
            <label className="label">월</label>
            <input
              type="number"
              className="input"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : '')}
              placeholder="1-12"
              min="1"
              max="12"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">검색 중...</div>
      ) : articles && articles.length > 0 ? (
        <div>
          <p style={{ marginBottom: '1rem', color: 'var(--secondary-color)' }}>
            {articles.length}개의 결과를 찾았습니다.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                highlightQuery={searchQuery}
              />
            ))}
          </div>
        </div>
      ) : searchQuery || selectedType || selectedYear || selectedMonth ? (
        <div className="card">
          <p>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="card">
          <p>검색어를 입력하거나 필터를 선택해주세요.</p>
        </div>
      )}
    </div>
  );
}


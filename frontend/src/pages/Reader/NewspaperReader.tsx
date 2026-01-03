import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import NewspaperViewer from '../../components/NewspaperViewer';
import { API_BASE_URL } from '../../utils/constants';
import { useState } from 'react';

interface Issue {
  id: number;
  year: number;
  month: number;
  title: string;
  image_count: number;
}

interface Image {
  id: number;
  image_url: string;
  local_path: string;
  page_number: number;
  file_name: string;
}

export default function NewspaperReader() {
  const { issueId } = useParams<{ issueId?: string }>();
  const [currentPage, setCurrentPage] = useState(0);

  const { data: issues } = useQuery<Issue[]>({
    queryKey: ['issues'],
    queryFn: async () => {
      const response = await api.get('/issues?year=2025');
      return response.data;
    },
  });

  const selectedIssueId = issueId ? parseInt(issueId) : issues?.[0]?.id;

  const { data: images, isLoading } = useQuery<Image[]>({
    queryKey: ['issue-images', selectedIssueId],
    queryFn: async () => {
      if (!selectedIssueId) return [];
      const response = await api.get(`/issues/${selectedIssueId}/images`);
      return response.data;
    },
    enabled: !!selectedIssueId,
  });

  const selectedIssue = issues?.find((i) => i.id === selectedIssueId);
  const currentImage = images?.[currentPage];

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (!selectedIssue || !images || images.length === 0) {
    return (
      <div>
        <h1>신문 보기</h1>
        <div className="card">
          <p>표시할 신문이 없습니다.</p>
        </div>
      </div>
    );
  }

  // Use API_BASE_URL from constants, but remove /api suffix for image URLs
  // Azure 환경: https://11hour-backend.azurewebsites.net
  const apiBaseUrl = API_BASE_URL.replace(/\/api$/, '') || 'https://11hour-backend.azurewebsites.net';
  const imageUrl = currentImage?.local_path
    ? `${apiBaseUrl}${currentImage.local_path.replace(/^\./, '')}`
    : currentImage?.image_url || '';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>{selectedIssue.year}년 {selectedIssue.month}월호</h1>
        <select
          className="input"
          value={selectedIssueId}
          onChange={(e) => {
            window.location.href = `/reader/${e.target.value}`;
            setCurrentPage(0);
          }}
          style={{ width: '200px' }}
        >
          {issues?.map((issue) => (
            <option key={issue.id} value={issue.id}>
              {issue.year}년 {issue.month}월호
            </option>
          ))}
        </select>
      </div>

      <NewspaperViewer
        imageUrl={imageUrl}
        pageNumber={currentPage + 1}
        totalPages={images.length}
        hasPrev={currentPage > 0}
        hasNext={currentPage < images.length - 1}
        onPrev={() => setCurrentPage((p) => Math.max(0, p - 1))}
        onNext={() => setCurrentPage((p) => Math.min(images.length - 1, p + 1))}
      />

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {images.map((image, index) => (
          <button
            key={image.id}
            className="btn"
            onClick={() => setCurrentPage(index)}
            style={{
              background: currentPage === index ? 'var(--primary-color)' : 'var(--border-color)',
              color: currentPage === index ? 'white' : 'var(--text-color)',
            }}
          >
            {index + 1}
          </button>
        ))}
      </div>
    </div>
  );
}


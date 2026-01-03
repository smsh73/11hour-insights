import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import NewspaperViewer from '../../components/NewspaperViewer';
import { API_BASE_URL } from '../../utils/constants';
import { useState, useMemo } from 'react';

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

  const { data: images, isLoading, error: imagesError } = useQuery<Image[]>({
    queryKey: ['issue-images', selectedIssueId],
    queryFn: async () => {
      if (!selectedIssueId) {
        console.warn('[NewspaperReader] No selected issue ID');
        return [];
      }
      console.log('[NewspaperReader] Fetching images for issue:', selectedIssueId);
      try {
        const response = await api.get(`/issues/${selectedIssueId}/images`);
        console.log('[NewspaperReader] Images fetched:', {
          count: response.data?.length || 0,
          images: response.data,
        });
        return response.data || [];
      } catch (error) {
        console.error('[NewspaperReader] Failed to fetch images:', error);
        throw error;
      }
    },
    enabled: !!selectedIssueId,
    retry: 2,
  });

  const selectedIssue = issues?.find((i) => i.id === selectedIssueId);
  const currentImage = images?.[currentPage];

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (imagesError) {
    return (
      <div>
        <h1>신문 보기</h1>
        <div className="card" style={{ color: 'var(--danger-color)' }}>
          <h3>이미지를 불러오는 중 오류가 발생했습니다</h3>
          <p>{imagesError instanceof Error ? imagesError.message : '알 수 없는 오류'}</p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  if (!selectedIssue || !images || images.length === 0) {
    return (
      <div>
        <h1>신문 보기</h1>
        <div className="card">
          <p>표시할 신문이 없습니다.</p>
          {selectedIssueId && (
            <p style={{ fontSize: '0.875rem', color: 'var(--secondary-color)', marginTop: '0.5rem' }}>
              Issue ID: {selectedIssueId}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 이미지 URL 생성: /api/images/:id 엔드포인트 사용
  // local_path가 있으면 API 엔드포인트 사용, 없으면 원본 image_url 사용
  const imageUrl = useMemo(() => {
    if (!currentImage) {
      console.warn('[NewspaperReader] No current image');
      return '';
    }
    
    let url = '';
    if (currentImage.local_path) {
      url = `${API_BASE_URL}/images/${currentImage.id}`;
      console.log('[NewspaperReader] Using API endpoint for image:', {
        id: currentImage.id,
        local_path: currentImage.local_path,
        url,
      });
    } else if (currentImage.image_url) {
      url = currentImage.image_url;
      console.log('[NewspaperReader] Using original image_url:', {
        id: currentImage.id,
        image_url: currentImage.image_url,
        url,
      });
    } else {
      console.error('[NewspaperReader] No image path or URL available:', currentImage);
    }
    
    return url;
  }, [currentImage, API_BASE_URL]);

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


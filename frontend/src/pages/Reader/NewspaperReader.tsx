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
      console.log('[NewspaperReader] ===== Fetching Images =====');
      console.log('[NewspaperReader] Issue ID:', selectedIssueId);
      console.log('[NewspaperReader] API URL:', `${API_BASE_URL}/issues/${selectedIssueId}/images`);
      try {
        const response = await api.get(`/issues/${selectedIssueId}/images`);
        console.log('[NewspaperReader] API Response:', {
          status: response.status,
          dataLength: response.data?.length || 0,
        });
        console.log('[NewspaperReader] Images data:', response.data);
        
        // 각 이미지의 상세 정보 로깅
        if (response.data && Array.isArray(response.data)) {
          response.data.forEach((img: Image, index: number) => {
            console.log(`[NewspaperReader] Image ${index + 1}:`, {
              id: img.id,
              issue_id: (img as any).issue_id,
              local_path: img.local_path,
              image_url: img.image_url,
              file_name: img.file_name,
              page_number: img.page_number,
              has_local_path: !!img.local_path && img.local_path.trim() !== '',
              has_image_url: !!img.image_url && img.image_url.trim() !== '',
            });
          });
        }
        
        console.log('[NewspaperReader] ===== Images Fetched =====');
        return response.data || [];
      } catch (error) {
        console.error('[NewspaperReader] ===== Fetch Images Error =====');
        console.error('[NewspaperReader] Error:', error);
        console.error('[NewspaperReader] ===== Fetch Images Error End =====');
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
    
    console.log('[NewspaperReader] ===== Image URL Generation =====');
    console.log('[NewspaperReader] Current image data:', {
      id: currentImage.id,
      local_path: currentImage.local_path,
      image_url: currentImage.image_url,
      file_name: currentImage.file_name,
      page_number: currentImage.page_number,
    });
    console.log('[NewspaperReader] API_BASE_URL:', API_BASE_URL);
    
    let url = '';
    
    // Strategy 1: local_path가 있으면 API 엔드포인트 사용
    if (currentImage.local_path && currentImage.local_path.trim() !== '') {
      url = `${API_BASE_URL}/images/${currentImage.id}`;
      console.log('[NewspaperReader] Strategy 1: Using API endpoint');
      console.log('[NewspaperReader] Generated URL:', url);
      console.log('[NewspaperReader] Full URL breakdown:', {
        base: API_BASE_URL,
        path: '/images',
        id: currentImage.id,
        final: url,
      });
    } 
    // Strategy 2: image_url이 있으면 원본 URL 사용
    else if (currentImage.image_url && currentImage.image_url.trim() !== '') {
      url = currentImage.image_url;
      console.log('[NewspaperReader] Strategy 2: Using original image_url');
      console.log('[NewspaperReader] Using URL:', url);
    } 
    // Strategy 3: 둘 다 없으면 에러
    else {
      console.error('[NewspaperReader] Strategy 3: No image source available');
      console.error('[NewspaperReader] Image data:', currentImage);
      url = '';
    }
    
    console.log('[NewspaperReader] Final image URL:', url);
    console.log('[NewspaperReader] ===== Image URL Generation End =====');
    
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


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { useState } from 'react';

interface Issue {
  id: number;
  year: number;
  month: number;
  board_id: number;
  url: string;
  title: string;
  published_date: string;
  image_count: number;
  status: string;
}

export default function Issues() {
  const queryClient = useQueryClient();
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  const { data: issues, isLoading } = useQuery<Issue[]>({
    queryKey: ['issues'],
    queryFn: async () => {
      const response = await api.get('/issues?year=2025');
      return response.data;
    },
    refetchInterval: (query) => {
      // If any issue is processing, refetch every 3 seconds
      const data = query.state.data;
      if (data?.some(issue => issue.status === 'processing')) {
        return 3000;
      }
      return false;
    },
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      console.log('[Init] Starting 2025 initialization');
      try {
        const response = await api.post('/admin/init-2025');
        console.log('[Init] Initialization successful:', response.data);
        return response.data;
      } catch (error: any) {
        console.error('[Init] Initialization failed:', {
          error,
          response: error.response?.data,
          status: error.response?.status,
          message: error.message,
        });
        throw error;
      }
    },
    onSuccess: () => {
      console.log('[Init] Invalidating issues query');
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
    onError: (error: any) => {
      console.error('[Init] Error handler:', error);
      const errorMessage = error.response?.data?.error 
        || error.message 
        || '알 수 없는 오류가 발생했습니다';
      alert(`초기화 실패: ${errorMessage}`);
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (issueId: number) => {
      console.log('Starting extraction for issue:', issueId);
      try {
        const response = await api.post(`/issues/${issueId}/extract`);
        console.log('Extraction started successfully:', response.data);
        return response.data;
      } catch (error: any) {
        console.error('Extraction API call failed:', {
          issueId,
          error,
          response: error.response?.data,
          status: error.response?.status,
          message: error.message,
        });
        throw error;
      }
    },
    onSuccess: (_, issueId) => {
      console.log('Extraction mutation success for issue:', issueId);
      // Immediately update the issue status to processing
      queryClient.setQueryData<Issue[]>(['issues'], (old) => {
        if (!old) return old;
        return old.map(issue => 
          issue.id === issueId 
            ? { ...issue, status: 'processing' }
            : issue
        );
      });
      // Then refetch to get accurate data
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      // Also start polling for progress
      if (selectedIssue?.id === issueId) {
        queryClient.invalidateQueries({ queryKey: ['extraction-progress', issueId] });
      }
    },
    onError: (error: any) => {
      console.error('Extraction start failed:', error);
      const errorMessage = error.response?.data?.error 
        || error.message 
        || '알 수 없는 오류가 발생했습니다';
      const statusCode = error.response?.status;
      
      let userMessage = `추출 시작에 실패했습니다: ${errorMessage}`;
      if (statusCode === 401) {
        userMessage = '인증이 필요합니다. 다시 로그인해주세요.';
      } else if (statusCode === 403) {
        userMessage = '권한이 없습니다. 관리자 권한이 필요합니다.';
      } else if (statusCode === 404) {
        userMessage = '호수를 찾을 수 없습니다.';
      } else if (statusCode === 500) {
        userMessage = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }
      
      alert(userMessage);
    },
  });

  const { data: progress } = useQuery<{
    status: string;
    progress: number;
    totalItems: number;
    processedItems: number;
    errorMessage?: string;
  }>({
    queryKey: ['extraction-progress', selectedIssue?.id],
    queryFn: async () => {
      if (!selectedIssue) return null;
      const response = await api.get(`/issues/${selectedIssue.id}/progress`);
      return response.data;
    },
    enabled: !!selectedIssue,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000;
    },
  });

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'var(--success-color)';
      case 'processing':
        return 'var(--warning-color)';
      case 'failed':
        return 'var(--danger-color)';
      default:
        return 'var(--secondary-color)';
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>신문 호수 관리</h1>
        <button
          className="btn btn-primary"
          onClick={() => initMutation.mutate()}
          disabled={initMutation.isPending}
        >
          {initMutation.isPending ? '초기화 중...' : '2025년 호수 초기화'}
        </button>
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>연도</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>월</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>이미지 수</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>상태</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {issues?.map((issue) => (
              <tr
                key={issue.id}
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  backgroundColor: selectedIssue?.id === issue.id ? 'var(--bg-color)' : 'transparent',
                }}
                onClick={() => setSelectedIssue(issue)}
              >
                <td style={{ padding: '0.75rem' }}>{issue.year}</td>
                <td style={{ padding: '0.75rem' }}>{issue.month}월</td>
                <td style={{ padding: '0.75rem' }}>{issue.image_count}</td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{ color: getStatusColor(issue.status) }}>
                    {issue.status}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Extract button clicked for issue:', issue.id, 'Status:', issue.status);
                      if (issue.status === 'processing') {
                        alert('이미 추출이 진행 중입니다.');
                        return;
                      }
                      extractMutation.mutate(issue.id);
                    }}
                    disabled={extractMutation.isPending || issue.status === 'processing' || issue.status === 'completed'}
                  >
                    {extractMutation.isPending ? '시작 중...' : issue.status === 'processing' ? '진행 중' : '추출 시작'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedIssue && progress && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h3>추출 진행 상황: {selectedIssue.year}년 {selectedIssue.month}월호</h3>
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>상태: {progress.status}</span>
              <span>
                {progress.processedItems} / {progress.totalItems}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: '20px',
                background: 'var(--border-color)',
                borderRadius: '10px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress.totalItems > 0 ? (progress.processedItems / progress.totalItems) * 100 : 0}%`,
                  height: '100%',
                  background: 'var(--primary-color)',
                  transition: 'width 0.3s',
                }}
              />
            </div>
            {progress.errorMessage && (
              <div className="error" style={{ marginTop: '0.5rem' }}>
                {progress.errorMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


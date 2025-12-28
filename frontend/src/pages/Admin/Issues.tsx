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
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/init-2025');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    },
  });

  const extractMutation = useMutation({
    mutationFn: async (issueId: number) => {
      await api.post(`/issues/${issueId}/extract`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues'] });
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
                      extractMutation.mutate(issue.id);
                    }}
                    disabled={extractMutation.isPending || issue.status === 'processing'}
                  >
                    추출 시작
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


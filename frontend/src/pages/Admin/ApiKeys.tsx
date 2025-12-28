import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

interface ApiKey {
  id: number;
  provider: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ApiKeys() {
  const queryClient = useQueryClient();
  const [editingKey, setEditingKey] = useState<{ provider: string; api_key: string } | null>(null);

  const { data: apiKeys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const response = await api.get('/api-keys');
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ provider, api_key, is_active }: { provider: string; api_key: string; is_active: boolean }) => {
      await api.put(`/api-keys/${provider}`, { api_key, is_active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setEditingKey(null);
    },
  });

  const handleEdit = (provider: string) => {
    setEditingKey({ provider, api_key: '' });
  };

  const handleSave = (provider: string, isActive: boolean) => {
    if (editingKey && editingKey.api_key) {
      updateMutation.mutate({
        provider,
        api_key: editingKey.api_key,
        is_active: isActive,
      });
    }
  };

  const providers = ['openai', 'gemini', 'anthropic'];

  if (isLoading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: '2rem' }}>API 키 관리</h1>

      <div className="card">
        <p style={{ marginBottom: '1rem', color: 'var(--secondary-color)' }}>
          AI 서비스 API 키를 등록하세요. 최소 하나의 API 키가 필요합니다.
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>제공자</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>상태</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => {
              const existingKey = apiKeys?.find((k) => k.provider === provider);
              const isEditing = editingKey?.provider === provider;

              return (
                <tr key={provider} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>
                    {provider}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {existingKey?.is_active ? (
                      <span style={{ color: 'var(--success-color)' }}>활성</span>
                    ) : (
                      <span style={{ color: 'var(--secondary-color)' }}>비활성</span>
                    )}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="password"
                          className="input"
                          placeholder="API 키 입력"
                          value={editingKey.api_key}
                          onChange={(e) =>
                            setEditingKey({ ...editingKey, api_key: e.target.value })
                          }
                          style={{ width: '300px' }}
                        />
                        <button
                          className="btn btn-primary"
                          onClick={() => handleSave(provider, true)}
                          disabled={!editingKey.api_key}
                        >
                          저장
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => setEditingKey(null)}
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleEdit(provider)}
                      >
                        {existingKey ? '수정' : '등록'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

